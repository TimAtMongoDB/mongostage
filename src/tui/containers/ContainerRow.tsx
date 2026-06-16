import React from 'react';
import { Box, Text } from 'ink';
import type { ContainerState } from '../../types/container.js';

interface ContainerRowProps {
  container: ContainerState;
  isSelected: boolean;
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffDays > 0) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return diffMinutes > 0 ? `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago` : 'just now';
}

export function ContainerRow({ container, isSelected }: ContainerRowProps): JSX.Element {
  const age = timeAgo(container.created);
  const statusText = container.status === 'running'
    ? `Up ${container.uptime ?? age}`
    : `Exited ${age}`;

  return isSelected ? (
    <Box>
      <Text color="#00ED64">▶ {container.slug.padEnd(28)}</Text>
      <Text color="#00ED64">{statusText}</Text>
    </Box>
  ) : (
    <Box>
      <Text>  {container.slug.padEnd(28)}</Text>
      <Text dimColor>{statusText}</Text>
    </Box>
  );
}
