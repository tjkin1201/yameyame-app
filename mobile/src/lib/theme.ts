/**
 * 체육관 특화 테마 — mobile-legacy gymTheme 이식 (react-native-paper 의존 제거).
 * - 고대비(본문 7:1+): 체육관 조명·실외 가시성
 * - 큰 터치 영역(44pt+): 땀·오터치 방지
 * - 큰 폰트(본문 18sp): 코트 밖 가독성
 */
import type { TextStyle } from 'react-native';

export const Colors = {
  primary: '#0066CC',
  primaryContainer: '#D0E4FF',
  secondary: '#FF6B35',
  secondaryContainer: '#FFE0D9',
  tertiary: '#00B050',
  tertiaryContainer: '#C8F7DC',

  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceVariant: '#E5E5E5',
  border: '#DDDDDD',

  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#4A4A4A',

  error: '#DC3545',
  onError: '#FFFFFF',
  success: '#00B050',
  warning: '#FFB020',
} as const;

export const Spacing = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 } as const;

export const TouchTarget = { min: 44, recommended: 56 } as const;

export const Radius = 12;

export const Typography: Record<string, TextStyle> = {
  h1: { fontSize: 32, fontWeight: 'bold', lineHeight: 40, color: Colors.text },
  h2: { fontSize: 24, fontWeight: 'bold', lineHeight: 32, color: Colors.text },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 28, color: Colors.text },
  body: { fontSize: 18, lineHeight: 26, color: Colors.text },
  button: { fontSize: 20, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 20, color: Colors.textMuted },
};
