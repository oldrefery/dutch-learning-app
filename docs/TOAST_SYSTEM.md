# Toast Notification System

## Overview

This document describes the simplified toast notification system implemented in the Dutch Learning App. The system follows UX best practices and Apple Human Interface Guidelines for both light and dark themes.

## Design Principles

### 1. Minimalism (Less is More)

- **3 types only**: `SUCCESS`, `ERROR`, `INFO`
- **1 method**: `ToastService.show(message, type)`
- **No complex configurations** or specialized methods

### 2. UX Best Practices

- **Timing based on research**: Success (3s), Error (4s), Info (2.5s)
- **Non-intrusive**: Appears at top, doesn't block interaction
- **Accessible**: High contrast, readable fonts
- **Consistent**: Same behavior across the entire app

### 3. Apple HIG Compliance

- **Dynamic colors**: Automatically adapts to light/dark themes
- **System colors**: Uses Apple-recommended colors for status indication
- **Typography**: Follows iOS text sizing and weight guidelines

## Usage

### Basic Usage

```typescript
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'

// Success messages
ToastService.show('Word added successfully', ToastType.SUCCESS)
ToastService.show('Collection created', ToastType.SUCCESS)

// Error messages
ToastService.show('Failed to save word', ToastType.ERROR)
ToastService.show('Network connection failed', ToastType.ERROR)

// Informational messages
ToastService.show('No words available for review', ToastType.INFO)
ToastService.show('Feature coming soon', ToastType.INFO)
```

### Default Type

If no type is specified, `INFO` is used by default:

```typescript
ToastService.show('This is an info message') // Defaults to INFO
```

## Toast Types

### SUCCESS (`ToastType.SUCCESS`)

- **Purpose**: Positive feedback, successful operations
- **Color Light**: `#10B981` (Green)
- **Color Dark**: `#34D399` (Lighter Green)
- **Duration**: 3 seconds
- **Examples**: "Word added", "Settings saved", "Login successful"

### ERROR (`ToastType.ERROR`)

- **Purpose**: Error messages, failed operations
- **Color Light**: `#EF4444` (Red)
- **Color Dark**: `#FF453A` (Apple HIG Red)
- **Duration**: 4 seconds (longer for important error messages)
- **Examples**: "Failed to save", "Network error", "Validation failed"

### INFO (`ToastType.INFO`)

- **Purpose**: Neutral information, status updates
- **Color Light**: `#3B82F6` (Blue)
- **Color Dark**: `#409CFF` (Lighter Blue)
- **Duration**: 2.5 seconds
- **Examples**: "No items found", "Feature coming soon", "Session expired"

## Theme Support

The toast system automatically adapts to the current theme:

### Light Theme

- **Background**: White (`#FFFFFF`)
- **Text**: Dark gray (`#111827`)
- **Borders**: Status-specific colors

### Dark Theme

- **Background**: Dark elevated (`#48484A`)
- **Text**: Light gray (`#E5E5E7`)
- **Borders**: Lighter status colors for better contrast

## Migration Guide

### From Old System

The old system had 10+ methods and 43+ message types. Here's how to migrate:

```typescript
// OLD (Don't use)
ToastService.showWordAdded(word, collection)
ToastService.showError(ToastMessageType.ANALYSIS_FAILED, customMessage)
ToastService.showCollectionSuccess(CollectionOperation.CREATED, name)

// NEW (Use this)
ToastService.show(`"${word}" added to "${collection}"`, ToastType.SUCCESS)
ToastService.show(customMessage || 'Analysis failed', ToastType.ERROR)
ToastService.show(`Collection "${name}" created`, ToastType.SUCCESS)
```

### Common Patterns

