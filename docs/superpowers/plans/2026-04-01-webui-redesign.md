# Web UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default shadcn/ui tab layout with a professional dark purple/indigo design — collapsible sidebar, 3-step creation wizard, improved Docker viewer, and cleaner test runner.

**Architecture:** Full component rewrite. All existing API call logic and state management is preserved; only the UI layer changes. New components live alongside old ones until Task 9 deletes the originals. The AppShell manages view state (replacing Tabs), passes an `onNavigate` callback to child views.

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS, TypeScript, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-01-webui-redesign-design.md`

---

## Chunk 1: Foundation & AppShell

### Task 1: Install missing shadcn components + update theme

**Files:**
- Modify: `webui/app/globals.css`
- Modify: `webui/app/layout.tsx`

- [ ] **Step 1: Install shadcn Select and Tooltip components**

```bash
cd webui
npx shadcn@latest add select
npx shadcn@latest add tooltip
```

Expected: two new files created — `components/ui/select.tsx` and `components/ui/tooltip.tsx`. No errors.

> **Note:** `checkbox`, `use-toast`, `toast`, and `toaster` are already installed in `webui/components/ui/`. No action needed for those.

- [ ] **Step 2: Replace globals.css with the new dark purple palette**

Replace the full contents of `webui/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 258 39% 6%;
    --foreground: 210 40% 96%;
    --card: 258 33% 9%;
    --card-foreground: 210 40% 96%;
    --popover: 258 33% 9%;
    --popover-foreground: 210 40% 96%;
    --primary: 270 90% 65%;
    --primary-foreground: 258 39% 6%;
    --secondary: 239 84% 67%;
    --secondary-foreground: 210 40% 96%;
    --muted: 270 30% 12%;
    --muted-foreground: 220 9% 46%;
    --accent: 270 39% 17%;
    --accent-foreground: 210 40% 96%;
    --destructive: 0 62% 42%;
    --destructive-foreground: 210 40% 98%;
    --border: 265 33% 19%;
    --input: 265 33% 19%;
    --ring: 270 90% 65%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 3: Add `dark` class to `<html>` in layout.tsx**

Replace the `<html lang="en">` line in `webui/app/layout.tsx`:

```tsx
<html lang="en" className="dark">
```

- [ ] **Step 4: Run build to verify no TypeScript errors**

```bash
cd webui && npm run build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add webui/app/globals.css webui/app/layout.tsx webui/components/ui/select.tsx webui/components/ui/tooltip.tsx
git commit -m "feat: add dark purple theme + install select/tooltip shadcn components"
```

---

### Task 2: Create AppShell + update page.tsx

**Files:**
- Create: `webui/components/app-shell.tsx`
- Modify: `webui/app/page.tsx`

