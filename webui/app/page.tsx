'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectWizard } from '@/components/project-wizard'
import { ProjectViewer } from '@/components/project-viewer'
import { TestProject } from '@/components/test-project'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const [activeTab, setActiveTab] = useState('create')

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Docker Project Builder</h1>
          <p className="text-muted-foreground">
            Generate production-ready Docker projects with a visual interface
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create Project</TabsTrigger>
            <TabsTrigger value="view">Docker Viewer</TabsTrigger>
            <TabsTrigger value="test">Test Project</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            <ProjectWizard onProjectCreated={() => setActiveTab('view')} />
          </TabsContent>

          <TabsContent value="view" className="mt-6">
            <ProjectViewer />
          </TabsContent>

          <TabsContent value="test" className="mt-6">
            <TestProject />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
