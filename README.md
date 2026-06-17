# mongo-docker

MongoDB-branded Docker environments for demos, workshops, and content creation. Comes with a full terminal UI and CLI for managing containers across Linux, macOS, and Windows (WSL2).

## Requirements

- **Node.js** >= 22
- **Docker** — not required upfront; `mongo-docker setup` installs it

## Install

```bash
npm install -g @timatmongodb/mongo-docker
```

## Quick start

```bash
mongo-docker setup     # install Docker (first time only)
mongo-docker           # open the interactive TUI
mongo-docker connect   # connect to a container from the CLI
```

---

## Interactive TUI

Running `mongo-docker` with no arguments opens an interactive terminal UI. Two pages, navigated with `Tab`:

- **Images** — Browse available images, filter by category (`← →`), search by typing, launch with `Enter`
- **Containers** — View running and stopped containers, stop/start/remove/shell in from a menu

---

## Available images

| Tag | Components | Category | Description |
|-----|------------|----------|-------------|
| `base` | base | base | Ubuntu 24.04 LTS with MongoDB-branded terminal |
| `shell` | base, shell | shell | base + mongosh, mongoimport, mongoexport, mongodump |
| `server-shell` | base, server, shell | server | MongoDB Community Server 8.0 + full shell tooling |
| `node-shell` | base, shell, node | runtime | Node.js 22 LTS + mongosh + shell tools |
| `node-shell-claude` | base, shell, node, claude | ai | Node.js 22 LTS + mongosh + Claude Code CLI |
| `python-shell` | base, shell, python | runtime | Python 3.12 + mongosh + shell tools |
| `python-shell-claude` | base, shell, python, claude | ai | Python 3.12 + mongosh + Claude Code CLI |
| `node-shell-grok` | base, shell, node, grok | ai | Node.js 22 LTS + mongosh + Grok Build CLI |

All images run as a non-root `mongo` user and include a Starship prompt.

Use the short tag with any command — `node-shell-claude` not the full `timatmongodb/mongo-docker:node-shell-claude`.

---

## Commands

### `mongo-docker connect [image]`

Pull and attach to a MongoDB environment. Creates a new container or reattaches to an existing one.

```bash
mongo-docker connect                     # pick image interactively
mongo-docker connect node-shell-claude   # connect directly
mongo-docker connect node-shell --fresh  # remove any existing container first
mongo-docker connect node-shell --name my-env  # custom container name
```

Options:

| Flag | Description |
|------|-------------|
| `--image <tag>` | Image slug (alternative to positional arg) |
| `--fresh` | Remove existing container before creating a new one |
| `--name <name>` | Custom container name |

---

### `mongo-docker list`

List all available images from the registry.

```bash
mongo-docker list                   # all images
mongo-docker list --filter ai       # only AI images
mongo-docker list --filter runtime  # Node + Python images
```

Categories: `base`, `shell`, `server`, `runtime`, `ai`

---

### `mongo-docker env`

Manage credentials that get injected as environment variables into every container. Stored at `~/.mongo-docker/.env`.

```bash
mongo-docker env set ANTHROPIC_API_KEY=sk-ant-...   # add or overwrite a key
mongo-docker env list                                # list all keys (values masked)
mongo-docker env remove ANTHROPIC_API_KEY            # remove one key
mongo-docker env clear                               # remove all keys (prompts first)
```

**Key format:** must match `/^[A-Z_][A-Z0-9_]*$/i` — letters, digits, underscores only. Values cannot contain newlines.

---

### `mongo-docker setup`

Install Docker on this machine. Safe to re-run; detects if Docker is already running.

```bash
mongo-docker setup
```

What it does per platform:

| Platform | Method |
|----------|--------|
| Linux / WSL2 | Rootless Docker via get.docker.com, falls back to system install |
| macOS | Installs Colima + Docker via Homebrew |
| Windows (native) | Installs Docker Desktop via winget |

> **macOS:** Homebrew must be installed before running `mongo-docker setup`. Get it at https://brew.sh

---

### `mongo-docker status`

