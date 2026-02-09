#!/usr/bin/env tsx

/**
 * Test the create command programmatically (non-interactive)
 */

import { ProjectGenerator } from './src/core/generator/project-generator.js';
import { PluginRegistry } from './src/core/services/plugin-registry.js';
import { FileWriter } from './src/core/services/file-writer.js';
import { TemplateRenderer } from './src/core/services/template-renderer.js';
import type { ProjectConfig } from './src/core/models/project-config.js';
import { validateProjectConfig } from './src/core/models/project-config.js';

async function testCliCreate() {
  console.log('🧪 Testing CLI Create Command (Non-Interactive)\n');

  try {
    // Step 1: Discover plugins
    console.log('🔍 Discovering plugins...');
    const registry = new PluginRegistry();
    await registry.discoverPlugins();
    console.log(`✓ Found ${registry.getPluginCount()} plugins\n`);

    // Step 2: Create config (simulating user input)
    const config: ProjectConfig = {
      projectName: 'my-awesome-app',
      containerPrefix: 'awesome',
      domain: 'awesome.test',
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
      outputPath: './test-cli-output',
    };

    // Step 3: Validate config
    console.log('✓ Configuration created');
    const validationResult = validateProjectConfig(config);
    console.log('✓ Configuration validated\n');

    // Step 4: Load plugins
    console.log('🔌 Loading plugins...');
    const plugins = [];

    // Add proxy
    const proxyPlugin = registry.getPlugin('proxy');
    if (proxyPlugin) {
      plugins.push(proxyPlugin);
      console.log(`  ✓ ${proxyPlugin.displayName}`);
    }

    // Add selected services
    for (const service of config.services) {
      const plugin = registry.getPlugin(service.name);
      if (plugin) {
        plugins.push(plugin);
        console.log(`  ✓ ${plugin.displayName}`);
      }
    }
    console.log('');

    // Step 5: Generate project
    console.log('🏗️  Generating project...\n');
    const fileWriter = new FileWriter();
    const templateRenderer = new TemplateRenderer();
    const generator = new ProjectGenerator(fileWriter, templateRenderer);

    await generator.generate(config, plugins);

    console.log('\n✅ CLI Create Test Passed!\n');
    console.log('📂 Check generated project at: ./test-cli-output');
    console.log('\nTo test the generated project:');
    console.log('  cd test-cli-output');
    console.log('  ./my-awesome-app up');

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testCliCreate();
