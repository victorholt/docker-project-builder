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
 * MySQL database plugin
 */
export class MysqlPlugin implements IServicePlugin {
  name = 'mysql';
  displayName = 'MySQL';
  category: ServiceCategory = 'database';
  defaultVersion = '8-alpine';
  availableVersions = ['8-alpine', '8', '5.7'];

  getPrompts(): PromptQuestion[] {
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      image: `mysql:${this.defaultVersion}`,
      container_name: `\${CONTAINER_PREFIX}-mysql`,
      environment: {
        MYSQL_ROOT_PASSWORD: '\${MYSQL_ROOT_PASSWORD}',
        MYSQL_DATABASE: '\${MYSQL_DATABASE}',
        MYSQL_USER: '\${MYSQL_USER}',
        MYSQL_PASSWORD: '\${MYSQL_PASSWORD}',
      },
      volumes: [
        'mysql_data:/var/lib/mysql',
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
      ports: ['3306:3306'],
    };
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // In production, use external database
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
      MYSQL_HOST: env === 'prod' ? 'your-prod-mysql-host' : 'mysql',
      MYSQL_PORT: 3306,
      MYSQL_DATABASE: config.projectName,
      MYSQL_USER: 'dbuser',
      MYSQL_PASSWORD: env === 'prod' ? 'CHANGE_ME_IN_PRODUCTION' : 'devpassword',
      MYSQL_ROOT_PASSWORD: env === 'prod' ? 'CHANGE_ME_IN_PRODUCTION' : 'rootpassword',
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [
      {
        name: 'mysql_data',
        driver: 'local',
      },
    ];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig {
    return {
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-u', 'root', '-p$${MYSQL_ROOT_PASSWORD}'],
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
        name: 'db-mysql',
        description: 'Open MySQL shell',
        script: `#!/usr/bin/env bash

# Open MySQL shell

check_docker
load_env

info "Opening MySQL shell..."
dc exec mysql mysql -u "\${MYSQL_USER}" -p"\${MYSQL_PASSWORD}" "\${MYSQL_DATABASE}"
`,
      },
    ];
  }
}

export default new MysqlPlugin();
