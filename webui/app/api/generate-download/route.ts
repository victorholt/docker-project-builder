import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import archiver from 'archiver'

const execAsync = promisify(exec)

type Environment = 'local' | 'staging' | 'prod'

interface DomainsConfig {
  local?: string
  staging?: string
  prod?: string
}

interface GenerateRequest {
  projectName: string
  /** One domain per selected environment — matches core ProjectConfig.domains. */
  domains?: DomainsConfig
  services: string[]
  environments: Environment[]
  ports?: Record<string, number>
}

/** Shared with core/models/project-config.ts DOMAIN_REGEX. */
const DOMAIN_REGEX = /^[a-z0-9.-]+$/

function defaultDomainFor(env: Environment, projectName: string): string {
  switch (env) {
    case 'local':
      return `${projectName}.test`
    case 'staging':
      return `staging-${projectName}.com`
    case 'prod':
      return `${projectName}.com`
  }
}

export async function POST(request: Request) {
  let outputPath: string | null = null

  try {
    const body: GenerateRequest = await request.json()
    const { projectName, domains = {}, services, environments, ports = {} } = body

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

    if (!environments || environments.length === 0) {
      return NextResponse.json(
        { error: 'At least one environment must be selected' },
        { status: 400 }
      )
    }

    // Mirror the core Zod superRefine: every selected env needs a non-empty,
    // well-formed domain. Fill in smart defaults for any missing entries, then
    // validate the final shape.
    const resolvedDomains: DomainsConfig = {}
    const domainErrors: string[] = []
    for (const env of environments) {
      const value = (domains[env] ?? defaultDomainFor(env, projectName)).trim()
      if (!value) {
        domainErrors.push(`Domain for '${env}' is required`)
        continue
      }
      if (!DOMAIN_REGEX.test(value)) {
        domainErrors.push(`Domain for '${env}' is not a valid domain name`)
        continue
      }
      resolvedDomains[env] = value
    }
    if (domainErrors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid domains', details: domainErrors.join('; ') },
        { status: 400 }
      )
    }

    // Use generate-project.mjs as a separate process to avoid
    // plugin discovery issues inside the Next.js runtime
    const scriptPath = path.join(process.cwd(), 'generate-project.mjs')
    const servicesArg = services.join(',')
    const envArg = environments.join(',')
    const portsArg = JSON.stringify(ports)
    // Pass per-env domains as a JSON string; generate-project.mjs parses it.
    const domainsArg = JSON.stringify(resolvedDomains)

    const command = `node ${scriptPath} ${projectName} ${servicesArg} '${domainsArg}' ${envArg} '${portsArg}'`

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
