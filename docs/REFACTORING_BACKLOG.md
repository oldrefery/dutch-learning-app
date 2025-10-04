# Refactoring Backlog

This document tracks technical debt and refactoring opportunities to improve code maintainability and architecture.

## File Length Optimization

### High Priority

#### 📄 `src/app/(tabs)/settings.tsx` (261 lines)

**Status**: 📝 Pending
**Target**: < 250 lines
**Suggested approach**:

- Extract logic into `src/hooks/useSettings.ts`
- Create separate components:
  - `AccountSection.tsx`
  - `PreferencesSection.tsx`
  - `DangerZoneSection.tsx`
- Move constants to `src/constants/SettingsConstants.ts`

**Estimated effort**: 2-3 hours

#### 📄 `src/app/collection/[id].tsx` (257 lines)

**Status**: 📝 Pending
**Target**: < 250 lines
**Suggested approach**:

- Extract logic into `src/hooks/useCollectionDetails.ts`
- Create separate components:
  - `CollectionHeader.tsx`
  - `WordsList.tsx`
  - `CollectionActions.tsx`
- Move styles to separate file

**Estimated effort**: 2-3 hours

## Future Refactoring Opportunities

### Component Architecture

#### High Priority

📄 **`src/lib/supabase.ts` (695 lines) - CRITICAL**
**Status**: 📝 Pending
**Target**: < 250 lines per file
**Suggested approach**:

- Split into separate service files:
  - `src/services/wordService.ts`
  - `src/services/collectionService.ts`
  - `src/services/reviewService.ts`
  - `src/services/authService.ts`
- Keep only client initialization in `supabase.ts`
  **Estimated effort**: 4-6 hours

#### Medium Priority

- **SwipeableWordItem.tsx** (502 lines): Extract gesture logic to custom hook
- **collectionActions.ts** (493 lines): Split by responsibility (CRUD, sharing, etc.)
- **SwipeableCollectionCard.tsx** (456 lines): Extract swipe handlers and UI components
- **Large hook files**: Review hooks > 200 lines for potential splitting
- **Complex components**: Identify components with multiple responsibilities
- **Repeated patterns**: Extract common UI patterns into reusable components

#### Low Priority

- **Style consolidation**: Merge similar StyleSheet objects
- **Constant extraction**: Move hardcoded values to constants
- **Type definitions**: Extract large type definitions to separate files

## Cognitive Complexity Issues

### Files Exceeding Threshold (15)

1. **`src/app/(tabs)/settings.tsx`** - Complexity: **23**
   - Refactor into smaller functions
   - Extract logic to `useSettings.ts` hook
   - Priority: Medium (already in refactoring plan)

2. **`src/components/AddWordScreen/hooks/useWordAnalysis.ts`** - Complexity: **17**
   - Split analysis logic into smaller functions
   - Consider state machine pattern
   - Priority: Medium

3. **`src/types/ErrorTypes.ts`** - Complexity: **18**
   - Simplify error categorization logic
   - Use lookup tables instead of nested conditionals
   - Priority: Low

## Best Practices Compliance

### Naming Conventions

- ✅ Components use PascalCase
- ✅ Hooks use camelCase with 'use' prefix
- ✅ Constants use UPPER_SNAKE_CASE

### File Organization

- ✅ Components have corresponding .types.ts files when needed
- ✅ Styles are co-located or in separate .styles.ts files
- ⚠️ Some large files need splitting (see above)

### Architecture Patterns

- ✅ Custom hooks for logic separation
- ✅ TypeScript for type safety
- ✅ Centralized state management
- ⚠️ Some components mix UI and business logic

## Tracking

### Completed ✅

- Toast system simplification (2024-01-XX)
- Color constants consolidation (2024-01-XX)

### In Progress 🟡

- None currently

### Planned 📝

- Settings component refactoring
- Collection details component refactoring

## Guidelines

### When to Refactor

- **File exceeds 250 lines**: Consider splitting
- **Function exceeds 50 lines**: Consider breaking down
- **Component has > 3 responsibilities**: Split into smaller components
- **Repeated code appears > 3 times**: Extract into utility/component

### When NOT to Refactor

- **Code works well and is readable**: Don't fix what isn't broken
- **Under time pressure**: Technical debt can be addressed later
- **No clear improvement**: Refactoring should add value

### Refactoring Process

1. **Identify**: File analysis, lint warnings, code review feedback
2. **Plan**: Document approach and estimate effort
3. **Execute**: Create branch, implement changes, test thoroughly
4. **Review**: Ensure improvement in maintainability
5. **Update**: Mark as completed in this document

---

**Last updated**: 2024-01-XX
**Next review**: Every 2 weeks or after major feature additions
