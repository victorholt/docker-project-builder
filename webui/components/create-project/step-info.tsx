'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WizardState } from './types'

interface StepInfoProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
}

const ENVS = ['local', 'staging', 'prod'] as const

export function StepInfo({ state, onChange, onNext }: StepInfoProps) {
  const proxyPortValid = state.proxyPort >= 1 && state.proxyPort <= 65535
  const canAdvance = state.projectName.length > 0 && proxyPortValid

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
          onChange={(e) =>
            onChange({ projectName: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
          }
          className="bg-[#252432] border-[#3a3948] focus-visible:ring-[#6264a7]"
        />
        <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
      </div>

      {/* Domain */}
      <div className="space-y-2">
        <Label htmlFor="domain">Domain <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          id="domain"
          placeholder="example.local"
          value={state.domain}
          onChange={(e) => onChange({ domain: e.target.value.toLowerCase() })}
          className="bg-[#252432] border-[#3a3948] focus-visible:ring-[#6264a7]"
        />
        <p className="text-xs text-muted-foreground">
          Defaults to {state.projectName || 'project-name'}.local
        </p>
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
          className={`w-32 bg-[#252432] border-[#3a3948] focus-visible:ring-[#6264a7] ${
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
                onClick={() => {
                  if (isLocked) return
                  onChange({
                    environments: isSelected
                      ? state.environments.filter((e) => e !== env)
                      : [...state.environments, env],
                  })
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize ${
                  isSelected
                    ? 'bg-[#32313f] border-[#6264a7] text-[#9ea4f0]'
                    : 'bg-[#252432] border-[#3a3948] text-muted-foreground hover:text-foreground'
                } ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {env}
              </button>
            )
          })}
        </div>
      </div>

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!canAdvance}
          className="px-6 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ background: canAdvance ? 'linear-gradient(135deg, #6264a7, #7b83eb)' : undefined }}
        >
          Next: Services →
        </button>
      </div>
    </div>
  )
}
