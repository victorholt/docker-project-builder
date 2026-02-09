import { z } from 'zod';
import type { ServiceCategory, Environment } from '../interfaces/service-plugin.js';

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
 * Zod schema for project configuration
 * This is the main configuration object that flows through the entire system
 */
export const ProjectConfigSchema = z.object({
  projectName: z
    .string()
    .min(1, 'Project name is required')
    .regex(/^[a-z0-9-]+$/, 'Project name must be lowercase alphanumeric with hyphens'),

  containerPrefix: z
    .string()
    .min(1, 'Container prefix is required')
    .regex(/^[a-z0-9-]+$/, 'Container prefix must be lowercase alphanumeric with hyphens'),

  domain: z
    .string()
    .min(1, 'Domain is required')
    .regex(/^[a-z0-9.-]+$/, 'Domain must be a valid domain name'),

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
 * @returns { success: true, data: ProjectConfig } or { success: false, error: ZodError }
 */
export function safeValidateProjectConfig(config: unknown) {
  return ProjectConfigSchema.safeParse(config);
}
