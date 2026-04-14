import type { IFileWriter } from '../interfaces/file-writer.js';
import type { IServicePlugin, CLICommand } from '../interfaces/service-plugin.js';
import type { ProjectConfig } from '../models/project-config.js';
import { getPrimaryDomain } from '../models/project-config.js';
import { join } from 'path';

/**
 * Returns the domain to bake into generated shell scripts as the default
 * value for ${DOMAIN:-...}. The generated CLI is run interactively and
 * typically against local first, so prefer local; otherwise fall back in
 * precedence order via getPrimaryDomain.
 */
function defaultShellDomain(config: ProjectConfig): string {
  return config.domains.local ?? getPrimaryDomain(config) ?? '';
}

/**
 * CLIBuilder generates the bash CLI tool for managing the Docker project
 */
export class CLIBuilder {
  constructor(private fileWriter: IFileWriter) {}

  /**
   * Builds the complete CLI tool
   */
  async buildCLI(config: ProjectConfig, plugins: IServicePlugin[]): Promise<void> {
    const { outputPath, projectName } = config;
    const cliDir = join(outputPath, 'bin/cli');
    const commandsDir = join(cliDir, 'commands');

    // Build main CLI entry point
    await this.buildMainCLI(outputPath, projectName, config);

    // Build common utility functions
    await this.buildCommonUtilities(cliDir, config);

    // Build standard commands
    await this.buildStandardCommands(commandsDir, config);

    // Build plugin-specific commands
    await this.buildPluginCommands(commandsDir, config, plugins);
  }

  /**
   * Builds the main CLI entry point (./cli)
   */
  private async buildMainCLI(outputPath: string, projectName: string, config: ProjectConfig): Promise<void> {
    // Determine which conditional commands are available
    const hasAppPlugins = config.services.some((s) => s.category === 'app');
    const hasDbPlugins = config.services.some((s) => s.category === 'database');

    // Build help text conditionally
    const helpCommands: string[] = [
      '    up          Start all containers',
      '    down        Stop and remove containers',
      '    clean       Remove containers, volumes, and local images',
      '    build       Build or rebuild containers',
      '    logs        View container logs',
      '    exec        Execute a command in a container',
      '    shell       Open a shell in a container',
      '    status      Show container status',
      '    restart     Restart containers',
      '    deploy      Guided deployment wizard',
      '    env         Interactive environment configuration',
      '    version     View or bump project version',
    ];

    if (hasAppPlugins) {
      helpCommands.push('    install     Install dependencies in app containers');
      helpCommands.push('    typecheck   Run TypeScript type checking');
    }
    if (hasDbPlugins) {
      helpCommands.push('    db          Database management commands');
    }

    helpCommands.push("    certs       Generate SSL certificates (self-signed or Let's Encrypt)");
    helpCommands.push("    certs-renew Renew Let's Encrypt certificates");
    helpCommands.push('    help        Show this help message');

    const helpText = helpCommands.join('\n');

    // Build dispatcher cases conditionally
    const dispatchCases: string[] = [
      '    up)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/up.sh"',
      '        ;;',
      '    down)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/down.sh"',
      '        ;;',
      '    clean)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/clean.sh"',
      '        ;;',
      '    build)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/build.sh"',
      '        ;;',
      '    logs)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/logs.sh"',
      '        ;;',
      '    exec)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/exec.sh"',
      '        ;;',
      '    shell)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/shell.sh"',
      '        ;;',
      '    status)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/status.sh"',
      '        ;;',
      '    restart)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/restart.sh"',
      '        ;;',
      '    deploy)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/deploy.sh"',
      '        ;;',
      '    env)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/env.sh"',
      '        ;;',
      '    version)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/version.sh"',
      '        ;;',
    ];

    if (hasAppPlugins) {
      dispatchCases.push(
        '    install)',
        '        source "${SCRIPT_DIR}/bin/cli/commands/install.sh"',
        '        ;;',
        '    typecheck)',
        '        source "${SCRIPT_DIR}/bin/cli/commands/typecheck.sh"',
        '        ;;',
      );
    }
    if (hasDbPlugins) {
      dispatchCases.push(
        '    db)',
        '        source "${SCRIPT_DIR}/bin/cli/commands/db.sh"',
        '        ;;',
      );
    }

    dispatchCases.push(
      '    certs)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/certs.sh"',
      '        ;;',
      '    certs-renew)',
      '        source "${SCRIPT_DIR}/bin/cli/commands/certs-renew.sh"',
      '        ;;',
    );

    const dispatchText = dispatchCases.join('\n');

    const content = `#!/usr/bin/env bash

# ${projectName} CLI Tool
# Generated by Docker Project Builder

set -e

# Get script directory
SCRIPT_DIR="\$( cd "\$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="\${SCRIPT_DIR}"

# Source common utilities
source "\${SCRIPT_DIR}/bin/cli/common.sh"

# Extract --env flag from any position in arguments
REMAINING_ARGS=()
for arg in "$@"; do
    case "\$arg" in
        --env=*)
            export APP_ENV="\${arg#*=}"
            ;;
        *)
            REMAINING_ARGS+=("\$arg")
            ;;
    esac
done
set -- "\${REMAINING_ARGS[@]}"

show_help() {
    cat << EOF
${projectName} CLI - Docker Project Management Tool

Usage: ./cli [--env=<local|staging|prod>] [command] [options]

Commands:
${helpText}

Examples:
    ./cli up
    ./cli --env=prod up
    ./cli logs api
    ./cli shell nextjs
    ./cli deploy
    ./cli certs

EOF
}

# Command dispatcher
COMMAND="\${1:-help}"
shift || true

case "\${COMMAND}" in
${dispatchText}
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: \${COMMAND}"
        echo ""
        show_help
        exit 1
        ;;
esac
`;

    const filePath = join(outputPath, 'cli');
    await this.fileWriter.writeFile(filePath, content);
    await this.fileWriter.makeExecutable(filePath);
  }

