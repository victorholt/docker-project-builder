import Handlebars from 'handlebars';
import { promises as fs } from 'fs';
import type { ITemplateRenderer } from '../interfaces/template-renderer.js';

/**
 * Handlebars implementation of ITemplateRenderer
 */
export class TemplateRenderer implements ITemplateRenderer {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerDefaultHelpers();
  }

  /**
   * Renders a template string with the provided context
   */
  render(template: string, context: Record<string, unknown>): string {
    const compiled = this.handlebars.compile(template);
    return compiled(context);
  }

  /**
   * Renders a template file with the provided context
   */
  async renderFile(templatePath: string, context: Record<string, unknown>): Promise<string> {
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    return this.render(templateContent, context);
  }

  /**
   * Registers a custom helper function
   */
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
    this.handlebars.registerHelper(name, fn);
  }

  /**
   * Registers a partial template
   */
  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
  }

  /**
   * Registers default Handlebars helpers
   */
  private registerDefaultHelpers(): void {
    // Helper: Convert string to uppercase
    this.registerHelper('uppercase', ((...args: unknown[]) => {
      const str = args[0] as string;
      return str?.toUpperCase() || '';
    }));

    // Helper: Convert string to lowercase
    this.registerHelper('lowercase', ((...args: unknown[]) => {
      const str = args[0] as string;
      return str?.toLowerCase() || '';
    }));

    // Helper: Convert kebab-case to snake_case
    this.registerHelper('snakecase', ((...args: unknown[]) => {
      const str = args[0] as string;
      return str?.replace(/-/g, '_') || '';
    }));

    // Helper: Convert kebab-case to camelCase
    this.registerHelper('camelcase', ((...args: unknown[]) => {
      const str = args[0] as string;
      return str?.replace(/-([a-z])/g, (g) => g[1]?.toUpperCase() || '') || '';
    }));

    // Helper: Convert kebab-case to PascalCase
    this.registerHelper('pascalcase', ((...args: unknown[]) => {
      const str = args[0] as string;
      const camel = str?.replace(/-([a-z])/g, (g) => g[1]?.toUpperCase() || '') || '';
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    }));

    // Helper: Check if value equals another value
    this.registerHelper('eq', ((...args: unknown[]) => {
      return args[0] === args[1];
    }));

    // Helper: Check if value is in array
    this.registerHelper('includes', ((...args: unknown[]) => {
      const array = args[0];
      const value = args[1];
      return Array.isArray(array) && array.includes(value);
    }));

    // Helper: JSON stringify with formatting
    this.registerHelper('json', ((...args: unknown[]) => {
      return JSON.stringify(args[0], null, 2);
    }));

    // Helper: Indent text block by N spaces
    this.registerHelper('indent', ((...args: unknown[]) => {
      const text = args[0] as string;
      const spaces = args[1] as number;
      const indent = ' '.repeat(spaces || 0);
      return text?.split('\n').map((line) => indent + line).join('\n') || '';
    }));

    // Helper: Conditional block for environment
    this.registerHelper('ifEnv', (function(this: unknown, ...args: unknown[]) {
      const env = args[0] as string;
      const options = args[args.length - 1] as Handlebars.HelperOptions;
      const currentEnv = (options.data?.root as Record<string, unknown>)?.environment;
      if (currentEnv === env) {
        return options.fn(this);
      }
      return options.inverse(this);
    }));

    // Helper: Format number with leading zeros
    this.registerHelper('padNumber', ((...args: unknown[]) => {
      const num = args[0] as number;
      const width = args[1] as number;
      return String(num).padStart(width || 2, '0');
    }));
  }
}
