import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../');
const README = join(ROOT, 'README.md');

describe('README.md', () => {
  it('should exist at the project root', () => {
    expect(existsSync(README)).toBe(true);
  });

  describe('structure', () => {
    let content: string;
    beforeAll(() => { content = readFileSync(README, 'utf8'); });

    it('should have an Installation section', () => {
      expect(content).toMatch(/#+\s+install/i);
    });

    it('should have a section covering available images', () => {
      expect(content).toMatch(/#+\s+(images|available images)/i);
    });

    it('should document all major CLI commands', () => {
      const commands = ['connect', 'list', 'env', 'setup', 'stop', 'start', 'run', 'remove', 'clean', 'status'];
      for (const cmd of commands) {
        expect(content, `README should mention ${cmd} command`).toContain(`mongostage ${cmd}`);
      }
    });

    it('should mention the TUI mode', () => {
      expect(content).toMatch(/tui|interactive/i);
    });

    it('should document the env file at ~/.mongostage/.env', () => {
      expect(content).toContain('.mongostage');
      expect(content).toContain('.env');
    });

    it('should call out the macOS Homebrew prerequisite', () => {
      expect(content).toMatch(/homebrew/i);
    });

    it('should call out the WSL2 path format gotcha', () => {
      expect(content).toMatch(/wsl2?/i);
    });
  });
});
