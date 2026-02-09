import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Get the path to dpb CLI (two levels up from webui/)
    const dpbPath = path.join(process.cwd(), '..', 'dpb')

    // Execute dpb list to get available services
    const { stdout, stderr } = await execAsync(`${dpbPath} list`)

    if (stderr) {
      console.error('dpb list stderr:', stderr)
    }

    // Parse the output to extract services by category
    const services: Record<string, Array<{ name: string; category: string; description: string }>> = {}

    const lines = stdout.split('\n')
    let currentCategory = ''

    for (const line of lines) {
      // Match category headers (e.g., "App Frameworks:")
      const categoryMatch = line.match(/^([A-Z][^:]+):/)
      if (categoryMatch) {
        currentCategory = categoryMatch[1].toLowerCase().replace(/\s+/g, '-')
        services[currentCategory] = []
        continue
      }

      // Match service lines (e.g., "  - nextjs: Next.js framework")
      const serviceMatch = line.match(/^\s+-\s+(\S+):\s+(.+)$/)
      if (serviceMatch && currentCategory) {
        services[currentCategory].push({
          name: serviceMatch[1],
          category: currentCategory,
          description: serviceMatch[2],
        })
      }
    }

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Failed to fetch services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available services', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
