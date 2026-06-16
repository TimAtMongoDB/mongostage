import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import ora from 'ora';
import chalk from 'chalk';
import { detectDockerState, pullImage, runContainer, stopContainer, startContainer, removeContainer, getDockerClient } from '../lib/docker.js';
import { getImages, getImageBySlug } from '../lib/config.js';
import { getContainerName, getSlugFromTag, findContainerBySlug } from '../lib/containers.js';
import { detectPlatform } from '../lib/os.js';

export interface ConnectOpts {
  image?: string;
  fresh?: boolean;
  name?: string;
}

function readMongoEnvFile(): Record<string, string> {
  const envFile = join(homedir(), '.mongo-docker', '.env');
  if (!existsSync(envFile)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) result[line.slice(0, eqIdx)] = line.slice(eqIdx + 1);
  }
  return result;
}

function isWindowsPath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\');
}

function expandTilde(p: string): string {
  return p.startsWith('~') ? p.replace(/^~/, homedir()) : p;
}

async function attachExisting(containerId: string): Promise<void> {
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

export async function attachToContainer(nameOrId: string): Promise<void> {
  await attachExisting(nameOrId);
}

export async function connectCommand(
  imageArg: string | undefined,
  opts: ConnectOpts
): Promise<void> {
  const dockerState = await detectDockerState();
  if (dockerState !== 'running') {
    console.error(chalk.red('Docker is not running. Run `mongo-docker setup` to install it.'));
    process.exit(1);
  }

  const inputSlug = imageArg ?? opts.image;
  let fullTag: string;
  let slug: string;

  if (!inputSlug) {
    const { default: inquirer } = await import('inquirer');
    const images = getImages();
    const answer = await inquirer.prompt<{ tag: string }>([
      {
        type: 'list',
        name: 'tag',
        message: 'Select an image:',
        choices: images.map(img => ({
          name: `${getSlugFromTag(img.tag)}  (${img.components.join(', ')})`,
          value: img.tag,
        })),
      },
    ]);
    fullTag = answer.tag;
    slug = getSlugFromTag(fullTag);
  } else {
    const imageConfig = getImageBySlug(inputSlug);
    if (!imageConfig) {
      const validSlugs = getImages().map(img => getSlugFromTag(img.tag)).join(', ');
      console.error(chalk.red(`Unknown image: ${inputSlug}`));
      console.error(`Valid images: ${validSlugs}`);
      process.exit(1);
    }
    fullTag = imageConfig.tag;
    slug = getSlugFromTag(fullTag);
  }

  const envVars = readMongoEnvFile();
  const mongoMount = envVars['MONGO_MOUNT'];
  const mongoWorkdir = envVars['MONGO_WORKDIR'];

  if (mongoMount && detectPlatform() === 'wsl2' && isWindowsPath(mongoMount)) {
    console.error(
      chalk.red('MONGO_MOUNT must be a WSL2 path (e.g. ~/myproject), not a Windows path (e.g. C:\\Users\\...).')
    );
    process.exit(1);
  }

  const containerName = opts.name ?? getContainerName(slug);
  const existing = await findContainerBySlug(slug);

  if (existing && !opts.fresh) {
    if (existing.status === 'running') {
      console.log(chalk.green(`Attaching to running container: ${containerName}`));
      await attachExisting(existing.id);
      return;
    }
    console.log(chalk.green(`Starting stopped container: ${containerName}`));
    await startContainer(existing.id);
    await attachExisting(existing.id);
    return;
  }

  if (existing && opts.fresh) {
    await stopContainer(existing.id);
    await removeContainer(existing.id, true);
  }

  const spinner = ora(`Pulling ${fullTag}...`).start();
  await pullImage(fullTag, msg => { spinner.text = msg; });
  spinner.succeed('Image ready');

  let mountHost: string | undefined;
  let mountTarget: string | undefined;
  let workdir = '/home/mongo/demo';

  if (mongoMount) {
    mountHost = expandTilde(mongoMount);
    mountTarget = mongoWorkdir ?? '/home/mongo/myproject';
    workdir = mountTarget;
  } else if (mongoWorkdir) {
    workdir = mongoWorkdir;
  }

  const envFilePath = join(homedir(), '.mongo-docker', '.env');

  await runContainer({
    tag: fullTag,
    name: containerName,
    slug,
    envFile: existsSync(envFilePath) ? envFilePath : undefined,
    mountHost,
    mountTarget,
    workdir,
    detach: false,
  });
}
