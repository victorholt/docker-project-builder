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
    const services: Record<string, ComposeServiceBlock> = {};
    const volumes: Record<string, unknown> = {};
    const networks: Record<string, unknown> = {};

    // Collect service blocks from all plugins
    for (const plugin of plugins) {
      const serviceBlock = plugin.getComposeService(config);
      if (serviceBlock) {
        services[serviceBlock.serviceName] = serviceBlock;
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
    const services: Record<string, ComposeServiceBlock> = {};

    // Collect override blocks from all plugins
    for (const plugin of plugins) {
      const overrideBlock = plugin.getComposeOverride(config);
      if (overrideBlock) {
        services[overrideBlock.serviceName] = overrideBlock;
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
   * Builds the docker-compose.prod.yml (production overrides)
   */
  private async buildProdCompose(
    composeDir: string,
    config: ProjectConfig,
    plugins: IServicePlugin[]
  ): Promise<void> {
    const services: Record<string, ComposeServiceBlock> = {};

    // Collect prod blocks from all plugins
    for (const plugin of plugins) {
      const prodBlock = plugin.getComposeProd(config);
      if (prodBlock) {
        services[prodBlock.serviceName] = prodBlock;
      }
    }

    // Only create file if there are prod configs
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
    const filePath = join(composeDir, 'docker-compose.prod.yml');
    await this.fileWriter.writeFile(filePath, yamlContent);
  }
}
