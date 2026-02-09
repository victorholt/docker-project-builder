/**
 * Template rendering interface
 * Abstracts template engine (Handlebars) for future flexibility
 */
export interface ITemplateRenderer {
  /**
   * Renders a template string with the provided context
   * @param template - The template string (Handlebars syntax)
   * @param context - Data object to pass to the template
   * @returns Rendered string
   */
  render(template: string, context: Record<string, unknown>): string;

  /**
   * Renders a template file with the provided context
   * @param templatePath - Absolute path to the template file
   * @param context - Data object to pass to the template
   * @returns Rendered string
   */
  renderFile(templatePath: string, context: Record<string, unknown>): Promise<string>;

  /**
   * Registers a custom helper function
   * @param name - Helper name (used in templates as {{helperName}})
   * @param fn - Helper function
   */
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;

  /**
   * Registers a partial template
   * @param name - Partial name (used in templates as {{> partialName}})
   * @param template - Partial template string
   */
  registerPartial(name: string, template: string): void;
}
