# Code Complexity Analysis

## Overview

The Dutch Learning App uses **eslint-plugin-sonarjs** to monitor and control cognitive complexity, ensuring code remains readable and maintainable.

## Cognitive Complexity vs Cyclomatic Complexity

**Cognitive Complexity** measures how difficult code is to understand for humans:

- Focuses on mental overhead
- Penalizes nested conditions more heavily
- Better reflects real-world maintainability

**Our Thresholds (2025 standards):**

- Functions: **15** (warning level)
- Critical functions: **10** (strict mode)

## Current Analysis Results

### 🚨 Issues Found (as of latest scan):

1. **High Complexity**: `app/(tabs)/review.tsx:265`
   - **Current**: 16 complexity
   - **Threshold**: 15
   - **Action**: Refactor needed

2. **Duplicate String**: `app/(tabs)/index.tsx:213`
   - **Issue**: String duplicated 3 times
   - **Action**: Extract to constant

## NPM Scripts

```bash
# Standard complexity check
npm run complexity

# Strict mode (threshold 10)
npm run complexity:strict

# Generate JSON report
npm run complexity:report

# Quick summary
npm run complexity:summary
```

## Rules Configuration

### Active SonarJS Rules:

- ✅ `cognitive-complexity`: Max 15 (warning)
- ✅ `max-switch-cases`: Max 10 (error)
- ✅ `no-duplicate-string`: Detect 3+ duplicates
- ✅ `no-identical-functions`: Warn on duplicates
- ✅ `no-duplicated-branches`: Warn on same logic
- ✅ `no-redundant-boolean`: Simplify boolean logic
- ✅ `prefer-immediate-return`: Reduce variables
- ✅ `prefer-single-boolean-return`: Simplify returns

## Refactoring Strategies

### For High Cognitive Complexity:

#### ❌ Before (Complexity: 16)

```typescript
function complexFunction(data: any[]) {
  if (data) {
    // +1
    for (const item of data) {
      // +2 (nested)
      if (item.type === 'special') {
        // +3 (doubly nested)
        if (item.value > 10) {
          // +4 (triply nested)
          // complex logic
        } else {
          // +1
          // other logic
        }
      }
    }
  }
  return result
}
```

#### ✅ After (Complexity: 8)

```typescript
function processItems(data: any[]) {
  if (!data) return // Early return (+1)

  return data
    .filter(item => item.type === 'special') // +1
    .map(item => processSpecialItem(item)) // +1
}

function processSpecialItem(item: any) {
  // Separate function
  if (item.value > 10) {
    // +1
    return handleHighValue(item) // +1
  }
  return handleLowValue(item) // +1
}
```

### For Duplicate Strings:

#### ❌ Before

```typescript
const errorMsg = 'Something went wrong'
console.log('Something went wrong')
throw new Error('Something went wrong')
```

#### ✅ After

```typescript
const ERROR_MESSAGES = {
  GENERIC: 'Something went wrong',
} as const

const errorMsg = ERROR_MESSAGES.GENERIC
console.log(ERROR_MESSAGES.GENERIC)
throw new Error(ERROR_MESSAGES.GENERIC)
```

## Integration with Development Workflow

### Pre-commit Hooks

The complexity check runs automatically on commit via Husky.

### CI/CD Integration

```yaml
# Future GitHub Actions integration
- name: Code Complexity Check
  run: npm run complexity:strict
```

### VS Code Integration

Install the ESLint extension to see complexity warnings in real-time.

## Best Practices

### ✅ DO:

- Extract complex conditions into well-named functions
- Use early returns to reduce nesting
- Break large functions into smaller, focused ones
- Use array methods (map, filter, reduce) over loops
- Extract constants for repeated strings

### ❌ DON'T:

- Ignore complexity warnings
- Nest conditions more than 3 levels deep
- Write functions longer than 50 lines
- Use complex ternary operators
- Duplicate logic across functions

## Project-Specific Guidelines

### React Components:

- **Render methods**: Max complexity 10
- **Event handlers**: Max complexity 8
- **Effect hooks**: Max complexity 5

### Utility Functions:

- **Pure functions**: Max complexity 8
- **API handlers**: Max complexity 12
- **Validation logic**: Max complexity 10

### Edge Functions:

- **Supabase functions**: Max complexity 8
- **Single responsibility**: One main operation per function

## Monitoring and Reporting

### Weekly Review:

```bash
npm run complexity:report
# Review reports/complexity-report.json
```

### Complexity Trending:

Track complexity changes over time to prevent technical debt accumulation.

## Troubleshooting

### ESLint Plugin Issues:

```bash
# Check plugin version
npm list eslint-plugin-sonarjs

# Reinstall if needed
npm install --save-dev eslint-plugin-sonarjs@latest
```

### False Positives:

Use `// eslint-disable-next-line sonarjs/cognitive-complexity` sparingly and document why.

## Future Improvements

- [ ] Automated complexity trending reports
- [ ] Integration with code review tools
- [ ] Custom complexity rules for specific patterns
- [ ] Performance correlation analysis
