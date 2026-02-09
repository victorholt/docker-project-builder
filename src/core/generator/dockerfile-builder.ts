import type { IFileWriter } from '../interfaces/file-writer.js';
import type { IServicePlugin } from '../interfaces/service-plugin.js';
import type { ProjectConfig } from '../models/project-config.js';
import { join } from 'path';

/**
 * DockerfileBuilder generates Dockerfiles for services that need custom images
 */
export class DockerfileBuilder {
  constructor(private fileWriter: IFileWriter) {}

  /**
   * Builds Dockerfiles for all services that need them
   */
  async buildDockerfiles(config: ProjectConfig, plugins: IServicePlugin[]): Promise<void> {
    const { outputPath } = config;
    const imagesDir = join(outputPath, 'docker/images');
    const scriptsDir = join(outputPath, 'docker/scripts');

    for (const plugin of plugins) {
      // Generate Dockerfile if plugin provides one
      const dockerfileContent = plugin.getDockerfile(config);
      if (dockerfileContent) {
        const dockerfilePath = join(imagesDir, `${plugin.name}.Dockerfile`);
        await this.fileWriter.writeFile(dockerfilePath, dockerfileContent);
      }

      // Generate entrypoint script if plugin provides one
      const entrypointContent = plugin.getEntrypoint(config);
      if (entrypointContent) {
        const entrypointPath = join(scriptsDir, `${plugin.name}-entrypoint.sh`);
        await this.fileWriter.writeFile(entrypointPath, entrypointContent);
        await this.fileWriter.makeExecutable(entrypointPath);
      }
    }
  }

  /**
   * Builds proxy-specific Dockerfile (special case)
   */
  async buildProxyDockerfile(config: ProjectConfig, proxyPlugin: IServicePlugin): Promise<void> {
    const { outputPath } = config;
    const proxyDir = join(outputPath, 'docker/proxy');

    const dockerfileContent = proxyPlugin.getDockerfile(config);
    if (dockerfileContent) {
      const dockerfilePath = join(proxyDir, 'Dockerfile');
      await this.fileWriter.writeFile(dockerfilePath, dockerfileContent);
    }

    const entrypointContent = proxyPlugin.getEntrypoint(config);
    if (entrypointContent) {
      const entrypointPath = join(proxyDir, 'entrypoint.sh');
      await this.fileWriter.writeFile(entrypointPath, entrypointContent);
      await this.fileWriter.makeExecutable(entrypointPath);
    }
  }
}
