import { z } from 'zod';
import type { Environment } from '../interfaces/service-plugin.js';

/**
 * Zod schema for service configuration
 */
export const ServiceConfigSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  version: z.string().min(1, 'Service version is required'),
  category: z.enum(['app', 'database', 'cache', 'mail', 'proxy'] as const),
  config: z.record(z.unknown()).optional(),  // Plugin-specific config
});

/**
 * Zod schema for proxy configuration
 */
export const ProxyConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(8080),
  sslPort: z.number().int().min(1).max(65535).default(8443),
  vhostMode: z.enum(['path', 'subdomain']).default('path'),
});

/**
 * Shared regex for a single domain value.
 */
const DOMAIN_REGEX = /^[a-z0-9.-]+$/;

/**
 * Zod schema for per-environment domain map.
 *
 * Each entry is optional on the schema itself; presence is enforced by a
 * superRefine on ProjectConfigSchema that requires a domain for every
 * environment listed in `environments`.
 */
export const DomainsConfigSchema = z.object({
  local: z
    .string()
    .regex(DOMAIN_REGEX, 'Domain must be a valid domain name')
    .optional(),
  staging: z
    .string()
    .regex(DOMAIN_REGEX, 'Domain must be a valid domain name')
    .optional(),
  prod: z
    .string()
    .regex(DOMAIN_REGEX, 'Domain must be a valid domain name')
    .optional(),
});

/**
 * Zod schema for project configuration
 * This is the main configuration object that flows through the entire system
 */
export const ProjectConfigSchema = z
  .object({
    projectName: z
      .string()
      .min(1, 'Project name is required')
      .regex(/^[a-z0-9-]+$/, 'Project name must be lowercase alphanumeric with hyphens'),

    containerPrefix: z
      .string()
      .min(1, 'Container prefix is required')
      .regex(/^[a-z0-9-]+$/, 'Container prefix must be lowercase alphanumeric with hyphens'),

    // One domain per selected environment. The user is only prompted for the
    // domains matching `environments`, and the superRefine below enforces
    // that every selected environment has a non-empty domain.
    domains: DomainsConfigSchema,

    services: z
      .array(ServiceConfigSchema)
      .min(1, 'At least one service must be selected'),

    environments: z
      .array(z.enum(['local', 'staging', 'prod'] as const))
      .min(1, 'At least one environment must be selected')
      .default(['local']),

    proxy: ProxyConfigSchema,

    // Optional port overrides for services (maps service name to external port)
    ports: z.record(z.number().int().min(1).max(65535)).default({}),

    outputPath: z
      .string()
      .min(1, 'Output path is required'),
  })
  .superRefine((cfg, ctx) => {
    for (const env of cfg.environments) {
      const value = cfg.domains?.[env];
      if (!value || value.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['domains', env],
          message: `Domain for '${env}' is required because '${env}' is a selected environment`,
        });
      }
    }
  });

/**
 * TypeScript type inferred from Zod schema
 */
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * TypeScript type for service configuration
 */
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

/**
 * TypeScript type for proxy configuration
 */
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;

/**
 * TypeScript type for the per-environment domain map
 */
export type DomainsConfig = z.infer<typeof DomainsConfigSchema>;

/**
 * Helper function to validate project configuration
 * @param config - Raw configuration object
 * @returns Validated and typed configuration
 * @throws ZodError if validation fails
 */
export function validateProjectConfig(config: unknown): ProjectConfig {
  return ProjectConfigSchema.parse(config);
}

/**
 * Helper function to safely validate project configuration
 * @param config - Raw configuration object
 * @returns An object of shape { success: true, data: ProjectConfig } or { success: false, error: ZodError }
 */
export function safeValidateProjectConfig(config: unknown) {
  return ProjectConfigSchema.safeParse(config);
}

/**
 * Returns a "primary" domain for the project — the first domain defined in
 * precedence order local → staging → prod. This is a convenience helper for
 * call sites that previously used the single `config.domain` field but still
 * just need "a" domain for display purposes (e.g. readme links).
 *
 * Returns undefined only if no domains are configured at all, which a validated
 * ProjectConfig will never be in, since `environments` must contain at least
 * one entry and each selected environment requires a domain.
 */
export function getPrimaryDomain(
  config: Pick<ProjectConfig, 'domains'>
): string | undefined {
  return config.domains.local ?? config.domains.staging ?? config.domains.prod;
}

/**
 * Returns the domain that should be used for a specific environment, with a
 * graceful fallback to the primary domain when the requested env is not
 * configured (e.g. env-specific call sites that still run even when that env
 * isn't in `environments`). Generators should prefer passing the env explicitly.
 */
export function getDomainFor(
  config: Pick<ProjectConfig, 'domains'>,
  env: Environment
): string {
  return config.domains[env] ?? getPrimaryDomain(config) ?? '';
}
