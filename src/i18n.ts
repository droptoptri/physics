import messages from './translations.json'

export type Locale = 'ru' | 'en' | 'zh'
const requested = new URLSearchParams(window.location.search).get('lang')
export const locale: Locale = requested === 'en' || requested === 'zh' ? requested : 'ru'
export const localeTag = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN' }[locale]
const dictionary: Record<string, string[]> = messages

/** Russian source text is the stable key; user-entered content is never translated. */
export function tr(source: string): string {
  if (locale === 'ru') return source
  const pair = dictionary[source.trim()]
  if (!pair) return source
  const translated = pair[locale === 'en' ? 0 : 1]
  return `${source.match(/^\s*/)?.[0] || ''}${translated}${source.match(/\s*$/)?.[0] || ''}`
}
export function localizedError(message: string): string {
  return locale === 'ru' || dictionary[message.trim()] ? tr(message) : tr('Не удалось выполнить запрос. Попробуйте позже.')
}
export function languageHref(language: Locale): string {
  const url = new URL(window.location.href)
  if (language === 'ru') url.searchParams.delete('lang')
  else url.searchParams.set('lang', language)
  return `${url.pathname}${url.search}${url.hash}`
}
export function initializeLocale(page: string): void {
  document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale
  const title = page === '/cabinet' ? 'Кабинет партнёра — СГТ-КСК' : page === '/privacy' ? 'Политика обработки персональных данных' : page === '/consent' ? 'Согласие на обработку персональных данных' : 'СГТ-Холдинг — объединяя компетенции'
  document.title = tr(title)
  const description = tr('СГТ-Холдинг. Консорциум строительных компаний и геологическое направление. Объединяем компетенции для строительных, промышленных и инфраструктурных проектов.')
  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', tr(title))
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  document.querySelector('meta[property="og:locale"]')?.setAttribute('content', {ru:'ru_RU',en:'en_GB',zh:'zh_CN'}[locale])
  document.querySelectorAll('link[data-language-alternate]').forEach(el => el.remove())
  for (const language of ['ru','en','zh'] as const) {
    const link = document.createElement('link')
    link.rel = 'alternate'; link.hreflang = language === 'zh' ? 'zh-Hans' : language
    link.href = new URL(languageHref(language), window.location.origin).href.split('#')[0]
    link.dataset.languageAlternate = 'true'; document.head.append(link)
  }
}
