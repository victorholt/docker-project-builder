#!/usr/bin/env node
import { ProjectGenerator } from '../dist/core/generator/project-generator.js';
import { PluginRegistry } from '../dist/core/services/plugin-registry.js';
import { FileWriter } from '../dist/core/services/file-writer.js';
import { TemplateRenderer } from '../dist/core/services/template-renderer.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get arguments: node script.mjs projectName services
const args = process.argv.slice(2);
const projectName = args[0] || 'test-project';
const services = args[1] ? args[1].split(',') : ['nextjs', 'api', 'postgres'];
const outputPath = path.join(__dirname, '..', `${projectName}-output`);

try {
  await fs.rm(outputPath, { recursive: true, force: true });

  const registry = new PluginRegistry();
  await registry.discoverPlugins();

  const plugins = [];
  const proxyPlugin = registry.getPlugin('proxy');
  if (proxyPlugin) plugins.push(proxyPlugin);

  for (const serviceName of services) {
    const plugin = registry.getPlugin(serviceName);
    if (plugin) plugins.push(plugin);
  }

  // Generate unique ports to avoid conflicts (random offset between 1000-9000)
  const portOffset = Math.floor(Math.random() * 8000) + 1000;
  const ports = {
    nextjs: 3000 + portOffset,
    api: 4000 + portOffset,
  };
  const proxyPort = 8080 + (portOffset % 1000); // Keep proxy port in 8xxx range

  const config = {
    projectName,
    containerPrefix: projectName,
    domain: `${projectName}.local`,
    services: services.map(name => ({ name, version: 'latest', enabled: true })),
    environments: ['local'],
    proxy: { enabled: true, type: 'path-based', port: proxyPort, sslPort: proxyPort + 363 },
    ports,
    outputPath,
  };

  const fileWriter = new FileWriter();
  const templateRenderer = new TemplateRenderer();
  const generator = new ProjectGenerator(fileWriter, templateRenderer);

  await generator.generate(config, plugins);

  console.log(JSON.stringify({ success: true, outputPath, projectName, ports, proxyPort }));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: error.message, stack: error.stack }));
  process.exit(1);
}
