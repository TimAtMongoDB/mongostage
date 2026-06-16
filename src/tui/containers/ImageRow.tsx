import React from 'react';
import { Box, Text } from 'ink';
import type { DockerImage } from '../../lib/docker.js';

interface ImageRowProps {
  image: DockerImage;
  isSelected: boolean;
}

function slugFromTag(tag: string): string {
  const colon = tag.lastIndexOf(':');
  return colon >= 0 ? tag.slice(colon + 1) : tag;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}MB`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

export function ImageRow({ image, isSelected }: ImageRowProps): JSX.Element {
  const tag = image.repoTags[0] ?? image.id.slice(0, 12);
  const slug = slugFromTag(tag);
  const sizeStr = image.size != null ? formatBytes(image.size) : '';

  return isSelected ? (
    <Box>
      <Text color="#00ED64">▶ {slug.padEnd(28)}</Text>
      <Text color="#00ED64">{sizeStr}</Text>
    </Box>
  ) : (
    <Box>
      <Text>  {slug.padEnd(28)}</Text>
      <Text dimColor>{sizeStr}</Text>
    </Box>
  );
}
