import type { IFileWriter } from '../interfaces/file-writer.js';
import type { ProjectConfig } from '../models/project-config.js';
import { join } from 'path';

/**
 * StructureBuilder creates the folder tree for the generated project
 */
export class StructureBuilder {
  constructor(private fileWriter: IFileWriter) {}

  /**
   * Creates the complete folder structure for the project
   */
  async buildStructure(config: ProjectConfig): Promise<void> {
    const { outputPath } = config;

    // Root directories
    await this.createDirectory(outputPath);

    // apps/ - where user's application code goes
    await this.createDirectory(join(outputPath, 'apps'));

    // docker/ - Docker configuration
    await this.createDirectory(join(outputPath, 'docker'));
    await this.createDirectory(join(outputPath, 'docker/compose'));
    await this.createDirectory(join(outputPath, 'docker/images'));
    await this.createDirectory(join(outputPath, 'docker/scripts'));
    await this.createDirectory(join(outputPath, 'docker/proxy'));
    await this.createDirectory(join(outputPath, 'docker/ssl'));

    // bin/cli/ - Generated CLI tool
    await this.createDirectory(join(outputPath, 'bin'));
    await this.createDirectory(join(outputPath, 'bin/cli'));
    await this.createDirectory(join(outputPath, 'bin/cli/commands'));

    // Create app directories for each app service
    const appServices = config.services.filter((s) => s.category === 'app');
    for (const service of appServices) {
      const appDir = join(outputPath, 'apps', service.name);
      await this.createDirectory(appDir);
      await this.createGitkeep(appDir);
    }
  }

  /**
   * Creates a directory
   */
  private async createDirectory(path: string): Promise<void> {
    await this.fileWriter.createDirectory(path);
  }

  /**
   * Creates a .gitkeep file in a directory
   */
  private async createGitkeep(dirPath: string): Promise<void> {
    const gitkeepPath = join(dirPath, '.gitkeep');
    await this.fileWriter.writeFile(gitkeepPath, '');
  }
}
