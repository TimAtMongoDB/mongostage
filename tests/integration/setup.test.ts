/**
 * Integration tests for the setup command.
 * Requires a machine without Docker or with a fresh Docker installation.
 * Run manually only — do not run in CI.
 */
import { describe, it } from 'vitest';

describe('setup command integration', () => {
  it.skip('should detect Docker is already installed and skip install — requires host without Docker', () => { /* MDD skeleton */ });
  it.skip('should install rootless Docker on Ubuntu 24.04 — requires a clean VM', () => { /* MDD skeleton */ });
  it.skip('should fall back to system-level Docker when rootless fails — requires a clean VM', () => { /* MDD skeleton */ });
});
