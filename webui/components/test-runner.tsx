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
      <div className="bg-[#252432] border border-[#3a3948] rounded-lg p-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="testName">Project Name</Label>
          <Input
            id="testName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="w-64 bg-[#1c1b24] border-[#3a3948] focus-visible:ring-[#6264a7]"
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
                      ? 'bg-[#32313f] border-[#6264a7]'
                      : 'bg-[#1c1b24] border-[#3a3948] hover:border-[#44435a]'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${isSelected ? 'bg-[#7b83eb]' : 'bg-[#44435a]'}`} />
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
                      i < progressStep ? 'bg-[#6264a7]' : i === progressStep ? 'bg-[#7b83eb] animate-pulse' : 'bg-[#3a3948]'
                    }`}
                  />
                  <span className={`text-xs ${i === progressStep ? 'text-[#9ea4f0] font-semibold' : 'text-muted-foreground'}`}>
                    {step}
                  </span>
                  {i < PROGRESS_STEPS.length - 1 && <span className="text-[#3a3948]">&#8594;</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              This takes 2&ndash;3 minutes &mdash; don&apos;t close the tab
            </p>
          </div>
        ) : (
          <button
            onClick={runTest}
            disabled={selected.length === 0}
            className="w-full py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6264a7, #7b83eb)' }}
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
                  className={`flex items-center justify-between p-3 rounded-md border-l-2 bg-[#252432] border border-[#3a3948] text-sm ${
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
        <div className="bg-[#252432] border border-[#3a3948] rounded-lg overflow-hidden">
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
                className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 text-xs border border-[#3a3948] rounded bg-[#1c1b24] text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
              <pre className="p-4 bg-[#141318] text-gray-300 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto border-t border-[#3a3948]">
                {logs}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