  /**
   * Builds common utility functions used by all commands
   */
  private async buildCommonUtilities(cliDir: string, config: ProjectConfig): Promise<void> {
    // Build check_all_ports based on what port env vars exist
    const portChecks: string[] = [];
    for (const service of config.services) {
      if (service.category === 'app') {
        // App services (api, nextjs) are NOT exposed on a host port by
        // default — only via the HTTPS proxy. Only check the port if the
        // user has explicitly set e.g. API_EXTERNAL_PORT in .env.
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        portChecks.push(`    if [ -n "\${${portVar}:-}" ]; then check_port "\${${portVar}}" "${service.name.toUpperCase()}" "${portVar}" || ok=false; fi`);
      } else if (service.category === 'database') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 5432;
        portChecks.push(`    check_port "\${${portVar}:-${defaultPort}}" "${service.name.toUpperCase()}" "${portVar}" || ok=false`);
      } else if (service.category === 'cache') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 6379;
        portChecks.push(`    check_port "\${${portVar}:-${defaultPort}}" "${service.name.toUpperCase()}" "${portVar}" || ok=false`);
      } else if (service.category === 'mail' && service.name === 'mailhog') {
        portChecks.push(`    check_port "\${MAILHOG_SMTP_PORT:-1025}" "MAILHOG_SMTP" "MAILHOG_SMTP_PORT" || ok=false`);
        portChecks.push(`    check_port "\${MAILHOG_UI_PORT:-8025}" "MAILHOG_UI" "MAILHOG_UI_PORT" || ok=false`);
      }
    }
    // Always check proxy ports
    portChecks.push(`    check_port "\${PROXY_PORT:-${config.proxy.port}}" "PROXY" "PROXY_PORT" || ok=false`);
    portChecks.push(`    check_port "\${PROXY_SSL_PORT:-${config.proxy.sslPort}}" "PROXY_SSL" "PROXY_SSL_PORT" || ok=false`);

    const portChecksText = portChecks.join('\n');

    const content = `#!/usr/bin/env bash

# Common utilities for CLI commands

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Logging functions
info() {
    echo -e "\${BLUE}\\xe2\\x84\\xb9\${NC} $*"
}

success() {
    echo -e "\${GREEN}\\xe2\\x9c\\x93\${NC} $*"
}

warning() {
    echo -e "\${YELLOW}\\xe2\\x9a\\xa0\${NC} $*"
}

error() {
    echo -e "\${RED}\\xe2\\x9c\\x97\${NC} $*" >&2
}

# Docker Compose wrapper (environment-aware)
dc() {
    local compose_files="-f \${PROJECT_ROOT}/docker/compose/docker-compose.yml"

    # Determine environment from APP_ENV
    local env="\${APP_ENV:-local}"

    case "\${env}" in
        local)
            if [ -f "\${PROJECT_ROOT}/docker/compose/docker-compose.override.yml" ]; then
                compose_files="\$compose_files -f \${PROJECT_ROOT}/docker/compose/docker-compose.override.yml"
            fi
            ;;
        staging)
            if [ -f "\${PROJECT_ROOT}/docker/compose/docker-compose.staging.yml" ]; then
                compose_files="\$compose_files -f \${PROJECT_ROOT}/docker/compose/docker-compose.staging.yml"
            fi
            ;;
        prod)
            if [ -f "\${PROJECT_ROOT}/docker/compose/docker-compose.prod.yml" ]; then
                compose_files="\$compose_files -f \${PROJECT_ROOT}/docker/compose/docker-compose.prod.yml"
            fi
            ;;
    esac

    # When running locally, ensure the 'local' compose profile is active so
    # services gated behind \`profiles: [local]\` (e.g. mailhog, postgres,
    # valkey) come up. Preserve any other profiles the user has set.
    if [ "\${env}" = "local" ]; then
        if [ -z "\${COMPOSE_PROFILES:-}" ]; then
            export COMPOSE_PROFILES="local"
        elif [[ ",\${COMPOSE_PROFILES}," != *",local,"* ]]; then
            export COMPOSE_PROFILES="\${COMPOSE_PROFILES},local"
        fi
    fi

    local env_file=""
    if [ -f "\${PROJECT_ROOT}/.env" ]; then
        env_file="--env-file \${PROJECT_ROOT}/.env"
    fi
    docker compose \$env_file \$compose_files "$@"
}

# Check if docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Load environment variables
load_env() {
    if [ -f "\${PROJECT_ROOT}/.env" ]; then
        set -a
        source "\${PROJECT_ROOT}/.env"
        set +a
    else
        warning ".env file not found. Using defaults."
    fi
}

# Update or add a key=value in the .env file
# Usage: set_env_var <KEY> <VALUE>
set_env_var() {
    local key="$1"
    local value="$2"
    local env_file="\${PROJECT_ROOT}/.env"

    if [ ! -f "\$env_file" ]; then
        echo "\${key}=\${value}" > "\$env_file"
        return
    fi

    if grep -q "^\${key}=" "\$env_file" 2>/dev/null; then
        # Update existing key (macOS-compatible sed)
        sed -i '' "s|^\${key}=.*|\${key}=\${value}|" "\$env_file"
    else
        # Append new key
        echo "\${key}=\${value}" >> "\$env_file"
    fi
}

# Check if a port is available. If in use, prompt the user for a new port.
# Skips ports held by our own project containers.
# Usage: check_port <port> <SERVICE_NAME> <ENV_VAR_NAME>
check_port() {
    local port="$1"
    local service="$2"
    local env_var="$3"
    local prefix="\${CONTAINER_PREFIX:-${config.containerPrefix}}"
    local pid

    pid=\$(lsof -ti :"\$port" 2>/dev/null)
    if [ -z "\$pid" ]; then
        return 0
    fi

    # If the port is held by one of our own running containers, that's fine
    local container
    container=\$(docker ps --filter "publish=\$port" --filter "name=\${prefix}-" --format '{{.Names}}' 2>/dev/null)
    if [ -n "\$container" ]; then
        return 0
    fi

    local owner
    owner=\$(lsof -i :"\$port" -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print \$1}')
    warning "Port \$port (\$service) is already in use by \${owner:-unknown}"

    # Prompt for a new port
    while true; do
        read -r -p "  Enter a new port for \$service (or 'q' to abort): " new_port
        if [ "\$new_port" = "q" ]; then
            return 1
        fi
        # Validate it's a number
        if ! [[ "\$new_port" =~ ^[0-9]+$ ]]; then
            error "  Invalid port number"
            continue
        fi
        # Check the new port is free
        if lsof -ti :"\$new_port" > /dev/null 2>&1; then
            error "  Port \$new_port is also in use"
            continue
        fi
        # Good - save to .env and export for this session
        set_env_var "\$env_var" "\$new_port"
        export "\$env_var=\$new_port"
        success "  \$service port set to \$new_port (saved to .env)"
        return 0
    done
}

# Check all project ports for conflicts, prompting to fix any that are in use.
check_all_ports() {
    local ok=true
${portChecksText}

    if [ "\$ok" = false ]; then
        echo ""
        error "Aborting due to unresolved port conflicts."
        return 1
    fi
    return 0
}

# Get list of service names
get_services() {
    dc config --services
}

# Check if service exists
service_exists() {
    local service="$1"
    get_services | grep -q "^\${service}$"
}
`;

    const filePath = join(cliDir, 'common.sh');
    await this.fileWriter.writeFile(filePath, content);
  }

  /**
   * Builds standard CLI commands (up, down, build, logs, etc.)
   */
  private async buildStandardCommands(commandsDir: string, config: ProjectConfig): Promise<void> {
    // up command
    await this.buildUpCommand(commandsDir, config);

    // down command
    await this.buildDownCommand(commandsDir);

    // clean command
    await this.buildCleanCommand(commandsDir);

    // build command
    await this.buildBuildCommand(commandsDir);

    // logs command
    await this.buildLogsCommand(commandsDir);

    // exec command
    await this.buildExecCommand(commandsDir);

    // shell command
    await this.buildShellCommand(commandsDir);

    // status command
    await this.buildStatusCommand(commandsDir);

    // restart command
    await this.buildRestartCommand(commandsDir);

    // deploy command
    await this.buildDeployCommand(commandsDir, config);

    // env command
    await this.buildEnvCommand(commandsDir, config);

    // version command
    await this.buildVersionCommand(commandsDir);

    // certs command
    await this.buildCertsCommand(commandsDir, config);

    // certs-renew command
    await this.buildCertsRenewCommand(commandsDir, config);

    // Conditional commands based on plugin categories
    const hasAppPlugins = config.services.some((s) => s.category === 'app');
    const hasDbPlugins = config.services.some((s) => s.category === 'database');

    if (hasAppPlugins) {
      await this.buildInstallCommand(commandsDir, config);
      await this.buildTypecheckCommand(commandsDir, config);
    }
    if (hasDbPlugins) {
      await this.buildDbCommand(commandsDir, config);
    }
  }

  /**
   * Builds the 'up' command
   */
  private async buildUpCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    const content = `#!/usr/bin/env bash

# Start all containers

check_docker
load_env

ENV="\${APP_ENV:-local}"

# Force-remove stale containers (Created/Exited) to prevent port conflicts.
PREFIX="\${CONTAINER_PREFIX:-${config.containerPrefix}}"
stale=\$(docker ps -a --filter "name=\${PREFIX}-" --filter "status=created" --filter "status=exited" -q 2>/dev/null)
if [ -n "\$stale" ]; then
    warning "Removing stale containers to avoid port conflicts..."
    docker rm -f \$stale 2>/dev/null
fi

# Check for port conflicts before starting (local only)
if [ "\${ENV}" = "local" ]; then
    check_all_ports || exit 1
fi

# In non-local environments, auto-build production images before starting
if [ "\${ENV}" != "local" ]; then
    info "Environment: \${ENV} -- building production images..."
    dc build
fi

info "Starting containers..."
dc up -d "$@"

success "Containers started successfully!"
info "Run './cli status' to see container status"
info "Run './cli logs' to view logs"
`;

    await this.fileWriter.writeFile(join(commandsDir, 'up.sh'), content);
  }

  /**
   * Builds the 'down' command
   */
  private async buildDownCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# Stop all containers

