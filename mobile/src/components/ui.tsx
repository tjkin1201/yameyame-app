/** 공유 UI — 체육관 테마(고대비·44pt+ 터치·큰 폰트) 기반 기본 블록 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getRatingTier } from '../lib/elo';
import { Colors, Radius, Spacing, TouchTarget, Typography } from '../lib/theme';

export function ScreenContainer({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const bg =
    variant === 'primary' ? Colors.primary
    : variant === 'secondary' ? Colors.secondary
    : variant === 'danger' ? Colors.error
    : 'transparent';
  const fg = variant === 'outline' ? Colors.primary : Colors.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && styles.buttonOutline,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[Typography.button, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TierBadge({ elo }: { elo: number }) {
  const tier = getRatingTier(elo);
  return (
    <View style={[styles.badge, { backgroundColor: tier.color }]}>
      <Text style={styles.badgeText}>
        {tier.tier} {elo}
      </Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={[Typography.body, { color: Colors.textMuted, textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text style={[Typography.h3, styles.sectionTitle]}>{title}</Text>;
}

export function LoadingView() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  button: {
    minHeight: TouchTarget.recommended,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  buttonOutline: { borderWidth: 2, borderColor: Colors.primary },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  sectionTitle: { marginTop: Spacing.md, marginBottom: Spacing.xs },
});
