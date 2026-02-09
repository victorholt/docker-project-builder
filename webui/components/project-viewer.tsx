'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Play, Square, RotateCw, Terminal, Activity } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface Project {
  name: string
  path: string
}

export function ProjectViewer() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [isExecuting, setIsExecuting] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/docker/projects')
      const data = await response.json()
      setProjects(data.projects || [])
      if (data.projects?.length > 0 && !selectedProject) {
        setSelectedProject(data.projects[0].name)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load projects',
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const executeDockerAction = async (action: string, service?: string) => {
    if (!selectedProject) {
      toast({
        variant: 'destructive',
        title: 'No project selected',
        description: 'Please select a project first',
      })
      return
    }

    setIsExecuting(true)
    try {
      const response = await fetch(`/api/docker/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: selectedProject, service }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action}`)
      }

      if (action === 'logs') {
        setLogs(data.output || '')
      } else if (action === 'status') {
        setStatus(data.output || '')
      } else {
        toast({
          title: `Action completed`,
          description: `Successfully executed ${action}`,
        })
        // Refresh status after action
        setTimeout(() => executeDockerAction('status'), 1000)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: `Failed to ${action}`,
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsExecuting(false)
    }
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Docker Viewer</CardTitle>
          <CardDescription>No projects found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create a project first to view and manage Docker containers
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Project Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Docker Viewer</CardTitle>
          <CardDescription>View and manage Docker containers for your projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Project</label>
              <select
                className="w-full mt-2 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.name} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <Separator />

            {/* Control Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => executeDockerAction('up')}
                disabled={isExecuting}
                variant="default"
              >
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
              <Button
                onClick={() => executeDockerAction('down')}
                disabled={isExecuting}
                variant="destructive"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
              <Button
                onClick={() => executeDockerAction('restart')}
                disabled={isExecuting}
                variant="outline"
              >
                <RotateCw className="mr-2 h-4 w-4" />
                Restart
              </Button>
              <Button
                onClick={() => executeDockerAction('status')}
                disabled={isExecuting}
                variant="outline"
              >
                <Activity className="mr-2 h-4 w-4" />
                Status
              </Button>
              <Button
                onClick={() => executeDockerAction('logs')}
                disabled={isExecuting}
                variant="outline"
              >
                <Terminal className="mr-2 h-4 w-4" />
                View Logs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Output Tabs */}
      {(status || logs) && (
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="status">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="status" className="mt-4">
                <div className="relative">
                  <pre className="p-4 rounded-lg bg-black text-green-400 font-mono text-xs overflow-x-auto max-h-[500px] overflow-y-auto">
                    {status || 'No status information. Click "Status" to load.'}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <div className="relative">
                  <pre className="p-4 rounded-lg bg-black text-gray-300 font-mono text-xs overflow-x-auto max-h-[500px] overflow-y-auto">
                    {logs || 'No logs available. Click "View Logs" to load.'}
                    <div ref={logsEndRef} />
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {isExecuting && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Executing command...</span>
        </div>
      )}
    </div>
  )
}
