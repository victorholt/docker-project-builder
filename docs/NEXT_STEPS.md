# Next Steps - Quick Start Guide

## 🚀 Resume Development Here

### What's Already Done
- ✅ Core architecture (interfaces, models, services, generators)
- ✅ 4 working plugins (Apache, Next.js, Express, PostgreSQL)
- ✅ TypeScript builds successfully (`npm run build`)
- ✅ All generators ready to use

### What's Needed to Run
The project can't be used yet because there's **no CLI entry point**. You need to implement the CLI commands.

---

## 📋 Immediate Tasks (Priority Order)

### Task 1: Create CLI Entry Point (HIGHEST PRIORITY)
**File:** `src/index.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { createCommand } from './cli/commands/create.js';
import { listServicesCommand } from './cli/commands/list-services.js';

const program = new Command();

program
  .name('dpb')
  .description('Docker Project Builder - Generate production-ready Docker projects')
  .version('0.1.0');

program.addCommand(createCommand);
program.addCommand(listServicesCommand);

program.parse();
```

### Task 2: Create Prompts Module
**File:** `src/cli/prompts.ts`

Implement interactive prompts using inquirer:
- Project name, domain, container prefix
- Service selection (checkboxes by category)
- Version selection per service
- Environment selection
- Proxy configuration
- Output path

**Returns:** `ProjectConfig` object

### Task 3: Create `create` Command
**File:** `src/cli/commands/create.ts`

```typescript
import { Command } from 'commander';
import { collectProjectConfig } from '../prompts.js';
import { ProjectGenerator } from '../../core/generator/project-generator.js';
import { PluginRegistry } from '../../core/services/plugin-registry.js';
import { FileWriter } from '../../core/services/file-writer.js';
import { TemplateRenderer } from '../../core/services/template-renderer.js';

export const createCommand = new Command('create')
  .description('Create a new Docker project')
  .action(async () => {
    try {
      // 1. Collect config via prompts
      const config = await collectProjectConfig();

      // 2. Discover plugins
      const registry = new PluginRegistry();
      await registry.discoverPlugins();

      // 3. Get selected plugins
      const plugins = config.services.map(s => registry.getPlugin(s.name)!);

      // 4. Initialize services
      const fileWriter = new FileWriter();
      const templateRenderer = new TemplateRenderer();

      // 5. Generate project
      const generator = new ProjectGenerator(fileWriter, templateRenderer);
      await generator.generate(config, plugins);

      console.log('\n✅ Project created successfully!');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });
```

### Task 4: Create `list` Command
**File:** `src/cli/commands/list-services.ts`

Simple command to list available services by category.

### Task 5: Build and Test
```bash
# Build
npm run build

# Test (should show help)
node dist/index.js --help

# Test create command
node dist/index.js create

# Or use the bin alias
npm link
dpb create
```

---

## 🧪 Testing Current Build (Task C)

### Option 1: Unit Test a Generator
Create `test.ts` in project root:

```typescript
import { StructureBuilder } from './src/core/generator/structure-builder.js';
import { FileWriter } from './src/core/services/file-writer.js';
import { ProjectConfig } from './src/core/models/project-config.js';

const config: ProjectConfig = {
  projectName: 'test-project',
  containerPrefix: 'test',
  domain: 'test.local',
  services: [
    { name: 'nextjs', version: '20-alpine', category: 'app' },
    { name: 'postgres', version: '16-alpine', category: 'database' }
  ],
  environments: ['local'],
  proxy: { port: 8080, sslPort: 8443, vhostMode: 'path' },
  outputPath: './test-output'
};

const fileWriter = new FileWriter();
const structureBuilder = new StructureBuilder(fileWriter);

await structureBuilder.buildStructure(config);
console.log('✅ Structure created at ./test-output');
```

Run: `tsx test.ts`

### Option 2: Test Plugin Loading
Create `test-plugins.ts`:

```typescript
import { PluginRegistry } from './src/core/services/plugin-registry.js';

const registry = new PluginRegistry();
await registry.discoverPlugins();

console.log('📦 Discovered plugins:');
for (const plugin of registry.getAllPlugins()) {
  console.log(`  - ${plugin.displayName} (${plugin.category})`);
}
```

Run: `tsx test-plugins.ts`

---

## 🔧 Add Remaining Plugins (Lower Priority)

Follow the same pattern as PostgreSQL:

### MySQL Plugin
**File:** `src/plugins/database/mysql/index.ts`
- Copy postgres plugin structure
- Change image to `mysql:8-alpine`
- Adjust env vars (MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE)
- Update health check to `mysqladmin ping`

### Redis Plugin
**File:** `src/plugins/cache/redis/index.ts`
- Image: `redis:7-alpine`
- Simple compose block with volume
- Health check: `redis-cli ping`
- No custom Dockerfile needed

### Valkey Plugin
**File:** `src/plugins/cache/valkey/index.ts`
- Similar to Redis
- Image: `valkey/valkey:latest`

### MailHog Plugin
**File:** `src/plugins/mail/mailhog/index.ts`
- Image: `mailhog/mailhog:latest`
- Ports: 1025 (SMTP), 8025 (UI)
- No auth needed for dev

### Mailpit Plugin
**File:** `src/plugins/mail/mailpit/index.ts`
- Image: `axllent/mailpit:latest`
- Similar to MailHog

---

## 📊 Progress Tracker

**Completion:** ~60% of MVP

| Step | Task | Status | Estimate |
|------|------|--------|----------|
| 1-5 | Core + 4 Plugins | ✅ Done | - |
| 6 | 5 More Plugins | ⏳ Pending | 2h |
| 7 | CLI Commands | ⏳ **CRITICAL** | 3h |
| 8 | Tests | ⏳ Pending | 4h |
| 9 | Docs | ⏳ Pending | 2h |

**Total Remaining:** ~11 hours

---

## 🎯 Suggested Next Session Plan

1. **Start here:** Implement CLI commands (Task 1-4 above) - 3 hours
2. **Test it:** Generate a real project and verify it works - 1 hour
3. **Add plugins:** Implement remaining 5 plugins - 2 hours
4. **Polish:** Tests and documentation - as time permits

---

## 💡 Quick Reference

**Key Files to Understand:**
- `src/core/interfaces/service-plugin.ts` - Plugin contract
- `src/core/generator/project-generator.ts` - Orchestrator
- `src/plugins/app/nextjs/index.ts` - Example plugin
- `docs/designs/arch/architecture.md` - Full architecture plan

**Build Commands:**
```bash
npm run build        # Compile TypeScript
npm run dev         # Run with tsx (no compile)
npm test            # Run tests (when added)
```

**Verify Build:**
```bash
ls dist/            # Should see compiled JS files
```

---

## 🐛 Troubleshooting

**Build fails:**
- Check `npm install` ran successfully
- Verify `tsconfig.json` settings
- Look for syntax errors in new code

**Plugin not discovered:**
- Verify `index.ts` exports default plugin instance
- Check folder structure matches `src/plugins/{category}/{name}/`
- Ensure plugin implements all IServicePlugin methods

**Generated project fails:**
- Run `docker compose config` to validate YAML
- Check env var substitution (${VAR_NAME})
- Verify file paths are correct

---

## 📞 Need Help?

Check these files:
- `docs/PROGRESS.md` - Detailed progress and architecture
- `docs/designs/arch/architecture.md` - Original plan
- `src/core/interfaces/` - Type definitions and contracts
