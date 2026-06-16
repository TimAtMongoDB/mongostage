import React from 'react';
import { Box, Text } from 'ink';
import type { DockerImage } from '../../lib/docker.js';
import { getSlugFromTag } from '../../lib/containers.js';
import { formatBytes } from '../../lib/format.js';

interface ImageRowProps {
  image: DockerImage;
  isSelected: boolean;
}

export function ImageRow({ image, isSelected }: ImageRowProps): JSX.Element {
  const tag = image.repoTags[0] ?? image.id.slice(0, 12);
  const slug = getSlugFromTag(tag);
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
