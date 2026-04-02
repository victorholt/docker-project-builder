'use client'

import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { WizardState, ServicesByCategory } from './types'
import { getCategoryLabel, DEFAULT_PORTS } from './constants'

interface StepServicesProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export function StepServices({ state, onChange }: StepServicesProps) {
  const [servicesByCategory, setServicesByCategory] = useState<ServicesByCategory>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchServices = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/services')
      const data = await res.json()
      setServicesByCategory(data.services ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchServices() }, [])

  const toggleService = (name: string, enabled: boolean) => {
    const selected = enabled
      ? [...state.selectedServices, name]
      : state.selectedServices.filter((s) => s !== name)

    const ports = { ...state.servicePorts }
    if (enabled && DEFAULT_PORTS[name]) {
      ports[name] = DEFAULT_PORTS[name]
    }
    if (!enabled) {
      delete ports[name]
    }
    onChange({ selectedServices: selected, servicePorts: ports })
  }

  const handlePortChange = (name: string, val: string) => {
    const n = parseInt(val)
    if (!isNaN(n) && n >= 1 && n <= 65535) {
      onChange({ servicePorts: { ...state.servicePorts, [name]: n } })
    }
  }

  const handleUseDefaultPortsToggle = (checked: boolean) => {
    if (checked) {
      const ports: Record<string, number> = {}
      state.selectedServices.forEach((s) => {
        if (DEFAULT_PORTS[s]) ports[s] = DEFAULT_PORTS[s]
      })
      onChange({ useDefaultPorts: true, servicePorts: ports })
    } else {
      onChange({ useDefaultPorts: false })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-16 bg-dpb-border rounded animate-pulse" />
            {[...Array(2)].map((_, j) => (
              <div key={j} className="h-12 bg-dpb-surface rounded-md border border-dpb-border animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-dpb-surface p-4 text-sm text-destructive">
        {error}
        <button
          onClick={fetchServices}
          className="ml-3 underline text-muted-foreground hover:text-foreground"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      {/* Left — service list */}
      <div className="flex-1 space-y-5 overflow-y-auto">
        {Object.entries(servicesByCategory).map(([category, services]) => (
          <div key={category}>
            <h4 className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2 uppercase">
              {getCategoryLabel(category)}
            </h4>
            <div className="space-y-1.5">
              {services.map((service) => {
                const isSelected = state.selectedServices.includes(service.name)
                return (
                  <div
                    key={service.name}
                    onClick={() => toggleService(service.name, !isSelected)}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-dpb-raised border-dpb-border-focus'
                        : 'bg-dpb-surface border-dpb-border hover:border-dpb-dot-inactive'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-dpb-dot-active' : 'bg-dpb-dot-inactive'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {service.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{service.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Right — summary panel */}
      <div className="w-44 flex-shrink-0 bg-dpb-surface border border-dpb-border rounded-lg p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-dpb-accent-light tracking-wide">YOUR STACK</span>
          {state.selectedServices.length > 0 && (
            <span className="text-[10px] bg-dpb-raised border border-dpb-border-focus text-dpb-accent-muted rounded-full px-2 py-0.5 font-semibold">
              {state.selectedServices.length}
            </span>
          )}
        </div>

        {state.selectedServices.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No services selected yet</p>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto">
            {state.selectedServices.map((name) => (
              <div key={name} className="space-y-1">
                <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={state.servicePorts[name] ?? DEFAULT_PORTS[name] ?? ''}
                  onChange={(e) => handlePortChange(name, e.target.value)}
                  disabled={state.useDefaultPorts}
                  className="h-7 text-xs bg-dpb-bg border-dpb-border focus-visible:ring-dpb-accent disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        )}

        {/* Use default ports toggle */}
        <div className="mt-3 pt-3 border-t border-dpb-border flex items-center gap-2">
          <Checkbox
            id="use-default-ports"
            checked={state.useDefaultPorts}
            onCheckedChange={(v) => handleUseDefaultPortsToggle(v as boolean)}
          />
          <label htmlFor="use-default-ports" className="text-[10px] text-muted-foreground cursor-pointer">
            Use default ports
          </label>
        </div>
      </div>
    </div>
  )
}
