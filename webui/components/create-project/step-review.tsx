import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { WizardState } from './types'
import { DEFAULT_PORTS } from './constants'

interface StepReviewProps {
  state: WizardState
  onBack: () => void
  onGenerate: () => Promise<void>
}

export function StepReview({ state, onBack, onGenerate }: StepReviewProps) {
  const [generating, setGenerating] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await onGenerate()
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-md bg-green-950 border border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-300">Project Downloaded!</p>
            <p className="text-xs text-green-400 mt-0.5">
              Extract the zip and run <code className="bg-black/30 px-1 rounded">./myapp up</code> to get started.
            </p>
          </div>
        </div>
        <button
          onClick={() => setSuccess(false)}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Create another project
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-[#1d1428] border border-[#2e2040] rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Project</p>
            <p className="font-semibold text-foreground">{state.projectName}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Domain</p>
            <p className="font-semibold text-foreground">{state.domain || `${state.projectName}.local`}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Proxy Port</p>
            <p className="font-semibold text-foreground">{state.proxyPort}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Environments</p>
            <div className="flex flex-wrap gap-1">
              {state.environments.map((env) => (
                <span
                  key={env}
                  className="text-[10px] bg-[#2a1a3e] border border-purple-500 text-purple-300 rounded-full px-2 py-0.5 capitalize"
                >
                  {env}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Services</p>
          <div className="space-y-1">
            {state.selectedServices.map((name) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{name}</span>
                <span className="text-muted-foreground text-xs">
                  :{state.servicePorts[name] ?? DEFAULT_PORTS[name] ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive bg-[#1d1428] border border-destructive rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate & Download'
          )}
        </button>
      </div>
    </div>
  )
}
