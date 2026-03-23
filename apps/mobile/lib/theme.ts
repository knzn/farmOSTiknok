import { useColorScheme } from 'react-native'

export const darkColors = {
  bgPrimary: '#0A0A0A',
  bgSecondary: '#141414',
  bgTertiary: '#1E1E1E',
  surface: '#1A1A1A',
  border: '#2A2A2A',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#606060',
  accent: '#C8A84B',
  accentHover: '#D4B96A',
  accentMuted: '#C8A84B33',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
} as const

export const lightColors = {
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F5F5F5',
  bgTertiary: '#EBEBEB',
  surface: '#FAFAFA',
  border: '#E0E0E0',
  textPrimary: '#0A0A0A',
  textSecondary: '#606060',
  textTertiary: '#A0A0A0',
  accent: '#C8A84B',
  accentHover: '#D4B96A',
  accentMuted: '#C8A84B33',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
} as const

export type AppColors = typeof darkColors

export function useTheme(): AppColors {
  const scheme = useColorScheme()
  return scheme === 'light' ? lightColors : darkColors
}
