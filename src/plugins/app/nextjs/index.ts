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
 * Next.js application plugin
 */
export class NextjsPlugin implements IServicePlugin {
  name = 'nextjs';
  displayName = 'Next.js';
  category: ServiceCategory = 'app';
  defaultVersion = '20-alpine';
  availableVersions = ['20-alpine', '18-alpine', '21-alpine'];

  getPrompts(): PromptQuestion[] {
    return [
      {
        type: 'list',
        name: 'nextjs_version',
        message: 'Select Node.js version for Next.js:',
        choices: this.availableVersions.map((v) => ({
          name: `Node.js ${v}`,
          value: v,
        })),
        default: this.defaultVersion,
      },
    ];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      build: {
        context: '../..',
        dockerfile: 'docker/images/nextjs.Dockerfile',
        target: 'development',
      },
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-nextjs`,
      environment: {
        NODE_ENV: 'development',
        NEXT_TELEMETRY_DISABLED: '1',
        // Default to empty so the browser makes same-origin `/api/*`
        // requests through the HTTPS reverse proxy. `${VAR-}` (no colon)
        // lets an explicitly-empty value through unchanged.
        NEXT_PUBLIC_API_URL: '${NEXT_PUBLIC_API_URL-}',
      },
      networks: ['app-network'],
      restart: 'unless-stopped',
      healthcheck: this.getHealthCheck(config),
    };
  }

  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null {
    // Dev: Hot reload with host volume mounts.
    //
    // NOTE: Next.js is intentionally NOT exposed on a host port by default.
    // It is only reachable through the HTTPS reverse proxy, which gives
    // you a trusted TLS cert and matches the prod topology.
    //
    // If you truly need Next.js on localhost directly, add a `ports` entry
    // back here, for example:
    //     ports: [`\${NEXTJS_EXTERNAL_PORT:-${(config as any).ports?.nextjs || 3000}}:3000`]
    // and set NEXTJS_EXTERNAL_PORT in .env.
    return {
      serviceName: this.name,
      volumes: [
        '../../apps/nextjs:/app',
        '/app/node_modules',
      ],
      command: 'npm run dev',
    };
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // Prod: Build and run production build
    return {
      serviceName: this.name,
      build: {
        context: '../..',
        dockerfile: 'docker/images/nextjs.Dockerfile',
        target: 'production',
      },
      environment: {
        NODE_ENV: 'production',
      },
      command: 'npm start',
    };
  }

  getDockerfile(config: ProjectConfig): string {
    return `# Multi-stage Dockerfile for Next.js
# Stage 1: Base
FROM node:${this.defaultVersion} AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY apps/nextjs/package*.json ./
RUN npm ci --only=production && \\
    npm cache clean --force

# Stage 2: Development
FROM base AS development
COPY apps/nextjs/package*.json ./
RUN npm install
COPY apps/nextjs/ ./

# Copy entrypoint
COPY docker/scripts/nextjs-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Stage 3: Builder
FROM base AS builder
COPY apps/nextjs/package*.json ./
RUN npm ci
COPY apps/nextjs/ ./
RUN npm run build

# Stage 4: Production
FROM node:${this.defaultVersion} AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
`;
  }

  getEntrypoint(config: ProjectConfig): string {
    return `#!/bin/sh
set -e

# Install dependencies if package.json changed
if [ -f "package.json" ]; then
    echo "Checking for dependency changes..."

    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    else
        echo "Dependencies up to date"
    fi
fi

# Execute the main command
exec "$@"
`;
  }

  getEnvVars(config: ProjectConfig, env: Environment): EnvVarBlock {
    const externalPort = (config as any).ports?.[this.name] || 3000;
    // Each environment's API URL points at that environment's domain. Fall
    // back through the domain precedence if the exact env isn't configured
    // (e.g. generating the local .env but only prod was selected).
    const envDomain =
      config.domains[env] ??
      config.domains.local ??
      config.domains.staging ??
      config.domains.prod ??
      '';
    return {
      NEXTJS_PORT: 3000,
      NEXTJS_EXTERNAL_PORT: externalPort,
      NEXT_PUBLIC_API_URL: env === 'prod'
        ? `https://api.${envDomain}`
        : `http://${envDomain}:${(config as any).ports?.api || 4000}`,
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];  // Uses app-network from proxy
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig {
    return {
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:3000/'],
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
        path: '/',
        subdomain: 'www',
        port: 3000,
      },
    ];
  }

  getCLICommands(config: ProjectConfig): CLICommand[] {
    return [
      {
        name: 'nextjs-install',
        description: 'Install Next.js dependencies',
        script: `#!/usr/bin/env bash

# Install Next.js dependencies

check_docker

info "Installing Next.js dependencies..."
dc exec nextjs npm install

success "Dependencies installed!"
`,
      },
      {
        name: 'nextjs-build',
        description: 'Build Next.js application',
        script: `#!/usr/bin/env bash

# Build Next.js application

check_docker

info "Building Next.js application..."
dc exec nextjs npm run build

success "Build completed!"
`,
      },
    ];
  }
}

// Export default instance
export default new NextjsPlugin();
