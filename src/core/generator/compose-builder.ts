import type { IFileWriter } from '../interfaces/file-writer.js';
import type { ITemplateRenderer } from '../interfaces/template-renderer.js';
import type { IServicePlugin, ComposeServiceBlock } from '../interfaces/service-plugin.js';
import type { ProjectConfig } from '../models/project-config.js';
import { join } from 'path';
import YAML from 'yaml';

/**
 * ComposeBuilder assembles docker-compose files from plugin contributions
 */
export class ComposeBuilder {
  constructor(
    private fileWriter: IFileWriter,
    private templateRenderer: ITemplateRenderer
  ) {}

  /**
   * Builds all docker-compose files (base, override, prod)
   */
  async buildComposeFiles(config: ProjectConfig, plugins: IServicePlugin[]): Promise<void> {
    const { outputPath } = config;
    const composeDir = join(outputPath, 'docker/compose');

    // Build base docker-compose.yml
    await this.buildBaseCompose(composeDir, config, plugins);

    // Build docker-compose.override.yml (dev)
    await this.buildOverrideCompose(composeDir, config, plugins);

    // Build docker-compose.staging.yml (staging)
    if (config.environments.includes('staging')) {
      await this.buildStagingCompose(composeDir, config, plugins);
    }

    // Build docker-compose.prod.yml (production)
    if (config.environments.includes('prod')) {
      await this.buildProdCompose(composeDir, config, plugins);
    }
  }

  /**
   * Builds the base docker-compose.yml
   */
  private async buildBaseCompose(
    composeDir: string,
    config: ProjectConfig,
    plugins: IServicePlugin[]
  ): Promise<void> {
    const services: Record<string, Omit<ComposeServiceBlock, 'serviceName'>> = {};
    const volumes: Record<string, unknown> = {};
    const networks: Record<string, unknown> = {};

    // Collect service blocks from all plugins
    for (const plugin of plugins) {
      const serviceBlock = plugin.getComposeService(config);
      if (serviceBlock) {
        const { serviceName, ...serviceDefinition } = serviceBlock;
        services[serviceName] = serviceDefinition;
      }

      // Collect volumes
      const pluginVolumes = plugin.getVolumes(config);
      for (const volume of pluginVolumes) {
        volumes[volume.name] = {
          driver: volume.driver || 'local',
          ...(volume.driver_opts && { driver_opts: volume.driver_opts }),
        };
      }

      // Collect networks
      const pluginNetworks = plugin.getNetworks(config);
      for (const network of pluginNetworks) {
        networks[network.name] = {
          driver: network.driver || 'bridge',
          ...(network.external && { external: network.external }),
        };
      }
    }

    // Build compose object
    const composeContent = {
      name: config.projectName, // Docker Desktop project name
      version: '3.9',
      services,
      ...(Object.keys(volumes).length > 0 && { volumes }),
      ...(Object.keys(networks).length > 0 && { networks }),
    };

    // Convert to YAML
    const yamlContent = YAML.stringify(composeContent);

    // Write file
    const filePath = join(composeDir, 'docker-compose.yml');
    await this.fileWriter.writeFile(filePath, yamlContent);
  }

  /**
   * Builds the docker-compose.override.yml (dev overrides)
   */
  private async buildOverrideCompose(
    composeDir: string,
    config: ProjectConfig,
    plugins: IServicePlugin[]
  ): Promise<void> {
    const services: Record<string, Omit<ComposeServiceBlock, 'serviceName'>> = {};

    // Collect override blocks from all plugins
    for (const plugin of plugins) {
      const overrideBlock = plugin.getComposeOverride(config);
      if (overrideBlock) {
        const { serviceName, ...serviceDefinition } = overrideBlock;
        services[serviceName] = serviceDefinition;
      }
    }

    // Only create file if there are overrides
    if (Object.keys(services).length === 0) {
      return;
    }

    // Build compose object
    const composeContent = {
      version: '3.9',
      services,
    };

    // Convert to YAML
    const yamlContent = YAML.stringify(composeContent);

    // Write file
    const filePath = join(composeDir, 'docker-compose.override.yml');
    await this.fileWriter.writeFile(filePath, yamlContent);
  }

