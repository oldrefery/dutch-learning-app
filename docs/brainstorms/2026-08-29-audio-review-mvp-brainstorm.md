---
date: 2026-08-29
topic: audio-review-mvp
---

# Audio Review MVP

## What We're Building

Add a foreground-only Audio Review route for due words. It starts a standard
Meaning Recall SRS session, plays each Dutch prompt automatically, reveals the
translation on a single tap or visible button, and lets the user assess the
word with visible Again and Good actions. Double tap and a visible Replay
button repeat the Dutch pronunciation.

The route stops playback when it exits, unmounts, or the app leaves the active
state. It remains recoverable after an interruption through explicit Replay
and Resume controls. Every gesture has a labelled visible alternative.

## Why This Approach

The preferred approach is a separate route that reuses the existing review
store and the app-wide `expo-audio` player. Overloading the current visual
review screen would couple two different interaction models, while a separate
player or speech engine would create competing audio lifecycle ownership.

A fully voice-driven flow was rejected for the MVP because the app does not
have reviewed English speech output or speech recognition. The answer remains
visible and accessible; Dutch TTS is only used for Dutch pronunciation.

## Key Decisions

- Session semantics: Meaning Recall over all currently due words, using the
  existing SRS assessment actions and review-event tracking.
- Playback ownership: extend the existing single `AudioProvider`; never create
  an additional player for Audio Review.
- Reveal behavior: show the preferred translation, announce it for assistive
  technology, and replay the Dutch pronunciation.
- Gestures: memoized RNGH 2 builder gestures composed with
  `Gesture.Exclusive(doubleTap, singleTap)` and JS actions scheduled through
  `scheduleOnRN`.
- Assessments: expose Again and Good for low-attention use and guard each card
  against duplicate rapid submissions.
- Lifecycle: foreground-only runtime behavior with stop on exit, unmount, and
  inactive/background AppState.
- Scope: no background playback promise, lock-screen controls, automatic speech
  recognition, screen-dimming automation, or swipe assessment in this MVP.

## Open Questions

- Headphone, Bluetooth, and interruption behavior must be confirmed on real
  iOS and Android devices before the package is considered complete.

## Next Steps

Implement the route, audio session controller, entry point, tests, and Maestro
smoke flow described in WP2.1.
