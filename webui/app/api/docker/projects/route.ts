import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  try {
    // List all *-output directories in the parent folder
    const parentDir = path.join(process.cwd(), '..')
    const entries = await fs.readdir(parentDir, { withFileTypes: true })

    const projects = entries
      .filter((entry) => entry.isDirectory() && entry.name.endsWith('-output'))
      .map((entry) => ({
        name: entry.name.replace('-output', ''),
        path: path.join(parentDir, entry.name),
      }))

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Failed to list projects:', error)
    return NextResponse.json(
      { error: 'Failed to list projects', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