  /**
   * Builds the docker-compose.staging.yml (staging overrides)
   * Reuses prod plugin blocks + adds certbot service
   */
  private async buildStagingCompose(
    composeDir: string,
    config: ProjectConfig,
    plugins: IServicePlugin[]
  ): Promise<void> {
    const services: Record<string, unknown> = {};

    // Reuse prod blocks for staging (same infrastructure, different env vars)
    for (const plugin of plugins) {
      const prodBlock = plugin.getComposeProd(config);
      if (prodBlock) {
        const { serviceName, ...serviceDefinition } = prodBlock;
        services[serviceName] = serviceDefinition;
      }
    }

    // Add certbot services for Let's Encrypt
    this.addCertbotService(services, config);
    this.addCertbotRenewService(services, config);

    // Build compose object
    const composeContent: Record<string, unknown> = {
      version: '3.9',
      services,
      volumes: {
        'ssl-certs': { driver: 'local' },
        'letsencrypt-data': { driver: 'local' },
        'acme-challenge': { driver: 'local' },
      },
    };

    const yamlContent = YAML.stringify(composeContent);
    const filePath = join(composeDir, 'docker-compose.staging.yml');
    await this.fileWriter.writeFile(filePath, yamlContent);
  }

  /**
   * Builds the docker-compose.prod.yml (production overrides)
   */
  private async buildProdCompose(
    composeDir: string,
    config: ProjectConfig,
    plugins: IServicePlugin[]
  ): Promise<void> {
    const services: Record<string, unknown> = {};

    // Collect prod blocks from all plugins
    for (const plugin of plugins) {
      const prodBlock = plugin.getComposeProd(config);
      if (prodBlock) {
        const { serviceName, ...serviceDefinition } = prodBlock;
        services[serviceName] = serviceDefinition;
      }
    }

    // Add certbot services for Let's Encrypt
    this.addCertbotService(services, config);
    this.addCertbotRenewService(services, config);

    // Only create file if there are services
    if (Object.keys(services).length === 0) {
      return;
    }

    // Build compose object
    const composeContent: Record<string, unknown> = {
      version: '3.9',
      services,
      volumes: {
        'ssl-certs': { driver: 'local' },
        'letsencrypt-data': { driver: 'local' },
        'acme-challenge': { driver: 'local' },
      },
    };

    const yamlContent = YAML.stringify(composeContent);
    const filePath = join(composeDir, 'docker-compose.prod.yml');
    await this.fileWriter.writeFile(filePath, yamlContent);
  }

  /**
   * Adds the certbot service for Let's Encrypt certificate management
   */
  private addCertbotService(services: Record<string, unknown>, config: ProjectConfig): void {
    services['certbot'] = {
      image: 'certbot/certbot:latest',
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-certbot`,
      volumes: [
        'letsencrypt-data:/etc/letsencrypt',
        'ssl-certs:/etc/ssl-output',
        'acme-challenge:/var/www/certbot',
      ],
      profiles: ['certbot'],
      networks: ['app-network'],
    };
  }

  /**
   * Adds the certbot-renew service for automatic certificate renewal
   */
  private addCertbotRenewService(services: Record<string, unknown>, config: ProjectConfig): void {
    services['certbot-renew'] = {
      image: 'certbot/certbot:latest',
      container_name: `\${CONTAINER_PREFIX:-${config.containerPrefix}}-certbot-renew`,
      entrypoint: 'sh',
      command: [
        '-c',
        [
          'echo "Certbot auto-renewal service started (checks every 12h)"',
          'trap exit TERM INT',
          'while true; do',
          '  sleep 43200 &',
          '  wait $$!',
          '  echo "[`date`] Running certbot renew..."',
          '  certbot renew --webroot -w /var/www/certbot \\',
          '    --deploy-hook "cp -L /etc/letsencrypt/live/$$DOMAIN/fullchain.pem /etc/ssl-output/$$DOMAIN.crt && cp -L /etc/letsencrypt/live/$$DOMAIN/privkey.pem /etc/ssl-output/$$DOMAIN.key && cp -L /etc/letsencrypt/live/$$DOMAIN/chain.pem /etc/ssl-output/ca.crt && echo Certificates renewed and copied"',
          'done',
        ].join('\n'),
      ],
      environment: {
        'DOMAIN': `\${DOMAIN:?DOMAIN must be set}`,
      },
      volumes: [
        'letsencrypt-data:/etc/letsencrypt',
        'ssl-certs:/etc/ssl-output',
        'acme-challenge:/var/www/certbot',
      ],
      profiles: ['auto-renew'],
      networks: ['app-network'],
      restart: 'unless-stopped',
    };
  }
}
