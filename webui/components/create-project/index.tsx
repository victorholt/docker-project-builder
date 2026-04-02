'use client'

import { useState } from 'react'
import { View } from '../app-shell'
import { GRADIENT } from '@/lib/theme'
import { WizardState, WizardLayout, WizardStep } from './types'
import { StepIndicator } from './step-indicator'
import { StepInfo } from './step-info'
import { StepServices } from './step-services'
import { StepReview } from './step-review'

interface CreateProjectProps {
  onNavigate: (view: View) => void
  layout?: WizardLayout
}

const INITIAL_STATE: WizardState = {
  projectName: '',
  domain: '',
  proxyPort: 8080,
  environments: ['local'],
  selectedServices: [],
  servicePorts: {},
  useDefaultPorts: true,
}

export function CreateProject({ onNavigate, layout = 'steps' }: CreateProjectProps) {
  const [state, setState] = useState<WizardState>(INITIAL_STATE)
  const [step, setStep] = useState<WizardStep>(1)
  // Used by two-panel layout — must be declared unconditionally (React rules of hooks)
  const [generating, setGenerating] = useState(false)
  const [genSuccess, setGenSuccess] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const patch = (partial: Partial<WizardState>) => setState((s) => ({ ...s, ...partial }))

  const generate = async () => {
    const res = await fetch('/api/generate-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: state.projectName,
        domain: state.domain || `${state.projectName}.local`,
        services: state.selectedServices,
        environments: state.environments,
        ports: { ...state.servicePorts, proxy: state.proxyPort },
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to generate project')
    }

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${state.projectName}.zip`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  // ── Two-panel layout ──────────────────────────────────────────────
  if (layout === 'two-panel') {
    const handleGenerate = async () => {
      setGenerating(true)
      setGenError(null)
      try {
        await generate()
        setGenSuccess(true)
      } catch (e) {
        setGenError(e instanceof Error ? e.message : 'Generation failed')
      } finally {
        setGenerating(false)
      }
    }

    return (
      <div>
        <h1 className="text-2xl font-bold mb-1 text-foreground">Create Project</h1>
        <p className="text-sm text-muted-foreground mb-6">Configure your Docker stack</p>
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <StepInfo state={state} onChange={patch} onNext={() => {}} />
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <StepServices state={state} onChange={patch} />
            <div className="mt-auto">
              {genError && (
                <p className="text-sm text-destructive mb-2">{genError}</p>
              )}
              {genSuccess ? (
                <div className="text-sm text-green-400">
                  Downloaded! Run <code className="bg-black/30 px-1 rounded">./myapp up</code> to start.{' '}
                  <button onClick={() => { setState(INITIAL_STATE); setGenSuccess(false) }} className="underline">
                    Create another
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={generating || !state.projectName || state.selectedServices.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: GRADIENT }}
                >
                  {generating ? 'Generating...' : 'Generate & Download'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Steps layout (default) ────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 text-foreground">Create Project</h1>
      <p className="text-sm text-muted-foreground mb-6">Configure your Docker stack</p>
      <StepIndicator currentStep={step} />

      {step === 1 && (
        <StepInfo state={state} onChange={patch} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <>
          <StepServices state={state} onChange={patch} />
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={state.selectedServices.length === 0}
              className="px-6 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: GRADIENT }}
            >
              Next: Review →
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <StepReview state={state} onBack={() => setStep(2)} onGenerate={generate} />
      )}
    </div>
  )
}
