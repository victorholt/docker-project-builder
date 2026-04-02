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
      const trimmed = line.trim()

      // Skip empty lines, main header, and total line
      if (!trimmed || trimmed.includes('Available Services') || trimmed.startsWith('Total:')) {
        continue
      }

      // Category headers start with an emoji (non-ASCII) at the beginning of the line (no leading spaces)
      // e.g., "📱 Application Frameworks" or "🗄️  Databases"
      if (!line.startsWith(' ') && /[^\x00-\x7F]/.test(line)) {
        // Extract category name: strip emojis/special chars, trim whitespace
        const categoryName = trimmed.replace(/[^\w\s]/g, '').trim()
        if (categoryName) {
          currentCategory = categoryName.toLowerCase().replace(/\s+/g, '-')
          services[currentCategory] = []
        }
        continue
      }

      // Service lines start with spaces: "  api             Express.js API - 20-alpine"
      // Skip "Also:" lines
      if (line.startsWith('  ') && currentCategory && !trimmed.startsWith('Also:')) {
        const serviceMatch = trimmed.match(/^(\S+)\s+(.+?)(?:\s+-\s+\S+)?$/)
        if (serviceMatch) {
          const name = serviceMatch[1]
          const description = serviceMatch[2].replace(/\s+-\s+\S+$/, '').trim()
          services[currentCategory].push({
            name,
            category: currentCategory,
            description,
          })
        }
      }
    }

    // Filter out proxy (auto-included) and any empty categories
    delete services['proxy']
    for (const key of Object.keys(services)) {
      if (services[key].length === 0) delete services[key]
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
