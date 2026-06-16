import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { ImageRegistry, ImageConfig, CliConfig } from '../types/image.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '../../');
const REGISTRY_PATH = join(PACKAGE_ROOT, 'images.json');
const CONFIG_DIR = process.env.MONGO_DOCKER_CONFIG_DIR ?? join(homedir(), '.mongo-docker');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULT_ORG = 'timatmongodb';
const DEFAULT_REPO = 'mongo-docker';

let _registry: ImageRegistry | null = null;

function loadRegistry(): ImageRegistry {
  if (_registry) return _registry;
  const raw = readFileSync(REGISTRY_PATH, 'utf8');
  _registry = JSON.parse(raw) as ImageRegistry;
  return _registry;
}

export function getRegistry(): ImageRegistry {
  return loadRegistry();
}

export function getImages(): ImageConfig[] {
  return loadRegistry().images;
}

export function getImageBySlug(slug: string): ImageConfig | undefined {
  const images = getImages();
  const isFullTag = slug.includes('/') && slug.includes(':');
  if (isFullTag) {
    return images.find(img => img.tag === slug);
  }
  const fullTag = resolveFullTag(slug);
  return images.find(img => img.tag === fullTag);
}

export function resolveFullTag(slug: string): string {
  if (slug.includes('/') && slug.includes(':')) {
    return slug;
  }
  return `${DEFAULT_ORG}/${DEFAULT_REPO}:${slug}`;
}

export function filterImagesByCategory(category: string): ImageConfig[] {
  return getImages().filter(img => img.category === category);
}

const CLI_CONFIG_DEFAULTS: CliConfig = {
  setupComplete: false,
  os: 'linux',
  dockerMethod: 'engine',
  defaultOrg: DEFAULT_ORG,
  lastUpdated: new Date().toISOString(),
};

export function getCliConfig(): CliConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    return { ...CLI_CONFIG_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...CLI_CONFIG_DEFAULTS };
  }
}

export function saveCliConfig(config: Partial<CliConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const current = getCliConfig();
  const updated = { ...current, ...config, lastUpdated: new Date().toISOString() };
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
}
