'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WizardState, Environment, defaultDomainFor } from './types'
import { GRADIENT } from '@/lib/theme'

interface StepInfoProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
}

const ENVS: readonly Environment[] = ['local', 'staging', 'prod'] as const

/** Same regex the core Zod schema uses (DOMAIN_REGEX). */
const DOMAIN_REGEX = /^[a-z0-9.-]+$/

function validateDomain(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return 'Domain is required'
  if (!DOMAIN_REGEX.test(value)) return 'Only lowercase letters, numbers, dots, and hyphens'
  return null
}

export function StepInfo({ state, onChange, onNext }: StepInfoProps) {
  const proxyPortValid = state.proxyPort >= 1 && state.proxyPort <= 65535

  // Build the per-env domain error map for the currently selected envs.
  const domainErrors = state.environments.reduce<Record<string, string | null>>((acc, env) => {
    acc[env] = validateDomain(state.domains[env])
    return acc
  }, {})
  const allDomainsValid = state.environments.every((env) => domainErrors[env] === null)

  const canAdvance =
    state.projectName.length > 0 &&
    proxyPortValid &&
    state.environments.length > 0 &&
    allDomainsValid

  // ── Handlers ─────────────────────────────────────────────────────
  const handleProjectNameChange = (raw: string) => {
    const nextName = raw.toLowerCase().replace(/[^a-z0-9-]/g, '')
    // Re-seed defaults for any env whose field the user has NOT manually
    // edited. Matches the smart-default behavior in the CLI prompts.
    const nextDomains = { ...state.domains }
    for (const env of ENVS) {
      if (!state.domainsEdited[env]) {
        nextDomains[env] = defaultDomainFor(env, nextName)
      }
    }
    onChange({ projectName: nextName, domains: nextDomains })
  }

  const handleDomainChange = (env: Environment, raw: string) => {
    const value = raw.toLowerCase()
    onChange({
      domains: { ...state.domains, [env]: value },
      domainsEdited: { ...state.domainsEdited, [env]: true },
    })
  }

  const toggleEnv = (env: Environment) => {
    const isSelected = state.environments.includes(env)
    if (env === 'local') return // local is locked on
    if (isSelected) {
      // Keep the domain value in state so we can restore on re-toggle.
      onChange({ environments: state.environments.filter((e) => e !== env) })
    } else {
      // Seed with a default if this env has never been filled in.
      const seeded =
        state.domains[env] && state.domains[env]!.length > 0
          ? state.domains[env]!
          : defaultDomainFor(env, state.projectName)
      onChange({
        environments: [...state.environments, env],
        domains: { ...state.domains, [env]: seeded },
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="projectName">
          Project Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="projectName"
          placeholder="my-awesome-app"
          value={state.projectName}
          onChange={(e) => handleProjectNameChange(e.target.value)}
          className="bg-dpb-surface border-dpb-border focus-visible:ring-dpb-accent"
        />
        <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
      </div>

      {/* Proxy Port */}
      <div className="space-y-2">
        <Label htmlFor="proxyPort">Proxy Port</Label>
        <Input
          id="proxyPort"
          type="number"
          min={1}
          max={65535}
          value={state.proxyPort}
          onChange={(e) => onChange({ proxyPort: parseInt(e.target.value) || 0 })}
          className={`w-32 bg-dpb-surface border-dpb-border focus-visible:ring-dpb-accent ${
            !proxyPortValid ? 'border-destructive' : ''
          }`}
        />
        {!proxyPortValid && (
          <p className="text-xs text-destructive">Port must be between 1 and 65535</p>
        )}
        <p className="text-xs text-muted-foreground">Apache proxy listens on this port</p>
      </div>

      {/* Environments */}
      <div className="space-y-3">
        <Label>Environments <span className="text-destructive">*</span></Label>
        <div className="flex gap-2">
          {ENVS.map((env) => {
            const isSelected = state.environments.includes(env)
            const isLocked = env === 'local'
            return (
              <button
                key={env}
                type="button"
                disabled={isLocked}
                onClick={() => toggleEnv(env)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize ${
                  isSelected
                    ? 'bg-dpb-raised border-dpb-border-focus text-dpb-accent-muted'
                    : 'bg-dpb-surface border-dpb-border text-muted-foreground hover:text-foreground'
                } ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {env}
              </button>
            )
          })}
        </div>
      </div>

      {/* Per-env Domains — one input per selected environment */}
      <div className="space-y-3">
        <Label>
          Domains <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground -mt-1">
          One domain per selected environment
        </p>
        {ENVS.filter((env) => state.environments.includes(env)).map((env) => {
          const error = domainErrors[env]
          const value = state.domains[env] ?? ''
          return (
            <div key={env} className="space-y-1.5">
              <Label htmlFor={`domain-${env}`} className="text-xs uppercase tracking-wide text-muted-foreground capitalize">
                {env}
              </Label>
              <Input
                id={`domain-${env}`}
                placeholder={defaultDomainFor(env, state.projectName)}
                value={value}
                onChange={(e) => handleDomainChange(env, e.target.value)}
                className={`bg-dpb-surface border-dpb-border focus-visible:ring-dpb-accent ${
                  error ? 'border-destructive' : ''
                }`}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )
        })}
      </div>

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!canAdvance}
          className="px-6 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: canAdvance ? GRADIENT : undefined }}
        >
          Next: Services →
        </button>
      </div>
    </div>
  )
}