check_docker

info "Stopping containers..."
dc down "$@"

success "Containers stopped successfully!"
`;

    await this.fileWriter.writeFile(join(commandsDir, 'down.sh'), content);
  }

  /**
   * Builds the 'clean' command
   */
  private async buildCleanCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# Remove all project containers, volumes, and local images

check_docker

info "Removing project containers, volumes, and images..."
dc down --volumes --rmi local "$@"

success "Project cleaned successfully!"
`;

    await this.fileWriter.writeFile(join(commandsDir, 'clean.sh'), content);
  }

  /**
   * Builds the 'build' command
   */
  private async buildBuildCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# Build or rebuild containers

check_docker
load_env

SERVICE="\${1:-}"

if [ -n "\${SERVICE}" ]; then
    if service_exists "\${SERVICE}"; then
        info "Building \${SERVICE}..."
        dc build "\${SERVICE}"
        success "\${SERVICE} built successfully!"
    else
        error "Service '\${SERVICE}' not found"
        exit 1
    fi
else
    info "Building all containers..."
    dc build
    success "All containers built successfully!"
fi
`;

    await this.fileWriter.writeFile(join(commandsDir, 'build.sh'), content);
  }

  /**
   * Builds the 'logs' command
   */
  private async buildLogsCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# View container logs

check_docker

SERVICE="\${1:-}"
FOLLOW="\${2:-}"

if [ "\${FOLLOW}" = "-f" ] || [ "\${FOLLOW}" = "--follow" ]; then
    FOLLOW_FLAG="-f"
else
    FOLLOW_FLAG=""
fi

if [ -n "\${SERVICE}" ]; then
    if service_exists "\${SERVICE}"; then
        dc logs \${FOLLOW_FLAG} "\${SERVICE}"
    else
        error "Service '\${SERVICE}' not found"
        exit 1
    fi
else
    dc logs \${FOLLOW_FLAG}
fi
`;

    await this.fileWriter.writeFile(join(commandsDir, 'logs.sh'), content);
  }

  /**
   * Builds the 'exec' command
   */
  private async buildExecCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# Execute a command in a container

check_docker

SERVICE="\${1:-}"
shift || true

if [ -z "\${SERVICE}" ]; then
    error "Service name required"
    echo "Usage: exec <service> <command>"
    exit 1
fi

if ! service_exists "\${SERVICE}"; then
    error "Service '\${SERVICE}' not found"
    exit 1
fi

dc exec "\${SERVICE}" "$@"
`;

    await this.fileWriter.writeFile(join(commandsDir, 'exec.sh'), content);
  }

  /**
   * Builds the 'shell' command
   */
  private async buildShellCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# Open a shell in a container

check_docker

SERVICE="\${1:-}"

if [ -z "\${SERVICE}" ]; then
    error "Service name required"
    echo "Usage: shell <service>"
    exit 1
fi

if ! service_exists "\${SERVICE}"; then
    error "Service '\${SERVICE}' not found"
    exit 1
fi

info "Opening shell in \${SERVICE}..."

# Try bash first, fallback to sh
if dc exec "\${SERVICE}" bash --version > /dev/null 2>&1; then
    dc exec "\${SERVICE}" bash
else
    dc exec "\${SERVICE}" sh
fi
`;

    await this.fileWriter.writeFile(join(commandsDir, 'shell.sh'), content);
  }

  /**
   * Builds the 'status' command
   */
  private async buildStatusCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# Show container status

check_docker

