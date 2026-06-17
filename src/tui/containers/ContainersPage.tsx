import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { ContainerState } from '../../types/container.js';
import type { DockerImage } from '../../lib/docker.js';
import { ContainerRow } from './ContainerRow.js';
import { ImageRow } from './ImageRow.js';
import { ActionMenu } from './ActionMenu.js';

interface ContainersPageProps {
  footerHint: (hint: string) => void;
}

type RowEntry =
  | { kind: 'container'; container: ContainerState }
  | { kind: 'image'; image: DockerImage };

const FOOTER = '↑↓ navigate   Enter action   Esc quit';
const POLL_INTERVAL = 5000;
const MONGOSTAGE_FILTER = 'timatmongodb/mongostage*';

async function fetchData(): Promise<{
  running: ContainerState[];
  stopped: ContainerState[];
  images: DockerImage[];
  dockerRunning: boolean;
}> {
  try {
    const { listManagedContainers } = await import('../../lib/containers.js');
    const { listLocalImages } = await import('../../lib/docker.js');

    const [allContainers, images] = await Promise.all([
      listManagedContainers(),
      listLocalImages(MONGOSTAGE_FILTER),
    ]);

    const running = allContainers.filter(c => c.status === 'running');
    const stopped = allContainers.filter(c => c.status !== 'running');

    return { running, stopped, images, dockerRunning: true };
  } catch {
    return { running: [], stopped: [], images: [], dockerRunning: false };
  }
}

async function executeAction(action: string, target: RowEntry): Promise<void> {
  const { stopContainer, removeContainer, startContainer } = await import('../../lib/docker.js');
  const name = target.kind === 'container' ? target.container.name : target.image.repoTags[0] ?? target.image.id;

  if (action === 'Stop' && target.kind === 'container') {
    await stopContainer(target.container.name);
  } else if ((action === 'Remove' || action === 'Remove (force)') && target.kind === 'container') {
    await removeContainer(target.container.name, action === 'Remove (force)');
  } else if (action === 'Start' && target.kind === 'container') {
    await startContainer(target.container.name);
  } else if (action === 'Remove' && target.kind === 'image') {
    const { getDockerClient } = await import('../../lib/docker.js');
    const docker = getDockerClient();
    await docker.getImage(target.image.id).remove();
  } else if (action === 'Connect') {
    // Connect exits the TUI then runs attach — handled at App level via process signal
    // For now: exit and let the CLI handle reconnect
    const { connectCommand } = await import('../../commands/connect.js');
    if (target.kind === 'container') {
      await connectCommand(target.container.slug, {});
    }
  }
  void name; // consumed for potential logging
}

export function ContainersPage({ footerHint }: ContainersPageProps): JSX.Element {
  const { exit } = useApp();
  const [dockerRunning, setDockerRunning] = useState(true);
  const [running, setRunning] = useState<ContainerState[]>([]);
  const [stopped, setStopped] = useState<ContainerState[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows: RowEntry[] = [
    ...running.map(c => ({ kind: 'container' as const, container: c })),
    ...stopped.map(c => ({ kind: 'container' as const, container: c })),
    ...images.map(img => ({ kind: 'image' as const, image: img })),
  ];

  const refresh = useCallback(async () => {
    const data = await fetchData();
    setDockerRunning(data.dockerRunning);
    setRunning(data.running);
    setStopped(data.stopped);
    setImages(data.images);
  }, []);

  useEffect(() => {
    footerHint(FOOTER);
    void refresh();
    const interval = setInterval(() => { void refresh(); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [footerHint, refresh]);

  useInput((_input, key) => {
    if (actionMenuOpen) return; // ActionMenu handles its own input

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(rows.length - 1, i + 1));
      return;
    }
    if (key.return && rows.length > 0) {
      setActionMenuOpen(true);
      return;
    }
    if (key.escape) {
      exit();
    }
  });

  const handleAction = useCallback(async (action: string) => {
    setActionMenuOpen(false);
    setError(null);
    const target = rows[selectedIndex];
    if (!target) return;
    try {
      await executeAction(action, target);
    } catch (err) {
      setError((err as Error).message);
    }
    await refresh();
  }, [rows, selectedIndex, refresh]);

  if (!dockerRunning) {
    return (
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        <Text>Docker is not running. Run <Text color="#00ED64">`mongostage setup`</Text> to get started.</Text>
      </Box>
    );
  }

  const buildRow = (entry: RowEntry, index: number): JSX.Element => {
    const isSelected = selectedIndex === index;
    const el = entry.kind === 'container'
      ? <ContainerRow key={entry.container.id} container={entry.container} isSelected={isSelected} />
      : <ImageRow key={entry.image.id} image={entry.image} isSelected={isSelected} />;

    return (
      <Box key={index} flexDirection="column">
        {el}
        {isSelected && actionMenuOpen && (
          <ActionMenu
            rowType={entry.kind === 'container'
              ? (entry.container.status === 'running' ? 'running' : 'stopped')
              : 'image'}
            targetName={entry.kind === 'container' ? entry.container.name : (entry.image.repoTags[0] ?? entry.image.id)}
            onAction={action => { void handleAction(action); }}
            onClose={() => setActionMenuOpen(false)}
          />
        )}
      </Box>
    );
  };

  let rowIndex = 0;

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      {error && <Text color="red">{error}</Text>}

      {running.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>RUNNING</Text>
          {running.map(c => buildRow({ kind: 'container', container: c }, rowIndex++))}
        </Box>
      )}

      {stopped.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>STOPPED</Text>
          {stopped.map(c => buildRow({ kind: 'container', container: c }, rowIndex++))}
        </Box>
      )}

      {images.length > 0 && (
        <Box flexDirection="column">
          <Text bold>LOCAL IMAGES</Text>
          {images.map(img => buildRow({ kind: 'image', image: img }, rowIndex++))}
        </Box>
      )}

      {running.length === 0 && stopped.length === 0 && images.length === 0 && (
        <Text dimColor>No mongostage containers or images found.</Text>
      )}
    </Box>
  );
}
