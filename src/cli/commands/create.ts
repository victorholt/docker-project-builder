/**
 * Create command - generates a new Docker project
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { collectProjectConfig } from '../prompts.js';
import { ProjectGenerator } from '../../core/generator/project-generator.js';
import { PluginRegistry } from '../../core/services/plugin-registry.js';
import { FileWriter } from '../../core/services/file-writer.js';
import { TemplateRenderer } from '../../core/services/template-renderer.js';
import { validateProjectConfig } from '../../core/models/project-config.js';

export const createCommand = new Command('create')
  .description('Create a new Docker project')
  .action(async () => {
    try {
      // Step 1: Discover plugins
      const spinner = ora('Discovering available services...').start();
      const registry = new PluginRegistry();
      await registry.discoverPlugins();

      const pluginCount = registry.getPluginCount();
      if (pluginCount === 0) {
        spinner.fail('No plugins found. Please check your installation.');
        process.exit(1);
      }

      spinner.succeed(`Found ${pluginCount} available services`);

      // Step 2: Collect configuration through prompts
      const config = await collectProjectConfig(registry);

      // Step 3: Validate configuration
      spinner.start('Validating configuration...');
      const validationResult = validateProjectConfig(config);
      spinner.succeed('Configuration validated');

      // Step 4: Get plugins for selected services
      spinner.start('Loading plugins...');
      const plugins = [];

      // Always include proxy plugin
      const proxyPlugin = registry.getPlugin('proxy');
      if (proxyPlugin) {
        plugins.push(proxyPlugin);
      } else {
        spinner.fail('Proxy plugin not found');
        process.exit(1);
      }

      // Add selected service plugins
      for (const service of config.services) {
        const plugin = registry.getPlugin(service.name);
        if (plugin) {
          plugins.push(plugin);
        } else {
          spinner.warn(`Plugin not found: ${service.name}`);
        }
      }

      spinner.succeed(`Loaded ${plugins.length} plugins`);

      // Step 5: Initialize services
      spinner.start('Initializing generator...');
      const fileWriter = new FileWriter();
      const templateRenderer = new TemplateRenderer();
      const generator = new ProjectGenerator(fileWriter, templateRenderer);
      spinner.succeed('Generator initialized');

      // Step 6: Generate project
      console.log('\n' + chalk.bold('🏗️  Generating project...') + '\n');

      await generator.generate(config, plugins);

      // Step 7: Success message
      console.log('\n' + chalk.green.bold('✅ Project generated successfully!') + '\n');
      console.log(chalk.bold('📂 Next steps:'));
      console.log(chalk.gray(`  1. cd ${config.outputPath}`));
      console.log(chalk.gray(`  2. Review and edit .env file`));
      console.log(chalk.gray(`  3. ./${config.projectName} up`));
      console.log('');

    } catch (error) {
      console.error('\n' + chalk.red.bold('❌ Error generating project:'));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
        if (process.env.DEBUG) {
          console.error(chalk.gray(error.stack));
        }
      } else {
        console.error(chalk.red(String(error)));
      }
      process.exit(1);
    }
  });
