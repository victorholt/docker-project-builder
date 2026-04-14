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

// Get arguments: node script.mjs projectName services [domainsJSON] [environments] [ports]
//
// `domainsJSON` is a JSON string of the form `{"local":"x.test","staging":"..."}`
// with one key per selected environment. For back-compat, a bare domain
// string is still accepted and applied to all provided environments.
const args = process.argv.slice(2);
const projectName = args[0] || 'test-project';
const services = args[1] ? args[1].split(',') : ['nextjs', 'api', 'postgres'];
const rawDomainsArg = args[2];
const environments = args[3] ? args[3].split(',') : ['local'];
const userPorts = args[4] ? JSON.parse(args[4]) : null;

// Parse domains argument. Accept either a JSON object or (legacy) a bare
// hostname — the bare form is broadcast to every selected env so the core
// superRefine is satisfied.
let domains;
if (rawDomainsArg && rawDomainsArg.trim().startsWith('{')) {
  try {
    domains = JSON.parse(rawDomainsArg);
  } catch {
    domains = {};
  }
} else if (rawDomainsArg && rawDomainsArg.length > 0) {
  domains = {};
  for (const env of environments) {
    domains[env] = rawDomainsArg;
  }
} else {
  // No input at all — fall back to CLI-style smart defaults per env.
  domains = {};
  for (const env of environments) {
    if (env === 'local') domains[env] = `${projectName}.test`;
    else if (env === 'staging') domains[env] = `staging-${projectName}.com`;
    else if (env === 'prod') domains[env] = `${projectName}.com`;
  }
}

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

  // Use user-provided ports or generate unique ports to avoid conflicts
  let ports;
  let proxyPort;

  if (userPorts && Object.keys(userPorts).length > 0) {
    ports = userPorts;
    proxyPort = userPorts.proxy || 8080;
  } else {
    const portOffset = Math.floor(Math.random() * 8000) + 1000;
    ports = {
      nextjs: 3000 + portOffset,
      api: 4000 + portOffset,
    };
    proxyPort = 8080 + (portOffset % 1000);
  }

  // Build config with proper category from plugin registry
  const serviceConfigs = services.map(name => {
    const plugin = registry.getPlugin(name);
    return {
      name,
      version: 'latest',
      category: plugin ? plugin.category : 'app',
    };
  });

  // Always include proxy in service configs
  if (!serviceConfigs.find(s => s.name === 'proxy')) {
    serviceConfigs.push({ name: 'proxy', version: 'latest', category: 'proxy' });
  }

  const config = {
    projectName,
    containerPrefix: projectName,
    domains,
    services: serviceConfigs,
    environments,
    proxy: { port: proxyPort, sslPort: proxyPort + 363, vhostMode: 'path' },
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
