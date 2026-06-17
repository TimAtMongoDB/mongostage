#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { Command } from 'commander';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export function createProgram(): Command {
  const program = new Command();

  program
    .name('mongostage')
    .description('Spawn a MongoDB stage for demos, workshops, and content creation')
    .version('1.0.0')
    .allowUnknownOption(false)
    .option('--verbose', 'enable verbose output')
    .option('--silent', 'suppress all non-error output');

  program
    .command('connect [image]')
    .description('Pull and attach to a MongoDB environment')
    .option('--image <tag>', 'image slug or full tag (alternative to positional arg)')
    .option('--fresh', 'remove existing container before creating a new one')
    .option('--name <name>', 'custom container name')
    .action(async (image: string | undefined, opts: { image?: string; fresh?: boolean; name?: string }) => {
      const { connectCommand } = await import('./commands/connect.js');
      await connectCommand(image, opts);
    });

  program
    .command('list')
    .description('List available MongoDB Docker images')
    .option('--filter <category>', 'filter by category (base, shell, runtime, ai, server)')
    .option('--all', 'show all images (default)')
    .action(async (opts: { filter?: string; all?: boolean }) => {
      const { listCommand } = await import('./commands/list.js');
      await listCommand(opts);
    });

  const env = program
    .command('env')
    .description('Manage environment credentials for containers');

  env
    .command('set <entry>')
    .description('Set a credential (KEY=VALUE format)')
    .action(async (entry: string) => {
      const { envSetCommand } = await import('./commands/env.js');
      await envSetCommand(entry);
    });

  env
    .command('list')
    .description('List all stored credential keys (values masked)')
    .action(async () => {
      const { envListCommand } = await import('./commands/env.js');
      await envListCommand();
    });

  env
    .command('remove <key>')
    .description('Remove a stored credential key')
    .action(async (key: string) => {
      const { envRemoveCommand } = await import('./commands/env.js');
      await envRemoveCommand(key);
    });

  env
    .command('clear')
    .description('Remove all stored credentials (with confirmation)')
    .action(async () => {
      const { envClearCommand } = await import('./commands/env.js');
      await envClearCommand();
    });

  program
    .command('setup')
    .description('Install Docker on this machine (first-time setup)')
    .action(async () => {
      const { setupCommand } = await import('./commands/setup.js');
      await setupCommand();
    });

  program
    .command('stop [image]')
    .description('Stop a running container')
    .option('--image <slug>', 'container slug to stop (alternative to positional arg)')
    .option('--all', 'stop all running mongostage containers')
    .action(async (image: string | undefined, opts: { image?: string; all?: boolean }) => {
      const { stopCommand } = await import('./commands/stop.js');
      await stopCommand(image, opts);
    });

  program
    .command('start [image]')
    .description('Start a stopped container')
    .option('--image <slug>', 'container slug to start (alternative to positional arg)')
    .option('--attach', 'attach to bash after starting')
    .action(async (image: string | undefined, opts: { image?: string; attach?: boolean }) => {
      const { startCommand } = await import('./commands/start.js');
      await startCommand(image, opts);
    });

  program
    .command('run [image]')
    .description('Run a container in detached mode')
    .option('--image <slug>', 'image slug to run (alternative to positional arg)')
    .option('--port <mapping>', 'port mapping e.g. 27017:27017')
    .option('--env <file>', 'environment file to load')
    .option('--mount <path>', 'host path to mount at ~/demo')
    .action(async (image: string | undefined, opts: { image?: string; port?: string; env?: string; mount?: string }) => {
      const { runCommand } = await import('./commands/run.js');
      await runCommand(image, opts);
    });

  program
    .command('remove [image]')
    .description('Remove a container')
    .option('--image <slug>', 'container slug to remove (alternative to positional arg)')
    .option('--force', 'stop and remove even if running')
    .option('--all', 'remove all stopped containers (with confirmation)')
    .action(async (image: string | undefined, opts: { image?: string; force?: boolean; all?: boolean }) => {
      const { removeCommand } = await import('./commands/remove.js');
      await removeCommand(image, opts);
    });

  program
    .command('clean')
    .description('Remove all stopped mongostage containers')
    .option('--images', 'also remove locally pulled Docker images')
    .option('--force', 'stop and remove all containers, running or not')
    .action(async (opts: { images?: boolean; force?: boolean }) => {
      const { cleanCommand } = await import('./commands/clean.js');
      await cleanCommand(opts);
    });

  program
    .command('status')
    .description('Show status of all mongostage containers')
    .action(async () => {
      const { statusCommand } = await import('./commands/status.js');
      await statusCommand();
    });

  program
    .command('build [image]')
    .description('(admin) Build a Docker image from component Dockerfiles')
    .option('--push', 'push to Docker Hub after building')
    .option('--no-cache', 'build without Docker layer cache')
    .option('--dry-run', 'print the generated Dockerfile without building')
    .action(async (image: string | undefined, opts: { push?: boolean; noCache?: boolean; dryRun?: boolean }) => {
      const { buildCommand } = await import('./commands/build.js');
      await buildCommand(image, opts);
    });

  program
    .command('push [image]')
    .description('(admin) Push a built image to Docker Hub')
    .action(async (image: string | undefined) => {
      const { pushCommand } = await import('./commands/push.js');
      await pushCommand(image);
    });

  program
    .command('publish')
    .description('(admin) Bump version, build, and publish to npm')
    .option('--bump <type>', 'version bump type: patch, minor, major, or semver string')
    .option('--dry-run', 'show what would be published without publishing')
    .action(async (opts: { bump?: string; dryRun?: boolean }) => {
      const { publishCommand } = await import('./commands/publish.js');
      await publishCommand(opts);
    });

  return program;
}

// Only execute when this file is the entry point, not when imported as a module.
// realpathSync resolves symlinks so npm link / global installs work correctly.
const isMain = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    process.stdout.write('\x1Bc');
    const { default: App } = await import('./tui/App.js');
    const { default: React } = await import('react');
    const { render } = await import('ink');
    const { getImages } = await import('./lib/config.js');
    render(React.createElement(App, { images: getImages() }));
  } else {
    const program = createProgram();
    try {
      await program.parseAsync(process.argv);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  }
}
