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
 * MailHog email testing plugin
 */
export class MailhogPlugin implements IServicePlugin {
  name = 'mailhog';
  displayName = 'MailHog';
  category: ServiceCategory = 'mail';
  defaultVersion = 'latest';
  availableVersions = ['latest', 'v1.0.1'];

  getPrompts(): PromptQuestion[] {
    return [];
  }

  getComposeService(config: ProjectConfig): ComposeServiceBlock {
    return {
      serviceName: this.name,
      image: `mailhog/mailhog:${this.defaultVersion}`,
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-mailhog`,
      ports: [
        '${MAILHOG_SMTP_PORT:-1025}:1025',  // SMTP
        '${MAILHOG_UI_PORT:-8025}:8025',    // Web UI
      ],
      networks: ['app-network'],
      restart: 'unless-stopped',
      profiles: ['local'],
    };
  }

  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null {
    return null;
  }

  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null {
    // MailHog is only for local development
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
      MAIL_HOST: 'mailhog',
      MAIL_PORT: 1025,
      MAIL_USERNAME: '',
      MAIL_PASSWORD: '',
      MAIL_FROM_ADDRESS: 'dev@localhost',
      MAILHOG_WEB_UI: 'http://localhost:8025',
    };
  }

  getVolumes(config: ProjectConfig): VolumeDefinition[] {
    return [];
  }

  getNetworks(config: ProjectConfig): NetworkDefinition[] {
    return [];
  }

  getHealthCheck(config: ProjectConfig): HealthCheckConfig | null {
    return null;
  }

  getProxyRoutes(config: ProjectConfig): ProxyRoute[] {
    return [
      {
        serviceName: this.name,
        path: '/mailhog',
        subdomain: 'mail',
        port: 8025,
      },
    ];
  }

  getCLICommands(config: ProjectConfig): CLICommand[] {
    return [
      {
        name: 'mailhog-open',
        description: 'Open MailHog web UI',
        script: `#!/usr/bin/env bash

# Open MailHog web UI in browser

check_docker

URL="http://localhost:8025"

info "Opening MailHog at \${URL}..."

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

export default new MailhogPlugin();
