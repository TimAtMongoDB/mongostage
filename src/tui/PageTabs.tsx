import React from 'react';
import { Box, Text } from 'ink';

export type ActivePage = 'images' | 'containers';

interface PageTabsProps {
  activePage: ActivePage;
}

export function PageTabs({ activePage }: PageTabsProps): JSX.Element {
  return (
    <Box gap={2} marginLeft={2}>
      {activePage === 'images' ? (
        <Text backgroundColor="#00ED64" color="black">▶ Images</Text>
      ) : (
        <Text dimColor>  Images</Text>
      )}
      {activePage === 'containers' ? (
        <Text backgroundColor="#00ED64" color="black">▶ Containers</Text>
      ) : (
        <Text dimColor>  Containers</Text>
      )}
    </Box>
  );
}
