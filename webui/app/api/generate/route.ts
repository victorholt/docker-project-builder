import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

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
  try {
    const body: GenerateRequest = await request.json()
    const { projectName, domains = {}, services, environments = ['local'] } = body

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

    // Resolve per-env domains, mirroring the CLI superRefine behaviour.
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

    const scriptPath = path.join(process.cwd(), 'generate-project.mjs')
    const servicesArg = services.join(',')
    const envArg = environments.join(',')
    const domainsArg = JSON.stringify(resolvedDomains)
    const command = `node ${scriptPath} ${projectName} ${servicesArg} '${domainsArg}' ${envArg}`

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
