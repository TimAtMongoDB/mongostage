import chalk from 'chalk';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { detectDockerState, runContainer } from '../lib/docker.js';
import { getImageBySlug, getImages } from '../lib/config.js';
import { getContainerName, getSlugFromTag } from '../lib/containers.js';

export interface RunOpts {
  image?: string;
  port?: string;
  env?: string;
  mount?: string;
}

export async function runCommand(
  imageArg: string | undefined,
  opts: RunOpts = {}
): Promise<void> {
  const state = await detectDockerState();
  if (state !== 'running') {
    console.error(chalk.red('Docker is not running. Run `mongostage setup` to install it.'));
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
        message: 'Select an image to run:',
        choices: images.map(img => ({
          name: `${getSlugFromTag(img.tag)}  (${img.category})`,
          value: img.tag,
        })),
      },
    ]);
    fullTag = answer.tag;
    slug = getSlugFromTag(fullTag);
  } else {
    const imageConfig = getImageBySlug(inputSlug);
    if (!imageConfig) {
      const valid = getImages().map(img => getSlugFromTag(img.tag)).join(', ');
      console.error(chalk.red(`Unknown image: ${inputSlug}`));
      console.error(`Valid images: ${valid}`);
      process.exit(1);
    }
    fullTag = imageConfig.tag;
    slug = getSlugFromTag(fullTag);
  }

  const containerName = getContainerName(slug);
  const ports = opts.port ? [opts.port] : [];

  let mountHost: string | undefined;
  let mountTarget: string | undefined;
  if (opts.mount) {
    const resolved = resolve(opts.mount.replace(/^~/, homedir()));
    const home = homedir();
    if (!resolved.startsWith(home)) {
      console.error(chalk.yellow(`Warning: mount path "${resolved}" is outside your home directory. Proceeding anyway.`));
    }
    mountHost = resolved;
    mountTarget = '/home/mongo/myproject';
  }

  const envFilePath = opts.env
    ? resolve(opts.env)
    : join(homedir(), '.mongostage', '.env');
  const envFile = existsSync(envFilePath) ? envFilePath : undefined;

  await runContainer({
    tag: fullTag,
    name: containerName,
    slug,
    envFile,
    mountHost,
    mountTarget,
    ports,
    detach: true,
  });

  console.log(chalk.green('✓') + `  Running ${containerName} in detached mode`);
}
