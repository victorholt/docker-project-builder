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
 * Mailpit email testing plugin (MailHog alternative)
 */
export class MailpitPlugin implements IServicePlugin {
  name = 'mailpit';
  displayName = 'Mailpit';
  category: ServiceCategory = 'mail';
  defaultVersion = 'latest';
  availableVersions = ['latest', 'v1.15', 'v1.14'];

  getPrompts(): PromptQuestion[] {
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      image: `axllent/mailpit:${this.defaultVersion}`,
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-mailpit`,
      ports: [
        '1025:1025',  // SMTP
        '8025:8025',  // Web UI
      ],
      environment: {
        MP_SMTP_AUTH_ACCEPT_ANY: '1',
        MP_SMTP_AUTH_ALLOW_INSECURE: '1',
      },
      networks: ['app-network'],
      restart: 'unless-stopped',
      profiles: ['local'],
    };
  }

  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null {
    return null;
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // Mailpit is only for local development
    return null;
  }

  getDockerfile(config: ProjectConfig): string | null {
    return null;
  }

  getEntrypoint(config: ProjectConfig): string | null {
    return null;
  }

  getEnvVars(config: ProjectConfig, env: Environment): EnvVarBlock {
    if (env === 'prod') {
      return {
        MAIL_HOST: 'your-prod-mail-host',
        MAIL_PORT: 587,
        MAIL_USERNAME: 'CHANGE_ME_IN_PRODUCTION',
        MAIL_PASSWORD: 'CHANGE_ME_IN_PRODUCTION',
        MAIL_FROM_ADDRESS: 'noreply@example.com',
      };
    }

    return {
      MAIL_HOST: 'mailpit',
      MAIL_PORT: 1025,
      MAIL_USERNAME: '',
      MAIL_PASSWORD: '',
      MAIL_FROM_ADDRESS: 'dev@localhost',
      MAILPIT_WEB_UI: 'http://localhost:8025',
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig | null {
    return {
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:8025/'],
      interval: '10s',
      timeout: '5s',
      retries: 3,
      start_period: '5s',
    };
  }

  getProxyRoutes(config: ProjectConfig): ProxyRoute[] {
    return [
      {
        serviceName: this.name,
        path: '/mailpit',
        subdomain: 'mail',
        port: 8025,
      },
    ];
  }

  getCLICommands(config: ProjectConfig): CLICommand[] {
    return [
      {
        name: 'mailpit-open',
        description: 'Open Mailpit web UI',
        script: `#!/usr/bin/env bash

# Open Mailpit web UI in browser

check_docker

URL="http://localhost:8025"

info "Opening Mailpit at \${URL}..."

# Detect OS and open browser
if command -v open &> /dev/null; then
    open "\${URL}"
elif command -v xdg-open &> /dev/null; then
    xdg-open "\${URL}"
elif command -v start &> /dev/null; then
    start "\${URL}"
else
    echo "Please open \${URL} in your browser"
fi
`,
      },
    ];
  }
}

export default new MailpitPlugin();
