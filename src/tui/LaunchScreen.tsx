import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { ImageConfig } from '../types/image.js';
import { detectDockerState, pullImage, runContainer, startContainer, getDockerClient, getContainerLogs } from '../lib/docker.js';
import { findContainerBySlug, getContainerName, getSlugFromTag } from '../lib/containers.js';
import { attachToContainer } from '../commands/connect.js';
import type { RunContainerOpts } from '../types/container.js';
import { appendLaunchError } from '../lib/log.js';

type StepState = 'pending' | 'active' | 'complete' | 'skipped' | 'error';

interface Step {
  label: string;
  state: StepState;
  note?: string;
}

interface LaunchScreenProps {
  image: ImageConfig;
  onComplete: () => void;
  onError: (error: Error) => void;
}

const STEP_LABELS = [
  'Checking Docker',
  'Installing Docker Engine',
  'Pulling image',
  'Starting container',
  'Setting up workspace',
  'Connecting',
];

function initialSteps(): Step[] {
  return STEP_LABELS.map(label => ({ label, state: 'pending' as StepState }));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function StepRow({ step }: { step: Step }): JSX.Element {
  const icon =
    step.state === 'complete' ? <Text color="#00ED64">✓ </Text> :
    step.state === 'active'   ? <Text color="#00ED64"><Spinner type="dots" /> </Text> :
    step.state === 'skipped'  ? <Text dimColor>– </Text> :
    step.state === 'error'    ? <Text color="red">✗ </Text> :
                                <Text>  </Text>;

  const label =
    step.state === 'complete' ? <Text color="#00ED64">{step.label}</Text> :
    step.state === 'active'   ? <Text>{step.label}</Text> :
    step.state === 'skipped'  ? <Text dimColor>{step.label}</Text> :
    step.state === 'error'    ? <Text color="red">{step.label}</Text> :
                                <Text dimColor>{step.label}</Text>;

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={3}>{icon}</Box>
        {label}
      </Box>
      {step.note && step.state !== 'error' && (
        <Box paddingLeft={3}>
          <Text dimColor>{step.note}</Text>
        </Box>
      )}
      {step.note && step.state === 'error' && (
        <Box paddingLeft={3}>
          <Text color="red">{step.note}</Text>
        </Box>
      )}
    </Box>
  );
}

export function LaunchScreen({ image, onComplete, onError }: LaunchScreenProps): JSX.Element {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [errored, setErrored] = useState(false);
  const [capturedError, setCapturedError] = useState<Error | null>(null);
  const [containerLogs, setContainerLogs] = useState<string | null>(null);

  useInput((_input, _key) => {
    if (capturedError) onError(capturedError);
  }, { isActive: errored });

  function updateStep(idx: number, state: StepState, note?: string): void {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, state, note } : s));
  }

  function triggerError(stepIdx: number, err: Error): void {
    appendLaunchError(image.tag, STEP_LABELS[stepIdx], err);
    setCapturedError(err);
    setErrored(true);
  }

  // Empty deps intentional: this effect runs exactly once on mount to drive the launch sequence
  useEffect(() => {
    let alive = true;

    async function run(): Promise<void> {
      const slug = getSlugFromTag(image.tag);
      const containerName = getContainerName(slug);

      // Step 1: Check Docker
      updateStep(0, 'active');
      let dockerState: 'running' | 'not-running' | 'not-installed';
      try {
        dockerState = await detectDockerState();
        updateStep(0, 'complete');
      } catch (err) {
        updateStep(0, 'error', errMsg(err));
        triggerError(0, toError(err));
        return;
      }

      // Step 2: Install Docker Engine
      if (dockerState === 'running') {
        updateStep(1, 'skipped');
      } else {
        updateStep(1, 'active');
        updateStep(1, 'error', 'Docker is not running. Run `mongostage setup` to install it.');
        triggerError(1, new Error('Docker is not running'));
        return;
      }

      // Step 3: Pull image
      updateStep(2, 'active');
      let pullNote = '';
      try {
        await pullImage(image.tag, (msg) => { pullNote = msg; });
        updateStep(2, 'complete', pullNote || undefined);
      } catch (err) {
        updateStep(2, 'error', errMsg(err));
        triggerError(2, toError(err));
        return;
      }

      // Step 4: Start container
      updateStep(3, 'active');
      let skipWorkspace = false;
      try {
        const existing = await findContainerBySlug(slug);
        if (existing?.status === 'running') {
          updateStep(3, 'skipped');
          updateStep(4, 'skipped');
          skipWorkspace = true;
        } else {
          if (existing) {
            await startContainer(containerName);
          } else {
            const opts: RunContainerOpts = {
              tag: image.tag,
              name: containerName,
              slug,
              detach: true,
            };
            await runContainer(opts);
          }
          const docker = getDockerClient();
          const info = await docker.getContainer(containerName).inspect();
          if (!info.State.Running) {
            const logs = await getContainerLogs(containerName);
            setContainerLogs(logs || '(no output)');
            updateStep(3, 'error', 'Container exited immediately.');
            triggerError(3, new Error('Container exited immediately after start'));
            return;
          }
          updateStep(3, 'complete');
        }
      } catch (err) {
        updateStep(3, 'error', errMsg(err));
        triggerError(3, toError(err));
        return;
      }

      // Step 5: Setup workspace
      if (!skipWorkspace) {
        updateStep(4, 'active');
        try {
          const docker = getDockerClient();
          const container = docker.getContainer(containerName);
          const exec = await container.exec({ Cmd: ['mkdir', '-p', '/home/mongo/demo'], AttachStdout: true, AttachStderr: true });
          await exec.start({});
          updateStep(4, 'complete');
        } catch (err) {
          const logs = await getContainerLogs(containerName);
          setContainerLogs(logs || '(no output)');
          updateStep(4, 'error', 'Container stopped unexpectedly.');
          triggerError(4, toError(err));
          return;
        }
      }

      // Step 6: Connect
      updateStep(5, 'active');
      try {
        await attachToContainer(containerName);
        updateStep(5, 'complete');
        if (alive) onComplete();
      } catch (err) {
        updateStep(5, 'error', errMsg(err));
        triggerError(5, toError(err));
      }
    }

    run().catch(err => {
      if (alive) triggerError(0, toError(err));
    });

    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slug = getSlugFromTag(image.tag);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box justifyContent="center">
        <Text bold>🍃  Launching {image.description || slug}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column" paddingLeft={8}>
        {steps.map((step, i) => (
          <StepRow key={i} step={step} />
        ))}
        {containerLogs && (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Container output:</Text>
            <Text dimColor>{containerLogs}</Text>
          </Box>
        )}
        {errored && (
          <Box marginTop={1}>
            <Text dimColor>Press any key to go back</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
