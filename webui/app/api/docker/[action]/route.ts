import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

interface DockerActionParams {
  params: Promise<{ action: string }>
}

export async function POST(request: Request, context: DockerActionParams) {
  try {
    const { action } = await context.params
    const body = await request.json()
    const { projectName, service } = body

    if (!projectName) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    // Get the project path
    const projectPath = path.join(process.cwd(), '..', `${projectName}-output`)
    const cliPath = path.join(projectPath, projectName)

    // Build the command based on action
    let command: string

    switch (action) {
      case 'up':
        command = `cd ${projectPath} && ${cliPath} up`
        break
      case 'down':
        command = `cd ${projectPath} && ${cliPath} down`
        break
      case 'restart':
        command = `cd ${projectPath} && ${cliPath} restart ${service || ''}`
        break
      case 'logs':
        const follow = body.follow ? '-f' : ''
        const lines = body.lines || 100
        command = `cd ${projectPath} && ${cliPath} logs ${follow} --tail=${lines} ${service || ''}`
        break
      case 'status':
        command = `cd ${projectPath} && ${cliPath} status`
        break
      case 'build':
        command = `cd ${projectPath} && ${cliPath} build ${service || ''}`
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    console.log('Executing docker command:', command)

    // Execute the command
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: action === 'logs' ? 5000 : 60000, // 5s for logs, 60s for others
    })

    return NextResponse.json({
      success: true,
      output: stdout,
      error: stderr || undefined,
    })
  } catch (error) {
    console.error(`Failed to execute docker ${(await context.params).action}:`, error)
    return NextResponse.json(
      {
        error: `Failed to execute docker action`,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
