import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { continueAsGuest, signInWithBand } from '../services/auth';

interface LoginScreenProps {
  onSignedIn: () => void;
  onGuest: () => void;
}

export default function LoginScreen({ onSignedIn, onGuest }: LoginScreenProps) {
  const theme = useTheme();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleBandLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithBand();
      if (result.ok) {
        onSignedIn();
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error('Band login failed:', err);
      setError('로그인 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    await continueAsGuest();
    onGuest();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="badminton" size={96} color={theme.colors.primary} />
        <Text style={styles.title}>YameYame</Text>
        <Text style={styles.subtitle}>동탄 배드민턴 동호회 통합 관리</Text>
      </View>

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={handleBandLogin}
          loading={loading}
          disabled={loading}
          icon="account-group"
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          buttonColor="#00C73C"
        >
          밴드로 로그인
        </Button>

        <Button
          mode="text"
          onPress={handleGuest}
          disabled={loading}
          contentStyle={styles.buttonContent}
          labelStyle={styles.guestLabel}
        >
          게스트로 둘러보기
        </Button>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    marginTop: 8,
    opacity: 0.7,
  },
  actions: {
    paddingBottom: 32,
    gap: 12,
  },
  // 체육관 환경: 터치 영역 크게 (44pt+)
  buttonContent: {
    height: 56,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  guestLabel: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
});
