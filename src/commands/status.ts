import chalk from 'chalk';
import { detectDockerState, getDockerClient } from '../lib/docker.js';
import { listManagedContainers } from '../lib/containers.js';
import { getCliConfig } from '../lib/config.js';
import { formatBytes } from '../lib/format.js';

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

export async function statusCommand(): Promise<void> {
  const dockerState = await detectDockerState();
  const config = getCliConfig();

  const daemonLabel =
    dockerState === 'running'
      ? config.dockerMethod === 'colima'
        ? chalk.green('running') + chalk.dim(' (Colima)')
        : chalk.green('running')
      : chalk.red('not running');

  console.log(`Docker          ${daemonLabel}\n`);

  if (dockerState !== 'running') {
    console.log('Run `mongostage setup` to install Docker.');
    return;
  }

  const containers = await listManagedContainers();

  if (containers.length === 0) {
    console.log(chalk.dim('No mongostage containers.'));
    console.log(chalk.dim('Run `mongostage connect <image>` to create one.'));
  } else {
    const COL = { container: 28, image: 22, status: 10 };
    const header =
      'CONTAINER'.padEnd(COL.container) +
      'IMAGE'.padEnd(COL.image) +
      'STATUS'.padEnd(COL.status) +
      'CREATED';
    console.log(chalk.dim(header));
    for (const c of containers) {
      const statusColour = c.status === 'running' ? chalk.green : chalk.dim;
      const row =
        c.name.padEnd(COL.container) +
        c.imageTag.padEnd(COL.image) +
        statusColour(c.status.padEnd(COL.status)) +
        timeAgo(c.created);
      console.log(row);
    }
  }

  // Disk usage
  try {
    const docker = getDockerClient();
    const images = await docker.listImages({
      filters: JSON.stringify({ reference: ['timatmongodb/mongostage*'] }),
    });
    if (images.length > 0) {
      const total = images.reduce((sum, img) => sum + (img.Size ?? 0), 0);
      console.log(`\nDisk used by mongostage images: ${formatBytes(total)}`);
    }
  } catch {
    console.log(chalk.dim('\n(disk usage unavailable)'));
  }
}
