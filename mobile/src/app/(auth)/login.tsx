import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, ScreenContainer } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('확인', '이메일과 6자 이상 비밀번호를 입력하세요');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '인증에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <Text style={styles.logo}>🏸</Text>
        <Text style={Typography.h1}>YameYame</Text>
        <Text style={[Typography.caption, { marginBottom: Spacing.lg }]}>
          동호회 운영, 폰 하나로
        </Text>

        <TextInput
          style={styles.input}
          placeholder="이메일"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호 (6자 이상)"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          title={mode === 'login' ? '로그인' : '가입하기'}
          onPress={submit}
          loading={loading}
          style={{ alignSelf: 'stretch', marginTop: Spacing.sm }}
        />
        <View style={{ height: Spacing.sm }} />
        <Button
          title={mode === 'login' ? '처음이세요? 회원가입' : '계정이 있어요. 로그인'}
          variant="outline"
          onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
          style={{ alignSelf: 'stretch' }}
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: Spacing.md },
  logo: { fontSize: 64, textAlign: 'center' },
  input: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: Spacing.sm,
    fontSize: 18,
    color: Colors.text,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
});
