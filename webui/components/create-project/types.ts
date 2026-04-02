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
