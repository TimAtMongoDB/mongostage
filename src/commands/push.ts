import { getImageBySlug, resolveFullTag } from '../lib/config.js';
import { listLocalImages, streamCommand } from '../lib/docker.js';

export async function pushCommand(imageArg: string | undefined): Promise<void> {
  if (!imageArg) {
    console.error('Usage: mongostage push <tag>');
    console.error('Example: mongostage push node-shell-claude');
    process.exit(1);
  }

  const fullTag = resolveFullTag(imageArg);

  // Validate tag is known
  const imageConfig = getImageBySlug(imageArg);
  if (!imageConfig) {
    console.error(`Unknown tag: ${imageArg}. Check images.json.`);
    process.exit(1);
  }

  // Verify local image exists before attempting push
  const local = await listLocalImages(fullTag);
  if (local.length === 0) {
    console.error(`Image not found locally: ${fullTag}`);
    console.error(`Build it first: mongostage build ${imageArg}`);
    process.exit(1);
  }

  console.log(`Pushing ${fullTag} ...`);
  await streamCommand('docker', ['push', fullTag]);

  console.log(`\n✓ Pushed ${fullTag}`);
  console.log('\nDon\'t forget:');
  console.log('  1. Add/update the entry in images.json if new');
  console.log('  2. Run npm publish');
  console.log('  Users will see the new image on next: npm update -g mongostage');
}
