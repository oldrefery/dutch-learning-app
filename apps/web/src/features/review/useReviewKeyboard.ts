'use client'

import { useEffect } from 'react'
import type { ReviewAssessment } from './types'
import type { useReviewSession } from './useReviewSession'

export function useReviewKeyboard(
  session: ReturnType<typeof useReviewSession>,
  play: () => void
) {
  useEffect(() => {
    if (session.stage === 'setup') return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(
          'button, input, select, textarea, a, [contenteditable="true"]'
        )
      )
        return
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        if (session.historyEntry) session.returnToCurrent()
        else if (session.detailsVisible) session.closeDetails()
        else session.changeMode()
        return
      }
      if (key === 'p') {
        play()
        return
      }
      if (key === 'd') {
        session.openDetails()
        return
      }
      if (key === 'arrowleft') {
        session.goTo(-1)
        return
      }
      if (key === 'arrowright') {
        session.goTo(1)
        return
      }
      if (session.historyEntry || !session.flow?.active || session.correction)
        return
      if (!session.revealed && session.effectiveMode === 'recognition') {
        const option = session.recognitionOptions?.[Number(key) - 1]
        if (option) session.selectOption(option)
        return
      }
      if (key === ' ') {
        event.preventDefault()
        if (!session.revealed) session.setRevealed(true)
        else if (session.assessed) void session.submit('good')
        else {
          const rating = session.allowedAssessments.includes('good')
            ? 'good'
            : session.allowedAssessments[0]
          if (rating) void session.submit(rating)
        }
        return
      }
      const rating = (['again', 'hard', 'good', 'easy'] as ReviewAssessment[])[
        Number(key) - 1
      ]
      if (session.allowedAssessments.includes(rating))
        void session.submit(rating)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session, play])
}
