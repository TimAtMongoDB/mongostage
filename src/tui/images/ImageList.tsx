import React from 'react';
import { Box, Text } from 'ink';
import type { ImageConfig } from '../../types/image.js';

interface ImageListProps {
  images: ImageConfig[];
  selectedIndex: number;
}

function slugFromTag(tag: string): string {
  const colon = tag.lastIndexOf(':');
  return colon >= 0 ? tag.slice(colon + 1) : tag;
}

export function ImageList({ images, selectedIndex }: ImageListProps): JSX.Element {
  if (images.length === 0) {
    return (
      <Box marginLeft={2}>
        <Text dimColor>No images found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {images.map((img, i) => {
        const slug = slugFromTag(img.tag);
        return i === selectedIndex ? (
          <Box key={img.tag}>
            <Text color="#00ED64">▶ {slug}</Text>
          </Box>
        ) : (
          <Box key={img.tag} marginLeft={2}>
            <Text>{slug}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
