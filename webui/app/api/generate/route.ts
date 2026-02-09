import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

interface GenerateRequest {
  projectName: string
  domain?: string
  services: string[]
  environments: string[]
}

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json()
    const { projectName, domain, services, environments } = body

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

    // Get output path
    const outputPath = path.join(process.cwd(), '..', `${projectName}-output`)

    // Check if project already exists
    try {
      await fs.access(outputPath)
      return NextResponse.json(
        { error: `Project ${projectName} already exists. Please choose a different name or delete the existing project.` },
        { status: 409 }
      )
    } catch {
      // Project doesn't exist, which is good
    }

    // Generate project using standalone script (avoids Node.js module caching issues)
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    const scriptPath = path.join(process.cwd(), 'generate-project.mjs')
    const servicesArg = services.join(',')
    const command = `node ${scriptPath} ${projectName} ${servicesArg}`

    console.log(`Executing: ${command}`)
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    })

    // Parse the JSON output from the script
    const lastLine = stdout.trim().split('\n').pop()
    const result = JSON.parse(lastLine!)

    if (!result.success) {
      throw new Error(result.error || 'Generation failed')
    }

    return NextResponse.json({
      success: true,
      message: 'Project generated successfully',
      projectName,
      outputPath,
      ports: result.ports || {},
      proxyPort: result.proxyPort || 8080,
      output: `✓ Project ${projectName} generated successfully at ${outputPath}`,
    })
  } catch (error) {
    console.error('Failed to generate project:', error)
    const errorDetails = error instanceof Error
      ? `${error.message}\n${error.stack}`
      : String(error)

    return NextResponse.json(
      {
        error: 'Failed to generate project',
        details: errorDetails,
      },
      { status: 500 }
    )
  }
}
