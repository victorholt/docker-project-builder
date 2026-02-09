import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { IServicePlugin, ServiceCategory } from '../interfaces/service-plugin.js';

/**
 * Plugin registry for auto-discovering and managing service plugins
 */
export class PluginRegistry {
  private plugins: Map<string, IServicePlugin> = new Map();
  private pluginsByCategory: Map<ServiceCategory, IServicePlugin[]> = new Map();

  /**
   * Discovers and loads all plugins from the plugins directory
   */
  async discoverPlugins(): Promise<void> {
    // Get the path to the plugins directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pluginsDir = join(__dirname, '../../plugins');

    try {
      // Check if plugins directory exists
      await fs.access(pluginsDir);

      // Discover plugins in each category directory
      const categories: ServiceCategory[] = ['app', 'database', 'cache', 'mail', 'proxy'];

      for (const category of categories) {
        const categoryDir = join(pluginsDir, category);

        try {
          await fs.access(categoryDir);
          await this.discoverPluginsInCategory(categoryDir, category);
        } catch {
          // Category directory doesn't exist yet, skip
          continue;
        }
      }
    } catch (error) {
      throw new Error(`Failed to discover plugins: ${error}`);
    }
  }

  /**
   * Discovers plugins in a specific category directory
   */
  private async discoverPluginsInCategory(
    categoryDir: string,
    category: ServiceCategory
  ): Promise<void> {
    const entries = await fs.readdir(categoryDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginDir = join(categoryDir, entry.name);
        const indexPath = join(pluginDir, 'index.js');

        try {
          // Check if index.js exists
          await fs.access(indexPath);

          // Import the plugin module
          const module = await import(indexPath);

          // Look for default export or named export matching plugin name
          const plugin: IServicePlugin = module.default || module[entry.name];

          if (plugin && this.isValidPlugin(plugin)) {
            this.registerPlugin(plugin);
          }
        } catch (error) {
          console.warn(`Failed to load plugin ${entry.name}: ${error}`);
        }
      }
    }
  }

  /**
   * Validates that an object implements IServicePlugin interface
   */
  private isValidPlugin(obj: unknown): obj is IServicePlugin {
    if (!obj || typeof obj !== 'object') return false;

    const plugin = obj as Partial<IServicePlugin>;

    return (
      typeof plugin.name === 'string' &&
      typeof plugin.displayName === 'string' &&
      typeof plugin.category === 'string' &&
      typeof plugin.defaultVersion === 'string' &&
      Array.isArray(plugin.availableVersions) &&
      typeof plugin.getPrompts === 'function' &&
      typeof plugin.getComposeService === 'function' &&
      typeof plugin.getComposeOverride === 'function' &&
      typeof plugin.getComposeProd === 'function' &&
      typeof plugin.getDockerfile === 'function' &&
      typeof plugin.getEntrypoint === 'function' &&
      typeof plugin.getEnvVars === 'function' &&
      typeof plugin.getVolumes === 'function' &&
      typeof plugin.getNetworks === 'function' &&
      typeof plugin.getHealthCheck === 'function' &&
      typeof plugin.getProxyRoutes === 'function' &&
      typeof plugin.getCLICommands === 'function'
    );
  }

  /**
   * Registers a plugin
   */
  registerPlugin(plugin: IServicePlugin): void {
    this.plugins.set(plugin.name, plugin);

    // Add to category map
    if (!this.pluginsByCategory.has(plugin.category)) {
      this.pluginsByCategory.set(plugin.category, []);
    }
    this.pluginsByCategory.get(plugin.category)?.push(plugin);
  }

  /**
   * Gets a plugin by name
   */
  getPlugin(name: string): IServicePlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Gets all registered plugins
   */
  getAllPlugins(): IServicePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Gets plugins by category
   */
  getPluginsByCategory(category: ServiceCategory): IServicePlugin[] {
    return this.pluginsByCategory.get(category) || [];
  }

  /**
   * Gets all plugin categories
   */
  getCategories(): ServiceCategory[] {
    return Array.from(this.pluginsByCategory.keys());
  }

  /**
   * Checks if a plugin exists
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Gets the count of registered plugins
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Clears all registered plugins
   * Useful for testing
   */
  clear(): void {
    this.plugins.clear();
    this.pluginsByCategory.clear();
  }
}
