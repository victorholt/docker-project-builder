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
                    ? 'bg-[#6264a7] border-[#6264a7] text-white'
                    : isCurrent
                    ? 'border-[#6264a7] text-[#7b83eb] bg-[#32313f]'
                    : 'border-[#3a3948] text-muted-foreground bg-[#252432]'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                  isCurrent ? 'text-[#7b83eb]' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 mb-3 transition-colors ${
                  step < currentStep ? 'bg-[#6264a7]' : 'bg-[#3a3948]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
