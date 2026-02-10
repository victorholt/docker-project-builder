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
 * PostgreSQL database plugin
 */
export class PostgresPlugin implements IServicePlugin {
  name = 'postgres';
  displayName = 'PostgreSQL';
  category: ServiceCategory = 'database';
  defaultVersion = '16-alpine';
  availableVersions = ['16-alpine', '15-alpine', '14-alpine'];

  getPrompts(): PromptQuestion[] {
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      image: `postgres:${this.defaultVersion}`,
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-postgres`,
      environment: {
        POSTGRES_USER: `\${POSTGRES_USER:-${config.projectName}_user}`,
        POSTGRES_PASSWORD: `\${POSTGRES_PASSWORD:-${config.projectName}_pass}`,
        POSTGRES_DB: `\${POSTGRES_DB:-${config.projectName}_db}`,
        PGDATA: '/var/lib/postgresql/data/pgdata',
      },
      volumes: [
        'postgres_data:/var/lib/postgresql/data',
      ],
      networks: ['app-network'],
      restart: 'unless-stopped',
      healthcheck: this.getHealthCheck(config),
      profiles: ['local'],  // Only run in local dev
    };
  }

  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null {
    return {
      serviceName: this.name,
      ports: ['5432:5432'],
    };
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // In production, use external database
    return null;
  }

  getDockerfile(config: ProjectConfig): string | null {
    // Use stock PostgreSQL image
    return null;
  }

  getEntrypoint(config: ProjectConfig): string | null {
    return null;
  }

  getEnvVars(config: ProjectConfig, env: Environment): EnvVarBlock {
    return {
      POSTGRES_HOST: env === 'prod' ? 'your-prod-db-host' : 'postgres',
      POSTGRES_PORT: 5432,
      POSTGRES_USER: 'dbuser',
      POSTGRES_PASSWORD: env === 'prod' ? 'CHANGE_ME_IN_PRODUCTION' : 'devpassword',
      POSTGRES_DB: config.projectName,
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [
      {
        name: 'postgres_data',
        driver: 'local',
      },
    ];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig {
    return {
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}'],
      interval: '10s',
      timeout: '5s',
      retries: 5,
      start_period: '10s',
    };
  }

  getProxyRoutes(config: ProjectConfig): ProxyRoute[] {
    // Database doesn't need proxy routes
    return [];
  }

  getCLICommands(config: ProjectConfig): CLICommand[] {
    return [
      {
        name: 'db-psql',
        description: 'Open PostgreSQL shell',
        script: `#!/usr/bin/env bash

# Open PostgreSQL shell

check_docker
load_env

info "Opening PostgreSQL shell..."
dc exec postgres psql -U "\${POSTGRES_USER}" -d "\${POSTGRES_DB}"
`,
      },
    ];
  }
}

export default new PostgresPlugin();
