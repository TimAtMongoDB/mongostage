import chalk from 'chalk';
import { detectDockerState, stopContainer } from '../lib/docker.js';
import { listManagedContainers, findContainerBySlug } from '../lib/containers.js';

export interface StopOpts {
  image?: string;
  all?: boolean;
}

export async function stopCommand(
  imageArg: string | undefined,
  opts: StopOpts = {}
): Promise<void> {
  const state = await detectDockerState();
  if (state !== 'running') {
    console.error(chalk.red('Docker is not running. Run `mongo-docker setup` to install it.'));
    process.exit(1);
  }

  if (opts.all) {
    const containers = await listManagedContainers();
    const running = containers.filter(c => c.status === 'running');
    if (running.length === 0) {
      console.log('No running mongo-docker containers.');
      return;
    }
    for (const c of running) {
      await stopContainer(c.id);
      console.log(chalk.green('✓') + `  Stopped ${c.name}`);
    }
    return;
  }

  const slug = imageArg ?? opts.image;

  if (!slug) {
    const containers = await listManagedContainers();
    const running = containers.filter(c => c.status === 'running');

    if (running.length === 0) {
      console.log('No running mongo-docker containers.');
      return;
    }

    if (running.length === 1) {
      await stopContainer(running[0].id);
      console.log(chalk.green('✓') + `  Stopped ${running[0].name}`);
      return;
    }

    const { default: inquirer } = await import('inquirer');
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'slug',
        message: 'Which container do you want to stop?',
        choices: running.map(c => ({ name: c.name, value: c.slug })),
      },
    ]) as { slug: string };
    const target = running.find(c => c.slug === answer.slug);
    if (target) {
      await stopContainer(target.id);
      console.log(chalk.green('✓') + `  Stopped ${target.name}`);
    }
    return;
  }

  const container = await findContainerBySlug(slug);
  if (!container) {
    console.error(chalk.red(`No mongo-docker container found for: ${slug}`));
    process.exit(1);
  }
  if (container.status !== 'running') {
    console.log(`Container ${container.name} is not running.`);
    return;
  }
  await stopContainer(container.id);
  console.log(chalk.green('✓') + `  Stopped ${container.name}`);
}
