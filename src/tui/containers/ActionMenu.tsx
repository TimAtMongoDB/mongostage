import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

type RowType = 'running' | 'stopped' | 'image';

const ACTIONS: Record<RowType, string[]> = {
  running: ['Connect', 'Stop', 'Remove (force)'],
  stopped: ['Connect', 'Start', 'Remove'],
  image: ['Remove'],
};

interface ActionMenuProps {
  rowType: RowType;
  targetName: string;
  onAction: (action: string) => void;
  onClose: () => void;
}

export function ActionMenu({ rowType, targetName, onAction, onClose }: ActionMenuProps): JSX.Element {
  const actions = ACTIONS[rowType];
  const [selectedAction, setSelectedAction] = useState(0);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  const isDestructive = (action: string) =>
    action === 'Remove' || action === 'Remove (force)';

  useInput((input, key) => {
    if (confirmingAction !== null) {
      if (key.return) {
        if (confirmInput.toLowerCase() === 'y' || confirmInput.toLowerCase() === 'yes') {
          onAction(confirmingAction);
        } else {
          setConfirmingAction(null);
          setConfirmInput('');
        }
        return;
      }
      if (key.escape) {
        setConfirmingAction(null);
        setConfirmInput('');
        return;
      }
      if (key.backspace || key.delete) {
        setConfirmInput(s => s.slice(0, -1));
        return;
      }
      if (input && input.charCodeAt(0) >= 32) {
        setConfirmInput(s => s + input);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedAction(i => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedAction(i => Math.min(actions.length - 1, i + 1));
      return;
    }
    if (key.return) {
      const action = actions[selectedAction];
      if (isDestructive(action ?? '')) {
        setConfirmingAction(action ?? null);
        setConfirmInput('');
      } else {
        onAction(action ?? '');
      }
      return;
    }
    if (key.escape || key.leftArrow) {
      onClose();
    }
  });

  if (confirmingAction !== null) {
    return (
      <Box marginLeft={4} flexDirection="column">
        <Text color="red">Remove {targetName}? [y/N]: {confirmInput}</Text>
      </Box>
    );
  }

  return (
    <Box marginLeft={4} flexDirection="column">
      {actions.map((action, i) => (
        i === selectedAction ? (
          <Text key={action} color="#00ED64">▶ {action}</Text>
        ) : (
          <Text key={action} dimColor>  {action}</Text>
        )
      ))}
    </Box>
  );
}
