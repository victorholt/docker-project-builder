import { promises as fs } from 'fs';
import { dirname } from 'path';
import type { IFileWriter } from '../interfaces/file-writer.js';

/**
 * Filesystem implementation of IFileWriter
 */
export class FileWriter implements IFileWriter {
  /**
   * Writes content to a file, creating directories if needed
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    // Ensure parent directory exists
    await this.createDirectory(dirname(filePath));

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Checks if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates a directory recursively
   */
  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Reads a file's content
   */
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  /**
   * Copies a file from source to destination
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    // Ensure destination directory exists
    await this.createDirectory(dirname(destPath));

    // Copy the file
    await fs.copyFile(sourcePath, destPath);
  }

  /**
   * Makes a file executable (chmod +x)
   */
  async makeExecutable(filePath: string): Promise<void> {
    // chmod 755 (rwxr-xr-x)
    await fs.chmod(filePath, 0o755);
  }

  /**
   * Lists files in a directory
   */
  async listFiles(dirPath: string, recursive: boolean = false): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;

      if (entry.isDirectory()) {
        if (recursive) {
          const subFiles = await this.listFiles(fullPath, true);
          files.push(...subFiles);
        }
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}
