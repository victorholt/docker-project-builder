'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface TestResult {
  url: string
  success: boolean
  response?: string
  error?: string
}

interface TestSummary {
  total: number
  passed: number
  failed: number
}

const DEFAULT_SERVICES = ['nextjs', 'expressjs', 'postgres']

export function TestProject() {
  const [projectName, setProjectName] = useState('test-project')
  const [selectedServices, setSelectedServices] = useState<string[]>(DEFAULT_SERVICES)
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [testLogs, setTestLogs] = useState('')
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null)
  const { toast } = useToast()

  const availableServices = [
    { name: 'nextjs', label: 'Next.js', description: 'Frontend application' },
    { name: 'expressjs', label: 'Express.js', description: 'API server' },
    { name: 'postgres', label: 'PostgreSQL', description: 'Database' },
    { name: 'redis', label: 'Redis', description: 'Cache' },
  ]

  const handleServiceToggle = (serviceName: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName)
        ? prev.filter((s) => s !== serviceName)
        : [...prev, serviceName]
    )
  }

  const runTest = async () => {
    if (selectedServices.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select at least one service to test',
      })
      return
    }

    setIsTesting(true)
    setTestResults([])
    setTestLogs('')
    setTestSummary(null)

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          services: selectedServices,
        }),
      })

      const data = await response.json()

      setTestLogs(data.logs || '')
      setTestResults(data.testResults || [])
      setTestSummary(data.summary || null)

      if (data.success) {
        toast({
          title: 'Test Completed Successfully',
          description: `All ${data.summary?.total || 0} tests passed!`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Test Failed',
          description: data.error || `${data.summary?.failed || 0} tests failed`,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Test Execution Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      })
      setTestLogs(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsTesting(false)
    }
  }

  const copyLogs = () => {
    navigator.clipboard.writeText(testLogs)
    toast({
      title: 'Logs Copied',
      description: 'Test logs copied to clipboard',
    })
  }

  return (
    <div className="space-y-4">
      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Project Generator</CardTitle>
          <CardDescription>
            Generate a test project, start Docker containers, and verify endpoints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="testProjectName">Project Name</Label>
            <Input
              id="testProjectName"
              placeholder="test-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <p className="text-xs text-muted-foreground">
              Will be created as {projectName}-output (in .gitignore)
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Services to Test</Label>
            <div className="grid grid-cols-2 gap-3">
              {availableServices.map((service) => (
                <div
                  key={service.name}
                  className={`flex items-start space-x-2 p-3 rounded-md border cursor-pointer hover:bg-accent transition-colors ${
                    selectedServices.includes(service.name) ? 'border-primary bg-accent' : ''
                  }`}
                  onClick={() => handleServiceToggle(service.name)}
                >
                  <Checkbox
                    id={`test-${service.name}`}
                    checked={selectedServices.includes(service.name)}
                    onCheckedChange={() => handleServiceToggle(service.name)}
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor={`test-${service.name}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {service.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{service.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <Button
            onClick={runTest}
            disabled={isTesting || selectedServices.length === 0}
            className="w-full"
            size="lg"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Test (this may take 2-3 minutes)...
              </>
            ) : (
              'Run Test'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              {testSummary.passed}/{testSummary.total} tests passed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-md border ${
                    result.success ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-sm font-medium">{result.url}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {result.response || result.error || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Logs */}
      {testLogs && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Test Logs</CardTitle>
              <Button variant="outline" size="sm" onClick={copyLogs}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Logs
              </Button>
            </div>
            <CardDescription>
              Detailed execution logs for debugging
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 rounded-lg bg-black text-gray-300 font-mono text-xs overflow-x-auto max-h-[500px] overflow-y-auto">
              {testLogs}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
