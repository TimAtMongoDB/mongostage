import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getRegistry, getImageBySlug, resolveFullTag } from '../lib/config.js';
import { listLocalImages, streamCommand } from '../lib/docker.js';
import type { ImageRegistry } from '../types/image.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = join(__dirname, '../../');
const DOCKERFILES_DIR = join(PACKAGE_ROOT, 'dockerfiles');

function sortedComponents(components: string[], registry: ImageRegistry): string[] {
  return [...components].sort(
    (a, b) => (registry.components[a]?.order ?? 0) - (registry.components[b]?.order ?? 0)
  );
}

async function getLocalTags(): Promise<Set<string>> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    const proc = spawn('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('close', () => {
      const lines = Buffer.concat(chunks).toString().trim().split('\n').filter(Boolean);
      resolve(new Set(lines));
    });
    proc.on('error', (err) => {
      console.warn(`Warning: could not list local Docker images: ${err.message}`);
      resolve(new Set());
    });
  });
}

function findBestBase(
  sortedComps: string[],
  registry: ImageRegistry,
  localTags: Set<string>
): { baseTag: string; remaining: string[] } | null {
  for (let i = sortedComps.length - 1; i >= 1; i--) {
    const prefix = sortedComps.slice(0, i);
    const match = registry.images.find(img => {
      const imgSorted = sortedComponents(img.components, registry);
      return (
        imgSorted.length === prefix.length &&
        imgSorted.every((c, idx) => c === prefix[idx])
      );
    });
    if (match && localTags.has(match.tag)) {
      return { baseTag: match.tag, remaining: sortedComps.slice(i) };
    }
  }
  return null;
}

function parseFragment(content: string): { builderStages: string; layerBody: string } {
  const markerIdx = content.indexOf('# Component fragment body');
  if (markerIdx !== -1) {
    const builderStages = content.slice(0, markerIdx).trim();
    const afterMarker = content.slice(content.indexOf('\n', markerIdx) + 1).trim();
    return { builderStages, layerBody: afterMarker };
  }

  // No explicit marker — split on FROM ... AS (builder) vs body
  const lines = content.split('\n');
  const builderLines: string[] = [];
  const bodyLines: string[] = [];
  let inBuilder = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^FROM\s+\S+\s+AS\s+/i.test(trimmed)) {
      inBuilder = true;
      builderLines.push(line);
    } else if (inBuilder && /^FROM\s+/i.test(trimmed) && !/\sAS\s/i.test(trimmed)) {
      inBuilder = false;
      bodyLines.push(line);
    } else if (inBuilder) {
      builderLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  return {
    builderStages: builderLines.join('\n').trim(),
    layerBody: bodyLines.join('\n').trim(),
  };
}

function assembleDockerfile(fromTag: string, components: string[]): string {
  const allBuilderStages: string[] = [];
  const layerBodies: string[] = [];

  for (const comp of components) {
    const fragmentPath = join(DOCKERFILES_DIR, `${comp}.Dockerfile`);
    if (!existsSync(fragmentPath)) {
      throw new Error(
        `Component Dockerfile not found: ${fragmentPath}\n` +
          `Ensure all component Dockerfiles exist in dockerfiles/`
      );
    }
    const content = readFileSync(fragmentPath, 'utf8');
    const { builderStages, layerBody } = parseFragment(content);
    if (builderStages) allBuilderStages.push(builderStages);
    if (layerBody) layerBodies.push(`# === ${comp} layer ===\n${layerBody}`);
  }

  const parts: string[] = [];
  if (allBuilderStages.length > 0) parts.push(allBuilderStages.join('\n\n'));
  parts.push(`FROM ${fromTag}`);
  parts.push(...layerBodies);
  return parts.join('\n\n');
}

