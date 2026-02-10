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
 * Express.js API plugin
 * Note: name is 'api' (not 'expressjs') to match the generated folder apps/api/
 */
export class ExpressjsPlugin implements IServicePlugin {
  name = 'api';
  displayName = 'Express.js API';
  category: ServiceCategory = 'app';
  defaultVersion = '20-alpine';
  availableVersions = ['20-alpine', '18-alpine', '21-alpine'];

  getPrompts(): PromptQuestion[] {
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      build: {
        context: '../..',
        dockerfile: 'docker/images/api.Dockerfile',
        target: 'development',
      },
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-api`,
      environment: {
        NODE_ENV: 'development',
        PORT: '4000',
      },
      networks: ['app-network'],
      restart: 'unless-stopped',
      healthcheck: this.getHealthCheck(config),
    };
  }

  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null {
    return {
      serviceName: this.name,
      volumes: [
        '../../apps/api:/app',
        '/app/node_modules',
      ],
      ports: [`\${API_EXTERNAL_PORT:-${(config as any).ports?.api || 4000}}:4000`],
      command: 'npm run dev',
    };
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    return {
      serviceName: this.name,
      build: {
        context: '../..',
        dockerfile: 'docker/images/api.Dockerfile',
        target: 'production',
      },
      environment: {
        NODE_ENV: 'production',
      },
      command: 'npm start',
    };
  }

  getDockerfile(config: ProjectConfig): string {
    return `# Multi-stage Dockerfile for Express.js API
FROM node:${this.defaultVersion} AS base
WORKDIR /app

# Development stage
FROM base AS development
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/ ./

COPY docker/scripts/api-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
COPY apps/api/package*.json ./
RUN npm ci --only=production
COPY apps/api/ ./

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start"]
`;
  }

  getEntrypoint(config: ProjectConfig): string {
    return `#!/bin/sh
set -e

if [ -f "package.json" ]; then
    echo "Checking dependencies..."
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
fi

exec "$@"
`;
  }

  getEnvVars(config: ProjectConfig, env: Environment): EnvVarBlock {
    const externalPort = (config as any).ports?.[this.name] || 4000;
    return {
      API_PORT: 4000,
      API_EXTERNAL_PORT: externalPort,
      API_HOST: '0.0.0.0',
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig {
    return {
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:4000/health'],
      interval: '30s',
      timeout: '10s',
      retries: 3,
      start_period: '40s',
    };
  }

  getProxyRoutes(config: ProjectConfig): ProxyRoute[] {
    return [
      {
        serviceName: this.name,
        path: '/api',
        subdomain: 'api',
        port: 4000,
      },
    ];
  }

  getCLICommands(config: ProjectConfig): CLICommand[] {
    return [];
  }
}

export default new ExpressjsPlugin();
