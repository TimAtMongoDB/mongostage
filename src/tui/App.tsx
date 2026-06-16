import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { type ImageConfig } from '../types/image.js';
import { PageTabs, type ActivePage } from './PageTabs.js';
import { ImagesPage } from './images/ImagesPage.js';
import { ContainersPage } from './containers/ContainersPage.js';
import { LaunchScreen } from './LaunchScreen.js';
import { Logo } from './Logo.js';

interface AppProps {
  images: ImageConfig[];
}

export default function App({ images }: AppProps): JSX.Element {
  const { exit } = useApp();
  const [activePage, setActivePage] = useState<ActivePage>('images');
  const [footerLine1, setFooterLine1] = useState('↑↓ navigate   ←→ filter   Enter launch   Esc quit');
  const [launchImage, setLaunchImage] = useState<ImageConfig | null>(null);

  useInput((_input, key) => {
    if (launchImage) return;
    if (key.tab) {
      setActivePage(p => (p === 'images' ? 'containers' : 'images'));
    }
    if (key.escape) {
      exit();
    }
  });

  const tabArrow =
    activePage === 'images'
      ? 'Tab ──────────────────────────────────► Containers'
      : 'Tab ◄──────────────────────────────────── Images';

  const termWidth = process.stdout.columns ?? 80;
  const divider = '─'.repeat(termWidth);

  if (launchImage) {
    return (
      <LaunchScreen
        image={launchImage}
        onComplete={() => { exit(); }}
        onError={() => { setLaunchImage(null); }}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Logo />
      <Box>
        <Text> </Text>
      </Box>
      <PageTabs activePage={activePage} />
      <Text>{divider}</Text>
      <Box flexDirection="column" flexGrow={1}>
        {activePage === 'images' ? (
          <ImagesPage
            images={images}
            onLaunch={(img) => { setLaunchImage(img); }}
            footerHint={setFooterLine1}
          />
        ) : (
          <ContainersPage footerHint={setFooterLine1} />
        )}
      </Box>
      <Box flexDirection="column">
        <Text>{footerLine1}</Text>
        <Text dimColor>{tabArrow}</Text>
      </Box>
    </Box>
  );
}
