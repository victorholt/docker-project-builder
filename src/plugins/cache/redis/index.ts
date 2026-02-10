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
 * Redis cache plugin
 */
export class RedisPlugin implements IServicePlugin {
  name = 'redis';
  displayName = 'Redis';
  category: ServiceCategory = 'cache';
  defaultVersion = '7-alpine';
  availableVersions = ['7-alpine', '7', '6-alpine'];

  getPrompts(): PromptQuestion[] {
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      image: `redis:${this.defaultVersion}`,
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-redis`,
      command: 'redis-server --appendonly yes',
      volumes: [
        'redis_data:/data',
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
      ports: ['6379:6379'],
    };
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // In production, use external Redis or managed service
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
      REDIS_HOST: env === 'prod' ? 'your-prod-redis-host' : 'redis',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: env === 'prod' ? 'CHANGE_ME_IN_PRODUCTION' : '',
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [
      {
        name: 'redis_data',
        driver: 'local',
      },
    ];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig {
    return {
      test: ['CMD', 'redis-cli', 'ping'],
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
        name: 'redis-cli',
        description: 'Open Redis CLI',
        script: `#!/usr/bin/env bash

# Open Redis CLI

check_docker

info "Opening Redis CLI..."
dc exec redis redis-cli
`,
      },
    ];
  }
}

export default new RedisPlugin();