Show all mongo-docker containers and disk usage.

```bash
mongo-docker status
```

---

### `mongo-docker start [image]`

Start a stopped container.

```bash
mongo-docker start                  # pick from stopped containers
mongo-docker start node-shell       # start by slug
mongo-docker start node-shell --attach  # start and attach to bash
```

---

### `mongo-docker stop [image]`

Stop a running container.

```bash
mongo-docker stop                   # pick from running containers
mongo-docker stop node-shell        # stop by slug
mongo-docker stop --all             # stop all running mongo-docker containers
```

---

### `mongo-docker run [image]`

Run a container in detached mode (background). Useful for dev servers and CI.

```bash
mongo-docker run node-shell
mongo-docker run server-shell --port 27017:27017
mongo-docker run node-shell --mount ~/myproject
mongo-docker run node-shell --env /path/to/custom.env
```

Options:

| Flag | Description |
|------|-------------|
| `--port <mapping>` | Port mapping, e.g. `27017:27017` |
| `--mount <path>` | Mount a host directory at `/home/mongo/myproject` |
| `--env <file>` | Load env vars from a specific file instead of `~/.mongo-docker/.env` |

---

### `mongo-docker remove [image]`

Remove a container.

```bash
mongo-docker remove                     # pick from stopped containers
mongo-docker remove node-shell          # remove by slug
mongo-docker remove node-shell --force  # stop and remove even if running
mongo-docker remove --all               # remove all stopped containers
```

---

### `mongo-docker clean`

Remove all stopped mongo-docker containers at once.

```bash
mongo-docker clean             # remove stopped containers (prompts first)
mongo-docker clean --force     # remove all, running or not
mongo-docker clean --images    # also remove pulled Docker images
```

---

## Global flags

All commands accept:

| Flag | Description |
|------|-------------|
| `--verbose` | Print extra output |
| `--silent` | Suppress all non-error output |
| `--version` | Print version and exit |
| `--help` | Print help for a command |

---

## Configuration files

### `~/.mongo-docker/.env` — credentials

Env vars injected into every container at connect/run time. Managed via `mongo-docker env`.

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
MONGO_MOUNT=~/myproject
MONGO_WORKDIR=/home/mongo/myproject
```

**Special keys:**

| Key | Effect |
|-----|--------|
| `MONGO_MOUNT` | Host directory to bind-mount into the container |
| `MONGO_WORKDIR` | Working directory inside the container (default `/home/mongo/demo`) |

> **WSL2 users:** `MONGO_MOUNT` must be a WSL2-style path like `~/myproject` or `/home/you/project`. Windows paths like `C:\Users\...` are not supported and will be rejected at connect time.

File permissions are set to `0600` (owner read/write only).

### `~/.mongo-docker/config.json` — CLI state

Auto-created and updated by `mongo-docker setup`. You do not normally edit this file by hand.

```json
{
  "setupComplete": true,
  "os": "linux",
  "dockerMethod": "engine",
  "defaultOrg": "timatmongodb",
  "lastUpdated": "2026-06-17T..."
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `setupComplete` | `true`/`false` | Whether setup has been run |
| `os` | `linux`, `mac`, `windows` | Detected OS |
| `dockerMethod` | `engine`, `colima` | How Docker is installed |
| `defaultOrg` | string | Docker Hub org prefix for images |

The config directory can be overridden with the `MONGO_DOCKER_CONFIG_DIR` environment variable.

---

## Platform notes

**macOS** — Homebrew is required before running `mongo-docker setup`. Docker runs via [Colima](https://github.com/abiosoft/colima), a lightweight VM. The setup command installs both automatically once Homebrew is present.

**WSL2** — Runs as Linux. `MONGO_MOUNT` in `~/.mongo-docker/.env` must be a WSL2 path (e.g. `~/project`), not a Windows path (`C:\Users\...`). mongo-docker will reject Windows paths with a clear error.

**Windows native** — Docker Desktop is installed via winget. A machine restart may be required before Docker is usable.

---

## License

Apache 2.0
