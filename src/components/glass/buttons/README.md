# Glass Button Components

HIG-compliant button components for the Liquid Glass design system.

## Overview

All button components now follow [Apple Human Interface Guidelines for Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons):

- ✅ **Minimum 44x44pt tap targets** for comfortable interaction
- ✅ **Clear visual states** (normal, pressed, disabled)
- ✅ **Tinted style** for secondary actions
- ✅ **Accessibility support** with proper labels and hints
- ✅ **Liquid Glass integration** with semi-transparent backgrounds

## Components

### GlassIconButton

Universal icon button component with three visual variants:

```tsx
import { GlassIconButton } from '@/components/glass/buttons'

// Tinted button (recommended for most actions)
<GlassIconButton
  icon="copy-outline"
  onPress={handleCopy}
  variant="tinted"
  size="medium"
  accessibilityLabel="Copy text"
/>

// Plain button (neutral actions)
<GlassIconButton
  icon="close"
  onPress={handleClose}
  variant="plain"
  size="medium"
  accessibilityLabel="Close"
/>

// Subtle button (minimal visual weight)
<GlassIconButton
  icon="settings-outline"
  onPress={handleSettings}
  variant="subtle"
  size="small"
  accessibilityLabel="Settings"
/>
```

### Props

```typescript
interface GlassIconButtonProps {
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap

  /** Button press handler */
  onPress: () => void

  /** Visual variant following HIG */
  variant?: 'tinted' | 'plain' | 'subtle'

  /** Button size affecting tap target and icon */
  size?: 'small' | 'medium' | 'large'

  /** Disabled state */
  disabled?: boolean

  /** Accessibility label (required for good UX) */
  accessibilityLabel: string

  /** Optional accessibility hint */
  accessibilityHint?: string

  /** Custom icon color override */
  iconColor?: string

  /** Custom icon size override */
  iconSize?: number
}
```

### Sizes

| Size     | Container | Icon | Tap Target | Use Case                           |
| -------- | --------- | ---- | ---------- | ---------------------------------- |
| `small`  | 36x36pt   | 18px | 36x36pt    | Compact layouts, secondary actions |
| `medium` | 44x44pt   | 22px | 44x44pt    | **Default**, most common use       |
| `large`  | 52x52pt   | 26px | 52x52pt    | Primary actions, prominent buttons |

### Variants

#### Tinted (Default)

- **Background**: Semi-transparent primary color
- **Border**: Subtle primary color
- **Icon**: Primary color
- **Use**: Audio, copy, refresh, most secondary actions

#### Plain

- **Background**: Semi-transparent white/gray
- **Border**: Subtle separator color
- **Icon**: Primary text color
- **Use**: Close, back, neutral actions

#### Subtle

- **Background**: Transparent
- **Border**: Minimal separator
- **Icon**: Secondary text color
- **Use**: Minimal visual weight, settings, info icons

## Updated Components

### CopyButton

Now uses `GlassIconButton` internally:

```tsx
import { CopyButton } from '@/components/CopyButton'
;<CopyButton
  text={textToCopy}
  variant="tinted"
  buttonSize="medium"
  showFeedback={true}
/>
```

### PronunciationButton

Updated for review cards:

```tsx
import { PronunciationButton } from '@/components/ReviewCard/PronunciationButton'
;<PronunciationButton
  ttsUrl={word.tts_url}
  isPlayingAudio={isPlaying}
  onPress={handlePlay}
  size="normal" // or "small"
/>
```

### AudioButton (HeaderSection)

Automatically uses `GlassIconButton` in word analysis:

```tsx
// Used internally in UniversalWordCard HeaderSection
// No manual implementation needed
```

## Visual States

All buttons have consistent visual feedback:

### Normal State

- Full opacity
- Scale: 1
- Colors as per variant

### Pressed State

- Opacity: 0.7
- Scale: 0.95
- Smooth transition (HIG compliant)

### Disabled State

- Background: Transparent gray
- Icon: Gray (#9CA3AF)
- No interaction

## Dark Mode Support

All variants automatically adapt to dark mode:

- **Tinted**: Uses `Colors.transparent.primary20` in dark mode
- **Plain**: Uses `Colors.transparent.white15` in dark mode
- **Subtle**: Transparent with subtle borders

## Accessibility

All buttons require:

- **accessibilityLabel**: Clear description of action
- **accessibilityHint** (optional): Additional context
- **accessibilityState**: Automatically includes disabled state

Example:

```tsx
<GlassIconButton
  icon="refresh"
  onPress={handleRefresh}
  accessibilityLabel="Force refresh"
  accessibilityHint="Fetches fresh analysis from AI instead of using cache"
/>
```

## Migration Guide

### Before (Old Style)

```tsx
// ❌ Old implementation
const tapGesture = Gesture.Tap()
  .onEnd(() => {
    'worklet'
    scheduleOnRN(handlePress)
  })

<GestureDetector gesture={tapGesture}>
  <View style={{ padding: 4 }}>
    <Ionicons name="copy-outline" size={18} color={color} />
  </View>
</GestureDetector>
```

### After (New Style)

```tsx
// ✅ New implementation
<GlassIconButton
  icon="copy-outline"
  onPress={handlePress}
  variant="tinted"
  size="medium"
  accessibilityLabel="Copy"
/>
```

## Best Practices

1. **Always provide accessibilityLabel** - Required for screen readers
2. **Use medium size by default** - Ensures 44x44pt tap target
3. **Prefer tinted variant** - Most versatile for secondary actions
4. **Group related buttons** - Use consistent variant and size
5. **Test with Reduce Motion** - Visual states work without animations

## References

- [Apple HIG - Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple HIG - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG - Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
