# Swipe Review Cards Enhancement Plan

## Overview

Implementation of Tinder-like swipe gestures for rating flashcards during review sessions, replacing swipe-based navigation between cards. This plan includes haptic feedback, visual feedback, and a dedicated info modal explaining the gesture system.

**Status:** Ready for Implementation
**Branch:** `feature/swipe-review-cards`

---

## 🎯 Key Features

- **Swipe-Based Rating:** Horizontal swipes trigger ratings (Again, Hard, Good, Easy)
- **Haptic Feedback:** Multi-threshold haptic events guide user through swipe zones
- **Visual Feedback:** Color overlays and text indicators show active rating zone
- **Info Modal:** Detailed instructions accessible via header info icon
- **Button Fallback:** Traditional buttons remain for accessibility
- **Smooth Animations:** Reanimated-powered card movements and snap animations

---

## 📊 Swipe Zones & Haptic Feedback

### Visual Layout

```
SWIPE RANGE & HAPTIC FEEDBACK:

┌─────────────────────────────────────────────────────────────┐
│                    FLASHCARD DISPLAY                        │
│                                                              │
│  Swipe LEFT                        Swipe RIGHT              │
│     ↙                                   ↘                   │
│                                                              │
│  ZONE 1: -50 to -100px               +50 to +100px         │
│  ├─ Rating: "Hard"                 Rating: "Good"          │
│  ├─ Color: Orange fade             Color: Green fade       │
│  ├─ Haptic: Light impact @-60px    Haptic: Light impact    │
│  └─ Text overlay: "💪 Hard"        Text overlay: "✓ Good"  │
│                                                              │
│  ZONE 2: < -100px                  > +100px                │
│  ├─ Rating: "Again"                Rating: "Easy"          │
│  ├─ Color: Red intense             Color: Bright green     │
│  ├─ Haptic: Medium+Warning         Haptic: Medium+Success  │
│  │           @-110px               @+110px                 │
│  └─ Text overlay: "↩️ Again"       Text overlay: "🎉 Easy" │
│                                                              │
│  CENTER ZONE: -49 to +49px                                 │
│  ├─ No color feedback                                      │
│  └─ No haptic (safe zone)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Haptic Events

```typescript
// Threshold crossing haptics
-60px: ImpactFeedbackStyle.Light (Hard zone entry)
-110px: ImpactFeedbackStyle.Medium + NotificationFeedback.Warning

+60px: ImpactFeedbackStyle.Light (Good zone entry)
+110px: ImpactFeedbackStyle.Medium + NotificationFeedback.Success

// On gesture release
- If < -100px: Heavy + Warning haptic (Again confirmed)
- If -50 to -100px: Light success (Hard confirmed)
- If +50 to +100px: Light success (Good confirmed)
- If > +100px: Heavy + Success haptic (Easy confirmed)
- If -49 to +49px: Light warning (gesture cancelled)
```

### Visual Feedback During Swipe

```
Card Movement:
├─ Card follows finger horizontally (Reanimated tracking)
├─ Opacity: 1.0 → 0.7 on threshold entry
├─ Scale: 1.0 → 0.98 (slight shrink effect)
└─ Snap animation on release