async function buildDockerfileContent(
  content: string,
  tag: string,
  noCache: boolean
): Promise<void> {
  const args = ['build'];
  if (noCache) args.push('--no-cache');
  args.push('-t', tag, '-f', '-', '.');

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, {
      cwd: PACKAGE_ROOT,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    proc.stdin.write(content);
    proc.stdin.end();
    proc.on('error', err => reject(new Error(`Failed to run docker build: ${err.message}`)));
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`docker build exited with code ${code}`));
    });
  });
}

export async function buildCommand(
  imageArg: string | undefined,
  opts: { push?: boolean; noCache?: boolean; dryRun?: boolean }
): Promise<void> {
  if (!imageArg) {
    console.error('Usage: mongostage build <tag> [--push] [--no-cache] [--dry-run]');
    console.error('Example: mongostage build node-shell-claude');
    process.exit(1);
  }

  const registry = getRegistry();
  const imageConfig = getImageBySlug(imageArg);
  if (!imageConfig) {
    console.error(`Unknown tag: ${imageArg}. Check images.json.`);
    process.exit(1);
  }

  const fullTag = resolveFullTag(imageArg);
  const sorted = sortedComponents(imageConfig.components, registry);

  // Base-only image: build from base.Dockerfile directly
  if (sorted.length === 1 && sorted[0] === 'base') {
    const baseDockerfilePath = join(DOCKERFILES_DIR, 'base.Dockerfile');
    const content = readFileSync(baseDockerfilePath, 'utf8');

    if (opts.dryRun) {
      console.log('Generated Dockerfile:');
      console.log('─'.repeat(60));
      console.log(content);
      console.log('─'.repeat(60));
      return;
    }

    console.log(`Building ${fullTag}`);
    console.log(`  Base: ubuntu:24.04`);
    console.log(`  Adding: Starship, MongoDB branding\n`);
    console.log('Running: docker build ...');
    await buildDockerfileContent(content, fullTag, opts.noCache ?? false);
    console.log(`\n✓ Built ${fullTag}`);
    console.log(`\nNext: mongostage push ${imageArg}`);
    if (opts.push) await _push(fullTag, imageArg);
    return;
  }

  const localTags = await getLocalTags();
  const best = findBestBase(sorted, registry, localTags);

  if (!best) {
    const shortBase = sorted[0];
    console.error(`No base image found locally for ${fullTag}.`);
    console.error(`Build the base first: mongostage build ${shortBase}`);
    process.exit(1);
  }

  const { baseTag, remaining } = best;
  console.log(`Building ${fullTag}`);
  console.log(`  Base: ${baseTag}`);
  for (const comp of remaining) {
    console.log(`  Adding: ${comp} layer`);
  }
  console.log('');

  const dockerfile = assembleDockerfile(baseTag, remaining);

  if (opts.dryRun) {
    console.log('Generated Dockerfile:');
    console.log('─'.repeat(60));
    console.log(dockerfile);
    console.log('─'.repeat(60));
    return;
  }

  console.log('Generating Dockerfile...');
  console.log('Running: docker build ...\n');
  await buildDockerfileContent(dockerfile, fullTag, opts.noCache ?? false);

  console.log(`\n✓ Built ${fullTag}`);
  if (opts.push) {
    await _push(fullTag, imageArg);
  } else {
    console.log(`\nNext: mongostage push ${imageArg}`);
  }
}

async function _push(fullTag: string, shortTag: string): Promise<void> {
  const local = await listLocalImages(fullTag);
  if (local.length === 0) {
    console.error(`Image not found locally: ${fullTag}`);
    process.exit(1);
  }
  console.log(`\nPushing ${fullTag} ...`);
  await streamCommand('docker', ['push', fullTag]);
  console.log(`\n✓ Pushed ${fullTag}`);
  console.log('\nDon\'t forget:');
  console.log('  1. Add/update the entry in images.json if new');
  console.log('  2. Run npm publish');
  console.log(`  Users will see the new image on next: npm update -g mongostage`);
  void shortTag;
}
