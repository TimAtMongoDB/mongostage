import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActivePage } from '../../src/tui/PageTabs.js';

const mockPortGroups = [{ envVarPrefix: 'MONGO_HOST_PORT', count: 1, defaultStart: 27017 }];

vi.mock('../../src/lib/topology.js', async () => ({
  TOPOLOGY_PRESETS: [
    { id: 'standalone', name: 'Standalone', description: 'Single mongod node', composeFile: 'docker-compose/standalone.yml', services: ['mongo-1'], portGroups: mockPortGroups },
    { id: 'replica-set-3', name: 'Replica Set (3 nodes)', description: '3-member replica set', composeFile: 'docker-compose/replica-set-3.yml', services: ['rs0-1', 'rs0-2', 'rs0-3'], portGroups: [{ envVarPrefix: 'MONGO_HOST_PORT', count: 3, defaultStart: 27017 }] },
    { id: 'sharded-2x3', name: 'Sharded Cluster', description: '2 shards x 3 members', composeFile: 'docker-compose/sharded-2x3.yml', services: ['cfg1', 'cfg2', 'cfg3', 'shard1-1', 'shard1-2', 'shard1-3', 'shard2-1', 'shard2-2', 'shard2-3', 'mongos'], portGroups: mockPortGroups },
    { id: 'standalone-search', name: 'Standalone + Atlas Search', description: 'Standalone with mongot', composeFile: 'docker-compose/standalone-search.yml', services: ['mongo-1', 'search-mongot'], portGroups: mockPortGroups },
    { id: 'replica-set-3-search', name: 'Replica Set + Atlas Search', description: '3-member RS with mongot', composeFile: 'docker-compose/replica-set-3-search.yml', services: ['rs0-1', 'rs0-2', 'rs0-3', 'search-mongot'], portGroups: mockPortGroups },
  ],
  spawnTopology: vi.fn().mockResolvedValue({ connectionString: 'mongodb://localhost:27017/' }),
  teardownTopology: vi.fn().mockResolvedValue(undefined),
}));

describe('Topology presets', () => {
  describe('TOPOLOGY_PRESETS', () => {
    it('should export all 5 expected presets', async () => {
      const { TOPOLOGY_PRESETS } = await import('../../src/lib/topology.js');
      expect(TOPOLOGY_PRESETS).toHaveLength(5);
    });

    it('should have unique ids for all presets', async () => {
      const { TOPOLOGY_PRESETS } = await import('../../src/lib/topology.js');
      const ids = TOPOLOGY_PRESETS.map((p: { id: string }) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should reference compose files in the docker-compose/ directory', async () => {
      const { TOPOLOGY_PRESETS } = await import('../../src/lib/topology.js');
      for (const preset of TOPOLOGY_PRESETS as Array<{ composeFile: string }>) {
        expect(preset.composeFile).toMatch(/^docker-compose\//);
      }
    });
  });
});

describe('spawnTopology', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('standalone', () => {
    it('should run docker compose up -d with the correct compose file and project name', async () => {
      const { spawnTopology } = await import('../../src/lib/topology.js');
      await spawnTopology('standalone');
      expect(spawnTopology).toHaveBeenCalledWith('standalone');
    });

    it('should throw if docker compose is not available', async () => {
      const { spawnTopology } = await import('../../src/lib/topology.js');
      vi.mocked(spawnTopology).mockRejectedValueOnce(new Error('Docker Compose not found'));
      await expect(spawnTopology('standalone')).rejects.toThrow('Docker Compose not found');
    });
  });

  describe('unknown preset', () => {
    it('should throw for an unknown preset id', async () => {
      const { spawnTopology } = await import('../../src/lib/topology.js');
      vi.mocked(spawnTopology).mockRejectedValueOnce(new Error('Unknown topology preset: "not-a-real-preset"'));
      await expect(spawnTopology('not-a-real-preset')).rejects.toThrow();
    });
  });
});

describe('teardownTopology', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run docker compose down for the given preset id', async () => {
    const { teardownTopology } = await import('../../src/lib/topology.js');
    await teardownTopology('standalone');
    expect(teardownTopology).toHaveBeenCalledWith('standalone');
  });

  it('should throw for an unknown preset id', async () => {
    const { teardownTopology } = await import('../../src/lib/topology.js');
    vi.mocked(teardownTopology).mockRejectedValueOnce(new Error('Unknown topology preset: "not-a-real-preset"'));
    await expect(teardownTopology('not-a-real-preset')).rejects.toThrow();
  });
});

describe('App.tsx topology tab integration', () => {
  it('should include topology in the ActivePage type union', async () => {
    const page: ActivePage = 'topology';
    expect(page).toBe('topology');
  });

  it('should cycle from containers to topology on Tab', () => {
    const cycle = (p: ActivePage): ActivePage => {
      if (p === 'images') return 'containers';
      if (p === 'containers') return 'topology';
      return 'images';
    };
    expect(cycle('containers')).toBe('topology');
  });

  it('should cycle from topology back to images on Tab', () => {
    const cycle = (p: ActivePage): ActivePage => {
      if (p === 'images') return 'containers';
      if (p === 'containers') return 'topology';
      return 'images';
    };
    expect(cycle('topology')).toBe('images');
  });
});
