export function formatWordTranslations(translations: {
  en: string[]
  ru: string[]
}) {
  return [translations.en.join(', '), translations.ru.join(', ')]
    .filter(Boolean)
    .join(' · ')
}
