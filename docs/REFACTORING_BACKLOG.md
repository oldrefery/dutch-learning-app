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

#### Medium Priority

- **Large hook files**: Review hooks > 200 lines for potential splitting
- **Complex components**: Identify components with multiple responsibilities
- **Repeated patterns**: Extract common UI patterns into reusable components

#### Low Priority

- **Style consolidation**: Merge similar StyleSheet objects
- **Constant extraction**: Move hardcoded values to constants
- **Type definitions**: Extract large type definitions to separate files

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
