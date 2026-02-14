import { Command } from 'commander';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const webuiCommand = new Command('webui')
  .description('Install and run the Web UI for Docker Project Builder')
  .option('-p, --port <port>', 'Port to run the web UI on', '3100')
  .option('--install-only', 'Only install dependencies, do not start the server')
  .action(async (options) => {
    try {
      // Get the webui directory path
      const webuiDir = join(__dirname, '../../../webui');

      if (!existsSync(webuiDir)) {
        console.error('❌ Web UI directory not found at:', webuiDir);
        process.exit(1);
      }

      // Check if node_modules exists
      const nodeModulesPath = join(webuiDir, 'node_modules');
      const needsInstall = !existsSync(nodeModulesPath);

      if (needsInstall) {
        console.log('📦 Installing Web UI dependencies...');
        console.log('   This may take a few minutes...\n');

        try {
          const { stdout, stderr } = await execAsync('npm install --legacy-peer-deps', {
            cwd: webuiDir,
            maxBuffer: 10 * 1024 * 1024,
          });

          if (stderr && !stderr.includes('warning')) {
            console.error('Installation warnings:', stderr);
          }

          console.log('✅ Dependencies installed successfully!\n');
        } catch (error) {
          console.error('❌ Failed to install dependencies:', error);
          process.exit(1);
        }
      } else {
        console.log('✓ Dependencies already installed\n');
      }

      if (options.installOnly) {
        console.log('✅ Installation complete. Run "dpb webui" to start the server.');
        return;
      }

      // Start the dev server
      console.log('🚀 Starting Web UI...');
      console.log(`   Open http://localhost:${options.port} in your browser\n`);
      console.log('   Press Ctrl+C to stop the server\n');

      const devServer = spawn('npx', ['next', 'dev', '-p', options.port], {
        cwd: webuiDir,
        stdio: 'inherit',
        env: process.env,
        shell: true,
      });

      devServer.on('error', (error) => {
        console.error('❌ Failed to start Web UI:', error);
        process.exit(1);
      });

      devServer.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`\n❌ Web UI exited with code ${code}`);
          process.exit(code);
        }
      });

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        console.log('\n\n👋 Stopping Web UI...');
        devServer.kill('SIGINT');
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });
