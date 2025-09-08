# Centralized Constants System

## Overview

The Dutch Learning App uses a centralized constants system to eliminate magic numbers and ensure consistency across both the React Native application and Supabase Edge Functions.

## Architecture

### Single Source of Truth

- **Location**: `supabase/functions/_shared/constants.ts`
- **Purpose**: Contains ALL application constants
- **Accessibility**: Used by both React Native app and Edge Functions

### React Native Integration

- **Location**: `constants/AppConfig.ts`
- **Purpose**: Re-exports all constants from the shared file
- **Usage**: `import { IMAGE_CONFIG, TOUCH_CONFIG } from '@/constants/AppConfig'`

## Available Constants

### IMAGE_CONFIG

- `MOBILE_WIDTH` / `MOBILE_HEIGHT`: Optimized image dimensions for mobile (400x300)
- `SELECTOR_OPTIONS_COUNT`: Number of image options in selector (6)
- `DEFAULT_QUERY_COUNT`: Default count for multiple image queries (6)
- `UNSPLASH`: Unsplash API configuration (preferred size, orientation)
- `PICSUM_ID_RANGE`: Range for Lorem Picsum random IDs (1000)

### TOUCH_CONFIG

- `MAX_TAP_DURATION`: Maximum tap duration (300ms)
- `MAX_TAP_DISTANCE`: Maximum tap distance (10px)

### UI_CONFIG

- `CARD_MIN_HEIGHT`: Minimum review card height (500px)
- `ANIMATION_DURATION_*`: Various animation durations
- `TOAST_DURATION_*`: Toast notification durations

### SRS_CONFIG

- Spaced Repetition System default values
- Easiness factor bounds

### API_CONFIG

- `RATE_LIMIT_DELAY_MS`: Delay between API calls (200ms)

### SEARCH_CONFIG

- `MIN_CONTEXT_WORD_LENGTH`: Minimum word length for context (3)
- `STOP_WORDS`: Common words to filter from search queries

## Deployment Workflow

### Automatic Deployment Reminders

When constants are modified, the system automatically:

1. **Git Hook Detection**: Pre-commit hook detects changes to `constants.ts`
2. **User Notification**: Displays deployment reminder with specific commands
3. **Manual Deploy**: Developer runs appropriate NPM script

### NPM Scripts

```bash
# Deploy all Edge Functions
npm run deploy:constants

# Deploy specific functions
npm run deploy:gemini      # gemini-handler only
npm run deploy:images      # get-multiple-images only
npm run deploy:edge-functions  # All functions (no notification)
```

### Best Practices

#### ✅ DO

- Always use constants instead of magic numbers
- Run deployment after constants changes
- Add descriptive comments for new constants
- Group related constants together

#### ❌ DON'T

- Hardcode values in components or Edge Functions
- Forget to deploy after constants changes
- Duplicate constants across files
- Use inconsistent naming patterns

## Example Usage

### React Native Component

```typescript
import { TOUCH_CONFIG, UI_CONFIG } from '@/constants/AppConfig'

// In component
const isQuickTap =
  touchDuration < TOUCH_CONFIG.MAX_TAP_DURATION &&
  touchDistance < TOUCH_CONFIG.MAX_TAP_DISTANCE

const styles = StyleSheet.create({
  card: {
    minHeight: UI_CONFIG.CARD_MIN_HEIGHT,
  },
})
```

### Edge Function

```typescript
import { IMAGE_CONFIG, SEARCH_CONFIG } from '../_shared/constants.ts'

// In function
const imageUrl = `https://picsum.photos/${IMAGE_CONFIG.MOBILE_WIDTH}/${IMAGE_CONFIG.MOBILE_HEIGHT}`

const contextWords = words.filter(
  word =>
    word.length >= SEARCH_CONFIG.MIN_CONTEXT_WORD_LENGTH &&
    !SEARCH_CONFIG.STOP_WORDS.includes(word.toLowerCase())
)
```

## Troubleshooting

### Edge Functions Not Using New Constants

**Problem**: Edge Functions still use old constant values after changes
**Solution**: Redeploy Edge Functions using `npm run deploy:constants`

### Git Hook Not Working

**Problem**: No deployment reminder when committing constants changes
**Solution**: Ensure `.husky/check-constants` is executable (`chmod +x .husky/check-constants`)

### Import Errors in React Native

**Problem**: Cannot import constants in React Native components
**Solution**: Use `import { CONSTANT_NAME } from '@/constants/AppConfig'` format

## Future Enhancements

### CI/CD Integration

Consider adding automatic Edge Function deployment:

- GitHub Actions on constants file changes
- Webhook-triggered deployments
- Environment-specific constant management

### Validation

- Runtime constant validation
- Type safety for constant values
- Configuration schema validation
