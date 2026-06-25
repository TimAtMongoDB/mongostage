import React, { useState, useEffect, useCallback } from 'react';
import { spawn } from 'node:child_process';
import { Box, Text, useInput, useApp } from 'ink';
import { TOPOLOGY_PRESETS, spawnTopology, teardownTopology, getRunningTopologyIds, type TopologyPreset } from '../../lib/topology.js';
import { detectPlatform } from '../../lib/os.js';

function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = detectPlatform();
    let cmd: string;
    let args: string[];
    if (platform === 'mac') { cmd = 'pbcopy'; args = []; }
    else if (platform === 'wsl2') {
      // Full path bypasses PATH resolution issues in WSL; clip.exe reads from stdin
      cmd = '/mnt/c/Windows/System32/clip.exe';
      args = [];
    } else if (platform === 'windows-native') { cmd = 'clip'; args = []; }
    else { cmd = 'xclip'; args = ['-selection', 'clipboard']; }
    const proc = spawn(cmd, args, { stdio: 'pipe' });
    if (!proc.stdin) { reject(new Error('stdin not available')); return; }
    proc.stdin.write(text);
    proc.stdin.end();
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
    proc.on('error', reject);
  });
}

interface TopologyPageProps {
  footerHint: (hint: string) => void;
}

type ActiveOp = { kind: 'spawning' | 'tearing-down'; id: string } | null;

const FOOTER_DEFAULT = '↑↓ navigate   Enter spawn   d tear down   Esc quit';
const FOOTER_WITH_COPY = '↑↓ navigate   Enter spawn   d tear down   c copy   Esc quit';
const FOOTER_BUSY = 'Starting topology... please wait';
const POLL_INTERVAL = 3000;

export function TopologyPage({ footerHint }: TopologyPageProps): JSX.Element {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [activeOp, setActiveOp] = useState<ActiveOp>(null);
  const [lastError, setLastError] = useState<{ id: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // Connection strings keyed by preset id — persists across navigation
  const [connectionStrings, setConnectionStrings] = useState<Map<string, string>>(new Map());

  const pollRunning = useCallback(async () => {
    const ids = await getRunningTopologyIds();
    setRunningIds(new Set(ids));
  }, []);

  useEffect(() => {
    void pollRunning();
    const interval = setInterval(() => { void pollRunning(); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollRunning]);

  const selectedPresetId = TOPOLOGY_PRESETS[selectedIndex]?.id;
  const selectedConnStr = connectionStrings.get(selectedPresetId ?? '');

  useEffect(() => {
    if (activeOp) footerHint(FOOTER_BUSY);
    else if (selectedConnStr) footerHint(FOOTER_WITH_COPY);
    else footerHint(FOOTER_DEFAULT);
  }, [activeOp, footerHint, selectedConnStr]);

  const handleSpawn = useCallback(async (preset: TopologyPreset) => {
    setActiveOp({ kind: 'spawning', id: preset.id });
    setLastError(null);
    try {
      const result = await spawnTopology(preset.id);
      setConnectionStrings(prev => new Map(prev).set(preset.id, result.connectionString));
      await pollRunning();
    } catch (err) {
      setLastError({ id: preset.id, message: (err as Error).message });
    } finally {
      setActiveOp(null);
    }
  }, [pollRunning]);

  const handleTeardown = useCallback(async (preset: TopologyPreset) => {
    setActiveOp({ kind: 'tearing-down', id: preset.id });
    setLastError(null);
    try {
      await teardownTopology(preset.id);
      setConnectionStrings(prev => { const m = new Map(prev); m.delete(preset.id); return m; });
      await pollRunning();
    } catch (err) {
      setLastError({ id: preset.id, message: (err as Error).message });
    } finally {
      setActiveOp(null);
    }
  }, [pollRunning]);

  const busy = activeOp !== null;

  useInput((_input, key) => {
    if (busy) return;

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(TOPOLOGY_PRESETS.length - 1, i + 1));
      return;
    }
    if (key.return) {
      const preset = TOPOLOGY_PRESETS[selectedIndex];
      if (runningIds.has(preset.id)) return; // already running — tear down first
      void handleSpawn(preset);
      return;
    }
    if (_input === 'd' || _input === 'D') {
      void handleTeardown(TOPOLOGY_PRESETS[selectedIndex]);
      return;
    }
    if (_input === 'c' || _input === 'C') {
      if (selectedConnStr) {
        copyToClipboard(selectedConnStr).then(() => {
          setCopied(true);
          setCopyFailed(false);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
          setCopyFailed(true);
          setCopied(false);
          setTimeout(() => setCopyFailed(false), 3000);
        });
      }
      return;
    }
    if (key.escape) {
      exit();
    }
  });

  const selectedPreset = TOPOLOGY_PRESETS[selectedIndex];
  const selectedRunning = runningIds.has(selectedPreset.id);

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      <Box flexDirection="column" marginBottom={1}>
        {TOPOLOGY_PRESETS.map((preset, index) => {
          const isSelected = index === selectedIndex;
          const isRunning = runningIds.has(preset.id);
          const isOpTarget = activeOp?.id === preset.id;

          let statusTag: JSX.Element | null = null;
          if (isOpTarget && activeOp?.kind === 'spawning') {
            statusTag = <Text color="yellow"> starting...</Text>;
          } else if (isOpTarget && activeOp?.kind === 'tearing-down') {
            statusTag = <Text color="yellow"> stopping...</Text>;
          } else if (isRunning) {
            statusTag = <Text color="#00ED64"> running</Text>;
          }

          return (
            <Box key={preset.id} flexDirection="column">
              <Box>
                {isSelected
                  ? <Text backgroundColor="#00ED64" color="black">{`▶ ${preset.name}`}</Text>
                  : <Text>{`  ${preset.name}`}</Text>}
                {statusTag}
              </Box>
              {isSelected && (
                <Box marginLeft={4}>
                  <Text dimColor>{preset.description}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {lastError && lastError.id === selectedPreset.id && (
        <Box marginTop={1}>
          <Text color="red">Error: {lastError.message}</Text>
        </Box>
      )}

      {selectedRunning && selectedConnStr && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text dimColor>Connect:</Text>
            {copied && <Text color="yellow">  Copied!</Text>}
            {copyFailed && <Text color="red">  Copy failed</Text>}
          </Box>
          <Text color="#00ED64">{selectedConnStr}</Text>
        </Box>
      )}

      {selectedRunning && !selectedConnStr && (
        <Box marginTop={1}>
          <Text dimColor>Running. Press d to tear down.</Text>
        </Box>
      )}
    </Box>
  );
}
