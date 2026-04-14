/**
 * Service categories for organizing plugins
 */
export type ServiceCategory = 'app' | 'database' | 'cache' | 'mail' | 'proxy';

/**
 * Environment types for environment-specific configuration
 */
export type Environment = 'local' | 'staging' | 'prod';

/**
 * Inquirer prompt question for collecting user input
 */
export interface PromptQuestion {
  type: 'input' | 'list' | 'checkbox' | 'confirm';
  name: string;
  message: string;
  choices?: string[] | { name: string; value: string }[];
  default?: string | boolean;
  when?: (answers: Record<string, unknown>) => boolean;
}

/**
 * Docker compose service block configuration
 */
export interface ComposeServiceBlock {
  serviceName: string;
  image?: string;
  build?: {
    context: string;
    dockerfile: string;
    target?: string;
    args?: Record<string, string>;
  };
  container_name?: string;
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string>;
  env_file?: string[];
  networks?: string[];
  depends_on?: string[] | Record<string, { condition: string }>;
  restart?: string;
  healthcheck?: HealthCheckConfig;
  profiles?: string[];
  command?: string;
  entrypoint?: string;
  extra_hosts?: string[];
}

/**
 * Health check configuration for Docker services
 */
export interface HealthCheckConfig {
  test: string | string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
}

/**
 * Environment variable block for .env files
 */
export interface EnvVarBlock {
  [key: string]: string | number | boolean;
}

/**
 * Volume definition for Docker compose
 */
export interface VolumeDefinition {
  name: string;
  driver?: string;
  driver_opts?: Record<string, string>;
}

/**
 * Network definition for Docker compose
 */
export interface NetworkDefinition {
  name: string;
  driver?: string;
  external?: boolean;
}

/**
 * Proxy route configuration for reverse proxy
 */
export interface ProxyRoute {
  serviceName: string;
  path?: string;        // For path-based routing (e.g., /api)
  subdomain?: string;   // For subdomain routing (e.g., api.myapp.test)
  port: number;         // Internal service port
  ssl?: boolean;
}

/**
 * Custom CLI command for the generated bash CLI
 */
export interface CLICommand {
  name: string;
  description: string;
  script: string;  // Bash script content
}

/**
 * Main service plugin interface
 * Every service (NextJS, Postgres, Redis, etc.) implements this interface
 */
export interface IServicePlugin {
  // ===== Metadata =====
  name: string;                    // e.g., "nextjs", "postgres"
  displayName: string;             // e.g., "Next.js", "PostgreSQL"
  category: ServiceCategory;
  defaultVersion: string;          // e.g., "20-alpine", "16-alpine"
  availableVersions: string[];

  // ===== Prompt Contributions =====
  /**
   * Returns prompts to ask the user for this service
   * Called during the interactive CLI flow
   */
  getPrompts(): PromptQuestion[];

  // ===== Generation Contributions =====
  /**
   * Returns the base docker-compose service block
   */
  getComposeService(config: ProjectConfig): ComposeServiceBlock;

  /**
   * Returns the docker-compose.override.yml service block (dev-specific)
   * Return null if no override needed
   */
  getComposeOverride(config: ProjectConfig): ComposeServiceBlock | null;

  /**
   * Returns the docker-compose.prod.yml service block (production-specific)
   * Return null if no prod config needed
   */
  getComposeProd(config: ProjectConfig): ComposeServiceBlock | null;

  /**
   * Returns the Dockerfile content for this service
   * Return null if using a stock image (no custom Dockerfile needed)
   */
  getDockerfile(config: ProjectConfig): string | null;

  /**
   * Returns the entrypoint script content for this service
   * Return null if no custom entrypoint needed
   */
  getEntrypoint(config: ProjectConfig): string | null;

  /**
   * Returns environment variables for the specified environment
   */
  getEnvVars(config: ProjectConfig, env: Environment): EnvVarBlock;

  /**
   * Returns volume definitions this service needs
   */
  getVolumes(config: ProjectConfig): VolumeDefinition[];

  /**
   * Returns network definitions this service needs
   */
  getNetworks(config: ProjectConfig): NetworkDefinition[];

  /**
   * Returns health check configuration
   */
  getHealthCheck(config: ProjectConfig): HealthCheckConfig | null;

  /**
   * Returns proxy routes for this service (if it's web-accessible)
   */
  getProxyRoutes(config: ProjectConfig): ProxyRoute[];

  /**
   * Returns custom CLI commands for this service
   */
  getCLICommands(config: ProjectConfig): CLICommand[];
}

/**
 * Import ProjectConfig from models (forward declaration)
 * Actual import will be in the model file
 */
export interface ProjectConfig {
  projectName: string;
  containerPrefix: string;
  /**
   * Per-environment domain map. The user is prompted for one domain per
   * selected environment; each key here is present iff the corresponding env
   * is listed in `environments`.
   */
  domains: {
    local?: string;
    staging?: string;
    prod?: string;
  };
  services: ServiceConfig[];
  environments: Environment[];
  proxy: ProxyConfig;
  outputPath: string;
}

/**
 * Service configuration (selected by user)
 */
export interface ServiceConfig {
  name: string;
  version: string;
  category: ServiceCategory;
  config?: Record<string, unknown>;  // Plugin-specific config
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  port: number;
  sslPort: number;
  vhostMode: 'path' | 'subdomain';
}
