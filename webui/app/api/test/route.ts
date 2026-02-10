import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

interface TestRequest {
  projectName?: string
  services?: string[]
}

export async function POST(request: Request) {
  const testLogs: string[] = []
  const addLog = (message: string) => {
    console.log(message)
    testLogs.push(`[${new Date().toISOString()}] ${message}`)
  }

  try {
    const body: TestRequest = await request.json()
    const projectName = body.projectName || 'test-project'
    const services = body.services || ['nextjs', 'api', 'postgres']

    addLog('Starting test project generation...')

    // Get paths
    const dpbPath = path.join(process.cwd(), '..', 'dpb')
    const outputPath = path.join(process.cwd(), '..', `${projectName}-output`)

    // Remove existing test project if it exists
    try {
      await fs.access(outputPath)
      addLog(`Removing existing test project at ${outputPath}`)
      await fs.rm(outputPath, { recursive: true, force: true })
    } catch {
      // Project doesn't exist, which is fine
    }

    // Generate test project using the generate API
    addLog('Generating test project with services: ' + services.join(', '))

    // Import the generate handler
    const { POST: generateHandler } = await import('../generate/route')

    const generateRequest = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName,
        domain: `${projectName}.local`,
        services,
        environments: ['local'],
      }),
    })

    const generateResponse = await generateHandler(generateRequest)
    const generateData = await generateResponse.json()

    if (!generateResponse.ok) {
      throw new Error(generateData.error || 'Failed to generate project')
    }

    addLog('Project generation output:')
    if (generateData.output) {
      generateData.output.split('\n').forEach((line: string) => line && addLog(`  ${line}`))
    }
    addLog(`✓ Project generated at ${generateData.outputPath}`)

    // Build and start containers
    addLog('\nBuilding and starting Docker containers...')
    const cliPath = path.join(outputPath, 'cli')
    const upCommand = `cd ${outputPath} && ${cliPath} build && ${cliPath} up -d`

    addLog(`Executing: ${upCommand}`)
    const { stdout: upStdout, stderr: upStderr } = await execAsync(upCommand, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 180000, // 3 minutes timeout for build + up
    })

    addLog('Docker up output:')
    upStdout.split('\n').forEach(line => line && addLog(`  ${line}`))

    if (upStderr && !upStderr.includes('warning')) {
      addLog('Docker warnings/errors:')
      upStderr.split('\n').forEach(line => line && addLog(`  ${line}`))
    }

    // Wait for services to be ready
    addLog('\nWaiting for services to be ready (30 seconds)...')
    await new Promise(resolve => setTimeout(resolve, 30000))

    // Test endpoints
    addLog('\nTesting endpoints...')
    const testResults: Array<{ url: string; success: boolean; response?: string; error?: string }> = []

    // Determine which services were included and test them
    const testEndpoints: Array<{ name: string; url: string }> = []
    const ports = generateData.ports || {}

    if (services.includes('nextjs')) {
      const nextjsPort = ports.nextjs || 3000
      testEndpoints.push({ name: 'Next.js App', url: `http://localhost:${nextjsPort}` })
    }

    if (services.includes('api')) {
      const apiPort = ports.api || 4000
      testEndpoints.push({ name: 'Express API Health', url: `http://localhost:${apiPort}/health` })
      testEndpoints.push({ name: 'Express API Hello', url: `http://localhost:${apiPort}/api/hello` })
    }

    for (const endpoint of testEndpoints) {
      addLog(`Testing ${endpoint.name}: ${endpoint.url}`)
      try {
        const curlCommand = `curl -s -o /dev/null -w "%{http_code}" --max-time 10 ${endpoint.url}`
        const { stdout: curlStdout } = await execAsync(curlCommand)
        const statusCode = curlStdout.trim()

        if (statusCode === '200') {
          addLog(`  ✓ ${endpoint.name} responded with 200 OK`)
          testResults.push({ url: endpoint.url, success: true, response: statusCode })
        } else {
          addLog(`  ✗ ${endpoint.name} responded with ${statusCode}`)
          testResults.push({ url: endpoint.url, success: false, response: statusCode })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        addLog(`  ✗ ${endpoint.name} failed: ${errorMsg}`)
        testResults.push({ url: endpoint.url, success: false, error: errorMsg })
      }
    }

    // Get container status
    addLog('\nGetting container status...')
    const statusCommand = `cd ${outputPath} && ${cliPath} status`
    const { stdout: statusStdout } = await execAsync(statusCommand)
    addLog('Container status:')
    statusStdout.split('\n').forEach(line => line && addLog(`  ${line}`))

    // Summary
    const successCount = testResults.filter(r => r.success).length
    const totalTests = testResults.length

    addLog(`\n=== Test Summary ===`)
    addLog(`Project: ${projectName}`)
    addLog(`Services: ${services.join(', ')}`)
    addLog(`Tests: ${successCount}/${totalTests} passed`)
    addLog(`Output path: ${outputPath}`)

    return NextResponse.json({
      success: successCount === totalTests,
      projectName,
      outputPath,
      testResults,
      logs: testLogs.join('\n'),
      summary: {
        total: totalTests,
        passed: successCount,
        failed: totalTests - successCount,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    addLog(`\n❌ Test failed: ${errorMsg}`)

    return NextResponse.json(
      {
        success: false,
        error: 'Test execution failed',
        details: errorMsg,
        logs: testLogs.join('\n'),
      },
      { status: 500 }
    )
  }
}
