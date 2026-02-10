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
      // Skip empty lines and headers
      if (!line.trim() || line.includes('Available Services')) {
        continue
      }

      // Match category headers (e.g., "📱 Application Frameworks" or "🗄️  Databases")
      const categoryMatch = line.match(/^[^\w\s]*\s*([A-Z][^$]+)$/)
      if (categoryMatch && !line.includes('  ')) {
        currentCategory = categoryMatch[1].trim().toLowerCase().replace(/\s+/g, '-')
        services[currentCategory] = []
        continue
      }

      // Match service lines (e.g., "  api             Express.js API - 20-alpine")
      const serviceMatch = line.match(/^\s+(\S+)\s+(.+?)(?:\s+-\s+\S+)?$/)
      if (serviceMatch && currentCategory && !line.includes('Also:')) {
        const name = serviceMatch[1]
        const description = serviceMatch[2].replace(/\s+-\s+\S+$/, '').trim()
        services[currentCategory].push({
          name,
          category: currentCategory,
          description,
        })
      }
    }

    // Filter out proxy - it's always auto-included and configured separately
    delete services['proxy']

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Failed to fetch services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available services', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
