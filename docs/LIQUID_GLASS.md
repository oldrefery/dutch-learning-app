## Liquid Glass Components

New components implementing iOS 26-inspired Liquid Glass with theme awareness.

### Components

- `LiquidGlass`: primitive glass layer with blur, outline, and radius.
- `GlassCard`: preset for cards (padding, radius).
- `GlassModalContainer`: modal overlay with glass content.
- `GlassBottomSheetContainer`: sheet with handle and safe-area padding.
- `GlassHeaderBackground`: navigation header background with blur.

### Usage

```tsx
import { LiquidGlass } from '@/components/LiquidGlass'
import { GlassCard } from '@/components/glass/GlassCard'
import { GlassModalContainer } from '@/components/glass/GlassModalContainer'
import { GlassBottomSheetContainer } from '@/components/glass/GlassBottomSheetContainer'
import { GlassHeaderBackground } from '@/components/glass/GlassHeaderBackground'
import { useHeaderGlassProgress } from '@/hooks/useHeaderGlassProgress'

// Card
<GlassCard>
  <TextThemed>Title</TextThemed>
</GlassCard>

// Modal
<GlassModalContainer visible={visible} onRequestClose={close}>
  <TextThemed>Modal content</TextThemed>
</GlassModalContainer>

// Bottom Sheet
<GlassBottomSheetContainer>
  <TextThemed>Sheet content</TextThemed>
</GlassBottomSheetContainer>

// Header background with scroll-based intensity
const { progress, intensity } = useHeaderGlassProgress(scrollY, { endOffset: 64 })
// In screen options: headerTransparent: true, headerBackground: () => <GlassHeaderBackground intensity={intensity} />
```

### Tokens

See `src/constants/GlassConstants.ts` for enums and defaults:

- `LiquidGlassTint`, `LiquidGlassIntensityMode`, `LiquidGlassRadius`, `LiquidGlassElevation`.

### Notes

- Blur intensity adapts for light/dark automatically.
- Hairline outline subtly separates glass from background.
- Avoid nested blurs for performance.
