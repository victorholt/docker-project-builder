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
 * Apache HTTP Server plugin for reverse proxy
 */
export class ApacheProxyPlugin implements IServicePlugin {
  name = 'proxy';
  displayName = 'Apache Proxy';
  category: ServiceCategory = 'proxy';
  defaultVersion = '2.4-alpine';
  availableVersions = ['2.4-alpine', '2.4'];

  getPrompts(): PromptQuestion[] {
    // Apache proxy is always included, no prompts needed
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: 'proxy',
      build: {
        context: '../..',
        dockerfile: 'docker/proxy/Dockerfile',
      },
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-proxy`,
      ports: [
        `\${PROXY_PORT:-${config.proxy.port}}:80`,
        `\${PROXY_SSL_PORT:-${config.proxy.sslPort}}:443`,
      ],
      volumes: [
        '../../docker/proxy/httpd.conf:/usr/local/apache2/conf/httpd.conf:ro',
        '../../docker/proxy/httpd-vhosts.conf:/usr/local/apache2/conf/vhosts/httpd-vhosts.conf:ro',
        '../../docker/ssl:/usr/local/apache2/conf/ssl:ro',
      ],
      networks: ['app-network'],
      depends_on: this.getAppServiceDependencies(config),
      restart: 'unless-stopped',
      healthcheck: this.getHealthCheck(config),
    };
  }

  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null {
    // In dev, use base path-based routing (works with localhost)
    // No override needed - base config already has path-based routing
    return null;
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // In prod, use prod vhosts configuration + certbot webroot volume
    return {
      serviceName: 'proxy',
      volumes: [
        '../../docker/proxy/httpd-vhosts-prod.conf:/usr/local/apache2/conf/vhosts/httpd-vhosts.conf:ro',
        'certbot-webroot:/usr/local/apache2/htdocs',
      ],
    };
  }

  getDockerfile(config: ProjectConfig): string {
    return `# Apache HTTP Server with proxy modules
FROM httpd:${this.defaultVersion}

# Install required modules (most are already included)
# Enable proxy modules
RUN sed -i 's/#LoadModule proxy_module/LoadModule proxy_module/' /usr/local/apache2/conf/httpd.conf && \\
    sed -i 's/#LoadModule proxy_http_module/LoadModule proxy_http_module/' /usr/local/apache2/conf/httpd.conf && \\
    sed -i 's/#LoadModule rewrite_module/LoadModule rewrite_module/' /usr/local/apache2/conf/httpd.conf && \\
    sed -i 's/#LoadModule ssl_module/LoadModule ssl_module/' /usr/local/apache2/conf/httpd.conf && \\
    sed -i 's/#LoadModule socache_shmcb_module/LoadModule socache_shmcb_module/' /usr/local/apache2/conf/httpd.conf

# Create vhosts config directory
RUN mkdir -p /usr/local/apache2/conf/vhosts && \\
    mkdir -p /usr/local/apache2/conf/ssl && \\
    mkdir -p /usr/local/apache2/htdocs/.well-known/acme-challenge

# Copy entrypoint script
COPY docker/scripts/proxy-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["httpd-foreground"]
`;
  }

  getEntrypoint(config: ProjectConfig): string {
    return `#!/bin/sh
set -e

# Wait for app services to be ready (optional, helps with startup)
echo "Starting Apache proxy..."

# Execute the main command
exec "$@"
`;
  }

  getEnvVars(config: ProjectConfig, env: Environment): EnvVarBlock {
    return {
      PROXY_PORT: env === 'prod' ? 80 : config.proxy.port,
      PROXY_SSL_PORT: env === 'prod' ? 443 : config.proxy.sslPort,
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    // certbot-webroot is used in staging/prod for Let's Encrypt ACME challenges
    if (config.environments.includes('staging') || config.environments.includes('prod')) {
      return [
        {
          name: 'certbot-webroot',
          driver: 'local',
        },
      ];
    }
    return [];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [
      {
        name: 'app-network',
        driver: 'bridge',
      },
    ];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig {
    return {
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:80/'],
      interval: '10s',
      timeout: '5s',
      retries: 3,
      start_period: '10s',
    };
  }

  getProxyRoutes(config: ProjectConfig): ProxyRoute[] {
    // Proxy doesn't define its own routes, other services do
    return [];
  }

  getCLICommands(config: ProjectConfig): CLICommand[] {
    return [
      {
        name: 'proxy-logs',
        description: 'View Apache proxy logs',
        script: `#!/usr/bin/env bash

# View Apache proxy logs

check_docker

info "Apache Proxy Logs:"
echo ""
dc logs -f proxy
`,
      },
      {
        name: 'proxy-reload',
        description: 'Reload Apache configuration',
        script: `#!/usr/bin/env bash

# Reload Apache proxy configuration

check_docker

info "Reloading Apache configuration..."
dc exec proxy httpd -k graceful

success "Apache configuration reloaded!"
`,
      },
    ];
  }

  /**
   * Helper: Get app service dependencies for proxy
   */
  private getAppServiceDependencies(config: ProjectConfig): string[] {
    return config.services
      .filter((s) => s.category === 'app')
      .map((s) => s.name);
  }
}

// Export default instance
export default new ApacheProxyPlugin();
