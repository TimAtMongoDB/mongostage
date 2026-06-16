export interface ComponentConfig {
  label: string;
  description: string;
  order: number;
}

export interface ImageConfig {
  tag: string;
  components: string[];
  description: string;
  category: 'base' | 'shell' | 'runtime' | 'ai' | 'server';
}

export interface ImageRegistry {
  components: Record<string, ComponentConfig>;
  images: ImageConfig[];
}

export interface CliConfig {
  setupComplete: boolean;
  os: 'linux' | 'mac' | 'windows';
  dockerMethod: 'engine' | 'colima';
  defaultOrg: string;
  lastUpdated: string;
}
