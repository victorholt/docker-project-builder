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
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('dpb:sidebar:collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  useEffect(() => {
    localStorage.setItem('dpb:sidebar:collapsed', String(collapsed))
  }, [collapsed])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`relative flex flex-col bg-[#141318] border-r border-[#3a3948] transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-[52px]' : 'w-[200px]'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-3 mb-2 ${collapsed ? 'justify-center' : ''}`}>
          <div
            className="w-8 h-8 rounded-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6264a7, #7b83eb)' }}
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
                        ? 'bg-[#32313f] border border-[#6264a7] text-[#7b83eb]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[#252432]'
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
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#32313f] border border-[#6264a7] flex items-center justify-center hover:bg-[#44435a] transition-colors z-10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-[#7b83eb]" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-[#7b83eb]" />
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
