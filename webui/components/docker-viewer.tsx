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
        <div className="h-10 bg-[#252432] rounded-md border border-[#3a3948] animate-pulse" />
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
        <div className="bg-[#252432] border border-[#3a3948] rounded-lg p-8 text-center mt-6">
          <p className="text-muted-foreground mb-4">No projects found.</p>
          <button
            onClick={() => onNavigate('create')}
            className="text-sm font-semibold text-[#7b83eb] hover:text-[#9ea4f0] underline"
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
        <SelectTrigger className="w-64 bg-[#252432] border-[#3a3948] focus:ring-[#6264a7]">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent className="bg-[#252432] border-[#3a3948]">
          {projects.map((p) => (
            <SelectItem key={p.name} value={p.name} className="text-foreground focus:bg-[#32313f]">
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
          style={{ background: 'linear-gradient(135deg, #6264a7, #7b83eb)' }}
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
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-[#3a3948] text-muted-foreground hover:text-foreground hover:border-[#6264a7] disabled:opacity-40 transition-colors"
            >
              {executingAction === action ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Output tabs — always rendered */}
      <Tabs defaultValue="status" className="w-full">
        <TabsList className="bg-[#252432] border border-[#3a3948]">
          <TabsTrigger value="status" className="data-[state=active]:bg-[#32313f] data-[state=active]:text-[#9ea4f0]">
            Status
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#32313f] data-[state=active]:text-[#9ea4f0]">
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-3">
          {!status ? (
            <p className="text-sm text-muted-foreground py-4">Click Status to load</p>
          ) : parsedStatus ? (
            <div className="overflow-x-auto rounded-md border border-[#3a3948]">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#252432] text-muted-foreground">
                    {['Service', 'Image', 'Status', 'Ports'].map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedStatus.map((row, i) => (
                    <tr key={i} className="border-t border-[#3a3948] hover:bg-[#252432]">
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
            <pre className="p-4 rounded-md bg-[#141318] text-green-400 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto border border-[#3a3948]">
              {status}
            </pre>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-3">
          <div className="relative">
            {logs && (
              <button
                onClick={() => copyText(logs)}
                className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 text-xs border border-[#3a3948] rounded bg-[#252432] text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            )}
            <pre className="p-4 rounded-md bg-[#141318] text-gray-300 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto border border-[#3a3948]">
              {logs || 'Click View Logs to load'}
              <div ref={logsEndRef} />
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
