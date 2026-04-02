import { Check } from 'lucide-react'

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3
}

const STEPS = ['Project Info', 'Services', 'Review']

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isCompleted
                    ? 'bg-dpb-accent border-dpb-border-focus text-white'
                    : isCurrent
                    ? 'border-dpb-border-focus text-dpb-accent-light bg-dpb-raised'
                    : 'border-dpb-border text-muted-foreground bg-dpb-surface'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                  isCurrent ? 'text-dpb-accent-light' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 mb-3 transition-colors ${
                  step < currentStep ? 'bg-dpb-accent' : 'bg-dpb-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
