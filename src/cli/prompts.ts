/**
 * Interactive prompts for collecting project configuration
 */

import inquirer from 'inquirer';
import type { ProjectConfig, ServiceConfig } from '../core/models/project-config.js';
import type { PluginRegistry } from '../core/services/plugin-registry.js';
import path from 'path';

/**
 * Collects project configuration through interactive prompts
 */
export async function collectProjectConfig(registry: PluginRegistry): Promise<ProjectConfig> {
  console.log('🚀 Docker Project Builder\n');

  // Step 1: Basic project info
  const basicInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name (lowercase, alphanumeric, hyphens):',
      default: 'my-app',
      validate: (input: string) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name must be lowercase alphanumeric with hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'containerPrefix',
      message: 'Container prefix (optional, defaults to project name):',
      default: (answers: { projectName: string }) => answers.projectName,
      validate: (input: string) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Container prefix must be lowercase alphanumeric with hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Domain for local development:',
      default: (answers: { projectName: string }) => `${answers.projectName}.test`,
      validate: (input: string) => {
        if (!/^[a-z0-9.-]+$/.test(input)) {
          return 'Domain must be a valid domain name';
        }
        return true;
      },
    },
  ]);

  // Step 2: Select app frameworks
  const appPlugins = registry.getPluginsByCategory('app');
  const appChoices = appPlugins.map((plugin) => ({
    name: `${plugin.displayName} - ${plugin.defaultVersion}`,
    value: plugin.name,
    checked: false,
  }));

  const selectedApps = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'apps',
      message: 'Select app frameworks:',
      choices: appChoices,
      validate: (input: string[]) => {
        if (input.length === 0) {
          return 'Please select at least one app framework';
        }
        return true;
      },
    },
  ]);

  // Step 3: Select databases (optional)
  const dbPlugins = registry.getPluginsByCategory('database');
  const dbChoices = dbPlugins.map((plugin) => ({
    name: `${plugin.displayName} - ${plugin.defaultVersion}`,
    value: plugin.name,
  }));

  const selectedDbs = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'databases',
      message: 'Select databases (optional):',
      choices: dbChoices,
    },
  ]);

  // Step 4: Select caches (optional)
  const cachePlugins = registry.getPluginsByCategory('cache');
  const cacheChoices = cachePlugins.map((plugin) => ({
    name: `${plugin.displayName} - ${plugin.defaultVersion}`,
    value: plugin.name,
  }));

  const selectedCaches = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'caches',
      message: 'Select caching services (optional):',
      choices: cacheChoices,
    },
  ]);

  // Step 5: Select mail service (optional)
  const mailPlugins = registry.getPluginsByCategory('mail');
  const mailChoices = [
    { name: 'None', value: null },
    ...mailPlugins.map((plugin) => ({
      name: `${plugin.displayName} - ${plugin.defaultVersion}`,
      value: plugin.name,
    })),
  ];

  const selectedMail = await inquirer.prompt([
    {
      type: 'list',
      name: 'mail',
      message: 'Select mail service for local development:',
      choices: mailChoices,
      default: null,
    },
  ]);

  // Step 6: Select environments
  const environments = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'environments',
      message: 'Select environments to support:',
      choices: [
        { name: 'Local (development)', value: 'local', checked: true },
        { name: 'Staging', value: 'staging' },
        { name: 'Production', value: 'prod' },
      ],
      validate: (input: string[]) => {
        if (input.length === 0) {
          return 'Please select at least one environment';
        }
        return true;
      },
    },
  ]);

  // Step 7: Proxy configuration
  const proxyConfig = await inquirer.prompt([
    {
      type: 'number',
      name: 'port',
      message: 'Proxy HTTP port:',
      default: 8080,
      validate: (input: number) => {
        if (input < 1 || input > 65535) {
          return 'Port must be between 1 and 65535';
        }
        return true;
      },
    },
    {
      type: 'number',
      name: 'sslPort',
      message: 'Proxy HTTPS port:',
      default: 8443,
      validate: (input: number) => {
        if (input < 1 || input > 65535) {
          return 'Port must be between 1 and 65535';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'vhostMode',
      message: 'Proxy routing mode:',
      choices: [
        { name: 'Path-based (e.g., /api, /app)', value: 'path' },
        { name: 'Subdomain (e.g., api.myapp.test)', value: 'subdomain' },
      ],
      default: 'path',
    },
  ]);

  // Step 8: Output path
  const outputConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputPath',
      message: 'Output directory:',
      default: `./${basicInfo.projectName}`,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Output path is required';
        }
        return true;
      },
      filter: (input: string) => path.resolve(input),
    },
  ]);

  // Build services array
  const services: ServiceConfig[] = [];

  // Add selected apps
  for (const appName of selectedApps.apps) {
    const plugin = registry.getPlugin(appName);
    if (plugin) {
      services.push({
        name: plugin.name,
        version: plugin.defaultVersion,
        category: plugin.category,
      });
    }
  }

  // Add selected databases
  for (const dbName of selectedDbs.databases) {
    const plugin = registry.getPlugin(dbName);
    if (plugin) {
      services.push({
        name: plugin.name,
        version: plugin.defaultVersion,
        category: plugin.category,
      });
    }
  }

  // Add selected caches
  for (const cacheName of selectedCaches.caches) {
    const plugin = registry.getPlugin(cacheName);
    if (plugin) {
      services.push({
        name: plugin.name,
        version: plugin.defaultVersion,
        category: plugin.category,
      });
    }
  }

  // Add mail service if selected
  if (selectedMail.mail) {
    const plugin = registry.getPlugin(selectedMail.mail);
    if (plugin) {
      services.push({
        name: plugin.name,
        version: plugin.defaultVersion,
        category: plugin.category,
      });
    }
  }

  // Build final config
  const config: ProjectConfig = {
    projectName: basicInfo.projectName,
    containerPrefix: basicInfo.containerPrefix,
    domain: basicInfo.domain,
    services,
    environments: environments.environments,
    proxy: {
      port: proxyConfig.port,
      sslPort: proxyConfig.sslPort,
      vhostMode: proxyConfig.vhostMode,
    },
    ports: {}, // Use default ports (can be overridden per service)
    outputPath: outputConfig.outputPath,
  };

  // Show summary
  console.log('\n📋 Configuration Summary:');
  console.log(`  Project: ${config.projectName}`);
  console.log(`  Domain: ${config.domain}`);
  console.log(`  Services: ${config.services.map((s) => s.name).join(', ')}`);
  console.log(`  Environments: ${config.environments.join(', ')}`);
  console.log(`  Output: ${config.outputPath}\n`);

  // Confirm
  const confirmation = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Generate project with this configuration?',
      default: true,
    },
  ]);

  if (!confirmation.proceed) {
    console.log('❌ Project generation cancelled.');
    process.exit(0);
  }

  return config;
}
