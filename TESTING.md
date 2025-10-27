# Testing Documentation - Dutch Learning App

## Overview

This document provides comprehensive guidance on testing practices and infrastructure for the Dutch Learning App. The project uses Jest with jest-expo preset for unit and integration testing, following industry best practices for React Native/Expo applications.

## Table of Contents

1. [Testing Infrastructure](#testing-infrastructure)
2. [Test Organization](#test-organization)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Testing Best Practices](#testing-best-practices)
6. [Test Coverage Summary](#test-coverage-summary)
7. [Troubleshooting](#troubleshooting)

## Testing Infrastructure

### Setup Files

**jest.config.js**

- Configuration for Jest test runner
- jest-expo preset for React Native support
- Module path aliases (@/ mapping)
- Coverage thresholds (50% global, 70-80% for critical modules)
- Transform and mock configurations

**jest.setup.ts**

- Global test setup and teardown
- Mock configurations for:
  - Expo modules (constants, secure-store, splash-screen, fonts, router)
  - React Native modules (MMKV, AsyncStorage, gesture-handler, reanimated, audio)
  - Third-party services (Sentry with integrations)
  - Supabase configuration
- Environment variables for testing
- Console warning suppression

### Key Dependencies

```json
{
  "jest": "^29.7.0",
  "jest-expo": "^49.0.0",
  "@testing-library/react-native": "^12.0.0",
  "react-test-renderer": "^18.2.0"
}
```

## Test Organization

### Directory Structure

```
src/
├── utils/__tests__/
│   ├── smoke.test.ts (3 tests)
│   ├── srs.test.ts (34 tests)
│   ├── dateUtils.test.ts (37 tests)
│   ├── streakUtils.test.ts (22 tests)
│   ├── retryUtils.test.ts (42 tests)
│   ├── wordTextFormatter.test.ts (35 tests)
│   └── collectionStats.test.ts (26 tests)
├── db/__tests__/
│   └── wordRepository.test.ts (16 tests)
├── services/__tests__/
│   └── syncManager.test.ts (15 tests)
└── components/__tests__/
    └── LiquidGlass.test.tsx (2 tests)
```

### Test File Naming Convention

- Test files use `.test.ts` or `.test.tsx` extension
- Located in `__tests__` directory adjacent to source code
- File names match the module being tested (e.g., `dateUtils.ts` → `dateUtils.test.ts`)

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests for a specific file
npm test -- src/utils/__tests__/srs.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should format"

# Run tests with coverage report
npm test -- --coverage

# Run tests once (CI mode, no watch)
npm test -- --no-watch --no-coverage --bail
```

### Watch Mode

Jest runs in watch mode by default. Press:

- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename pattern
- `t` - Filter by test name pattern
- `q` - Quit watch mode

### Pre-commit Integration

Tests automatically run via Husky pre-commit hook:

```bash
# In .husky/pre-commit
npm test -- --no-watch --no-coverage --bail
```

This ensures no broken tests are committed to the repository.

## Writing Tests

### Test Structure Template

```typescript
/**
 * Unit tests for module
 * Tests specific functionality
 */

import { functionUnderTest } from '../module'

describe('module', () => {
  describe('specific functionality', () => {
    it('should do something', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

### Helper Functions

Create helper functions for mock object generation to avoid hardcoded test data:

```typescript
const createMockWord = (overrides: Partial<Word> = {}): Word => ({
  word_id: 'word-1',
  user_id: 'user-1',
  // ... other fields
  ...overrides,
})

// Usage in tests
const word = createMockWord({ is_irregular: true })
```

### Mocking Strategy

#### Module Mocks

Place all `jest.mock()` calls at the top of the file, BEFORE imports:

```typescript
jest.mock('@/lib/supabase')
jest.mock('@/services/someService')

import { someFunction } from '../module'
```

#### React Native Mocks

```typescript
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Share: {
    share: jest.fn(),
  },
}))
```

#### Async Timers

For tests involving async delays or timeouts:

```typescript
describe('async operations', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should handle delays', async () => {
    const promise = delay(1000)
    jest.advanceTimersByTime(1000)
    await expect(promise).resolves.toBeUndefined()
  })
})
```

For Promise-based delays (like retry logic), use real timers:

```typescript
it('should retry with backoff', async () => {
  jest.useRealTimers()
  const result = await retryWithBackoff(fn)
  jest.useFakeTimers()
})
```

### Common Testing Patterns

#### Testing Calculated Values

```typescript
it('should calculate SRS interval correctly', () => {
  const result = calculateSRSInterval({
    previousInterval: 1,
    easinessFactor: 2.5,
    repetitionCount: 1,
  })

  expect(result).toBe(2) // 1 * 2.5 rounded
})
```

#### Testing Edge Cases

```typescript
describe('edge cases', () => {
  it('should handle empty input', () => {
    const result = functionUnderTest([])
    expect(result).toEqual({ empty: true })
  })

  it('should handle null values gracefully', () => {
    const result = functionUnderTest(null)
    expect(result).toBeDefined()
  })
})
```

#### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  const error = new Error('Network failed')
  ;(fetchFn as jest.Mock).mockRejectedValue(error)

  const result = await functionUnderTest()

  expect(result.success).toBe(false)
  expect(result.error).toBeDefined()
})
```

## Testing Best Practices

### Do's ✓

1. **Use Descriptive Test Names**

   ```typescript
   // Good
   it('should return empty array when collection has no words')

   // Bad
   it('works')
   ```

2. **Test Behavior, Not Implementation**

   ```typescript
   // Good - testing what the function does
   expect(result).toBe('expected value')

   // Bad - testing how it does it
   expect(mockFn).toHaveBeenCalledWith('specific args')
   ```

3. **Follow Arrange-Act-Assert Pattern**

   ```typescript
   it('should calculate correctly', () => {
     // Arrange - set up test data
     const input = createMockWord()

     // Act - execute the function
     const result = calculateStats([input])

     // Assert - verify the result
     expect(result.totalWords).toBe(1)
   })
   ```

4. **Use Meaningful Assertions**

   ```typescript
   expect(stats.progressPercentage).toBeGreaterThanOrEqual(0)
   expect(stats.progressPercentage).toBeLessThanOrEqual(100)
   ```

5. **Test Edge Cases and Boundaries**

   ```typescript
   it('should handle boundary case of repetition_count = 2')
   it('should handle boundary case of repetition_count = 3')
   ```

6. **Mock External Dependencies**

   ```typescript
   jest.mock('@/lib/supabase')
   jest.mock('@/utils/logger')
   ```

7. **Keep Tests Independent**
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks()
   })
   ```

### Don'ts ✗

1. **No Hardcoded Test Data (in most cases)**

   ```typescript
   // Bad - hardcoded data
   const userId = 'user-123'

   // Good - generate or use factory functions
   const userId = generateMockUserId()
   ```

2. **No test.only or test.skip in commits**
   - These will fail CI/CD pipelines

3. **No suppressing linter warnings**
   - Use `// @ts-expect-error` only when absolutely necessary
   - Never use `// @ts-ignore`

4. **No testing private implementation details**

   ```typescript
   // Bad
   expect(obj.privateField).toBe(5)

   // Good
   expect(publicMethod()).toBe(5)
   ```

5. **No excessive mocking**
   - Mock external services, not your own functions
   - Test integrations with real implementations when possible

6. **No flaky tests**
   - Avoid tests that depend on timing or external state
   - Use fake timers for time-dependent tests

### Code Quality Standards

1. **TypeScript Strict Mode**
   - All test files use strict TypeScript
   - No `any` types - use specific types or `unknown`
   - Proper type checking for mocked functions

2. **Comments**
   - Use English comments only
   - Explain "why", not "what"
   - File headers with JSDoc comments

3. **No Console Spam**
   - Tests should run quietly
   - Expected errors are suppressed in jest.setup.ts
   - Use appropriate log levels for debugging

## Test Coverage Summary

### Current Test Suite Statistics

| Test File                 | Test Count | Status | Purpose                              |
| ------------------------- | ---------- | ------ | ------------------------------------ |
| smoke.test.ts             | 3          | ✓ PASS | Jest setup verification              |
| srs.test.ts               | 34         | ✓ PASS | Spaced Repetition System algorithm   |
| dateUtils.test.ts         | 37         | ✓ PASS | Relative time formatting             |
| streakUtils.test.ts       | 22         | ✓ PASS | Study streak calculation             |
| retryUtils.test.ts        | 42         | ✓ PASS | Retry logic with exponential backoff |
| wordTextFormatter.test.ts | 35         | ✓ PASS | Word formatting for sharing          |
| collectionStats.test.ts   | 26         | ✓ PASS | Collection statistics calculation    |
| wordRepository.test.ts    | 16         | ✓ PASS | Database word operations             |
| syncManager.test.ts       | 15         | ✓ PASS | Offline-first sync orchestration     |
| LiquidGlass.test.tsx      | 2          | ✓ PASS | Glass effect component               |
| **TOTAL**                 | **232**    | ✓ PASS | Complete test suite                  |

### Coverage Targets

- **Global minimum**: 50%
- **Critical modules**: 70-80%
- **Current focus areas**:
  - Core business logic (SRS, sync, storage)
  - Utility functions (formatters, calculators)
  - Error handling and edge cases

### Areas with Strong Coverage

1. **Spaced Repetition Algorithm**
   - Initial state calculations
   - Interval calculations for different assessments
   - Easiness factor bounds
   - Edge cases and practical scenarios

2. **Data Utilities**
   - Date/time formatting and relative time
   - Streak calculation logic
   - Collection statistics
   - Text formatting for different word types

3. **Network & Sync**
   - Retry logic with exponential backoff
   - Error classification
   - Concurrent sync prevention
   - Offline-first behavior

### Areas for Future Coverage

1. **Component Tests**
   - Review screens and components
   - Input forms and validations
   - Navigation and routing

2. **Hook Tests**
   - useReviewSession
   - useCollections
   - Custom store hooks

3. **Store Tests**
   - Zustand store actions
   - State management
   - Persistence layer

4. **E2E Tests (Phase 4)**
   - Complete user workflows
   - Maestro framework integration
   - Real app interactions

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Cannot find module '@/...'"

**Cause**: Path alias not configured correctly

**Solution**:

```javascript
// In jest.config.js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

#### Issue: "Mock module is not exported"

**Cause**: Mock placed after imports or incorrect export

**Solution**:

```typescript
// CORRECT - mocks before imports
jest.mock('@/lib/supabase')

import { someFunction } from '../module'
```

#### Issue: "Timeout exceeded in async test"

**Cause**: Fake timers conflict with Promises, or actual slow operations

**Solution**:

```typescript
// Use real timers for Promise-based async
beforeEach(() => {
  jest.useRealTimers()
})

// Or increase timeout
jest.setTimeout(10000)
```

#### Issue: "Watchman warning: Recrawled this watch N times"

**Cause**: Too many file changes triggering watchman

**Solution**:

```bash
watchman watch-del '/path/to/project'
watchman watch-project '/path/to/project'
```

#### Issue: Tests pass locally but fail in CI

**Cause**: Date/time differences, environment variables, or native module issues

**Solution**:

1. Check environment variables in jest.setup.ts
2. Use consistent dates in tests (not Date.now())
3. Mock native modules properly

### Debug Commands

```bash
# Run single test file
npm test -- src/utils/__tests__/srs.test.ts --no-coverage

# Run tests matching pattern
npm test -- --testNamePattern="SRS" --verbose

# Run with debugging output
node --inspect-brk node_modules/.bin/jest --runInBand

# Clear cache and rerun
npm test -- --clearCache
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://testing-library.com/docs/react-native-testing-library/intro/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest Expo Preset](https://docs.expo.dev/develop/unit-tests/)

## Contributing Tests

When adding new features:

1. Write tests FIRST (TDD approach recommended)
2. Follow existing patterns and conventions
3. Ensure 70%+ coverage for critical code
4. Run full test suite before committing
5. Update this documentation if adding new patterns

## Questions or Issues?

Refer to the project's CLAUDE.md file for contribution guidelines and coding standards.
