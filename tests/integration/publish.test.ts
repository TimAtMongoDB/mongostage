import { describe, it } from 'vitest';

// Integration tests for the publish command.
// These tests require GITHUB_TOKEN to be set and will publish to GitHub Packages.
// Run manually before each release; do not run in CI automatically.

describe('publish command', () => {
  describe('pre-flight checks', () => {
    it.skip('should fail when GITHUB_TOKEN is not set', () => { /* MDD skeleton */ });
    it.skip('should fail when images.json has uncommitted changes', () => { /* MDD skeleton */ });
    it.skip('should fail when the target version already exists on GitHub Packages', () => { /* MDD skeleton */ });
  });

  describe('version bumping', () => {
    it.skip('should bump patch version and write to package.json', () => { /* MDD skeleton */ });
    it.skip('should bump minor version and reset patch to 0', () => { /* MDD skeleton */ });
    it.skip('should bump major version and reset minor and patch to 0', () => { /* MDD skeleton */ });
    it.skip('should accept a custom semver version string', () => { /* MDD skeleton */ });
    it.skip('should reject an invalid semver string', () => { /* MDD skeleton */ });
  });

  describe('dry-run', () => {
    it.skip('should show what would be published without building or publishing', () => { /* MDD skeleton */ });
    it.skip('should not modify package.json when --dry-run is set', () => { /* MDD skeleton */ });
  });
});
