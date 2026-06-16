import React from 'react';
import { Box, Text } from 'ink';
import type { ImageConfig } from '../../types/image.js';

interface ImageDetailProps {
  image: ImageConfig | undefined;
  mongoMount?: string;
  mongoWorkdir?: string;
}

function slugFromTag(tag: string): string {
  const colon = tag.lastIndexOf(':');
  return colon >= 0 ? tag.slice(colon + 1) : tag;
}

function abbreviatePath(p: string): string {
  const home = process.env.HOME ?? '/root';
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

export function ImageDetail({ image, mongoMount, mongoWorkdir }: ImageDetailProps): JSX.Element {
  if (!image) {
    return <Box><Text dimColor>No image selected</Text></Box>;
  }

  const slug = slugFromTag(image.tag);
  const containerMount = mongoMount ? `/home/mongo/${slug}` : undefined;
  const startDir = mongoWorkdir ?? (containerMount ?? '~/demo');

  return (
    <Box flexDirection="column" marginLeft={2} flexGrow={1}>
      <Text bold color="#00ED64">{slug}</Text>
      <Text>{'─'.repeat(30)}</Text>
      <Box marginBottom={1}>
        <Text wrap="wrap">{image.description}</Text>
      </Box>

      <Text dimColor>Components</Text>
      <Box marginBottom={1}>
        <Text>{image.components.join(', ')}</Text>
      </Box>

      <Text dimColor>Tag</Text>
      <Box marginBottom={1}>
        <Text>{image.tag}</Text>
      </Box>

      {mongoMount ? (
        <>
          <Text dimColor>Mount</Text>
          <Box marginBottom={1}>
            <Text>{abbreviatePath(mongoMount)} → {containerMount}</Text>
          </Box>
          <Text dimColor>Start</Text>
          <Box>
            <Text>{startDir}</Text>
          </Box>
        </>
      ) : (
        <>
          <Text dimColor>Start</Text>
          <Box>
            <Text>~/demo</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
