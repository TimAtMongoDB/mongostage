# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # compile TypeScript → dist/, make dist/index.js executable
npm run typecheck    # type-check without emitting files
npm run test         # run all tests (unit + integration) with Vitest
npm run test:unit    # unit tests only
npx vitest run tests/unit/some.test.ts  # run a single test file
```

Integration tests require a real Docker daemon and are skipped by default.

## Architecture

MongoStage is a CLI/TUI tool that spawns MongoDB-branded Docker containers. It is published as the `mongostage` npm package with a single bin entry (`dist/index.js`).

### Layer Separation

**Entry point** (`src/index.ts`) — Commander.js program. When called with no args, renders the TUI (React + Ink). With args, routes to command handlers. Global `unhandledRejection`/`uncaughtException` handlers live here.

**Commands** (`src/commands/`) — One file per CLI subcommand. Each exports a single function (e.g. `connectCommand()`). Commands are **lazy-loaded** via dynamic `import()` inside Commander action handlers to keep TUI startup fast.

**Library** (`src/lib/`) — Pure business logic with no UI imports:
- `docker.ts` — Dockerode wrapper; image pull, container run, streaming, state detection
- `containers.ts` — Label-based container discovery (`mongostage=true`, `mongostage-slug={slug}`)
- `config.ts` — Loads `images.json` registry and `~/.mongostage/config.json`; resolves short slugs to full image tags
- `os.ts` — Platform detection (Linux, WSL2, macOS, Windows native)
- `install.ts` — Docker installation; scripts downloaded only from an allowlisted URL set
- `build.ts` — Stitches component Dockerfiles together via `# Component fragment body` markers

**TUI** (`src/tui/`) — React + Ink components. Two main pages: Images (browse/launch) and Containers (manage running containers). `App.tsx` owns page state; Tab switches pages, Escape exits.

**Data** (`images.json`) — Registry of pre-built images and composable components. Categories: `base`, `shell`, `runtime`, `ai`, `server`. Loaded at startup; committed changes required before publish.

### Key Conventions

**Container identity** — All managed containers carry labels `mongostage=true` and `mongostage-slug={slug}`. Name pattern: `mongostage-{slug}`. Discovery always filters by these labels so unrelated containers are never touched.

**Image resolution** — Short slugs (`node-shell`) resolve to `timatmongodb/mongostage:node-shell`. Strings containing `/` and `:` pass through unchanged.

**User config** — Stored at `~/.mongostage/config.json` (overridable via `$MONGOSTAGE_CONFIG_DIR`). Tracks `setupComplete`, `os`, `dockerMethod`, `defaultOrg`. Created/repaired by the `setup` command.

**Env injection** — User credentials live in `~/.mongostage/.env` (mode 0600). Special keys: `MONGO_MOUNT` (host bind-mount path), `MONGO_WORKDIR` (container working dir). WSL2 rejects Windows-style paths (`C:\...`).

**Docker installation strategy** — Linux/WSL2: rootless Docker via `get.docker.com/rootless`. macOS: Colima + Docker via Homebrew. Windows: Docker Desktop via `winget`. State machine: `running` → `not-running` → `not-installed`.

**Publishing** — `publishCommand()` bumps version, verifies `MONGODB_NPM_TOKEN`, checks `images.json` is committed and version doesn't already exist on npm, then runs `npm publish`. Build is triggered as part of publish.

**Testing** — Vitest, mock-heavy. Dynamic imports in test files allow `vi.mock()` to intercept modules before they load. Integration tests in `tests/integration/` are skipped unless Docker is available.
