import chalk from 'chalk';
import { detectDockerState, stopContainer, removeContainer, getDockerClient } from '../lib/docker.js';
import { listManagedContainers } from '../lib/containers.js';
import { formatBytes } from '../lib/format.js';

export interface CleanOpts {
  images?: boolean;
  force?: boolean;
}

export async function cleanCommand(opts: CleanOpts = {}): Promise<void> {
  const state = await detectDockerState();
  if (state !== 'running') {
    console.error(chalk.red('Docker is not running. Run `mongo-docker setup` to install it.'));
    process.exit(1);
  }

  const containers = await listManagedContainers();
  const toRemove = opts.force ? containers : containers.filter(c => c.status !== 'running');

  if (toRemove.length === 0) {
    const msg = opts.force
      ? 'No mongo-docker containers to remove.'
      : 'No stopped mongo-docker containers.';
    console.log(msg);
    return;
  }

  console.log('Containers to remove:');
  for (const c of toRemove) console.log(`  ${c.name}  (${c.status})`);

  if (opts.images) {
    const docker = getDockerClient();
    const images = await docker.listImages({
      filters: JSON.stringify({ reference: ['timatmongodb/mongo-docker*'] }),
    });
    if (images.length > 0) {
      console.log('\nImages to remove:');
      for (const img of images) {
        const tags = (img.RepoTags ?? []).join(', ');
        console.log(`  ${tags}  (${formatBytes(img.Size)})`);
      }
    }
  }

  const { default: inquirer } = await import('inquirer');
  const answer = await inquirer.prompt<{ ok: boolean }>([
    {
      type: 'confirm',
      name: 'ok',
      message: `Remove ${toRemove.length} container(s)${opts.images ? ' and images' : ''}?`,
      default: false,
    },
  ]);

  if (!answer.ok) {
    console.log('Aborted.');
    return;
  }

  for (const c of toRemove) {
    if (c.status === 'running') await stopContainer(c.id);
    await removeContainer(c.id, true);
  }

  let freedBytes = 0;

  if (opts.images) {
    const docker = getDockerClient();
    const images = await docker.listImages({
      filters: JSON.stringify({ reference: ['timatmongodb/mongo-docker*'] }),
    });
    for (const img of images) {
      try {
        await docker.getImage(img.Id).remove({ force: true });
        freedBytes += img.Size ?? 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(chalk.yellow(`Warning: could not remove image ${img.Id.slice(0, 12)}: ${msg}`));
      }
    }
  }

  const summary = freedBytes > 0
    ? `Removed ${toRemove.length} container(s), freed ${formatBytes(freedBytes)}`
    : `Removed ${toRemove.length} container(s)`;
  console.log(chalk.green('✓') + `  ${summary}`);
}
