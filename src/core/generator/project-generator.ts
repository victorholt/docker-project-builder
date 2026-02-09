import type { IFileWriter } from '../interfaces/file-writer.js';
import type { ITemplateRenderer } from '../interfaces/template-renderer.js';
import type { IServicePlugin } from '../interfaces/service-plugin.js';
import type { ProjectConfig } from '../models/project-config.js';
import { StructureBuilder } from './structure-builder.js';
import { TemplatesBuilder } from './templates-builder.js';
import { DockerfileBuilder } from './dockerfile-builder.js';
import { ComposeBuilder } from './compose-builder.js';
import { ProxyBuilder } from './proxy-builder.js';
import { EnvBuilder } from './env-builder.js';
import { CLIBuilder } from './cli-builder.js';
import { join } from 'path';

/**
 * ProjectGenerator orchestrates all builders to generate a complete Docker project
 */
export class ProjectGenerator {
  private structureBuilder: StructureBuilder;
  private templatesBuilder: TemplatesBuilder;
  private dockerfileBuilder: DockerfileBuilder;
  private composeBuilder: ComposeBuilder;
  private proxyBuilder: ProxyBuilder;
  private envBuilder: EnvBuilder;
  private cliBuilder: CLIBuilder;

  constructor(
    private fileWriter: IFileWriter,
    private templateRenderer: ITemplateRenderer
  ) {
    this.structureBuilder = new StructureBuilder(fileWriter);
    this.templatesBuilder = new TemplatesBuilder(fileWriter, templateRenderer);
    this.dockerfileBuilder = new DockerfileBuilder(fileWriter);
    this.composeBuilder = new ComposeBuilder(fileWriter, templateRenderer);
    this.proxyBuilder = new ProxyBuilder(fileWriter, templateRenderer);
    this.envBuilder = new EnvBuilder(fileWriter);
    this.cliBuilder = new CLIBuilder(fileWriter);
  }

  /**
   * Generates a complete Docker project based on the configuration
   */
  async generate(config: ProjectConfig, plugins: IServicePlugin[]): Promise<void> {
    console.log('🚀 Generating Docker project...\n');
    console.log(`📦 Received ${plugins.length} plugins:`);
    plugins.forEach(p => console.log(`  - ${p.name} (${p.category})`));
    console.log('');

    // Step 1: Create folder structure
    console.log('📁 Creating folder structure...');
    await this.structureBuilder.buildStructure(config);
    console.log('✓ Folder structure created\n');

    // Step 2: Generate starter code from templates
    console.log('📝 Generating starter code...');
    await this.templatesBuilder.buildTemplates(config, plugins);
    console.log('✓ Starter code generated\n');

    // Step 3: Generate Dockerfiles and entrypoint scripts
    console.log('🐳 Generating Dockerfiles...');
    await this.dockerfileBuilder.buildDockerfiles(config, plugins);

    // Handle proxy Dockerfile separately
    const proxyPlugin = plugins.find((p) => p.category === 'proxy');
    if (proxyPlugin) {
      await this.dockerfileBuilder.buildProxyDockerfile(config, proxyPlugin);
    }
    console.log('✓ Dockerfiles generated\n');

    // Step 3: Generate docker-compose files
    console.log('📦 Generating docker-compose files...');
    await this.composeBuilder.buildComposeFiles(config, plugins);
    console.log('✓ Docker-compose files generated\n');

    // Step 4: Generate proxy configuration
    console.log('🔀 Generating proxy configuration...');
    await this.proxyBuilder.buildProxyConfig(config, plugins);
    console.log('✓ Proxy configuration generated\n');

    // Step 5: Generate environment files
    console.log('🔐 Generating environment files...');
    await this.envBuilder.buildEnvFiles(config, plugins);
    console.log('✓ Environment files generated\n');

    // Step 6: Generate CLI tool
    console.log('⚙️  Generating CLI tool...');
    await this.cliBuilder.buildCLI(config, plugins);
    console.log('✓ CLI tool generated\n');

    // Step 7: Generate README
    console.log('📄 Generating README...');
    await this.generateReadme(config);
    console.log('✓ README generated\n');

    // Step 8: Generate .gitignore
    console.log('🚫 Generating .gitignore...');
    await this.generateGitignore(config);
    console.log('✓ .gitignore generated\n');

    console.log('✅ Project generated successfully!\n');
    console.log(`📂 Location: ${config.outputPath}`);
    console.log(`🎯 Next steps:`);
    console.log(`   1. cd ${config.outputPath}`);
    console.log(`   2. Review and edit .env file`);
    console.log(`   3. ./${config.projectName} up`);
  }

  /**
   * Generates project README
   */
  private async generateReadme(config: ProjectConfig): Promise<void> {
    const content = `# ${config.projectName}

Docker-based project with multi-service architecture.

## 🚀 Quick Start

\`\`\`bash
# Start all services
./${config.projectName} up

# View logs
./${config.projectName} logs

# Stop all services
./${config.projectName} down
\`\`\`

## 📋 Services

${config.services.map((s) => `- **${s.name}** (${s.category}) - v${s.version}`).join('\n')}

## 🛠️ CLI Commands

\`\`\`bash
# Start containers
./${config.projectName} up

# Stop containers
./${config.projectName} down

# Build/rebuild containers
./${config.projectName} build [service]

# View logs
./${config.projectName} logs [service] [-f]

# Execute command in container
./${config.projectName} exec <service> <command>

# Open shell in container
./${config.projectName} shell <service>

# Show container status
./${config.projectName} status

# Restart containers
./${config.projectName} restart [service]
\`\`\`

## 📁 Project Structure

\`\`\`
${config.projectName}/
├── apps/                  # Application source code
├── docker/               # Docker configuration
│   ├── compose/         # Docker compose files
│   ├── images/          # Custom Dockerfiles
│   ├── scripts/         # Entrypoint scripts
│   └── proxy/           # Proxy configuration
├── bin/cli/             # CLI tool internals
├── .env                 # Environment variables
└── ${config.projectName}           # Main CLI tool
\`\`\`

## 🌐 Access URLs

- Main: http://${config.domain}:${config.proxy.port}
${config.services
  .filter((s) => s.category === 'app')
  .map((s) => `- ${s.name}: http://${config.domain}:${config.proxy.port}/${s.name}`)
  .join('\n')}

## 🔧 Configuration

Edit \`.env\` file to configure:
- Database credentials
- Service ports
- Domain settings
- Other environment-specific values

## 📝 Generated by Docker Project Builder

This project was generated using [Docker Project Builder](https://github.com/yourusername/docker-project-builder).
`;

    const filePath = join(config.outputPath, 'README.md');
    await this.fileWriter.writeFile(filePath, content);
  }

  /**
   * Generates .gitignore file
   */
  private async generateGitignore(config: ProjectConfig): Promise<void> {
    const content = `# Environment files
.env
.env.local
.env.*.local

# Docker volumes
/volumes/

# Logs
*.log
/logs/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
.temp/

# SSL certificates (if generated locally)
/docker/ssl/*.crt
/docker/ssl/*.key
/docker/ssl/*.pem
`;

    const filePath = join(config.outputPath, '.gitignore');
    await this.fileWriter.writeFile(filePath, content);
  }
}
