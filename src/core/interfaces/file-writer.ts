/**
 * File writing interface
 * Abstracts filesystem operations for testing and future flexibility
 */
export interface IFileWriter {
  /**
   * Writes content to a file, creating directories if needed
   * @param filePath - Absolute path to the file
   * @param content - Content to write
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * Checks if a file exists
   * @param filePath - Absolute path to the file
   * @returns True if file exists
   */
  fileExists(filePath: string): Promise<boolean>;

  /**
   * Creates a directory recursively
   * @param dirPath - Absolute path to the directory
   */
  createDirectory(dirPath: string): Promise<void>;

  /**
   * Reads a file's content
   * @param filePath - Absolute path to the file
   * @returns File content as string
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Copies a file from source to destination
   * @param sourcePath - Absolute path to source file
   * @param destPath - Absolute path to destination file
   */
  copyFile(sourcePath: string, destPath: string): Promise<void>;

  /**
   * Makes a file executable (chmod +x)
   * @param filePath - Absolute path to the file
   */
  makeExecutable(filePath: string): Promise<void>;

  /**
   * Lists files in a directory
   * @param dirPath - Absolute path to the directory
   * @param recursive - Whether to list recursively
   * @returns Array of file paths
   */
  listFiles(dirPath: string, recursive?: boolean): Promise<string[]>;
}
