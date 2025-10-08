/**
 * Glass (Liquid Glass) design tokens and enums
 * Centralizes values to keep components simple and HIG-consistent
 */

export enum LiquidGlassTint {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

export enum LiquidGlassIntensityMode {
  Adaptive = 'adaptive',
  Fixed = 'fixed',
}

export enum LiquidGlassRadius {
  S = 10,
  M = 14,
  L = 20,
}

export enum LiquidGlassElevation {
  None = 0,
  S = 2,
  M = 4,
  L = 8,
}

export const GlassDefaults = {
  tint: LiquidGlassTint.Auto as const,
  intensityMode: LiquidGlassIntensityMode.Adaptive as const,
  // iOS 26-aligned suggested intensities
  intensityLight: 90,
  intensityDark: 80,
  radius: LiquidGlassRadius.M as const,
  withOutline: true,
  paddingCard: 16,
  paddingTight: 12,
  elevationAndroid: LiquidGlassElevation.S as const,
}

export const GlassOutline = {
  // Subtle hairline borders to enhance glass separation
  light: 'rgba(0, 0, 0, 0.08)',
  dark: 'rgba(255, 255, 255, 0.10)',
}
