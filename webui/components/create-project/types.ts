export type WizardLayout = 'steps' | 'two-panel'
export type WizardStep = 1 | 2 | 3

export type Environment = 'local' | 'staging' | 'prod'

export interface ServiceInfo {
  name: string
  category: string
  description: string
}

export interface ServicesByCategory {
  [category: string]: ServiceInfo[]
}

/**
 * Per-environment domain map. Mirrors `DomainsConfig` in
 * src/core/models/project-config.ts. Each field is optional at the type
 * level; a domain is required for every env present in `environments`
 * (enforced by the UI and the core Zod superRefine on submit).
 */
export interface DomainsConfig {
  local?: string
  staging?: string
  prod?: string
}

export interface WizardState {
  projectName: string
  /** One domain per selected env (local / staging / prod). */
  domains: DomainsConfig
  /**
   * Which domain fields the user has manually edited. Used to decide
   * whether to auto-reseed defaults when the project name changes.
   */
  domainsEdited: { local?: boolean; staging?: boolean; prod?: boolean }
  proxyPort: number
  environments: Environment[]
  selectedServices: string[]
  servicePorts: Record<string, number>
  useDefaultPorts: boolean
}

/**
 * Compute the smart default domain for an env given a project name.
 * Matches the CLI prompt defaults in src/cli/prompts.ts.
 */
export function defaultDomainFor(env: Environment, projectName: string): string {
  const name = projectName || 'project-name'
  switch (env) {
    case 'local':
      return `${name}.test`
    case 'staging':
      return `staging-${name}.com`
    case 'prod':
      return `${name}.com`
  }
}
