#!/usr/bin/env tsx

/**
 * Test script to verify generators work programmatically
 */

import { ProjectGenerator } from './src/core/generator/project-generator.js';
import { PluginRegistry } from './src/core/services/plugin-registry.js';
import { FileWriter } from './src/core/services/file-writer.js';
import { TemplateRenderer } from './src/core/services/template-renderer.js';
import type { ProjectConfig } from './src/core/models/project-config.js';

async function testGeneration() {
  console.log('🧪 Testing Docker Project Builder\n');

  // 1. Create test config
  const config: ProjectConfig = {
    projectName: 'test-app',
    containerPrefix: 'testapp',
    domain: 'testapp.test',
    services: [
      { name: 'nextjs', version: '20-alpine', category: 'app' },
      { name: 'api', version: '20-alpine', category: 'app' },
      { name: 'postgres', version: '16-alpine', category: 'database' },
    ],
    environments: ['local', 'prod'],
    proxy: {
      port: 8080,
      sslPort: 8443,
      vhostMode: 'path',
    },
    outputPath: './test-output',
  };

  console.log('📋 Test Configuration:');
  console.log(`  Project: ${config.projectName}`);
  console.log(`  Domain: ${config.domain}`);
  console.log(`  Services: ${config.services.map((s) => s.name).join(', ')}`);
  console.log(`  Output: ${config.outputPath}\n`);

  try {
    // 2. Discover plugins
    console.log('🔍 Discovering plugins...');
    const registry = new PluginRegistry();
    await registry.discoverPlugins();

    const discoveredPlugins = registry.getAllPlugins();
    console.log(`✓ Found ${discoveredPlugins.length} plugins:`);
    for (const plugin of discoveredPlugins) {
      console.log(`  - ${plugin.displayName} (${plugin.category})`);
    }
    console.log('');

    // 3. Get plugins for selected services
    console.log('🔌 Loading selected plugins...');
    const plugins = [];

    // Always add proxy first
    const proxyPlugin = registry.getPlugin('proxy');
    if (proxyPlugin) {
      plugins.push(proxyPlugin);
      console.log(`  ✓ ${proxyPlugin.displayName}`);
    }

    // Add selected service plugins
    for (const service of config.services) {
      const plugin = registry.getPlugin(service.name);
      if (plugin) {
        plugins.push(plugin);
        console.log(`  ✓ ${plugin.displayName}`);
      } else {
        console.warn(`  ⚠ Plugin not found: ${service.name}`);
      }
    }
    console.log('');

    // 4. Initialize services
    console.log('⚙️  Initializing services...');
    const fileWriter = new FileWriter();
    const templateRenderer = new TemplateRenderer();
    const generator = new ProjectGenerator(fileWriter, templateRenderer);
    console.log('✓ Services initialized\n');

    // 5. Generate project
    console.log('🏗️  Generating project...\n');
    await generator.generate(config, plugins);

    console.log('\n✅ Test completed successfully!');
    console.log(`\n📂 Check the generated project at: ${config.outputPath}`);
    console.log(`\nTo test the generated project:`);
    console.log(`  cd ${config.outputPath}`);
    console.log(`  cat README.md`);
    console.log(`  docker compose -f docker/compose/docker-compose.yml config`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testGeneration();
