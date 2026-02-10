import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import archiver from 'archiver'

const execAsync = promisify(exec)

interface GenerateRequest {
  projectName: string
  domain?: string
  services: string[]
  environments: string[]
  ports?: Record<string, number>
}

export async function POST(request: Request) {
  let outputPath: string | null = null

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

    // Use generate-project.mjs as a separate process to avoid
    // plugin discovery issues inside the Next.js runtime
    const scriptPath = path.join(process.cwd(), 'generate-project.mjs')
    const servicesArg = services.join(',')
    const envArg = environments.join(',')
    const portsArg = JSON.stringify(ports)
    const domainArg = domain || `${projectName}.local`

    const command = `node ${scriptPath} ${projectName} ${servicesArg} ${domainArg} ${envArg} '${portsArg}'`

    console.log(`Executing: ${command}`)
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    })

    if (stderr) {
      console.warn('Generation warnings:', stderr)
    }

    // Parse the JSON output from the script
    const lastLine = stdout.trim().split('\n').pop()
    const result = JSON.parse(lastLine!)

    if (!result.success) {
      throw new Error(result.error || 'Generation failed')
    }

    outputPath = result.outputPath

    // Create zip file in memory
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    // Add all files from the generated project
    archive.directory(outputPath!, projectName)
    await archive.finalize()

    const zipBuffer = await archivePromise

    // Clean up generated project directory
    try {
      await fs.rm(outputPath!, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to cleanup output directory:', error)
    }

    // Return zip file as download
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    // Clean up on error
    if (outputPath) {
      try {
        await fs.rm(outputPath, { recursive: true, force: true })
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
