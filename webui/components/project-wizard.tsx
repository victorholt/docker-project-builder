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
  const [useDefaultPorts, setUseDefaultPorts] = useState(true)
  const [servicePorts, setServicePorts] = useState<Record<string, number>>({})
  const { toast } = useToast()

  const [proxyPort, setProxyPort] = useState(8080)

  // Default ports for each service
  const defaultPorts: Record<string, number> = {
    nextjs: 3000,
    api: 4000,
    postgres: 5432,
    mysql: 3306,
    redis: 6379,
    valkey: 6380,
    mailhog: 8025,
    mailpit: 8025,
  }

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

  const handleServiceToggle = (serviceName: string, isEnabled: boolean) => {
    if (isEnabled) {
      setSelectedServices((prev) => [...prev, serviceName])
      // Set default port when service is enabled
      if (useDefaultPorts && defaultPorts[serviceName]) {
        setServicePorts((prev) => ({ ...prev, [serviceName]: defaultPorts[serviceName] }))
      }
    } else {
      setSelectedServices((prev) => prev.filter((s) => s !== serviceName))
      // Remove port when service is disabled
      setServicePorts((prev) => {
        const newPorts = { ...prev }
        delete newPorts[serviceName]
        return newPorts
      })
    }
  }

  const handlePortChange = (serviceName: string, port: string) => {
    const portNum = parseInt(port)
    if (!isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
      setServicePorts((prev) => ({ ...prev, [serviceName]: portNum }))
    }
  }

  const handleUseDefaultPortsChange = (checked: boolean) => {
    setUseDefaultPorts(checked)
    if (checked) {
      // Fill in default ports for all selected services
      const newPorts: Record<string, number> = {}
      selectedServices.forEach((service) => {
        if (defaultPorts[service]) {
          newPorts[service] = defaultPorts[service]
        }
      })
      setServicePorts(newPorts)
    }
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
      const response = await fetch('/api/generate-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          domain: domain || `${projectName}.local`,
          services: selectedServices,
          environments,
          ports: { ...servicePorts, proxy: proxyPort },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate project')
      }

      // Get the zip file as a blob
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Project Downloaded!',
        description: `${projectName}.zip is ready. Extract it and run ./cli to get started.`,
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

          <div className="space-y-2">
            <Label htmlFor="proxyPort">Proxy Port</Label>
            <Input
              id="proxyPort"
              type="number"
              min="1"
              max="65535"
              value={proxyPort}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (!isNaN(val) && val >= 1 && val <= 65535) setProxyPort(val)
              }}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              The port Apache proxy listens on (serves all services)
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

        {/* Services & Ports */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Services & Ports *</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-default-ports"
                checked={useDefaultPorts}
                onCheckedChange={(checked) => handleUseDefaultPortsChange(checked as boolean)}
              />
              <label
                htmlFor="use-default-ports"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Use default ports
              </label>
            </div>
          </div>

          {Object.keys(availableServices).length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading services...</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(availableServices).map(([category, services]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-sm font-semibold capitalize text-muted-foreground">{category}</h4>
                  <div className="space-y-2">
                    {services.map((service) => {
                      const isSelected = selectedServices.includes(service.name)
                      const port = servicePorts[service.name] || defaultPorts[service.name] || ''

                      return (
                        <div
                          key={service.name}
                          className={`flex items-center gap-4 p-3 rounded-md border transition-colors ${
                            isSelected ? 'border-primary bg-accent' : 'border-border'
                          }`}
                        >
                          <Checkbox
                            id={service.name}
                            checked={isSelected}
                            onCheckedChange={(checked) => handleServiceToggle(service.name, checked as boolean)}
                          />
                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={service.name}
                              className="text-sm font-medium leading-none cursor-pointer block"
                            >
                              {service.name}
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Label htmlFor={`port-${service.name}`} className="text-xs text-muted-foreground">
                              Port:
                            </Label>
                            <Input
                              id={`port-${service.name}`}
                              type="number"
                              min="1"
                              max="65535"
                              value={isSelected ? port : ''}
                              onChange={(e) => handlePortChange(service.name, e.target.value)}
                              disabled={!isSelected || useDefaultPorts}
                              placeholder={defaultPorts[service.name]?.toString() || 'Port'}
                              className="w-24 h-8 text-sm"
                            />
                          </div>
                        </div>
                      )
                    })}
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
