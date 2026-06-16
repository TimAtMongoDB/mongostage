import chalk from 'chalk';
import { detectDockerState, startContainer, getDockerClient } from '../lib/docker.js';
import { listManagedContainers, findContainerBySlug } from '../lib/containers.js';

export interface StartOpts {
  image?: string;
  attach?: boolean;
}

async function attachToContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true }) as NodeJS.ReadWriteStream;
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.pipe(stream);
  stream.pipe(process.stdout);
  await container.wait();
  process.stdin.unpipe(stream);
  process.stdin.setRawMode?.(false);
}

export async function startCommand(
  imageArg: string | undefined,
  opts: StartOpts = {}
): Promise<void> {
  const state = await detectDockerState();
  if (state !== 'running') {
    console.error(chalk.red('Docker is not running. Run `mongo-docker setup` to install it.'));
    process.exit(1);
  }

  const slug = imageArg ?? opts.image;

  if (!slug) {
    const containers = await listManagedContainers();
    const stopped = containers.filter(c => c.status !== 'running');

    if (stopped.length === 0) {
      console.log('No stopped mongo-docker containers.');
      return;
    }

    if (stopped.length === 1) {
      await startContainer(stopped[0].id);
      console.log(chalk.green('✓') + `  Started ${stopped[0].name}`);
      if (opts.attach) await attachToContainer(stopped[0].id);
      return;
    }

    const { default: inquirer } = await import('inquirer');
    const answer = await inquirer.prompt<{ slug: string }>([
      {
        type: 'list',
        name: 'slug',
        message: 'Which container do you want to start?',
        choices: stopped.map(c => ({ name: c.name, value: c.slug })),
      },
    ]);
    const target = stopped.find(c => c.slug === answer.slug);
    if (target) {
      await startContainer(target.id);
      console.log(chalk.green('✓') + `  Started ${target.name}`);
      if (opts.attach) await attachToContainer(target.id);
    } else {
      console.error(chalk.red('Selected container not found. It may have been removed.'));
      process.exit(1);
    }
    return;
  }

  const container = await findContainerBySlug(slug);
  if (!container) {
    console.error(chalk.red(`No stopped container found. Run \`mongo-docker connect ${slug}\` to create one.`));
    process.exit(1);
  }
  if (container.status === 'running') {
    console.log(`Container ${container.name} is already running.`);
    return;
  }
  await startContainer(container.id);
  console.log(chalk.green('✓') + `  Started ${container.name}`);
  if (opts.attach) await attachToContainer(container.id);
}