- [ ] **Step 1: Create `webui/components/app-shell.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Wand2, Layers, FlaskConical, ChevronRight, ChevronLeft } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Lazy imports — these will be created in subsequent tasks.
// Use placeholder divs until the real components exist.
import { CreateProject } from './create-project'
import { DockerViewer } from './docker-viewer'
import { TestRunner } from './test-runner'

export type View = 'create' | 'viewer' | 'test'

const NAV_ITEMS: { view: View; icon: React.ElementType; label: string }[] = [
  { view: 'create', icon: Wand2, label: 'Create Project' },
  { view: 'viewer', icon: Layers, label: 'Docker Viewer' },
  { view: 'test', icon: FlaskConical, label: 'Test Runner' },
]

export function AppShell() {
  const [activeView, setActiveView] = useState<View>('create')
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dpb:sidebar:collapsed') === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('dpb:sidebar:collapsed', String(collapsed))
  }, [collapsed])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`relative flex flex-col bg-[#0d0b14] border-r border-[#2e2040] transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-[52px]' : 'w-[200px]'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-3 mb-2 ${collapsed ? 'justify-center' : ''}`}>
          <div
            className="w-8 h-8 rounded-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
          />
          {!collapsed && (
            <div>
              <div className="text-xs font-bold text-foreground">DPBuilder</div>
              <div className="text-[10px] text-muted-foreground">Docker Projects</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <TooltipProvider>
          <nav className="flex flex-col gap-1 px-2 flex-1">
            {NAV_ITEMS.map(({ view, icon: Icon, label }) => (
              <Tooltip key={view} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveView(view)}
                    className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors w-full text-left ${
                      activeView === view
                        ? 'bg-[#2a1a3e] border border-purple-500 text-purple-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[#1d1428]'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="text-sm font-medium">{label}</span>}
                  </button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>{label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#2a1a3e] border border-purple-500 flex items-center justify-center hover:bg-[#3d2a5a] transition-colors z-10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-purple-400" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-purple-400" />
          )}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-6">
          {activeView === 'create' && <CreateProject onNavigate={setActiveView} />}
          {activeView === 'viewer' && <DockerViewer onNavigate={setActiveView} />}
          {activeView === 'test' && <TestRunner onNavigate={setActiveView} />}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Replace `webui/app/page.tsx`**

```tsx
import { AppShell } from '@/components/app-shell'

export default function Home() {
  return <AppShell />
}
```

Remove the `'use client'` directive — AppShell handles client state internally.

- [ ] **Step 3: Create placeholder stubs so the build passes**

The imports in `app-shell.tsx` reference `./create-project`, `./docker-viewer`, and `./test-runner` which don't exist yet. Create minimal stubs:

`webui/components/create-project.tsx` (temporary stub):
```tsx
import { View } from './app-shell'
export function CreateProject({ onNavigate }: { onNavigate: (v: View) => void }) {
  return <div className="text-foreground p-4">Create Project (coming soon)</div>
}
```

`webui/components/docker-viewer.tsx` (temporary stub):
```tsx
import { View } from './app-shell'
export function DockerViewer({ onNavigate }: { onNavigate: (v: View) => void }) {
  return <div className="text-foreground p-4">Docker Viewer (coming soon)</div>
}
```

`webui/components/test-runner.tsx` (temporary stub):
```tsx
import { View } from './app-shell'
export function TestRunner({ onNavigate }: { onNavigate: (v: View) => void }) {
  return <div className="text-foreground p-4">Test Runner (coming soon)</div>
}
```

- [ ] **Step 4: Run build to verify no errors**

```bash
cd webui && npm run build
```

Expected: build succeeds with the dark purple background and stub views.

- [ ] **Step 5: Visual smoke test**

```bash
cd webui && npm run dev
```

Open http://localhost:3000. Verify:
- Dark purple/near-black background
- Sidebar visible on the left with 3 icons
- Clicking the collapse chevron toggles sidebar width
- Hovering icons in collapsed mode shows tooltips
- Clicking nav items switches the stub text

- [ ] **Step 6: Commit**

```bash
git add webui/components/app-shell.tsx webui/app/page.tsx webui/components/create-project.tsx webui/components/docker-viewer.tsx webui/components/test-runner.tsx
git commit -m "feat: add AppShell with collapsible dark sidebar"
```

---

## Chunk 2: Create Project Wizard

### Task 3: Wizard types + shared utilities

**Files:**
- Create: `webui/components/create-project/types.ts`
- Create: `webui/components/create-project/step-indicator.tsx`
- Create: `webui/components/create-project/constants.ts`

- [ ] **Step 1: Create `webui/components/create-project/types.ts`**

```ts
export type WizardLayout = 'steps' | 'two-panel'
export type WizardStep = 1 | 2 | 3

export interface ServiceInfo {
  name: string
  category: string
  description: string
}

export interface ServicesByCategory {
  [category: string]: ServiceInfo[]
}

export interface WizardState {
  projectName: string
  domain: string
  proxyPort: number
  environments: string[]
  selectedServices: string[]
  servicePorts: Record<string, number>
  useDefaultPorts: boolean
}
```

- [ ] **Step 2: Create `webui/components/create-project/constants.ts`**

```ts
export const CATEGORY_LABELS: Record<string, string> = {
  app: 'APP',
  database: 'DATABASE',
  cache: 'CACHE',
  mail: 'MAIL',
}

export function getCategoryLabel(key: string): string {
  return CATEGORY_LABELS[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

export const DEFAULT_PORTS: Record<string, number> = {
  nextjs: 3000,
  api: 4000,
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  valkey: 6380,
  mailhog: 8025,
  mailpit: 8025,
}
```

- [ ] **Step 3: Create `webui/components/create-project/step-indicator.tsx`**

```tsx
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
                    ? 'bg-purple-500 border-purple-500 text-white'
                    : isCurrent
                    ? 'border-purple-500 text-purple-400 bg-[#2a1a3e]'
                    : 'border-[#2e2040] text-muted-foreground bg-[#1d1428]'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                  isCurrent ? 'text-purple-400' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 mb-3 transition-colors ${
                  step < currentStep ? 'bg-purple-500' : 'bg-[#2e2040]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run build to verify**

```bash
cd webui && npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add webui/components/create-project/
git commit -m "feat: add wizard types, constants, and step indicator"
```

---

### Task 4: Step 1 — Project Info

**Files:**
- Create: `webui/components/create-project/step-info.tsx`

- [ ] **Step 1: Create `webui/components/create-project/step-info.tsx`**

```tsx
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
          className="bg-[#1d1428] border-[#2e2040] focus-visible:ring-purple-500"
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
          className="bg-[#1d1428] border-[#2e2040] focus-visible:ring-purple-500"
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
          className={`w-32 bg-[#1d1428] border-[#2e2040] focus-visible:ring-purple-500 ${
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
                    ? 'bg-[#2a1a3e] border-purple-500 text-purple-300'
                    : 'bg-[#1d1428] border-[#2e2040] text-muted-foreground hover:text-foreground'
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
          style={{ background: canAdvance ? 'linear-gradient(135deg, #a855f7, #6366f1)' : undefined }}
        >
          Next: Services →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run build**

```bash
cd webui && npm run build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add webui/components/create-project/step-info.tsx
git commit -m "feat: add wizard step 1 - project info form"
```

---

### Task 5: Step 2 — Services Picker + Summary Panel

**Files:**
- Create: `webui/components/create-project/step-services.tsx`

- [ ] **Step 1: Create `webui/components/create-project/step-services.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { WizardState, ServicesByCategory } from './types'
import { getCategoryLabel, DEFAULT_PORTS } from './constants'

interface StepServicesProps {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function StepServices({ state, onChange, onNext, onBack }: StepServicesProps) {
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
    if (enabled && state.useDefaultPorts && DEFAULT_PORTS[name]) {
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
            <div className="h-4 w-16 bg-[#2e2040] rounded animate-pulse" />
            {[...Array(2)].map((_, j) => (
              <div key={j} className="h-12 bg-[#1d1428] rounded-md border border-[#2e2040] animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-[#1d1428] p-4 text-sm text-destructive">
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
                        ? 'bg-[#2a1a3e] border-purple-500'
                        : 'bg-[#1d1428] border-[#2e2040] hover:border-[#3d2a5a]'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-purple-400' : 'bg-[#3d2a5a]'
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
      <div className="w-44 flex-shrink-0 bg-[#1d1428] border border-[#2e2040] rounded-lg p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-purple-400 tracking-wide">YOUR STACK</span>
          {state.selectedServices.length > 0 && (
            <span className="text-[10px] bg-[#2a1a3e] border border-purple-500 text-purple-300 rounded-full px-2 py-0.5 font-semibold">
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
                  className="h-7 text-xs bg-[#13101e] border-[#2e2040] focus-visible:ring-purple-500 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        )}

        {/* Use default ports toggle */}
        <div className="mt-3 pt-3 border-t border-[#2e2040] flex items-center gap-2">
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
```

- [ ] **Step 2: Add navigation buttons below the two-column layout**

The navigation row (`← Back` / `Next →`) will be rendered by the parent `CreateProject` shell, not inside `StepServices`. No additional changes needed here.

- [ ] **Step 3: Run build**

```bash
cd webui && npm run build
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add webui/components/create-project/step-services.tsx
git commit -m "feat: add wizard step 2 - service picker + summary panel"
```

---

### Task 6: Step 3 + Main shell (`create-project/index.tsx`) + replace stub

**Files:**
- Create: `webui/components/create-project/step-review.tsx`
- Create: `webui/components/create-project/index.tsx`
- Replace: `webui/components/create-project.tsx` (the stub)

- [ ] **Step 1: Create `webui/components/create-project/step-review.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `webui/components/create-project/index.tsx`** — the main shell

This is the component that replaces the stub. It holds all state and dispatches to steps.

```tsx
'use client'

import { useState } from 'react'
import { View } from '../app-shell'
import { WizardState, WizardLayout, WizardStep } from './types'
import { StepIndicator } from './step-indicator'
import { StepInfo } from './step-info'
import { StepServices } from './step-services'
import { StepReview } from './step-review'
import { DEFAULT_PORTS } from './constants'

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
            <StepServices state={state} onChange={patch} onNext={() => {}} onBack={() => {}} />
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
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
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
          <StepServices state={state} onChange={patch} onNext={() => setStep(3)} onBack={() => setStep(1)} />
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
              style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
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
```

- [ ] **Step 3: Replace the stub `webui/components/create-project.tsx` to re-export from the folder**

```tsx
export { CreateProject } from './create-project/index'
```

- [ ] **Step 4: Run build**

```bash
cd webui && npm run build
```

Expected: passes.

- [ ] **Step 5: Visual smoke test**

```bash
cd webui && npm run dev
```

Verify:
- Step indicator shows 3 nodes, "Project Info" highlighted
- Step 1 form renders with dark inputs
- "Next" disabled until project name is typed
- Port error shows for invalid proxy port
- Environment pills toggle correctly (`local` non-deselectable)
- Step 2 loads services from API, shows picker + summary panel
- Toggling a service adds it to the right panel with port
- "Use default ports" toggle disables port inputs
- Step 3 shows read-only summary and "Generate & Download" button

- [ ] **Step 6: Commit**

```bash
git add webui/components/create-project/ webui/components/create-project.tsx
git commit -m "feat: complete 3-step create project wizard with two-panel fallback"
```

---

## Chunk 3: Docker Viewer + Test Runner + Cleanup

### Task 7: Docker Viewer

**Files:**
- Replace: `webui/components/docker-viewer.tsx` (was a stub)

- [ ] **Step 1: Replace `webui/components/docker-viewer.tsx` with full implementation**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Square, RotateCw, Terminal, Activity, Loader2, Copy } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { View } from './app-shell'

interface Project { name: string; path: string }

interface DockerViewerProps {
  onNavigate: (view: View) => void
}

// Attempt to parse `docker ps` tabular output into rows.
// Returns null if the format is unrecognised.
function parseDockerStatus(raw: string): { name: string; image: string; status: string; ports: string }[] | null {
  const lines = raw.trim().split('\n')
  if (lines.length < 2) return null
  const dataLines = lines.slice(1).filter(Boolean)
  return dataLines.map((line) => {
    const cols = line.split(/\s{2,}/)
    return {
      name: cols[6] ?? cols[0] ?? '—',
      image: cols[1] ?? '—',
      status: cols[4] ?? '—',
      ports: cols[5] ?? '—',
    }
  })
}

function StatusDot({ status }: { status: string }) {
  const running = status.toLowerCase().includes('up')
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-2 ${running ? 'bg-green-400' : 'bg-gray-500'}`}
    />
  )
}

export function DockerViewer({ onNavigate }: DockerViewerProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [logs, setLogs] = useState('')
  const [status, setStatus] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executingAction, setExecutingAction] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => { loadProjects() }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const loadProjects = async () => {
    setLoadingProjects(true)
    setProjectsError(null)
    try {
      const res = await fetch('/api/docker/projects')
      const data = await res.json()
      setProjects(data.projects ?? [])
      if (data.projects?.length > 0) setSelectedProject(data.projects[0].name)
    } catch (e) {
      setProjectsError(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setLoadingProjects(false)
    }
  }

  const executeAction = async (action: string) => {
    if (!selectedProject) return
    setIsExecuting(true)
    setExecutingAction(action)
    try {
      const res = await fetch(`/api/docker/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: selectedProject }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Failed to ${action}`)

      if (action === 'logs') setLogs(data.output ?? '')
      else if (action === 'status') setStatus(data.output ?? '')
      else {
        toast({ title: 'Done', description: `${action} completed` })
        setTimeout(() => executeAction('status'), 1000)
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: `Failed to ${action}`,
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    } finally {
      setIsExecuting(false)
      setExecutingAction(null)
    }
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied', description: 'Copied to clipboard' })
  }

  // ── Loading state ──────────────────────────────────────────────────
  if (loadingProjects) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1 text-foreground">Docker Viewer</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage your Docker containers</p>
        <div className="h-10 bg-[#1d1428] rounded-md border border-[#2e2040] animate-pulse" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────
  if (projectsError) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1 text-foreground">Docker Viewer</h1>
        <p className="text-sm text-destructive">{projectsError}</p>
        <button onClick={loadProjects} className="text-sm underline text-muted-foreground hover:text-foreground mt-2">
          Retry
        </button>
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1 text-foreground">Docker Viewer</h1>
        <div className="bg-[#1d1428] border border-[#2e2040] rounded-lg p-8 text-center mt-6">
          <p className="text-muted-foreground mb-4">No projects found.</p>
          <button
            onClick={() => onNavigate('create')}
            className="text-sm font-semibold text-purple-400 hover:text-purple-300 underline"
          >
            Create your first project →
          </button>
        </div>
      </div>
    )
  }

  const parsedStatus = status ? parseDockerStatus(status) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1 text-foreground">Docker Viewer</h1>
        <p className="text-sm text-muted-foreground">Manage your Docker containers</p>
      </div>

      {/* Project selector */}
      <Select value={selectedProject} onValueChange={setSelectedProject}>
        <SelectTrigger className="w-64 bg-[#1d1428] border-[#2e2040] focus:ring-purple-500">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent className="bg-[#1d1428] border-[#2e2040]">
          {projects.map((p) => (
            <SelectItem key={p.name} value={p.name} className="text-foreground focus:bg-[#2a1a3e]">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Primary actions */}
        <button
          onClick={() => executeAction('up')}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
        >
          {executingAction === 'up' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Start
        </button>
        <button
          onClick={() => executeAction('down')}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-destructive text-destructive-foreground disabled:opacity-40"
        >
          {executingAction === 'down' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
          Stop
        </button>

        {/* Secondary actions */}
        <div className="flex gap-2 ml-2">
          {[
            { action: 'restart', icon: RotateCw, label: 'Restart' },
            { action: 'status', icon: Activity, label: 'Status' },
            { action: 'logs', icon: Terminal, label: 'Logs' },
          ].map(({ action, icon: Icon, label }) => (
            <button
              key={action}
              onClick={() => executeAction(action)}
              disabled={isExecuting}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-[#2e2040] text-muted-foreground hover:text-foreground hover:border-purple-500 disabled:opacity-40 transition-colors"
            >
              {executingAction === action ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Output tabs — always rendered */}
      <Tabs defaultValue="status" className="w-full">
        <TabsList className="bg-[#1d1428] border border-[#2e2040]">
          <TabsTrigger value="status" className="data-[state=active]:bg-[#2a1a3e] data-[state=active]:text-purple-300">
            Status
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#2a1a3e] data-[state=active]:text-purple-300">
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-3">
          {!status ? (
            <p className="text-sm text-muted-foreground py-4">Click Status to load</p>
          ) : parsedStatus ? (
            <div className="overflow-x-auto rounded-md border border-[#2e2040]">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#1d1428] text-muted-foreground">
                    {['Service', 'Image', 'Status', 'Ports'].map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedStatus.map((row, i) => (
                    <tr key={i} className="border-t border-[#2e2040] hover:bg-[#1d1428]">
                      <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.image}</td>
                      <td className="px-3 py-2">
                        <StatusDot status={row.status} />
                        <span className="text-muted-foreground">{row.status}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.ports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="p-4 rounded-md bg-[#0d0b14] text-green-400 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto border border-[#2e2040]">
              {status}
            </pre>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-3">
          <div className="relative">
            {logs && (
              <button
                onClick={() => copyText(logs)}
                className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 text-xs border border-[#2e2040] rounded bg-[#1d1428] text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            )}
            <pre className="p-4 rounded-md bg-[#0d0b14] text-gray-300 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto border border-[#2e2040]">
              {logs || 'Click View Logs to load'}
              <div ref={logsEndRef} />
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Run build**

```bash
cd webui && npm run build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add webui/components/docker-viewer.tsx
git commit -m "feat: implement Docker Viewer with project selector, action bar, status table, and logs"
```

---

### Task 8: Test Runner

**Files:**
- Replace: `webui/components/test-runner.tsx` (was a stub)

- [ ] **Step 1: Replace `webui/components/test-runner.tsx` with full implementation**

```tsx
'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { View } from './app-shell'

interface TestResult { url: string; success: boolean; response?: string; error?: string }
interface TestSummary { total: number; passed: number; failed: number }

const AVAILABLE_SERVICES = [
  { name: 'nextjs', label: 'Next.js', description: 'Frontend application' },
  { name: 'api', label: 'Express.js', description: 'API server' },
  { name: 'postgres', label: 'PostgreSQL', description: 'Database' },
  { name: 'redis', label: 'Redis', description: 'Cache' },
]

const PROGRESS_STEPS = ['Generating', 'Building', 'Starting', 'Testing'] as const

interface TestRunnerProps {
  onNavigate: (view: View) => void
}

export function TestRunner({ onNavigate }: TestRunnerProps) {
  const [projectName, setProjectName] = useState('test-project')
  const [selected, setSelected] = useState<string[]>(['nextjs', 'api', 'postgres'])
  const [running, setRunning] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [results, setResults] = useState<TestResult[]>([])
  const [summary, setSummary] = useState<TestSummary | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [logs, setLogs] = useState('')
  const [showLogs, setShowLogs] = useState(false)
  const { toast } = useToast()

  const toggleService = (name: string) => {
    setSelected((s) => s.includes(name) ? s.filter((x) => x !== name) : [...s, name])
  }

  const runTest = async () => {
    if (selected.length === 0) return
    setRunning(true)
    setProgressStep(0)
    setResults([])
    setSummary(null)
    setLogs('')
    setShowLogs(false)

    // Pulse through progress steps visually every ~30s
    const interval = setInterval(() => {
      setProgressStep((p) => Math.min(p + 1, PROGRESS_STEPS.length - 1))
    }, 30000)

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, services: selected }),
      })
      const data = await res.json()
      setLogs(data.logs ?? '')
      setResults(data.testResults ?? [])
      setSummary(data.summary ?? null)
      // Auto-expand results on failure; collapse on full pass
      setShowResults(!data.success)

      if (!data.success) {
        setShowLogs(true) // auto-expand logs on failure
        toast({ variant: 'destructive', title: 'Test Failed', description: data.error ?? 'Some tests failed' })
      } else {
        toast({ title: 'All Tests Passed', description: `${data.summary?.total ?? 0} tests passed` })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setLogs(`Error: ${msg}`)
      setShowLogs(true)
      toast({ variant: 'destructive', title: 'Test Error', description: msg })
    } finally {
      clearInterval(interval)
      setRunning(false)
    }
  }

  const copyLogs = () => {
    navigator.clipboard.writeText(logs)
    toast({ title: 'Copied', description: 'Logs copied to clipboard' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1 text-foreground">Test Runner</h1>
        <p className="text-sm text-muted-foreground">Generate a project, start containers, and verify endpoints</p>
      </div>

      {/* Config */}
      <div className="bg-[#1d1428] border border-[#2e2040] rounded-lg p-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="testName">Project Name</Label>
          <Input
            id="testName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="w-64 bg-[#13101e] border-[#2e2040] focus-visible:ring-purple-500"
          />
          <p className="text-xs text-muted-foreground">Created as {projectName}-output (auto-gitignored)</p>
        </div>

        <div className="space-y-3">
          <Label>Services to Test</Label>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_SERVICES.map((s) => {
              const isSelected = selected.includes(s.name)
              return (
                <div
                  key={s.name}
                  onClick={() => toggleService(s.name)}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#2a1a3e] border-purple-500'
                      : 'bg-[#13101e] border-[#2e2040] hover:border-[#3d2a5a]'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${isSelected ? 'bg-purple-400' : 'bg-[#3d2a5a]'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Run button / progress */}
        {running ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      i < progressStep ? 'bg-purple-500' : i === progressStep ? 'bg-purple-400 animate-pulse' : 'bg-[#2e2040]'
                    }`}
                  />
                  <span className={`text-xs ${i === progressStep ? 'text-purple-300 font-semibold' : 'text-muted-foreground'}`}>
                    {step}
                  </span>
                  {i < PROGRESS_STEPS.length - 1 && <span className="text-[#2e2040]">→</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              This takes 2–3 minutes — don&apos;t close the tab
            </p>
          </div>
        ) : (
          <button
            onClick={runTest}
            disabled={selected.length === 0}
            className="w-full py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
          >
            Run Test
          </button>
        )}
      </div>

      {/* Results */}
      {summary && (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 p-3 rounded-md border text-sm font-semibold ${
              summary.failed === 0
                ? 'bg-green-950 border-green-800 text-green-300'
                : 'bg-red-950 border-red-800 text-red-300'
            }`}
          >
            {summary.failed === 0 ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span>{summary.passed} / {summary.total} passed</span>
            {summary.failed === 0 && (
              <button
                onClick={() => setShowResults((v) => !v)}
                className="ml-auto text-xs underline opacity-70 hover:opacity-100"
              >
                {showResults ? 'Hide results' : 'Show results'}
              </button>
            )}
          </div>

          {showResults && (
            <div className="space-y-1.5">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-md border-l-2 bg-[#1d1428] border border-[#2e2040] text-sm ${
                    r.success ? 'border-l-green-500' : 'border-l-red-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {r.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-foreground">{r.url}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">{r.response ?? r.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs — collapsed by default */}
      {logs && (
        <div className="bg-[#1d1428] border border-[#2e2040] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Logs</span>
            {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showLogs && (
            <div className="relative">
              <button
                onClick={copyLogs}
                className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 text-xs border border-[#2e2040] rounded bg-[#13101e] text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
              <pre className="p-4 bg-[#0d0b14] text-gray-300 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto border-t border-[#2e2040]">
                {logs}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run build**

```bash
cd webui && npm run build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add webui/components/test-runner.tsx
git commit -m "feat: implement Test Runner with progress steps, results, and collapsible logs"
```

---

### Task 9: Delete old components + final verification

**Files:**
- Delete: `webui/components/project-wizard.tsx`
- Delete: `webui/components/project-viewer.tsx`
- Delete: `webui/components/test-project.tsx`

- [ ] **Step 1: Delete old components**

```bash
rm webui/components/project-wizard.tsx
rm webui/components/project-viewer.tsx
rm webui/components/test-project.tsx
```

- [ ] **Step 2: Verify nothing imports them**

```bash
grep -r "project-wizard\|project-viewer\|test-project" webui/app webui/components --include="*.tsx" --include="*.ts"
```

Expected: no output (no remaining imports).

- [ ] **Step 3: Run final build**

```bash
cd webui && npm run build
```

Expected: clean build, no TypeScript errors, no missing imports.

- [ ] **Step 4: Full visual smoke test**

```bash
cd webui && npm run dev
```

Verify end-to-end:
1. Dark purple background loads, sidebar visible
2. Sidebar collapse/expand works, localStorage persists across refresh
3. All 3 nav items navigate correctly
4. Create Project — complete a full wizard flow: enter name → select services → review → download
5. Docker Viewer — if projects exist, selector works, actions fire correctly; if empty, "Create your first project" link navigates to Create view
6. Test Runner — service cards toggle, Run Test fires the API

- [ ] **Step 5: Final commit**

```bash
git add webui/components/app-shell.tsx webui/components/create-project.tsx webui/components/create-project/ webui/components/docker-viewer.tsx webui/components/test-runner.tsx webui/app/globals.css webui/app/layout.tsx webui/app/page.tsx webui/components/ui/select.tsx webui/components/ui/tooltip.tsx
git commit -m "feat: complete Web UI redesign - remove old components, full dark purple UI"
```

---

## Summary

| Task | File(s) | What it builds |
|---|---|---|
| 1 | globals.css, layout.tsx | Dark purple theme, dark class |
| 2 | app-shell.tsx, page.tsx | Collapsible sidebar, view routing |
| 3 | create-project/types.ts, constants.ts, step-indicator.tsx | Wizard shared types + step progress |
| 4 | create-project/step-info.tsx | Step 1 form |
| 5 | create-project/step-services.tsx | Step 2 service picker + summary panel |
| 6 | create-project/index.tsx, create-project.tsx | Full wizard shell + two-panel variant |
| 7 | docker-viewer.tsx | Project selector, action bar, status table, logs |
| 8 | test-runner.tsx | Service grid, progress, results, collapsible logs |
| 9 | (delete old files) | Cleanup + final verification |
