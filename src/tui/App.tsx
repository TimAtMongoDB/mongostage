import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { type ImageConfig } from '../types/image.js';
import { PageTabs, type ActivePage } from './PageTabs.js';
import { ImagesPage } from './images/ImagesPage.js';
import { ContainersPage } from './containers/ContainersPage.js';
import { TopologyPage } from './topology/TopologyPage.js';
import { LaunchScreen } from './LaunchScreen.js';
import { Logo } from './Logo.js';

interface AppProps {
  images: ImageConfig[];
  onContainerReady?: (containerName: string) => void;
}

export default function App({ images, onContainerReady }: AppProps): JSX.Element {
  const { exit } = useApp();
  const [activePage, setActivePage] = useState<ActivePage>('images');
  const [footerLine1, setFooterLine1] = useState('↑↓ navigate   ←→ filter   Enter launch   Esc quit');
  const [launchImage, setLaunchImage] = useState<ImageConfig | null>(null);

  // Clear terminal when entering launch screen so old App content doesn't bleed through
  useEffect(() => {
    if (launchImage) process.stdout.write('\x1B[2J\x1B[H');
  }, [launchImage]);

  // Track terminal width so the divider recomputes after resize.
  // The actual screen clear fires from index.ts (registered before render() so
  // it runs before Ink's handler). Here we only update state so Ink re-renders
  // the divider at the new width.
  const [termWidth, setTermWidth] = useState(process.stdout.columns ?? 80);
  useEffect(() => {
    const onResize = () => setTermWidth(process.stdout.columns ?? 80);
    process.stdout.on('resize', onResize);
    return () => { process.stdout.off('resize', onResize); };
  }, []);

  useInput((_input, key) => {
    if (launchImage) return;
    if (key.tab) {
      setActivePage(p => {
        if (p === 'images') return 'containers';
        if (p === 'containers') return 'topology';
        return 'images';
      });
    }
    // Escape is handled by each page so submenus can intercept it before exit fires
  });

  const tabArrow =
    activePage === 'images'
      ? 'Tab  Images ──► Containers ──► Topology'
      : activePage === 'containers'
      ? 'Tab  Images ◄── Containers ──► Topology'
      : 'Tab  Images ◄── Containers ◄── Topology';

  const divider = '─'.repeat(termWidth);

  if (launchImage) {
    return (
      <LaunchScreen
        image={launchImage}
        onComplete={(containerName) => { onContainerReady?.(containerName); exit(); }}
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
        ) : activePage === 'containers' ? (
          <ContainersPage footerHint={setFooterLine1} />
        ) : (
          <TopologyPage footerHint={setFooterLine1} />
        )}
      </Box>
      <Box flexDirection="column">
        <Text>{footerLine1}</Text>
        <Text dimColor>{tabArrow}</Text>
      </Box>
    </Box>
  );
}
