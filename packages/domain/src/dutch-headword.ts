const CALENDAR_NAMES = new Set([
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
  'zondag',
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
])

export const getHeadwordArticle = (lemma: string, article?: string | null) =>
  CALENDAR_NAMES.has(lemma.trim().toLocaleLowerCase('nl'))
    ? null
    : (article ?? null)

export const formatDutchHeadword = (lemma: string, article?: string | null) => {
  const displayedArticle = getHeadwordArticle(lemma, article)
  return displayedArticle ? `${displayedArticle} ${lemma}` : lemma
}
