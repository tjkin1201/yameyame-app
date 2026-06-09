import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

/**
 * 체육관 특화 테마
 * - 고대비 색상 (본문 7:1 이상) — 체육관 조명/실외 가시성
 * - 큰 터치 영역 (최소 44pt) — 땀/장갑 착용 상태 오터치 방지
 * - 큰 폰트 (본문 18sp) — 코트 밖에서도 가독성
 */

export const GymLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0066CC',
    primaryContainer: '#D0E4FF',
    secondary: '#FF6B35',
    secondaryContainer: '#FFE0D9',
    tertiary: '#00B050',
    tertiaryContainer: '#C8F7DC',

    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceVariant: '#E5E5E5',

    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: '#1A1A1A',
    onSurface: '#1A1A1A',
    onSurfaceVariant: '#4A4A4A',

    error: '#DC3545',
    onError: '#FFFFFF',
  },
  roundness: 12,
};

export const GymDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#4D9FFF',
    primaryContainer: '#003D75',
    secondary: '#FFB4A0',
    background: '#1A1A1A',
    surface: '#2A2A2A',
    onBackground: '#E5E5E5',
    onSurface: '#E5E5E5',
  },
  roundness: 12,
};

export const GymStyles = {
  touchTarget: {
    minHeight: 44,
    minWidth: 44,
    recommended: 56,
  },
  spacing: {
    xs: 8,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold' as const, lineHeight: 40 },
    h2: { fontSize: 24, fontWeight: 'bold' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    body: { fontSize: 18, lineHeight: 26 },
    button: { fontSize: 20, fontWeight: '600' as const },
    caption: { fontSize: 14, lineHeight: 20 },
  },
};

export type GymTheme = typeof GymLightTheme;