Color Zones:
├─ Hard zone (-100 to -50px): Orange (#FFA500)
├─ Again zone (< -100px): Red (#FF4444)
├─ Good zone (+50 to +100px): Green (#4CAF50)
└─ Easy zone (> +100px): Bright Green (#66BB6A)
```

---

## 🗂️ SwipeRating Info Modal

### Header & Modal Flow

```
HEADER:
┌────────────────────────────────────────────────────────────┐
│  ← Back          5 / 23 words           ℹ️ Settings         │
│                                                              │
│  (info icon at right, next to settings)                    │
└────────────────────────────────────────────────────────────┘

TAP INFO ICON ↓

MODAL (Full-screen or bottom-sheet):
┌────────────────────────────────────────────────────────────┐
│           HOW TO RATE WITH SWIPE                           │
│                                                              │
│  🎯 SWIPE LEFT                                             │
│  ├─ 50-100px: "Hard" - Review again soon                  │
│  └─ >100px: "Again" - Need to relearn                     │
│                                                              │
│  🎯 SWIPE RIGHT                                            │
│  ├─ 50-100px: "Good" - Correct and confident              │
│  └─ >100px: "Easy" - Too easy, increase interval          │
│                                                              │
│  💡 TIPS                                                    │
│  • Hold longer = stronger swipe zones                      │
│  • Buttons below are always available                      │
│  • Haptic feedback indicates zone entry                    │
│  • Tap card once to flip and see translations             │
│                                                              │
│  [Close]                                                   │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Phases

### Phase 1: Core Swipe Logic

- [ ] Create `useSwipeRating.ts` hook
  - Calculate swipe zones based on gesture translation
  - Determine rating value (Again, Hard, Good, Easy)
  - Manage haptic feedback timing
  - Handle snap-back and snap-away animations

- [ ] Create `SwipeRatingOverlay.tsx` component
  - Display rating text (hard/again/good/easy)
  - Show color overlay matching zone
  - Animate opacity based on swipe distance
  - Animate scale during swipe

### Phase 2: Gesture Handler Integration

- [ ] Update `src/app/(tabs)/review.tsx`
  - Remove swipe navigation logic (prev/next word)
  - Integrate new swipe rating logic
  - Wire up haptic feedback calls
  - Ensure button ratings still work (fallback)

- [ ] Update `src/hooks/useReviewScreen.ts`
  - Add swipeRating state management
  - Keep button rating methods for accessibility
  - Remove navigation methods (goToNextWord, goToPreviousWord)

### Phase 3: Haptic Feedback

- [ ] Install and configure `expo-haptics`
- [ ] Create haptic utility function
  - `triggerLightHaptic()`
  - `triggerMediumHaptic()`
  - `triggerSuccessHaptic()`
  - `triggerWarningHaptic()`
- [ ] Integrate haptic calls in useSwipeRating hook
- [ ] Test haptic timing and intensity

### Phase 4: UI Enhancements

- [ ] Create `SwipeRatingInfoModal.tsx`
  - Display detailed swipe instructions
  - Show visual examples of zones
  - Provide usage tips

- [ ] Update review screen header
  - Add info icon (ℹ️)
  - Wire icon to open SwipeRatingInfoModal
  - Keep word counter (x / xx)

### Phase 5: Animations & Polish

- [ ] Configure Reanimated animations
  - Card follow finger smoothly
  - Snap-away animation on successful swipe
  - Snap-back animation on cancelled swipe
  - Fade out animation when card completes

- [ ] Test timing and smoothness
- [ ] Adjust opacity/scale curves for visual feedback

### Phase 6: Navigation Cleanup

- [ ] Remove swipe navigation conditions
- [ ] Remove unused navigation methods
- [ ] Verify buttons still trigger next word correctly

### Phase 7: Auto-Refresh Collection

- [ ] Locate word collection screen
- [ ] Implement silent auto-refresh on screen focus
- [ ] Optional: periodic refresh (30s intervals)
- [ ] Add subtle loading indicator if needed

### Phase 8: Testing & QA

- [ ] Test swipe rating on iOS device
- [ ] Test swipe rating on Android device
- [ ] Verify haptic feedback at all thresholds
- [ ] Test rapid swipes and edge cases
- [ ] Test modal usability and readability
- [ ] Verify animation smoothness on different devices
- [ ] Cross-platform gesture consistency

---

## 📁 Files to Create/Modify

### New Files

```
src/
├── hooks/
│   └── useSwipeRating.ts                    [NEW]
├── components/
│   ├── ReviewCard/
│   │   └── SwipeRatingOverlay.tsx          [NEW]
│   └── modals/
│       └── SwipeRatingInfoModal.tsx        [NEW]
└── utils/
    └── hapticFeedback.ts                   [NEW - optional]
```

### Modified Files

```
src/
├── app/(tabs)/
│   └── review.tsx                          [MODIFY]
├── hooks/
│   └── useReviewScreen.ts                  [MODIFY]
├── components/
│   └── ReviewCard/
│       ├── CardFront.tsx                   [MODIFY - add overlay]
│       └── types.ts                        [MODIFY - add types]
└── constants/
    └── ReviewScreenConstants.ts            [MODIFY - add thresholds]
```

---

## 🎯 Priority Levels

| Phase | Task                | Priority |
| ----- | ------------------- | -------- |
| 1     | Core swipe logic    | HIGH     |
| 2     | Gesture integration | HIGH     |
| 3     | Haptic feedback     | HIGH     |
| 4     | Info modal & header | MEDIUM   |
| 5     | Animations          | MEDIUM   |
| 6     | Navigation cleanup  | HIGH     |
| 7     | Auto-refresh        | LOW      |
| 8     | Testing             | HIGH     |

---

## ✅ Success Criteria

- ✓ Swipe left/right correctly triggers ratings
- ✓ Haptic feedback fires at all thresholds
- ✓ Visual overlay shows rating during swipe
- ✓ Info modal clearly explains swipe zones
- ✓ Buttons still work as fallback
- ✓ No swipe navigation between cards
- ✓ Smooth animations on target devices
- ✓ Auto-refresh works on collection view

---

## 🔗 Related Documentation

- [Task Breakdown (Main Plan)](TASK_BREAKDOWN.md)
- [Review Screen Analysis](CODE_COMPLEXITY.md)
- [Constants System](CONSTANTS_SYSTEM.md)

---

_Last Updated: 2025-10-24_
_Branch: feature/swipe-review-cards_
