import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import archiver from 'archiver'
import { Readable } from 'stream'

const execAsync = promisify(exec)

interface GenerateRequest {
  projectName: string
  domain?: string
  services: string[]
  environments: string[]
  ports?: Record<string, number>
}

export async function POST(request: Request) {
  let tempDir: string | null = null

  try {
    const body: GenerateRequest = await request.json()
    const { projectName, domain, services, environments, ports = {} } = body

    // Validate input
    if (!projectName || !/^[a-z0-9-]+$/.test(projectName)) {
      return NextResponse.json(
        { error: 'Invalid project name. Use lowercase letters, numbers, and hyphens only.' },
        { status: 400 }
      )
    }

    if (!services || services.length === 0) {
      return NextResponse.json(
        { error: 'At least one service must be selected' },
        { status: 400 }
      )
    }

    // Create temp directory
    const tmpBase = path.join(process.cwd(), '..','.tmp')
    await fs.mkdir(tmpBase, { recursive: true })

    tempDir = path.join(tmpBase, `${projectName}-${Date.now()}`)
    const outputPath = path.join(tempDir, projectName)

    // Generate project using the generate module
    const { ProjectGenerator } = await import('../../../../dist/core/generator/project-generator.js')
    const { PluginRegistry } = await import('../../../../dist/core/services/plugin-registry.js')
    const { FileWriter } = await import('../../../../dist/core/services/file-writer.js')
    const { TemplateRenderer } = await import('../../../../dist/core/services/template-renderer.js')

    // Discover plugins
    const registry = new PluginRegistry()
    await registry.discoverPlugins()

    // Get selected plugins
    const plugins = []
    const proxyPlugin = registry.getPlugin('proxy')
    if (proxyPlugin) plugins.push(proxyPlugin)

    for (const serviceName of services) {
      const plugin = registry.getPlugin(serviceName)
      if (plugin) plugins.push(plugin)
    }

    // Build config
    const config = {
      projectName,
      containerPrefix: projectName,
      domain: domain || `${projectName}.local`,
      services: services.map(name => ({
        name,
        version: 'latest',
        enabled: true,
      })),
      environments: environments as Array<'local' | 'staging' | 'prod'>,
      proxy: {
        enabled: true,
        type: 'path-based' as const,
        port: 8080,
        sslPort: 8443,
      },
      ports,
      outputPath,
    }

    // Generate project
    const fileWriter = new FileWriter()
    const templateRenderer = new TemplateRenderer()
    const generator = new ProjectGenerator(fileWriter, templateRenderer)

    await generator.generate(config, plugins)

    // Create zip file in memory
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    // Add all files from the generated project
    archive.directory(outputPath, projectName)
    await archive.finalize()

    const zipBuffer = await archivePromise

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error)
    }

    // Return zip file as download
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    // Clean up temp directory on error
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {}
    }

    console.error('Failed to generate and download project:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate project',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