| Old Pattern                            | New Pattern                                           |
| -------------------------------------- | ----------------------------------------------------- |
| `showWordAdded(word, collection)`      | `show('"${word}" added to "${collection}"', SUCCESS)` |
| `showError(ANALYSIS_FAILED)`           | `show('Analysis failed', ERROR)`                      |
| `showInfo(NO_WORDS_FOR_REVIEW)`        | `show('No words for review', INFO)`                   |
| `showCollectionSuccess(CREATED, name)` | `show('Collection "${name}" created', SUCCESS)`       |

## Implementation Details

### Configuration

Located in `/src/constants/ToastConstants.ts`:

```typescript
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
}

export const TOAST_CONFIG = {
  [ToastType.SUCCESS]: {
    type: 'success' as const,
    visibilityTime: 3000,
  },
  [ToastType.ERROR]: {
    type: 'error' as const,
    visibilityTime: 4000,
  },
  [ToastType.INFO]: {
    type: 'info' as const,
    visibilityTime: 2500,
  },
}
```

### Service Implementation

Located in `/src/components/AppToast.tsx`:

```typescript
export class ToastService {
  static show = (message: string, type: ToastType = ToastType.INFO) => {
    const config = TOAST_CONFIG[type]

    Toast.show({
      type: config.type,
      text1: message,
      visibilityTime: config.visibilityTime,
      position: 'top',
    })
  }
}
```

## Best Practices

### Message Writing

1. **Be concise**: Keep messages under 50 characters when possible
2. **Be specific**: "Failed to save word" vs "Error occurred"
3. **Use active voice**: "Word added" vs "Word has been added"
4. **Avoid technical jargon**: Use user-friendly language

### When to Use Each Type

- **SUCCESS**: User completes an action successfully
- **ERROR**: Something goes wrong that requires user attention
- **INFO**: Neutral information that doesn't require action

### When NOT to Use Toasts

- **Critical errors**: Use alerts/modals instead
- **Long messages**: Use dedicated error pages
- **During user input**: Don't interrupt form filling
- **Time-sensitive actions**: Use more prominent notifications

## Accessibility

- **High contrast**: All colors meet WCAG AA standards
- **Screen readers**: Messages are announced automatically
- **Keyboard navigation**: Doesn't interfere with keyboard focus
- **Motion sensitivity**: No complex animations

## Testing

### Manual Testing

1. Test in both light and dark themes
2. Verify colors match Apple HIG guidelines
3. Check timing feels appropriate
4. Ensure messages are readable

### Automated Testing

```typescript
// Example test
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'

test('should show success toast', () => {
  const spy = jest.spyOn(Toast, 'show')
  ToastService.show('Test message', ToastType.SUCCESS)

  expect(spy).toHaveBeenCalledWith({
    type: 'success',
    text1: 'Test message',
    visibilityTime: 3000,
    position: 'top',
  })
})
```

## Maintenance

### Adding New Types (Discouraged)

The system is intentionally minimal. Before adding new types:

1. **Question necessity**: Can this use existing types?
2. **Check UX research**: Is there evidence for this type?
3. **Consider Apple HIG**: Does Apple recommend this status?
4. **Update documentation**: Include reasoning and usage guidelines

### Modifying Existing Types

Changes should be rare and well-justified:

1. **Timing changes**: Based on user feedback or UX research
2. **Color changes**: Only for accessibility or brand compliance
3. **Breaking changes**: Require team approval and migration plan

## Future Considerations

### Potential Enhancements

- **Position options**: Bottom toasts for certain contexts
- **Action buttons**: For undo functionality (use sparingly)
- **Custom icons**: For better visual communication
- **Haptic feedback**: For important messages on iOS

### Anti-Patterns to Avoid

- **Multiple types for same status**: Don't add "light success" and "strong success"
- **UI-specific methods**: Don't add "showWordCardToast" or similar
- **Complex configuration**: Keep the API simple
- **Platform-specific types**: Maintain cross-platform consistency

---

**Remember**: The goal is simplicity and consistency. When in doubt, use the existing types and clear, concise messages.
