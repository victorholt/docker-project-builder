import type { IFileWriter } from '../interfaces/file-writer.js';
import type { ITemplateRenderer } from '../interfaces/template-renderer.js';
import type { IServicePlugin } from '../interfaces/service-plugin.js';
import type { ProjectConfig } from '../models/project-config.js';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

/**
 * TemplatesBuilder copies and renders template files from plugins
 */
export class TemplatesBuilder {
  constructor(
    private fileWriter: IFileWriter,
    private templateRenderer: ITemplateRenderer
  ) {}

  /**
   * Copies and renders template files for all app plugins
   */
  async buildTemplates(config: ProjectConfig, plugins: IServicePlugin[]): Promise<void> {
    // Get the source templates directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pluginsBaseDir = join(__dirname, '../../plugins');

    // Only process app plugins (services that need starter code)
    const appPlugins = plugins.filter((p) => p.category === 'app');

    for (const plugin of appPlugins) {
      const pluginTemplatesDir = join(pluginsBaseDir, plugin.category, plugin.name, 'templates');
      const targetDir = join(config.outputPath, 'apps', plugin.name);

      try {
        // Check if templates directory exists
        const templatesExist = await this.fileWriter.fileExists(pluginTemplatesDir);
        if (!templatesExist) {
          console.log(`  ⓘ No templates found for ${plugin.name}`);
          continue;
        }

        // Build a per-plugin render context: base config plus any extra
        // computed values that specific plugins need in their templates.
        const context = this.buildRenderContext(plugin.name, config);

        // Copy and render all template files
        await this.copyTemplateDirectory(pluginTemplatesDir, targetDir, context);
        console.log(`  ✓ Generated starter code for ${plugin.name}`);
      } catch (error) {
        console.warn(`  ⚠ Failed to copy templates for ${plugin.name}:`, error);
      }
    }
  }

  /**
   * Returns the template render context for a given plugin. Starts from the
   * raw project config and layers plugin-specific computed values on top —
   * Handlebars can't easily do array composition, so we prepare anything
   * array-shaped here in TypeScript.
   */
  private buildRenderContext(
    pluginName: string,
    config: ProjectConfig
  ): Record<string, unknown> {
    const base: Record<string, unknown> = { ...config };

    if (pluginName === 'nextjs') {
      // allowedDevOrigins: every selected env's domain, plus the :proxy.port
      // and :proxy.sslPort variants of each. Emitted as a JSON array literal
      // via triple-stash {{{allowedDevOriginsJson}}} in the template.
      const domains = [
        config.domains.local,
        config.domains.staging,
        config.domains.prod,
      ].filter((d): d is string => typeof d === 'string' && d.length > 0);

      const origins: string[] = [];
      for (const d of domains) {
        origins.push(d);
        origins.push(`${d}:${config.proxy.port}`);
        origins.push(`${d}:${config.proxy.sslPort}`);
      }
      base.allowedDevOrigins = origins;
      base.allowedDevOriginsJson = JSON.stringify(origins);
    }

    return base;
  }

  /**
   * Recursively copies a directory of templates
   */
  private async copyTemplateDirectory(
    sourceDir: string,
    targetDir: string,
    context: Record<string, unknown>
  ): Promise<void> {
    const files = await this.fileWriter.listFiles(sourceDir, true);

    for (const sourceFile of files) {
      // Calculate relative path
      const relativePath = sourceFile.substring(sourceDir.length + 1);

      // Remove .hbs extension if present
      const targetPath = relativePath.endsWith('.hbs')
        ? relativePath.substring(0, relativePath.length - 4)
        : relativePath;

      const targetFile = join(targetDir, targetPath);

      // Read source file
      const content = await this.fileWriter.readFile(sourceFile);

      // If it's a .hbs file, render it with Handlebars
      if (sourceFile.endsWith('.hbs')) {
        const rendered = this.templateRenderer.render(content, context);
        await this.fileWriter.writeFile(targetFile, rendered);
      } else {
        // Copy as-is for non-template files
        await this.fileWriter.copyFile(sourceFile, targetFile);
      }
    }
  }
}
