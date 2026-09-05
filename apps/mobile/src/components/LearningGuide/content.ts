import { ROUTES } from '@/constants/Routes'

export const LEARNING_GUIDE_VERSION = 1

export const shouldShowLearningGuideIntroduction = (
  versionSeen: number,
  currentVersion = LEARNING_GUIDE_VERSION
) => versionSeen < currentVersion

export type LearningGuideSectionId =
  | 'start-learning'
  | 'review-modes'
  | 'srs-ratings'
  | 'difficult-words'
  | 'audio-review'
  | 'usage-nuance'

export type LearningGuideActionRoute =
  | typeof ROUTES.TABS.ADD_WORD
  | typeof ROUTES.TABS.REVIEW
  | typeof ROUTES.INSIGHTS

export interface LearningGuideAction {
  label: string
  accessibilityHint: string
  route: LearningGuideActionRoute
}

export interface LearningGuideSection {
  id: LearningGuideSectionId
  title: string
  description: string
  bullets: readonly string[]
  action?: LearningGuideAction
}

export const LEARNING_GUIDE_SECTIONS: readonly LearningGuideSection[] = [
  {
    id: 'start-learning',
    title: 'Start Learning',
    description:
      'Build a personal vocabulary list, then review cards when they become due.',
    bullets: [
      'Add a Dutch word for AI-assisted analysis, or import Dutch A1 Essentials for a ready-made foundation.',
      'Review scheduling begins after a word is saved and keeps adapting to your ratings.',
    ],
    action: {
      label: 'Open Add Word',
      accessibilityHint: 'Opens Add Word without saving or importing anything',
      route: ROUTES.TABS.ADD_WORD,
    },
  },
  {
    id: 'review-modes',
    title: 'Review Modes',
    description:
      'Choose the kind of recall you want to practice for each session.',
    bullets: [
      'Recognition asks you to choose the correct meaning.',
      'Meaning Recall shows Dutch and asks you to remember the meaning.',
      'Dutch Production shows a translation and asks you to produce Dutch.',
      'Adaptive chooses a suitable mode for each word from your history.',
    ],
    action: {
      label: 'Open Review',
      accessibilityHint:
        'Opens review mode selection without starting a session',
      route: ROUTES.TABS.REVIEW,
    },
  },
  {
    id: 'srs-ratings',
    title: 'SRS Ratings',
    description:
      'Your rating controls when a card returns; it does not grade your worth or fluency.',
    bullets: [
      'Again means you did not recall it and need another attempt soon.',
      'Hard means recall was correct but effortful.',
      'Good means normal, confident recall.',
      'Easy means the card can wait substantially longer.',
    ],
  },
  {
    id: 'difficult-words',
    title: 'Difficult Words',
    description:
      'Insights highlights cards whose history suggests they need extra attention.',
    bullets: [
      'Difficulty is estimated from ratings, repetition history, and scheduling data.',
      'Difficult Review includes only difficult cards that are currently due.',
    ],
    action: {
      label: 'Open Insights',
      accessibilityHint: 'Opens review insights without changing card progress',
      route: ROUTES.INSIGHTS,
    },
  },
  {
    id: 'audio-review',
    title: 'Audio Review',
    description:
      'Listen and rate due words in a foreground-only review with visible controls.',
    bullets: [
      'Buttons are the primary controls; gestures are optional shortcuts.',
      'Leaving the screen exits safely, and playback does not continue on the lock screen.',
    ],
  },
  {
    id: 'usage-nuance',
    title: 'Usage & Nuance',
    description:
      'Examples and nuance notes are AI-generated guidance, not the source of review correctness.',
    bullets: [
      'Treat the guidance as optional context and check authoritative sources when precision matters.',
      'You can refresh an analysis when the explanation is incomplete or unclear.',
    ],
  },
]
