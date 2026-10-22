import { languageHref, locale, tr, type Locale } from '../i18n'

export default function LanguageSwitcher() {
  return <nav className="language-switcher" aria-label={tr('Язык сайта')}>
    {([['ru','RU','Русский'],['en','EN','English'],['zh','中文','简体中文']] as const).map(([language,label,name]) =>
      <a key={language} href={languageHref(language as Locale)} lang={language === 'zh' ? 'zh-Hans' : language} hrefLang={language === 'zh' ? 'zh-Hans' : language} aria-label={name} aria-current={locale === language ? 'true' : undefined}>{label}</a>
    )}
  </nav>
}
