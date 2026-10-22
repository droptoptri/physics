import { locale } from './i18n'
export const isPreview = import.meta.env.VITE_SITE_PREVIEW === 'true'

export function sitePath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  const resolved = `${import.meta.env.BASE_URL}${path.slice(1)}`
  if (locale !== 'ru' && /^\/(?:cabinet|privacy|consent|geo|ksk)?\/?$/.test(path)) return `${resolved}?lang=${locale}`
  return resolved
}

export function currentPage(): string {
  const base = import.meta.env.BASE_URL
  const pathname = window.location.pathname
  const relative = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname
  return relative.replace(/\/+$/, '') || '/'
}
