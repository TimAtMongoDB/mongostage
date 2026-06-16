import React, { useState, useEffect, useCallback } from 'react';
import { Box, useInput } from 'ink';
import type { ImageConfig } from '../../types/image.js';
import { FilterBar, FILTER_TABS, type ImageFilter } from './FilterBar.js';
import { ImageList } from './ImageList.js';
import { ImageDetail } from './ImageDetail.js';

interface ImagesPageProps {
  images: ImageConfig[];
  onLaunch: (image: ImageConfig) => void;
  footerHint: (hint: string) => void;
}

const FOOTER = '↑↓ navigate   ←→ filter   Enter launch   Esc quit';

function filterImages(images: ImageConfig[], filter: ImageFilter, search: string): ImageConfig[] {
  let result = filter === 'all' ? images : images.filter(img => img.category === filter);
  if (search) {
    const lower = search.toLowerCase();
    result = result.filter(img => img.tag.toLowerCase().includes(lower));
  }
  return result;
}

export function ImagesPage({ images, onLaunch, footerHint }: ImagesPageProps): JSX.Element {
  const [activeFilter, setActiveFilter] = useState<ImageFilter>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState('');

  const filteredImages = filterImages(images, activeFilter, search);

  useEffect(() => {
    footerHint(FOOTER);
  }, [footerHint]);

  // Reset selection when filter/search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeFilter, search]);

  const filterIndex = FILTER_TABS.findIndex(t => t.key === activeFilter);

  const changeFilter = useCallback((dir: 1 | -1) => {
    const next = (filterIndex + dir + FILTER_TABS.length) % FILTER_TABS.length;
    setActiveFilter(FILTER_TABS[next].key);
    setSearch('');
  }, [filterIndex]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(filteredImages.length - 1, i + 1));
      return;
    }
    if (key.leftArrow) {
      changeFilter(-1);
      return;
    }
    if (key.rightArrow) {
      changeFilter(1);
      return;
    }
    if (key.return) {
      const selected = filteredImages[selectedIndex];
      if (selected) onLaunch(selected);
      return;
    }
    if (key.backspace || key.delete) {
      setSearch(s => s.slice(0, -1));
      return;
    }
    // Any printable character appends to search (not Tab, Escape, Enter, arrows)
    if (
      input &&
      !key.tab &&
      !key.escape &&
      !key.ctrl &&
      !key.meta &&
      input.split('').every(ch => ch.charCodeAt(0) >= 32)
    ) {
      setSearch(s => s + input);
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <FilterBar activeFilter={activeFilter} />
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width="50%">
          <ImageList
            images={filteredImages}
            selectedIndex={selectedIndex}
          />
        </Box>
        <Box flexDirection="column" width="50%">
          <ImageDetail
            image={filteredImages[selectedIndex]}
            mongoMount={process.env.MONGO_MOUNT}
            mongoWorkdir={process.env.MONGO_WORKDIR}
          />
        </Box>
      </Box>
    </Box>
  );
}
