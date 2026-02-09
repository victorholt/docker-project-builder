#!/usr/bin/env node

/**
 * Docker Project Builder CLI
 * Main entry point
 */

import { Command } from 'commander';
import { createCommand } from './cli/commands/create.js';
import { listServicesCommand } from './cli/commands/list-services.js';

const program = new Command();

program
  .name('dpb')
  .description('Docker Project Builder - Generate production-ready Docker projects')
  .version('0.1.0');

// Add commands
program.addCommand(createCommand);
program.addCommand(listServicesCommand);

// Parse arguments
program.parse();
