# Project Structure & Best Practices

## 📁 Directory Organization

### React Native Application

```
src/                   # Source code root
├── types/             # TypeScript type definitions
│   ├── database.ts    # Database types (generated)
│   ├── GeminiTypes.ts # Gemini AI analysis types
│   └── ...
│
├── constants/         # Application constants
│   ├── AppConfig.ts   # Main app configuration (re-exports from supabase)
│   ├── Colors.ts      # Centralized color constants
│   └── ...
│
├── utils/             # Utility functions
│   ├── srs.ts         # Spaced Repetition System
│   ├── geminiUtils.ts # Gemini AI utilities
│   └── ...
│
├── hooks/             # Custom React hooks
│   ├── useReviewScreen.ts # Review screen logic
│   └── ...
│
├── components/        # Reusable UI components
│   ├── ReviewCard/    # Card components
│   ├── ImageSelector.tsx # Image selection modal
│   └── ...
│
├── stores/            # State management (Zustand)
│   └── useAppStore.ts
│
├── lib/               # Utility libraries
│   ├── supabaseClient.ts # Supabase client configuration
│   ├── supabase.ts    # Supabase services and helpers
│   └── ...
│
├── assets/            # Static assets
│   ├── images/        # App icons, splash screens
│   └── fonts/         # Custom fonts
│
├── styles/            # StyleSheet definitions
│   └── CollectionsScreenStyles.ts
│
└── app/               # App screens (Expo Router)
    ├── (auth)/        # Authentication screens
    ├── (tabs)/        # Tab navigation screens
    └── ...
```

### Supabase Edge Functions (Deno)

```
supabase/functions/
├── _shared/          # Shared files for all Edge Functions
│   ├── constants.ts  # Common constants
│   ├── types.ts      # Common types
│   ├── geminiUtils.ts # Gemini utilities
│   └── geminiPrompts.ts # Gemini AI prompts
├── gemini-handler/
│   └── index.ts      # AI word analysis
├── get-multiple-images/
│   └── index.ts      # Image fetching
└── data-migration/
    └── index.ts      # Database migrations
```

## 🎯 Best Practices

### 1. **File Organization**

- **Types**: All in `types/` directory with descriptive names
- **Constants**: All in `constants/` directory, grouped by feature
- **Utils**: All in `utils/` directory, pure functions only
- **Hooks**: All in `hooks/` directory, custom React hooks
- **Prompts**: Long text constants in separate files (e.g., `geminiPrompts.ts`)

### 2. **Naming Conventions**

- **Types**: `PascalCase.ts` (e.g., `GeminiTypes.ts`)
- **Constants**: `PascalCase.ts` (e.g., `ReviewConstants.ts`)
- **Utils**: `camelCase.ts` (e.g., `geminiUtils.ts`)
- **Hooks**: `usePascalCase.ts` (e.g., `useReviewScreen.ts`)

### 3. **Import Paths**

```typescript
// React Native app (using src/ structure with @ alias)
import { REVIEW_CONSTANTS } from '@/constants/ReviewConstants'
import { Colors } from '@/constants/Colors'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import { supabase } from '@/lib/supabaseClient'
import type { WordAnalysisRequest } from '@/types/GeminiTypes'

// Edge Functions (Deno) - remain in supabase/ folder structure
import { analyzeSeparableVerb } from '../_shared/geminiUtils.ts'
import { formatWordAnalysisPrompt } from '../_shared/geminiPrompts.ts'
import type { WordAnalysisRequest } from '../_shared/types.ts'
```

### 4. **File Length Limits**

- **Maximum**: 250 lines (excluding imports and empty lines)
- **Warning**: 150+ lines (consider refactoring)
- **Enforced**: Pre-commit hook checks file length

### 5. **Cognitive Complexity**

- **Maximum**: 15 per function
- **Warning**: 10+ (consider refactoring)
- **Enforced**: ESLint SonarJS plugin

## 🔄 Refactoring Guidelines

### When to Extract Files:

1. **File exceeds 250 lines** → Extract logic into separate files
2. **Function exceeds 15 complexity** → Break into smaller functions
3. **Repeated constants** → Move to constants file
4. **Repeated types** → Move to types file
5. **Repeated logic** → Move to utils file

### Extraction Patterns:

```typescript
// Before: Large component file
export default function ReviewScreen() {
  // 500+ lines of logic
}

// After: Extracted structure
// src/hooks/useReviewScreen.ts
export const useReviewScreen = () => {
  /* logic */
}

// src/constants/ReviewConstants.ts
export const REVIEW_CONSTANTS = {
  /* constants */
}

// src/app/(tabs)/review.tsx
export default function ReviewScreen() {
  // Clean, focused component
}
```

## 📋 File Responsibilities

### Types (`types/`)

- Interface definitions
- Type unions and intersections
- Generic type constraints
- API response types

### Constants (`constants/`)

- Configuration values
- Color palettes
- Dimension values
- API endpoints
- Magic numbers

### Utils (`utils/`)

- Pure functions
- Data transformation
- Validation logic
- Helper functions
- Business logic

### Hooks (`hooks/`)

- State management logic
- Side effects
- Custom behavior
- Reusable component logic

## 🚀 Benefits

1. **Maintainability**: Easy to find and modify code
2. **Reusability**: Shared logic across components
3. **Testability**: Isolated, pure functions
4. **Readability**: Clear separation of concerns
5. **Scalability**: Organized structure grows with project

## ⚠️ Important Notes

### Edge Functions Limitations:

- Cannot import from root project folders
- Must use relative imports within `supabase/functions/`
- Shared code goes in `supabase/functions/_shared/`

### React Native App:

- Can use absolute imports with `@/` prefix
- All shared code in root-level folders
- TypeScript path mapping configured

## 🔧 Tools & Automation

### Pre-commit Hooks:

- File length checking
- Cognitive complexity analysis
- ESLint validation
- TypeScript compilation

### NPM Scripts:

```bash
npm run file-length        # Check file lengths
npm run complexity         # Check cognitive complexity
npm run lint              # Run ESLint
npm run type-check        # TypeScript validation
```

This structure ensures clean, maintainable, and scalable code organization following industry best practices.
