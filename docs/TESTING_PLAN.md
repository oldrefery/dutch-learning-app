# Testing Plan - Dutch Learning App

## Current Status

**Test Coverage:** 0% (No tests currently implemented)
**Priority:** 🔴 **HIGH** - Critical for production readiness

## Testing Strategy

### Phase 1: Unit Tests (5-7 days)

#### 1.1 Utility Functions (2 days)

**Priority:** High

- `src/utils/srs.ts` - SRS algorithm
  - Test `calculateNextReview()` with all difficulty levels
  - Test edge cases (first review, max interval, etc.)
  - Validate interval calculations

- `src/utils/logger.ts` - Logging utilities
  - Test log levels (debug, info, warning, error)
  - Verify development vs production behavior

- `src/utils/wordTextFormatter.ts` - Text formatting
  - Test all word type formatting
  - Verify fallback behavior

- `src/utils/validators.ts` - Input validation
  - Test email validation
  - Test password strength

**Estimated tests:** ~30-40 unit tests

#### 1.2 Services (2-3 days)

**Priority:** High

- `src/services/collectionSharingService.ts`
  - Test share code generation
  - Test import validation
  - Test duplicate detection

- `src/services/accessControlService.ts`
  - Test access level checks
  - Test permission validation

**Estimated tests:** ~20-25 unit tests

#### 1.3 Hooks (1-2 days)

**Priority:** Medium

- `src/hooks/useDebounce.ts`
- `src/hooks/useAudioPlayer.ts`
- `src/hooks/useReviewScreen.ts`

**Estimated tests:** ~15-20 unit tests

### Phase 2: Integration Tests (3-4 days)

#### 2.1 Supabase Integration

**Priority:** High

- Test database queries (mocked)
- Test RLS policy compliance
- Test Edge Function calls (mocked)

#### 2.2 State Management

**Priority:** Medium

- Test Zustand store actions
- Test state updates and side effects
- Test error handling in store

**Estimated tests:** ~25-30 integration tests

### Phase 3: Component Tests (4-5 days)

#### 3.1 Core Components

**Priority:** Medium

- `UniversalWordCard` - Word display
- `AddWordScreen` - Word addition flow
- `ReviewCard` - Review session UI
- `CollectionSelector` - Collection selection

#### 3.2 UI Components

**Priority:** Low

- Toast notifications
- Modals and dialogs
- Form inputs

**Estimated tests:** ~30-40 component tests

### Phase 4: E2E Tests (Optional - Future)

**Priority:** Low (post-MVP)

- Critical user flows
- Authentication flow
- Word addition flow
- Review session flow

## Testing Tools & Setup

### Required Dependencies

```bash
npm install --save-dev \
  @testing-library/react-native \
  @testing-library/jest-native \
  jest-expo \
  @types/jest
```

### Jest Configuration

Update `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ],
    "setupFilesAfterEnv": ["<rootDir>/jest-setup.ts"],
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/**/*.types.ts",
      "!src/**/*.styles.ts"
    ],
    "coverageThresholds": {
      "global": {
        "branches": 50,
        "functions": 50,
        "lines": 50,
        "statements": 50
      }
    }
  }
}
```

### Test File Structure

```
src/
├── utils/
│   ├── srs.ts
│   └── __tests__/
│       └── srs.test.ts
├── services/
│   ├── wordService.ts
│   └── __tests__/
│       └── wordService.test.ts
└── components/
    ├── WordCard.tsx
    └── __tests__/
        └── WordCard.test.tsx
```

## Coverage Goals

### Minimum Viable Coverage

- **Utilities:** 80% coverage
- **Services:** 70% coverage
- **Hooks:** 60% coverage
- **Components:** 50% coverage

### Target Coverage (Long-term)

- **Overall:** 70% coverage
- **Critical paths:** 90% coverage

## Test Examples

### Unit Test Example

```typescript
// src/utils/__tests__/srs.test.ts
import { calculateNextReview } from '../srs'

describe('calculateNextReview', () => {
  it('should calculate correct interval for "good" response', () => {
    const result = calculateNextReview({
      current_interval: 1,
      easiness_factor: 2.5,
      repetition_count: 1,
      quality: 3, // "good"
    })

    expect(result.interval).toBe(6)
    expect(result.easiness_factor).toBe(2.5)
  })

  it('should reset interval for "again" response', () => {
    const result = calculateNextReview({
      current_interval: 10,
      easiness_factor: 2.5,
      repetition_count: 5,
      quality: 0, // "again"
    })

    expect(result.interval).toBe(1)
    expect(result.repetition_count).toBe(0)
  })
})
```

### Component Test Example

```typescript
// src/components/__tests__/WordCard.test.tsx
import { render, screen } from '@testing-library/react-native'
import { WordCard } from '../WordCard'

describe('WordCard', () => {
  const mockWord = {
    word_id: '1',
    dutch_lemma: 'huis',
    part_of_speech: 'noun',
    article: 'het',
    translations: { en: ['house'], ru: ['дом'] }
  }

  it('should display word with article', () => {
    render(<WordCard word={mockWord} />)

    expect(screen.getByText('het huis')).toBeTruthy()
  })

  it('should display translations', () => {
    render(<WordCard word={mockWord} />)

    expect(screen.getByText(/house/)).toBeTruthy()
  })
})
```

## Implementation Timeline

**Week 1:** Setup + Unit tests (utils)
**Week 2:** Unit tests (services, hooks) + Integration tests
**Week 3:** Component tests + Coverage improvements

**Total Estimated Effort:** 12-16 days

## Success Criteria

- [ ] Jest configured and running
- [ ] Minimum 50% code coverage
- [ ] All critical paths tested
- [ ] CI/CD integration (optional)
- [ ] Test documentation complete

---

**Last Updated:** October 4, 2025
**Status:** Planning phase
