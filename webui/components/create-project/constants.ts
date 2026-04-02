export const CATEGORY_LABELS: Record<string, string> = {
  app: 'APP',
  database: 'DATABASE',
  cache: 'CACHE',
  mail: 'MAIL',
}

export function getCategoryLabel(key: string): string {
  return CATEGORY_LABELS[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

export const DEFAULT_PORTS: Record<string, number> = {
  nextjs: 3000,
  api: 4000,
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  valkey: 6380,
  mailhog: 8025,
  mailpit: 8025,
}
