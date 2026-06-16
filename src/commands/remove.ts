import chalk from 'chalk';
import { detectDockerState, stopContainer, removeContainer } from '../lib/docker.js';
import { listManagedContainers, findContainerBySlug } from '../lib/containers.js';

export interface RemoveOpts {
  image?: string;
  force?: boolean;
  all?: boolean;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    console.error(chalk.red(`Invalid container slug "${slug}". Slugs must match /^[a-z0-9-]+$/`));
    process.exit(1);
  }
}

async function confirmRemove(name: string): Promise<boolean> {
  const { default: inquirer } = await import('inquirer');
  const answer = await inquirer.prompt<{ ok: boolean }>([
    {
      type: 'confirm',
      name: 'ok',
      message: `Remove ${name}?`,
      default: false,
    },
  ]);
  return Boolean(answer.ok);
}

export async function removeCommand(
  imageArg: string | undefined,
  opts: RemoveOpts = {}
): Promise<void> {
  const state = await detectDockerState();
  if (state !== 'running') {
    console.error(chalk.red('Docker is not running. Run `mongo-docker setup` to install it.'));
    process.exit(1);
  }

  if (opts.all) {
    const containers = await listManagedContainers();
    const removable = opts.force ? containers : containers.filter(c => c.status !== 'running');

    if (removable.length === 0) {
      console.log(opts.force ? 'No mongo-docker containers found.' : 'No stopped mongo-docker containers.');
      return;
    }

    console.log('Containers to remove:');
    for (const c of removable) console.log(`  ${c.name}  (${c.status})`);

    const { default: inquirer } = await import('inquirer');
    const answer = await inquirer.prompt<{ ok: boolean }>([
      {
        type: 'confirm',
        name: 'ok',
        message: `Remove ${removable.length} container(s)?`,
        default: false,
      },
    ]);

    if (!Boolean(answer.ok)) {
      console.log('Aborted.');
      return;
    }

    for (const c of removable) {
      if (c.status === 'running') await stopContainer(c.id);
      await removeContainer(c.id, opts.force ?? false);
      console.log(chalk.green('✓') + `  Removed ${c.name}`);
    }
    return;
  }

  const slug = imageArg ?? opts.image;

  if (!slug) {
    const containers = await listManagedContainers();
    const candidates = opts.force ? containers : containers.filter(c => c.status !== 'running');

    if (candidates.length === 0) {
      console.log('No removable mongo-docker containers.');
      return;
    }

    if (candidates.length === 1) {
      const ok = await confirmRemove(candidates[0].name);
      if (!ok) { console.log('Aborted.'); return; }
      if (candidates[0].status === 'running') await stopContainer(candidates[0].id);
      await removeContainer(candidates[0].id, opts.force ?? false);
      console.log(chalk.green('✓') + `  Removed ${candidates[0].name}`);
      return;
    }

    const { default: inquirer } = await import('inquirer');
    const answer = await inquirer.prompt<{ slug: string }>([
      {
        type: 'list',
        name: 'slug',
        message: 'Which container do you want to remove?',
        choices: candidates.map(c => ({ name: `${c.name}  (${c.status})`, value: c.slug })),
      },
    ]);
    const target = candidates.find(c => c.slug === answer.slug);
    if (!target) return;

    const ok = await confirmRemove(target.name);
    if (!ok) { console.log('Aborted.'); return; }
    if (target.status === 'running') await stopContainer(target.id);
    await removeContainer(target.id, opts.force ?? false);
    console.log(chalk.green('✓') + `  Removed ${target.name}`);
    return;
  }

  validateSlug(slug);

  const container = await findContainerBySlug(slug);
  if (!container) {
    console.error(chalk.red(`No mongo-docker container found for: ${slug}`));
    process.exit(1);
  }

  if (container.status === 'running' && !opts.force) {
    console.error(
      chalk.red(`Container ${container.name} is running. Use --force to stop and remove it.`)
    );
    process.exit(1);
  }

  const ok = await confirmRemove(container.name);
  if (!ok) { console.log('Aborted.'); return; }

  if (container.status === 'running') await stopContainer(container.id);
  await removeContainer(container.id, opts.force ?? false);
  console.log(chalk.green('✓') + `  Removed ${container.name}`);
}
