/**
 * List services command - displays available service plugins
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { PluginRegistry } from '../../core/services/plugin-registry.js';
import type { ServiceCategory } from '../../core/interfaces/service-plugin.js';

export const listServicesCommand = new Command('list')
  .description('List available service plugins')
  .action(async () => {
    try {
      console.log(chalk.bold('\n🔌 Available Services\n'));

      // Discover plugins
      const registry = new PluginRegistry();
      await registry.discoverPlugins();

      const pluginCount = registry.getPluginCount();
      if (pluginCount === 0) {
        console.log(chalk.yellow('No plugins found.'));
        console.log(chalk.gray('Please check your installation.\n'));
        return;
      }

      // Group by category
      const categories: ServiceCategory[] = ['app', 'database', 'cache', 'mail', 'proxy'];
      const categoryNames = {
        app: '📱 Application Frameworks',
        database: '🗄️  Databases',
        cache: '⚡ Caching',
        mail: '📧 Mail Services',
        proxy: '🔀 Proxy',
      };

      for (const category of categories) {
        const plugins = registry.getPluginsByCategory(category);
        if (plugins.length === 0) continue;

        console.log(chalk.bold(categoryNames[category]));
        for (const plugin of plugins) {
          console.log(
            `  ${chalk.cyan(plugin.name.padEnd(15))} ${chalk.gray(plugin.displayName)} - ${chalk.dim(plugin.defaultVersion)}`
          );

          if (plugin.availableVersions.length > 1) {
            const otherVersions = plugin.availableVersions
              .filter((v) => v !== plugin.defaultVersion)
              .join(', ');
            if (otherVersions) {
              console.log(`  ${' '.repeat(15)} ${chalk.dim(`Also: ${otherVersions}`)}`);
            }
          }
        }
        console.log('');
      }

      console.log(chalk.gray(`Total: ${pluginCount} services available\n`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error listing services:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }
  });
