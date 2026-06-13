import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Button, Card, ScreenContainer } from '../../components/ui';
import { useClub } from '../../lib/club-context';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';

/** 클럽 만들기 or 가입코드로 참여 */
export default function OnboardingScreen() {
  const { refresh, signOut } = useClub();
  const [name, setName] = useState('');
  const [clubName, setClubName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);

  const requireName = (): boolean => {
    if (!name.trim()) {
      Alert.alert('확인', '이름(실명 또는 닉네임)을 입력하세요');
      return false;
    }
    return true;
  };

  const createClub = async () => {
    if (!requireName()) return;
    if (!clubName.trim()) {
      Alert.alert('확인', '클럽 이름을 입력하세요');
      return;
    }
    setLoading('create');
    try {
      const { data, error } = await supabase.rpc('create_club', {
        p_name: clubName.trim(),
        p_member_name: name.trim(),
      });
      if (error) throw error;
      const code = (data as { join_code?: string })?.join_code;
      await refresh();
      Alert.alert('클럽 생성 완료', `가입 코드: ${code}\n동호회원들에게 공유하세요!`);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '클럽 생성 실패');
    } finally {
      setLoading(null);
    }
  };

  const joinClub = async () => {
    if (!requireName()) return;
    if (joinCode.trim().length !== 6) {
      Alert.alert('확인', '6자리 가입 코드를 입력하세요');
      return;
    }
    setLoading('join');
    try {
      const { error } = await supabase.rpc('join_club', {
        p_code: joinCode.trim(),
        p_name: name.trim(),
      });
      if (error) throw error;
      await refresh();
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '가입 실패');
    } finally {
      setLoading(null);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={Typography.h2}>거의 다 왔어요 🏸</Text>
        <Text style={[Typography.caption, { marginBottom: Spacing.md }]}>
          클럽을 새로 만들거나, 받은 가입 코드로 참여하세요
        </Text>

        <TextInput
          style={styles.input}
          placeholder="내 이름 (예: 김태중)"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Card>
          <Text style={Typography.h3}>새 클럽 만들기</Text>
          <TextInput
            style={styles.input}
            placeholder="클럽 이름 (예: 동탄배드민턴클럽)"
            placeholderTextColor={Colors.textMuted}
            value={clubName}
            onChangeText={setClubName}
          />
          <Button title="클럽 만들기" onPress={createClub} loading={loading === 'create'} />
        </Card>

        <Card>
          <Text style={Typography.h3}>가입 코드로 참여</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="ABC123"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            maxLength={6}
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <Button
            title="참여하기"
            variant="secondary"
            onPress={joinClub}
            loading={loading === 'join'}
          />
        </Card>

        <Button title="다른 계정으로 로그인" variant="outline" onPress={() => void signOut()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: Spacing.md, paddingTop: Spacing.xl },
  input: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: Spacing.sm,
    fontSize: 18,
    color: Colors.text,
    marginVertical: Spacing.xs,
    backgroundColor: Colors.background,
  },
  codeInput: { letterSpacing: 6, fontWeight: '700', textAlign: 'center' },
});
