/**
 * 멤버 탭 — 클럽 멤버 목록 + 가입 코드 + 오프라인 회원 추가
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  LoadingView,
  ScreenContainer,
  TierBadge,
} from '../../components/ui';
import { useClub } from '../../lib/club-context';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, TouchTarget, Typography } from '../../lib/theme';
import type { Member, MemberRole } from '../../lib/types';

function RoleChip({ role }: { role: MemberRole }) {
  if (role === 'member') return null;
  const label = role === 'owner' ? '회장' : '운영진';
  const bg = role === 'owner' ? Colors.secondary : Colors.primary;
  return (
    <View style={[styles.roleChip, { backgroundColor: bg }]}>
      <Text style={styles.roleChipText}>{label}</Text>
    </View>
  );
}

interface MemberRowProps {
  item: Member;
  onPress: () => void;
}

function MemberRow({ item, onPress }: MemberRowProps) {
  const displayName = item.nickname ? `${item.name} (${item.nickname})` : item.name;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={displayName}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowNameRow}>
          <Text style={[Typography.body, styles.rowName]}>{displayName}</Text>
          <RoleChip role={item.role} />
        </View>
        {item.user_id === null && (
          <Text style={[Typography.caption, { marginTop: 2 }]}>앱 미가입</Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <TierBadge elo={item.elo_doubles} />
        <Ionicons
          name="chevron-forward"
          size={18}
          color={Colors.textMuted}
          style={{ marginLeft: Spacing.xs }}
        />
      </View>
    </Pressable>
  );
}

export default function MembersScreen() {
  const { club, me, refresh: refreshCtx } = useClub();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);
  const [addName, setAddName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<TextInput>(null);

  const isManager = me?.role !== 'member';

  const loadMembers = useCallback(async () => {
    if (!club) return;
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('club_id', club.id)
        .eq('status', 'active')
        .order('elo_doubles', { ascending: false });
      if (error) throw error;
      setMembers((data ?? []) as Member[]);
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    }
  }, [club]);

  useEffect(() => {
    setLoading(true);
    loadMembers().finally(() => setLoading(false));
  }, [loadMembers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMembers();
    await refreshCtx();
    setRefreshing(false);
  }, [loadMembers, refreshCtx]);

  const handleAddMember = useCallback(async () => {
    if (!club) return;
    const trimmed = addName.trim();
    if (!trimmed) {
      Alert.alert('이름을 입력해 주세요');
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase
        .from('members')
        .insert({ club_id: club.id, name: trimmed });
      if (error) throw error;
      setAddName('');
      setAddOpen(false);
      await loadMembers();
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    } finally {
      setAdding(false);
    }
  }, [club, addName, loadMembers]);

  if (!club || !me) return <LoadingView />;
  if (loading) return <LoadingView />;

  return (
    <ScreenContainer>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {/* 가입 코드 카드 */}
            <Card style={styles.codeCard}>
              {codeVisible ? (
                <View style={styles.codeRevealRow}>
                  <Text style={[Typography.h2, styles.codeText]}>{club.join_code}</Text>
                  <Pressable onPress={() => setCodeVisible(false)} style={styles.codeHideBtn}>
                    <Text style={[Typography.caption, { color: Colors.primary }]}>숨기기</Text>
                  </Pressable>
                </View>
              ) : (
                <Button
                  title="가입 코드 보기"
                  variant="outline"
                  onPress={() => setCodeVisible(true)}
                />
              )}
            </Card>

            {/* 운영진 전용: 이름으로 회원 추가 */}
            {isManager && (
              <View style={styles.addSection}>
                {addOpen ? (
                  <View style={styles.addRow}>
                    <TextInput
                      ref={addInputRef}
                      style={styles.addInput}
                      placeholder="회원 이름"
                      placeholderTextColor={Colors.textMuted}
                      value={addName}
                      onChangeText={setAddName}
                      returnKeyType="done"
                      onSubmitEditing={handleAddMember}
                      autoFocus
                    />
                    <Button
                      title="추가"
                      onPress={handleAddMember}
                      loading={adding}
                      style={styles.addBtn}
                    />
                    <Pressable
                      onPress={() => {
                        setAddOpen(false);
                        setAddName('');
                      }}
                      style={styles.cancelBtn}
                    >
                      <Ionicons name="close" size={22} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <Button
                    title="+ 이름으로 회원 추가"
                    variant="outline"
                    onPress={() => {
                      setAddOpen(true);
                      setTimeout(() => addInputRef.current?.focus(), 100);
                    }}
                  />
                )}
              </View>
            )}

            <Text style={[Typography.caption, styles.countLabel]}>
              전체 {members.length}명
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MemberRow
            item={item}
            onPress={() => router.push(`/member/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState message="등록된 회원이 없습니다" />}
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.sm,
    paddingBottom: 0,
  },
  codeCard: {
    marginBottom: Spacing.sm,
  },
  codeRevealRow: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  codeText: {
    letterSpacing: 4,
    color: Colors.primary,
    textAlign: 'center',
  },
  codeHideBtn: {
    padding: Spacing.xs,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  addSection: {
    marginBottom: Spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addInput: {
    flex: 1,
    height: TouchTarget.recommended,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: Spacing.sm,
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  addBtn: {
    paddingHorizontal: Spacing.sm,
    minWidth: 60,
  },
  cancelBtn: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: {
    marginBottom: Spacing.xs,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: TouchTarget.recommended,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  rowLeft: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowName: {
    fontWeight: '500',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
