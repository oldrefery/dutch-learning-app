export const IMAGE_SELECTOR_CONSTANTS = {
  COLORS: {
    PRIMARY: '#3b82f6',
    SUCCESS: '#10b981',
    ERROR: '#dc2626',
    WARNING: '#f59e0b',
    GRAY: {
      50: '#f8f9fa',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },
  SPACING: {
    SMALL: 4,
    MEDIUM: 8,
    LARGE: 16,
    XLARGE: 20,
    XXLARGE: 40,
  },
  BORDER_RADIUS: {
    SMALL: 8,
    MEDIUM: 12,
    LARGE: 16,
  },
  SHADOWS: {
    SMALL: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    MEDIUM: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
} as const
