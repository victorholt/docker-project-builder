import type {
  IServicePlugin,
  ServiceCategory,
  ProjectConfig,
  PromptQuestion,
  ComposeServiceBlock,
  EnvVarBlock,
  VolumeDefinition,
  NetworkDefinition,
  HealthCheckConfig,
  ProxyRoute,
  CLICommand,
  Environment,
} from '../../../core/interfaces/service-plugin.js';

/**
 * Valkey cache plugin (Redis fork)
 */
export class ValkeyPlugin implements IServicePlugin {
  name = 'valkey';
  displayName = 'Valkey';
  category: ServiceCategory = 'cache';
  defaultVersion = 'latest';
  availableVersions = ['latest', '7.2', '7.0'];

  getPrompts(): PromptQuestion[] {
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      image: `valkey/valkey:${this.defaultVersion}`,
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-valkey`,
      command: 'valkey-server --appendonly yes',
      volumes: [
        'valkey_data:/data',
      ],
      networks: ['app-network'],
      restart: 'unless-stopped',
      healthcheck: this.getHealthCheck(config),
      profiles: ['local'],
    };
  }

  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null {
    return {
      serviceName: this.name,
      ports: ['6380:6379'],  // Different port to avoid conflict with Redis
    };
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // In production, use external Valkey or managed service
    return null;
  }

  getDockerfile(config: ProjectConfig): string | null {
    return null;
  }

  getEntrypoint(config: ProjectConfig): string | null {
    return null;
  }

  getEnvVars(config: ProjectConfig, env: Environment): EnvVarBlock {
    return {
      VALKEY_HOST: env === 'prod' ? 'your-prod-valkey-host' : 'valkey',
      VALKEY_PORT: 6379,
      VALKEY_PASSWORD: env === 'prod' ? 'CHANGE_ME_IN_PRODUCTION' : '',
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [
      {
        name: 'valkey_data',
        driver: 'local',
      },
    ];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig {
    return {
      test: ['CMD', 'valkey-cli', 'ping'],
      interval: '10s',
      timeout: '5s',
      retries: 5,
      start_period: '10s',
    };
  }

  getProxyRoutes(config: ProjectConfig): ProxyRoute[] {
    return [];
  }

  getCLICommands(config: ProjectConfig): CLICommand[] {
    return [
      {
        name: 'valkey-cli',
        description: 'Open Valkey CLI',
        script: `#!/usr/bin/env bash

# Open Valkey CLI

check_docker

info "Opening Valkey CLI..."
dc exec valkey valkey-cli
`,
      },
    ];
  }
}

export default new ValkeyPlugin();
