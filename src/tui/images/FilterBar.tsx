import React from 'react';
import { Box, Text } from 'ink';

export type ImageFilter = 'all' | 'base' | 'runtime' | 'ai' | 'server';

const FILTER_TABS: ReadonlyArray<{ key: ImageFilter; label: string }> = Object.freeze([
  { key: 'all', label: 'All' },
  { key: 'base', label: 'Base' },
  { key: 'runtime', label: 'Runtime' },
  { key: 'ai', label: 'AI' },
  { key: 'server', label: 'Server' },
]);

interface FilterBarProps {
  activeFilter: ImageFilter;
}

export function FilterBar({ activeFilter }: FilterBarProps): JSX.Element {
  return (
    <Box gap={2} marginLeft={2} marginBottom={1}>
      {FILTER_TABS.map(tab => (
        activeFilter === tab.key ? (
          <Text key={tab.key} color="#00ED64">[ {tab.label} ]</Text>
        ) : (
          <Text key={tab.key} dimColor>[ {tab.label} ]</Text>
        )
      ))}
    </Box>
  );
}

export { FILTER_TABS };