info "Container Status:"
echo ""
dc ps
`;

    await this.fileWriter.writeFile(join(commandsDir, 'status.sh'), content);
  }

  /**
   * Builds the 'restart' command
   */
  private async buildRestartCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# Restart containers

check_docker

SERVICE="\${1:-}"

if [ -n "\${SERVICE}" ]; then
    if service_exists "\${SERVICE}"; then
        info "Restarting \${SERVICE}..."
        dc restart "\${SERVICE}"
        success "\${SERVICE} restarted successfully!"
    else
        error "Service '\${SERVICE}' not found"
        exit 1
    fi
else
    info "Restarting all containers..."
    dc restart
    success "All containers restarted successfully!"
fi
`;

    await this.fileWriter.writeFile(join(commandsDir, 'restart.sh'), content);
  }

  /**
   * Builds the 'deploy' command (guided deployment wizard)
   */
  private async buildDeployCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    const hasDbPlugins = config.services.some((s) => s.category === 'database');

    // Build health check services list
    const appServices = config.services.filter((s) => s.category === 'app').map((s) => s.name);
    const healthCheckServices = ['proxy', ...appServices].join(' ');

    // Build DB step conditionally
    let dbStep = '';
    if (hasDbPlugins) {
      const dbServices = config.services.filter((s) => s.category === 'database').map((s) => s.name);
      dbStep = `
# ====================================================================
# Step 5: Database Setup
# ====================================================================
step_header 5 "Database Setup"

info "Push database schema (required on first deploy)"
read -r -p "Run 'db push' now? [Y/n]: " do_db
if [[ ! "\${do_db}" =~ ^[Nn]$ ]]; then
    source "\${SCRIPT_DIR}/bin/cli/commands/db.sh" push
    success "Database schema pushed!"
else
    info "Skipping database setup"
    info "Run './cli db push' later to initialize the schema"
fi
`;
    } else {
      dbStep = `
# ====================================================================
# Step 5: Database Setup (skipped - no database plugins)
# ====================================================================
step_header 5 "Database Setup"
info "No database plugins configured. Skipping."
`;
    }

    const content = `#!/usr/bin/env bash

# Guided deployment wizard
# Usage: ./cli deploy

show_deploy_help() {
    echo "Guided Deployment Wizard"
    echo ""
    echo "Usage:"
    echo "  ./cli deploy"
    echo ""
    echo "Walks through the full deployment process:"
    echo "  1. Environment configuration (.env)"
    echo "  2. Build Docker images"
    echo "  3. Start containers"
    echo "  4. Wait for services to be healthy"
    echo "  5. Database setup"
    echo "  6. SSL certificate setup"
    echo ""
}

if [[ "\${1:-}" == "-h" || "\${1:-}" == "--help" ]]; then
    show_deploy_help
    exit 0
fi

check_docker

# -- Helpers ---------------------------------------------------------
step_header() {
    local step_num="$1"
    local step_name="$2"
    echo ""
    echo "---------------------------------------------"
    echo "  Step \${step_num}: \${step_name}"
    echo "---------------------------------------------"
    echo ""
}

wait_for_healthy() {
    local service="$1"
    local max_wait="\${2:-120}"
    local elapsed=0

    while [ \$elapsed -lt \$max_wait ]; do
        local state
        state=\$(dc ps --format '{{.Health}}' "\${service}" 2>/dev/null || echo "unknown")
        if echo "\${state}" | grep -qi "healthy"; then
            return 0
        fi
        sleep 2
        elapsed=\$((elapsed + 2))
        printf "."
    done
    return 1
}

# ====================================================================
# Step 1: Environment Configuration
# ====================================================================
step_header 1 "Environment Configuration"

load_env
ENV="\${APP_ENV:-local}"

if [ -f "\${PROJECT_ROOT}/.env" ]; then
    info "Current .env found (APP_ENV=\${ENV}, DOMAIN=\${DOMAIN:-not set})"
    echo ""
    read -r -p "Reconfigure .env? [y/N]: " reconfig
    if [[ "\${reconfig}" =~ ^[Yy]$ ]]; then
        source "\${SCRIPT_DIR}/bin/cli/commands/env.sh"
        load_env
        ENV="\${APP_ENV:-local}"
    fi
else
    warning "No .env file found. Starting interactive setup..."
    source "\${SCRIPT_DIR}/bin/cli/commands/env.sh"
    load_env
    ENV="\${APP_ENV:-local}"
fi

if [[ "\${ENV}" == "local" ]]; then
    warning "APP_ENV is 'local'. For production deployment, set APP_ENV=prod in .env"
    read -r -p "Continue anyway? [y/N]: " continue_local
    if [[ ! "\${continue_local}" =~ ^[Yy]$ ]]; then
        info "Run './cli env' to reconfigure"
        exit 0
    fi
fi

# ====================================================================
# Step 2: Build Docker Images
# ====================================================================
step_header 2 "Build Docker Images"

info "Building images for environment: \${ENV}"
echo ""
read -r -p "Build images now? [Y/n]: " do_build
if [[ ! "\${do_build}" =~ ^[Nn]$ ]]; then
    dc build
    success "Images built successfully!"
else
    info "Skipping build (using existing images)"
fi

# ====================================================================
# Step 3: Start Containers
# ====================================================================
step_header 3 "Start Containers"

read -r -p "Start containers? [Y/n]: " do_start
if [[ ! "\${do_start}" =~ ^[Nn]$ ]]; then
    dc up -d
    success "Containers started!"
else
    info "Skipping start"
fi

# ====================================================================
# Step 4: Wait for Health
# ====================================================================
step_header 4 "Waiting for Services"

SERVICES_TO_CHECK="${healthCheckServices}"

all_healthy=true
for svc in \${SERVICES_TO_CHECK}; do
    printf "  Waiting for %s " "\${svc}"
    if wait_for_healthy "\${svc}" 120; then
        echo ""
        success "\${svc} is healthy"
    else
        echo ""
        warning "\${svc} did not become healthy within 120s"
        all_healthy=false
    fi
done

if [ "\${all_healthy}" = true ]; then
    success "All services are healthy!"
else
    warning "Some services are not healthy. Check logs: ./cli logs"
fi
${dbStep}
# ====================================================================
# Step 6: SSL Certificates
# ====================================================================
step_header 6 "SSL Certificates"

if [[ "\${ENV}" != "local" ]]; then
    info "Domain: \${DOMAIN:-not set}"
    info "Make sure DNS for \${DOMAIN:-your domain} points to this server"
    echo ""
    read -r -p "Request Let's Encrypt SSL certificate? [Y/n]: " do_certs
    if [[ ! "\${do_certs}" =~ ^[Nn]$ ]]; then
        source "\${SCRIPT_DIR}/bin/cli/commands/certs.sh"
    else
        info "Skipping SSL setup"
        info "Run './cli certs' later to get SSL certificates"
    fi
else
    info "Local environment -- run './cli certs' for self-signed certificates"
fi

# ====================================================================
# Summary
# ====================================================================
echo ""
echo "========================================="
echo "  Deployment Complete"
echo "========================================="
echo ""

dc ps

echo ""
if [[ "\${ENV}" != "local" && -n "\${DOMAIN:-}" ]]; then
    PROTO="http"
    if [ -f "\${PROJECT_ROOT}/docker/ssl/\${DOMAIN}.crt" ]; then
        PROTO="https"
    fi
    success "Access your app: \${PROTO}://\${DOMAIN}"
else
    success "Access your app: http://\${DOMAIN:-localhost}:\${PROXY_PORT:-${config.proxy.port}}"
fi

echo ""
info "Useful commands:"
echo "  ./cli status          # Container status"
echo "  ./cli logs            # View logs"
echo "  ./cli restart         # Restart all services"
echo "  ./cli certs           # Manage SSL certificates"
echo "  ./cli certs-renew     # Renew Let's Encrypt certs"
echo ""

if [[ "\${ENV}" != "local" ]]; then
    warning "Remember to set up auto-renewal for SSL certificates:"
    echo "  COMPOSE_PROFILES=auto-renew ./cli up certbot-renew"
    echo ""
fi
`;

    await this.fileWriter.writeFile(join(commandsDir, 'deploy.sh'), content);
  }

  /**
   * Builds the 'env' command (interactive .env configurator)
   */
  private async buildEnvCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    // Build plugin-specific prompts
    const pluginPrompts: string[] = [];

    for (const service of config.services) {
      if (service.category === 'database') {
        const nameUpper = service.name.toUpperCase();
        pluginPrompts.push(`
echo ""
info "${service.name} configuration"
prompt ${nameUpper}_USER "${service.name} user" "\${${nameUpper}_USER:-${config.containerPrefix}_user}"
prompt ${nameUpper}_PASSWORD "${service.name} password" "\${${nameUpper}_PASSWORD:-${config.containerPrefix}_pass}" true
prompt ${nameUpper}_DB "${service.name} database" "\${${nameUpper}_DB:-${config.containerPrefix}_db}"
`);
      }
    }

    // Build port prompts for app services
    const portPrompts: string[] = [];
    for (const service of config.services) {
      if (service.category === 'app') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 3000;
        portPrompts.push(`prompt ${portVar} "${service.name} external port" "\${${portVar}:-${defaultPort}}"`);
      } else if (service.category === 'database') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 5432;
        portPrompts.push(`prompt ${portVar} "${service.name} external port" "\${${portVar}:-${defaultPort}}"`);
      } else if (service.category === 'cache') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 6379;
        portPrompts.push(`prompt ${portVar} "${service.name} external port" "\${${portVar}:-${defaultPort}}"`);
      } else if (service.category === 'mail' && service.name === 'mailhog') {
        portPrompts.push(`prompt MAILHOG_SMTP_PORT "MailHog SMTP port" "\${MAILHOG_SMTP_PORT:-1025}"`);
        portPrompts.push(`prompt MAILHOG_UI_PORT "MailHog Web UI port" "\${MAILHOG_UI_PORT:-8025}"`);
      }
    }
    portPrompts.push(`prompt PROXY_PORT "Proxy HTTP port" "\${PROXY_PORT:-${config.proxy.port}}"`);
    portPrompts.push(`prompt PROXY_SSL_PORT "Proxy HTTPS port" "\${PROXY_SSL_PORT:-${config.proxy.sslPort}}"`);

    const portPromptsText = portPrompts.join('\n');
    const pluginPromptsText = pluginPrompts.join('');

    // Build env file write section for ports
    const portEnvLines: string[] = [];
    for (const service of config.services) {
      if (service.category === 'app') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 3000;
        portEnvLines.push(`${portVar}=\${${portVar}:-${defaultPort}}`);
      } else if (service.category === 'database') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 5432;
        portEnvLines.push(`${portVar}=\${${portVar}:-${defaultPort}}`);
      } else if (service.category === 'cache') {
        const portVar = `${service.name.toUpperCase()}_EXTERNAL_PORT`;
        const defaultPort = (service.config?.port as number) || 6379;
        portEnvLines.push(`${portVar}=\${${portVar}:-${defaultPort}}`);
      } else if (service.category === 'mail' && service.name === 'mailhog') {
        portEnvLines.push(`MAILHOG_SMTP_PORT=\${MAILHOG_SMTP_PORT:-1025}`);
        portEnvLines.push(`MAILHOG_UI_PORT=\${MAILHOG_UI_PORT:-8025}`);
      }
    }
    portEnvLines.push(`PROXY_PORT=\${PROXY_PORT:-${config.proxy.port}}`);
    portEnvLines.push(`PROXY_SSL_PORT=\${PROXY_SSL_PORT:-${config.proxy.sslPort}}`);

    const portEnvLinesText = portEnvLines.join('\n');

    // Build db env section
    const dbEnvLines: string[] = [];
    for (const service of config.services) {
      if (service.category === 'database') {
        const nameUpper = service.name.toUpperCase();
        dbEnvLines.push(`${nameUpper}_USER=\${${nameUpper}_USER}`);
        dbEnvLines.push(`${nameUpper}_PASSWORD=\${${nameUpper}_PASSWORD}`);
        dbEnvLines.push(`${nameUpper}_DB=\${${nameUpper}_DB}`);
      }
    }
    const dbEnvLinesText = dbEnvLines.length > 0 ? `
# -- Database -----------------------------------------------
${dbEnvLines.join('\n')}
` : '';

    const hasDbPlugins = config.services.some((s) => s.category === 'database');

    // Compose profiles section
    let composeProfilesSection = '';
    if (hasDbPlugins) {
      composeProfilesSection = `
# -- Docker Compose Profiles ---------------------------------
echo ""
read -r -p "Run database containers? (disable for external services) [Y/n]: " run_db
if [[ "\${run_db}" =~ ^[Nn]$ ]]; then
    COMPOSE_PROFILES=""
else
    COMPOSE_PROFILES="db"
fi
`;
    }

    const content = `#!/usr/bin/env bash

# Interactive environment configuration
# Usage: ./cli env

ENV_FILE="\${PROJECT_ROOT}/.env"

show_env_help() {
    echo "Interactive Environment Configuration"
    echo ""
    echo "Usage:"
    echo "  ./cli env"
    echo ""
    echo "Walks you through configuring your .env file."
    echo "If .env already exists, current values are used as defaults."
    echo ""
}

# Help flag
if [[ "\${1:-}" == "-h" || "\${1:-}" == "--help" ]]; then
    show_env_help
    exit 0
fi

# -- Load existing .env values as defaults ---------------------
if [ -f "\${ENV_FILE}" ]; then
    set -a
    source "\${ENV_FILE}"
    set +a
    info "Loading existing .env values as defaults"
fi

# -- Prompt helper ---------------------------------------------
prompt() {
    local var_name="$1"
    local prompt_text="$2"
    local default_value="$3"
    local is_secret="\${4:-false}"

    if [ -n "\${default_value}" ]; then
        if [ "\${is_secret}" = "true" ]; then
            local display="****\${default_value: -4}"
            read -r -p "\${prompt_text} [\${display}]: " value
        else
            read -r -p "\${prompt_text} [\${default_value}]: " value
        fi
    else
        read -r -p "\${prompt_text}: " value
    fi

    # Use default if empty
    value="\${value:-\${default_value}}"
    eval "export \${var_name}='\${value}'"
}

# -- Generate random token ------------------------------------
generate_token() {
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32
    fi
}

echo ""
echo "========================================="
echo "  ${config.projectName} - Environment Setup"
echo "========================================="
echo ""

# -- Environment -----------------------------------------------
prompt APP_ENV "Environment (local/staging/prod)" "\${APP_ENV:-local}"
prompt DOMAIN "Domain" "\${DOMAIN:-${defaultShellDomain(config)}}"

# -- Docker ----------------------------------------------------
prompt CONTAINER_PREFIX "Container prefix" "\${CONTAINER_PREFIX:-${config.containerPrefix}}"
${pluginPromptsText}
# -- Ports (local only) ----------------------------------------
if [[ "\${APP_ENV}" == "local" ]]; then
    echo ""
    info "Local ports"
${portPromptsText}
fi

# -- SSL -------------------------------------------------------
if [[ "\${APP_ENV}" != "local" ]]; then
    echo ""
    info "SSL configuration"
    prompt CERT_EMAIL "Let's Encrypt email" "\${CERT_EMAIL:-admin@\${DOMAIN}}"
fi
${composeProfilesSection}
# -- Write .env file -------------------------------------------
echo ""
info "Writing \${ENV_FILE}..."

cat > "\${ENV_FILE}" << ENVEOF
# -- Environment -----------------------------------------------
APP_ENV=\${APP_ENV}
DOMAIN=\${DOMAIN}

# -- Docker ----------------------------------------------------
CONTAINER_PREFIX=\${CONTAINER_PREFIX}
PROJECT_NAME=${config.projectName}
${dbEnvLinesText}ENVEOF

if [[ "\${APP_ENV}" == "local" ]]; then
    cat >> "\${ENV_FILE}" << ENVEOF

# -- Ports (local dev only) ------------------------------------
${portEnvLinesText}
ENVEOF
fi

if [ -n "\${CERT_EMAIL:-}" ]; then
    cat >> "\${ENV_FILE}" << ENVEOF

# -- SSL -------------------------------------------------------
CERT_EMAIL=\${CERT_EMAIL}
ENVEOF
fi

cat >> "\${ENV_FILE}" << ENVEOF

# -- Docker Compose Profiles -----------------------------------
COMPOSE_PROFILES=\${COMPOSE_PROFILES:-}
ENVEOF

echo ""
success ".env file written successfully!"
echo ""

if [[ "\${APP_ENV}" == "local" ]]; then
    info "Next: ./cli up"
else
    info "Next: ./cli deploy  (or ./cli build && ./cli up)"
fi
echo ""
`;

    await this.fileWriter.writeFile(join(commandsDir, 'env.sh'), content);
  }

  /**
   * Builds the 'version' command
   */
  private async buildVersionCommand(commandsDir: string): Promise<void> {
    const content = `#!/usr/bin/env bash

# ./cli version -- View or bump the project version
#
# Usage:
#   ./cli version              Show current version
#   ./cli version patch        Bump patch  (0.0.1 -> 0.0.2)
#   ./cli version minor        Bump minor  (0.0.1 -> 0.1.0)
#   ./cli version major        Bump major  (0.0.1 -> 1.0.0)
#   ./cli version set 1.2.3    Set explicit version

VERSION_FILE="\${PROJECT_ROOT}/VERSION"

if [[ ! -f "\$VERSION_FILE" ]]; then
    echo "0.0.0" > "\$VERSION_FILE"
fi

CURRENT=\$(tr -d '[:space:]' < "\$VERSION_FILE")

bump_version() {
    local version="$1"
    local part="$2"

    IFS='.' read -r major minor patch <<< "\$version"
    major="\${major:-0}"
    minor="\${minor:-0}"
    patch="\${patch:-0}"

    case "\$part" in
        major)
            major=\$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=\$((minor + 1))
            patch=0
            ;;
        patch)
            patch=\$((patch + 1))
            ;;
    esac

    echo "\${major}.\${minor}.\${patch}"
}

SUB="\${1:-}"

case "\$SUB" in
    "")
        info "Current version: \${CURRENT}"
        ;;
    patch|minor|major)
        NEW=\$(bump_version "\$CURRENT" "\$SUB")
        echo "\$NEW" > "\$VERSION_FILE"
        success "Version bumped: \${CURRENT} -> \${NEW}"
        ;;
    set)
        NEW="\${2:-}"
        if [[ -z "\$NEW" ]]; then
            error "Usage: ./cli version set <version>"
            exit 1
        fi
        if [[ ! "\$NEW" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
            error "Invalid version format. Expected: X.Y.Z (e.g. 1.2.3)"
            exit 1
        fi
        echo "\$NEW" > "\$VERSION_FILE"
        success "Version set: \${CURRENT} -> \${NEW}"
        ;;
    *)
        error "Unknown subcommand: \${SUB}"
        echo ""
        echo "Usage:"
        echo "  ./cli version              Show current version"
        echo "  ./cli version patch        Bump patch  (0.0.1 -> 0.0.2)"
        echo "  ./cli version minor        Bump minor  (0.0.1 -> 0.1.0)"
        echo "  ./cli version major        Bump major  (0.0.1 -> 1.0.0)"
        echo "  ./cli version set 1.2.3    Set explicit version"
        exit 1
        ;;
esac
`;

    await this.fileWriter.writeFile(join(commandsDir, 'version.sh'), content);
  }

  /**
   * Builds the 'certs' command
   */
  private async buildCertsCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    const content = `#!/usr/bin/env bash

# SSL Certificate management command
# Usage: ./cli certs [--domain=<domain>] [--days=<days>] [--force] [--email=<email>] [--staging-le]

# ============================================================================
# Help
# ============================================================================

show_cert_help() {
    echo "Generate SSL Certificates"
    echo ""
    echo "Usage:"
    echo "  ./cli certs [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --domain=<domain>  Domain to generate cert for (default: ${defaultShellDomain(config)})"
    echo "  --days=<days>      Certificate validity in days (default: 365, local only)"
    echo "  --force            Regenerate existing certificates"
    echo "  --email=<email>    Email for Let's Encrypt registration (staging/prod)"
    echo "  --staging-le       Use Let's Encrypt staging server (for testing)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Behavior by environment (APP_ENV):"
    echo "  local              Self-signed CA + domain certificate (openssl)"
    echo "  staging/prod       Let's Encrypt certificate via certbot"
    echo ""
    echo "Examples:"
    echo "  ./cli certs                                   # Local: self-signed for ${defaultShellDomain(config)}"
    echo "  ./cli certs --force                           # Regenerate certificates"
    echo "  ./cli certs --email=admin@example.com         # Staging/Prod: Let's Encrypt"
    echo "  ./cli certs --staging-le                      # Test with LE staging server"
    echo ""
}

# ============================================================================
# Sudo refusal guard
# ============================================================================
# Running the whole cert flow as root leaves ca.key / \${DOMAIN}.key owned by
# root, which Docker Desktop's file bridge then hides from the bind mount,
# and Apache inside the container can't read them. We only need sudo for the
# optional Keychain step at the very end.
if [ "\$(id -u)" = "0" ]; then
    echo "Error: do not run './cli certs' with sudo." >&2
    echo "Run it as your normal user; you'll be prompted for sudo only when" >&2
    echo "adding the CA to the macOS Keychain (optional, at the end)." >&2
    exit 1
fi

# ============================================================================
# Parse Arguments
# ============================================================================

load_env

DOMAIN="\${DOMAIN:-${defaultShellDomain(config)}}"
DAYS="365"
FORCE=""
EMAIL="\${CERT_EMAIL:-admin@\${DOMAIN}}"
LE_STAGING=""

while [[ \$# -gt 0 ]]; do
    case \$1 in
        --domain=*)
            DOMAIN="\${1#*=}"
            shift
            ;;
        --days=*)
            DAYS="\${1#*=}"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --email=*)
            EMAIL="\${1#*=}"
            shift
            ;;
        --staging-le)
            LE_STAGING="true"
            shift
            ;;
        -h|--help)
            show_cert_help
            exit 0
            ;;
        *)
            error "Unknown option: \$1"
            show_cert_help
            exit 1
            ;;
    esac
done

SSL_DIR="\${PROJECT_ROOT}/docker/ssl"
ENV="\${APP_ENV:-local}"

mkdir -p "\${SSL_DIR}"

# ============================================================================
# Local: Self-signed CA + Domain Certificate
# ============================================================================

generate_self_signed() {
    # Check if openssl is available
    if ! command -v openssl &> /dev/null; then
        error "openssl is not installed. Please install it and try again."
        exit 1
    fi

    CA_KEY="\${SSL_DIR}/ca.key"
    CA_CERT="\${SSL_DIR}/ca.crt"

    # Step 1: Create local Certificate Authority (CA)
    if [ -f "\${CA_KEY}" ] && [ -f "\${CA_CERT}" ] && [ -z "\${FORCE}" ]; then
        info "Using existing Certificate Authority"
    else
        info "Creating local Certificate Authority..."

        # Remove any stale (possibly root-owned) files so --force can overwrite
        rm -f "\${CA_KEY}" "\${CA_CERT}"

        openssl genrsa -out "\${CA_KEY}" 4096 2>/dev/null
        # Key must be readable by the Apache container's daemon user, and
        # Docker Desktop's file bridge hides 0600 files from bind mounts.
        chmod 644 "\${CA_KEY}"

        openssl req -x509 -new -nodes \\
            -key "\${CA_KEY}" \\
            -sha256 \\
            -days 1825 \\
            -out "\${CA_CERT}" \\
            -subj "/C=US/ST=Local/L=Local/O=${config.projectName} Dev CA/CN=${config.projectName} Local CA"

        if [ \$? -ne 0 ]; then
            error "Failed to create Certificate Authority."
            exit 1
        fi

        success "Certificate Authority created"
    fi

    # Step 2: Generate domain certificate signed by our CA
    DOMAIN_KEY="\${SSL_DIR}/\${DOMAIN}.key"
    DOMAIN_CERT="\${SSL_DIR}/\${DOMAIN}.crt"
    DOMAIN_CSR="\${SSL_DIR}/\${DOMAIN}.csr"
    DOMAIN_EXT="\${SSL_DIR}/\${DOMAIN}.ext"

    if [ -f "\${DOMAIN_KEY}" ] && [ -f "\${DOMAIN_CERT}" ] && [ -z "\${FORCE}" ]; then
        warning "Certificate for \${DOMAIN} already exists. Use --force to regenerate."
        exit 0
    fi

    info "Generating certificate for \${DOMAIN}..."

    # Remove any stale (possibly root-owned) files so --force can overwrite
    rm -f "\${DOMAIN_KEY}" "\${DOMAIN_CERT}" "\${DOMAIN_CSR}" "\${DOMAIN_EXT}"

    openssl genrsa -out "\${DOMAIN_KEY}" 2048 2>/dev/null
    # Key must be readable by the Apache container's daemon user, and
    # Docker Desktop's file bridge hides 0600 files from bind mounts.
    chmod 644 "\${DOMAIN_KEY}"

    openssl req -new \\
        -key "\${DOMAIN_KEY}" \\
        -out "\${DOMAIN_CSR}" \\
        -subj "/C=US/ST=Local/L=Local/O=${config.projectName}/CN=\${DOMAIN}"

    cat > "\${DOMAIN_EXT}" << EXTEOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = \${DOMAIN}
DNS.2 = *.\${DOMAIN}
DNS.3 = localhost
IP.1 = 127.0.0.1
EXTEOF

    openssl x509 -req \\
        -in "\${DOMAIN_CSR}" \\
        -CA "\${CA_CERT}" \\
        -CAkey "\${CA_KEY}" \\
        -CAcreateserial \\
        -out "\${DOMAIN_CERT}" \\
        -days "\${DAYS}" \\
        -sha256 \\
        -extfile "\${DOMAIN_EXT}" 2>/dev/null

    if [ \$? -ne 0 ]; then
        error "Failed to generate domain certificate."
        exit 1
    fi

    rm -f "\${DOMAIN_CSR}" "\${DOMAIN_EXT}" "\${SSL_DIR}/ca.srl"

    success "SSL certificate generated for \${DOMAIN}"
    echo ""
    info "CA Certificate:     \${CA_CERT}"
    info "Domain Certificate: \${DOMAIN_CERT}"
    info "Domain Private Key: \${DOMAIN_KEY}"
    echo ""

    # macOS Keychain trust (optional)
    if [[ "\$(uname)" == "Darwin" ]]; then
        echo ""
        read -p "Add CA to macOS Keychain for browser trust? [y/N] " -n 1 -r
        echo ""
        if [[ \$REPLY =~ ^[Yy]$ ]]; then
            info "Adding CA certificate to macOS Keychain (requires sudo)..."
            sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "\${CA_CERT}"
            if [ \$? -eq 0 ]; then
                success "CA added to Keychain. Browsers will trust \${DOMAIN} certificates."
            else
                warning "Failed to add CA to Keychain. You can do it manually:"
                echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \${CA_CERT}"
            fi
        else
            info "Skipping Keychain trust. To manually trust later:"
            echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \${CA_CERT}"
        fi
    fi

    echo ""
    info "To apply certificates, rebuild and restart the proxy:"
    echo "  ./cli build proxy && ./cli restart proxy"
    echo ""
    warning "These are self-signed certificates for local development only."
}

# ============================================================================
# Auto-renewal service
# ============================================================================

start_auto_renewal() {
    # Check if certbot-renew container is already running
    if dc ps --format '{{.State}}' certbot-renew 2>/dev/null | grep -qi "running"; then
        info "Auto-renewal service is already running"
        return
    fi

    echo ""
    read -r -p "Start auto-renewal service (checks every 12 hours)? [Y/n]: " start_renewal
    if [[ "\${start_renewal}" =~ ^[Nn]$ ]]; then
        info "Skipping auto-renewal. To renew manually: ./cli certs-renew"
        warning "Certificates expire in 90 days."
        return
    fi

    info "Starting certbot auto-renewal service..."
    COMPOSE_PROFILES="\${COMPOSE_PROFILES:+\${COMPOSE_PROFILES},}auto-renew,certbot" dc up -d certbot-renew

    if [ \$? -eq 0 ]; then
        success "Auto-renewal service started"
        info "Checks for renewal every 12 hours"
        info "Proxy auto-reloads within 1 hour of cert change"
    else
        warning "Failed to start auto-renewal service."
        info "To start manually: COMPOSE_PROFILES=auto-renew ./cli up certbot-renew"
    fi
}

# ============================================================================
# Staging/Prod: Let's Encrypt via Certbot
# ============================================================================

generate_letsencrypt() {
    check_docker

    # Verify proxy is running (needed for HTTP-01 challenge)
    if ! dc ps --format '{{.State}}' proxy 2>/dev/null | grep -qi "running"; then
        error "Proxy must be running for Let's Encrypt HTTP-01 challenge."
        info "Start the proxy first: ./cli up proxy"
        exit 1
    fi

    info "Requesting Let's Encrypt certificate for \${DOMAIN}..."

    # Build certbot arguments
    local certbot_args="certonly --webroot -w /var/www/certbot"
    certbot_args="\${certbot_args} --email \${EMAIL} --agree-tos --no-eff-email"
    certbot_args="\${certbot_args} -d \${DOMAIN}"

    # Use LE staging server for testing
    if [ -n "\${LE_STAGING}" ]; then
        certbot_args="\${certbot_args} --staging"
        warning "Using Let's Encrypt STAGING server (certs will NOT be trusted)"
    fi

    # Force renewal
    if [ -n "\${FORCE}" ]; then
        certbot_args="\${certbot_args} --force-renewal"
    fi

    # Run certbot via docker compose (COMPOSE_PROFILES activates the certbot service)
    COMPOSE_PROFILES="\${COMPOSE_PROFILES:+\${COMPOSE_PROFILES},}certbot" dc run --rm certbot \${certbot_args}

    if [ \$? -ne 0 ]; then
        error "Let's Encrypt certificate request failed."
        info "Make sure:"
        echo "  - Port 80 is accessible from the internet"
        echo "  - DNS for \${DOMAIN} points to this server"
        echo "  - Proxy is running: ./cli up proxy"
        exit 1
    fi

    # Copy certs from letsencrypt volume to ssl-certs volume (inside container)
    info "Copying certificates to SSL volume..."
    COMPOSE_PROFILES="\${COMPOSE_PROFILES:+\${COMPOSE_PROFILES},}certbot" dc run --rm --entrypoint sh certbot -c \\
        "cp -L /etc/letsencrypt/live/\${DOMAIN}/fullchain.pem /etc/ssl-output/\${DOMAIN}.crt && \\
         cp -L /etc/letsencrypt/live/\${DOMAIN}/privkey.pem /etc/ssl-output/\${DOMAIN}.key && \\
         cp -L /etc/letsencrypt/live/\${DOMAIN}/chain.pem /etc/ssl-output/ca.crt"

    if [ \$? -ne 0 ]; then
        error "Failed to copy certificates to SSL volume."
        exit 1
    fi
    success "Let's Encrypt certificates installed for \${DOMAIN}"

    # Restart proxy to pick up new certs
    info "Restarting proxy..."
    dc restart proxy
    success "Proxy restarted with new certificates."

    echo ""
    info "Certificates stored in Docker volume: ssl-certs"
    info "Renew with: ./cli certs-renew"
    echo ""

    # Start auto-renewal service
    start_auto_renewal
}

# ============================================================================
# Execute based on environment
# ============================================================================

case "\${ENV}" in
    local)
        info "Environment: local (self-signed certificates)"
        generate_self_signed
        ;;
    staging|prod)
        info "Environment: \${ENV} (Let's Encrypt)"
        generate_letsencrypt
        ;;
    *)
        error "Unknown environment: \${ENV}"
        info "Set APP_ENV in your .env file to: local, staging, or prod"
        exit 1
        ;;
esac
`;

    await this.fileWriter.writeFile(join(commandsDir, 'certs.sh'), content);
  }

  /**
   * Builds the 'certs-renew' command
   */
  private async buildCertsRenewCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    const content = `#!/usr/bin/env bash

# Renew SSL certificates
# For Let's Encrypt (staging/prod) environments

load_env

ENV="\${APP_ENV:-local}"
DOMAIN="\${DOMAIN:-${defaultShellDomain(config)}}"

if [ "\${ENV}" = "local" ]; then
    info "Local environment uses self-signed certificates."
    info "To regenerate, run: ./cli certs --force"
    exit 0
fi

check_docker

info "Renewing Let's Encrypt certificates..."

# Run certbot renew (COMPOSE_PROFILES activates the certbot service)
COMPOSE_PROFILES="\${COMPOSE_PROFILES:+\${COMPOSE_PROFILES},}certbot" dc run --rm certbot renew

if [ \$? -ne 0 ]; then
    error "Certificate renewal failed."
    exit 1
fi

# Copy renewed certs from letsencrypt volume to ssl-certs volume (inside container)
info "Copying renewed certificates to SSL volume..."
COMPOSE_PROFILES="\${COMPOSE_PROFILES:+\${COMPOSE_PROFILES},}certbot" dc run --rm --entrypoint sh certbot -c \\
    "if [ -d /etc/letsencrypt/live/\${DOMAIN} ]; then \\
         cp -L /etc/letsencrypt/live/\${DOMAIN}/fullchain.pem /etc/ssl-output/\${DOMAIN}.crt && \\
         cp -L /etc/letsencrypt/live/\${DOMAIN}/privkey.pem /etc/ssl-output/\${DOMAIN}.key && \\
         cp -L /etc/letsencrypt/live/\${DOMAIN}/chain.pem /etc/ssl-output/ca.crt && \\
         echo 'Certificates copied'; \\
     else \\
         echo 'No renewed certificates found (may not have been due for renewal)'; \\
     fi"

# Restart proxy to pick up new certs
info "Restarting proxy..."
dc restart proxy
success "Certificate renewal complete."

echo ""
info "Tip: For automatic renewal, start the auto-renewal service:"
echo "  COMPOSE_PROFILES=auto-renew ./cli up certbot-renew"
`;

    await this.fileWriter.writeFile(join(commandsDir, 'certs-renew.sh'), content);
  }

  /**
   * Builds the 'install' command (conditional on app plugins)
   */
  private async buildInstallCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    const appServices = config.services.filter((s) => s.category === 'app');

    const installBlocks: string[] = [];
    const caseBlocks: string[] = [];

    for (const service of appServices) {
      installBlocks.push(`    run_install "${service.name}"`);
      caseBlocks.push(`        ${service.name})`);
      caseBlocks.push(`            run_install ${service.name}`);
      caseBlocks.push('            ;;');
    }

    const content = `#!/usr/bin/env bash

# Install dependencies in app containers
# Usage: ./cli install [service]

check_docker

SERVICE="\${1:-}"

run_install() {
    local svc="$1"
    info "Installing dependencies in \${svc}..."
    if dc exec "\${svc}" npm install; then
        success "\${svc} dependencies installed!"
    else
        error "\${svc} dependency install failed"
        return 1
    fi
}

if [ -n "\${SERVICE}" ]; then
    if ! service_exists "\${SERVICE}"; then
        error "Service '\${SERVICE}' not found"
        exit 1
    fi
    run_install "\${SERVICE}"
else
    # Install for all app services
${installBlocks.join('\n')}
fi
`;

    await this.fileWriter.writeFile(join(commandsDir, 'install.sh'), content);
  }

  /**
   * Builds the 'typecheck' command (conditional on app plugins)
   */
  private async buildTypecheckCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    const appServices = config.services.filter((s) => s.category === 'app');

    const typecheckBlocks: string[] = [];
    const caseBlocks: string[] = [];

    for (const service of appServices) {
      typecheckBlocks.push(`    run_typecheck "${service.name}" "npx tsc --noEmit"`);
      caseBlocks.push(`        ${service.name})`);
      caseBlocks.push(`            run_typecheck ${service.name} "npx tsc --noEmit"`);
      caseBlocks.push('            ;;');
    }

    const serviceNames = appServices.map((s) => `'${s.name}'`).join(' or ');

    const content = `#!/usr/bin/env bash

# Run TypeScript type checking across all services
# Usage: ./cli typecheck [service]

check_docker
load_env

SERVICE="\${1:-}"
FAILED=false

run_typecheck() {
    local svc="$1"
    local cmd="$2"
    info "Type-checking \${svc}..."
    if dc exec "\${svc}" sh -c "\${cmd}" 2>&1; then
        success "\${svc} passed"
    else
        error "\${svc} has type errors"
        FAILED=true
    fi
    echo ""
}

if [ -n "\${SERVICE}" ]; then
    case "\${SERVICE}" in
${caseBlocks.join('\n')}
        *)
            error "Unknown service: \${SERVICE}. Use ${serviceNames}."
            exit 1
            ;;
    esac
else
${typecheckBlocks.join('\n')}
fi

if [ "\${FAILED}" = true ]; then
    error "Type checking failed. Fix errors before deploying."
    exit 1
else
    success "All type checks passed!"
fi
`;

    await this.fileWriter.writeFile(join(commandsDir, 'typecheck.sh'), content);
  }

  /**
   * Builds the 'db' command (conditional on database plugins)
   */
  private async buildDbCommand(commandsDir: string, config: ProjectConfig): Promise<void> {
    // Find the first app service (used for running ORM commands)
    const firstAppService = config.services.find((s) => s.category === 'app');
    const appServiceName = firstAppService?.name || 'api';

    const content = `#!/usr/bin/env bash

# Database management commands
# Usage: ./cli db <subcommand>
#
# Subcommands:
#   push      Push schema to database
#   migrate   Run database migrations
#   generate  Generate migration files
#   sync      Sync database schema

check_docker
load_env

ENV="\${APP_ENV:-local}"
SUB="\${1:-}"
shift || true

if [ -z "\${SUB}" ]; then
    echo "Database Management"
    echo ""
    echo "Usage:"
    echo "  ./cli db <subcommand>"
    echo ""
    echo "Subcommands:"
    echo "  push      Push schema to database"
    echo "  migrate   Run database migrations"
    echo "  generate  Generate migration files"
    echo "  sync      Sync database schema"
    exit 0
fi

run_db_cmd() {
    local cmd="$1"

    if [ "\${ENV}" = "local" ]; then
        # Local: exec into running app container
        dc exec ${appServiceName} \$cmd
    else
        # Non-local: use tools profile for one-off migration container
        COMPOSE_PROFILES="\${COMPOSE_PROFILES:+\${COMPOSE_PROFILES},}tools" dc run --build --rm ${appServiceName} \$cmd
    fi
}

case "\${SUB}" in
    push)
        info "Pushing schema to database..."
        run_db_cmd "npm run db:push"
        success "Schema pushed!"
        ;;
    migrate)
        info "Running database migrations..."
        run_db_cmd "npm run db:migrate"
        success "Migrations complete!"
        ;;
    generate)
        info "Generating migration files..."
        run_db_cmd "npm run db:generate"
        success "Migration files generated!"
        ;;
    sync)
        info "Syncing database schema..."
        run_db_cmd "npm run db:push"
        success "Database synced!"
        ;;
    *)
        error "Unknown subcommand: \${SUB}"
        echo "Use: push, migrate, generate, or sync"
        exit 1
        ;;
esac
`;

    await this.fileWriter.writeFile(join(commandsDir, 'db.sh'), content);
  }

  /**
   * Builds plugin-specific CLI commands
   */
  private async buildPluginCommands(
    commandsDir: string,
    config: ProjectConfig,
    plugins: IServicePlugin[]
  ): Promise<void> {
    for (const plugin of plugins) {
      const commands = plugin.getCLICommands(config);

      for (const command of commands) {
        const fileName = `${command.name}.sh`;
        const filePath = join(commandsDir, fileName);
        await this.fileWriter.writeFile(filePath, command.script);
      }
    }
  }
}
