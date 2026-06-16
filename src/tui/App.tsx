import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { type ImageConfig } from '../types/image.js';
import { PageTabs, type ActivePage } from './PageTabs.js';
import { ImagesPage as _ImagesPage } from './images/ImagesPage.js';
import { ContainersPage as _ContainersPage } from './containers/ContainersPage.js';
import { LaunchScreen } from './LaunchScreen.js';

interface AppProps {
  images: ImageConfig[];
}

// Placeholder props shape that feature 11 (ImagesPage) and 12 (ContainersPage) will satisfy
interface ImagesPageProps {
  images: ImageConfig[];
  onLaunch: (image: ImageConfig) => void;
  footerHint: (hint: string) => void;
}

interface ContainersPageProps {
  footerHint: (hint: string) => void;
}

// Placeholders replaced when features 11 and 12 are built
function ImagesPagePlaceholder({ images, footerHint }: ImagesPageProps): JSX.Element {
  useEffect(() => {
    footerHint('↑↓ navigate   ←→ filter   Enter launch   Esc quit');
  }, [footerHint]);
  return <Text dimColor>  {images.length} images available — Images page coming in feature 11</Text>;
}

function ContainersPagePlaceholder({ footerHint }: ContainersPageProps): JSX.Element {
  useEffect(() => {
    footerHint('↑↓ navigate   Enter action   Esc quit');
  }, [footerHint]);
  return <Text dimColor>  Containers page coming in feature 12</Text>;
}

let ImagesPage: (props: ImagesPageProps) => JSX.Element = _ImagesPage;
let ContainersPage: (props: ContainersPageProps) => JSX.Element = _ContainersPage;

// Features 11 and 12 call these to register their implementations
export function registerImagesPage(component: typeof ImagesPage): void {
  ImagesPage = component;
}

export function registerContainersPage(component: typeof ContainersPage): void {
  ContainersPage = component;
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

  const termWidth = process.stdout.columns || 80;
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
      <Box marginLeft={2}>
        <Text>🍃  mongo-docker</Text>
      </Box>
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
