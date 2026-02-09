import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

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

    // Get paths
    const dpbPath = path.join(process.cwd(), '..', 'dpb')
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

    // Build the command
    const finalDomain = domain || `${projectName}.local`
    const envArgs = environments.map(e => `-e ${e}`).join(' ')
    const serviceArgs = services.map(s => `-s ${s}`).join(' ')

    const command = `${dpbPath} create -n ${projectName} -d ${finalDomain} ${envArgs} ${serviceArgs} -o ${outputPath} -y`

    console.log('Executing command:', command)

    // Execute the dpb create command
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    })

    if (stderr && !stderr.includes('warning')) {
      console.error('dpb create stderr:', stderr)
    }

    console.log('dpb create stdout:', stdout)

    return NextResponse.json({
      success: true,
      message: 'Project generated successfully',
      projectName,
      outputPath,
      output: stdout,
    })
  } catch (error) {
    console.error('Failed to generate project:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate project',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
