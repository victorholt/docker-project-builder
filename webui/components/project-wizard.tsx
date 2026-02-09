'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

interface Service {
  name: string
  category: string
  description: string
}

interface ServicesByCategory {
  [category: string]: Service[]
}

interface ProjectWizardProps {
  onProjectCreated?: () => void
}

export function ProjectWizard({ onProjectCreated }: ProjectWizardProps) {
  const [projectName, setProjectName] = useState('')
  const [domain, setDomain] = useState('')
  const [availableServices, setAvailableServices] = useState<ServicesByCategory>({})
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [environments, setEnvironments] = useState<string[]>(['local'])
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  // Load available services on mount
  useEffect(() => {
    fetch('/api/services')
      .then((res) => res.json())
      .then((data) => setAvailableServices(data.services))
      .catch((error) => {
        toast({
          variant: 'destructive',
          title: 'Error loading services',
          description: error.message,
        })
      })
  }, [toast])

  const handleServiceToggle = (serviceName: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceName)
        ? prev.filter((s) => s !== serviceName)
        : [...prev, serviceName]
    )
  }

  const handleEnvironmentToggle = (env: string) => {
    setEnvironments((prev) =>
      prev.includes(env)
        ? prev.filter((e) => e !== env)
        : [...prev, env]
    )
  }

  const handleGenerate = async () => {
    if (!projectName) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Project name is required',
      })
      return
    }

    if (selectedServices.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select at least one service',
      })
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          domain: domain || `${projectName}.local`,
          services: selectedServices,
          environments,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate project')
      }

      toast({
        title: 'Project Generated!',
        description: `${projectName} has been created successfully at ${data.outputPath}`,
      })

      if (onProjectCreated) {
        onProjectCreated()
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Project</CardTitle>
        <CardDescription>
          Configure your Docker project settings and select services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Project Settings */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name *</Label>
            <Input
              id="projectName"
              placeholder="my-awesome-app"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain (optional)</Label>
            <Input
              id="domain"
              placeholder="example.local"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to {projectName || 'project-name'}.local
            </p>
          </div>
        </div>

        <Separator />

        {/* Environments */}
        <div className="space-y-3">
          <Label>Environments *</Label>
          <div className="flex gap-4">
            {['local', 'staging', 'prod'].map((env) => (
              <div key={env} className="flex items-center space-x-2">
                <Checkbox
                  id={`env-${env}`}
                  checked={environments.includes(env)}
                  onCheckedChange={() => handleEnvironmentToggle(env)}
                />
                <label
                  htmlFor={`env-${env}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                >
                  {env}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Services by Category */}
        <div className="space-y-4">
          <Label>Services *</Label>
          {Object.keys(availableServices).length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading services...</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(availableServices).map(([category, services]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-sm font-semibold capitalize">{category}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {services.map((service) => (
                      <div
                        key={service.name}
                        className={`flex items-start space-x-2 p-3 rounded-md border cursor-pointer hover:bg-accent transition-colors ${
                          selectedServices.includes(service.name) ? 'border-primary bg-accent' : ''
                        }`}
                        onClick={() => handleServiceToggle(service.name)}
                      >
                        <Checkbox
                          id={service.name}
                          checked={selectedServices.includes(service.name)}
                          onCheckedChange={() => handleServiceToggle(service.name)}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor={service.name}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {service.name}
                          </label>
                          <p className="text-xs text-muted-foreground">{service.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !projectName || selectedServices.length === 0}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Project...
            </>
          ) : (
            'Generate Project'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
