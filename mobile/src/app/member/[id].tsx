/**
 * 멤버 상세 — ELO 기록, 승패, 최근 변동
 */
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Card,
  EmptyState,
  LoadingView,
  ScreenContainer,
  SectionTitle,
  TierBadge,
} from '../../components/ui';
import { useClub } from '../../lib/club-context';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../../lib/theme';
import type { EloHistory, Member } from '../../lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleLabel(role: Member['role']): string {
  if (role === 'owner') return '회장';
  if (role === 'manager') return '운영진';
  return '회원';
}

function gameTypeLabel(type: EloHistory['game_type']): string {
  return type === 'doubles' ? '복식' : '단식';
}

interface WinLoss {
  wins: number;
  losses: number;
}

function calcWinLoss(history: EloHistory[]): WinLoss {
  return history.reduce<WinLoss>(
    (acc, h) => ({
      wins: h.elo_after > h.elo_before ? acc.wins + 1 : acc.wins,
      losses: h.elo_after < h.elo_before ? acc.losses + 1 : acc.losses,
    }),
    { wins: 0, losses: 0 },
  );
}

interface EloHistoryRowProps {
  item: EloHistory;
}

function EloHistoryRow({ item }: EloHistoryRowProps) {
  const diff = item.elo_after - item.elo_before;
  const diffColor = diff > 0 ? Colors.success : diff < 0 ? Colors.error : Colors.textMuted;
  const diffSign = diff > 0 ? '+' : '';
  return (
    <View style={styles.historyRow}>
      <Text style={[Typography.body, styles.historyType]}>
        {gameTypeLabel(item.game_type)}
      </Text>
      <Text style={Typography.body}>
        {item.elo_before} → {item.elo_after}
      </Text>
      <Text style={[Typography.body, { color: diffColor, fontWeight: '700' }]}>
        {` (${diffSign}${diff})`}
      </Text>
      <Text style={[Typography.caption, styles.historyDate]}>
        {formatDate(item.created_at)}
      </Text>
    </View>
  );
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { club, me } = useClub();
  const [member, setMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<EloHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [memberRes, historyRes] = await Promise.all([
        supabase.from('members').select('*').eq('id', id).single(),
        supabase
          .from('elo_history')
          .select('*')
          .eq('member_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (memberRes.error) throw memberRes.error;
      if (historyRes.error) throw historyRes.error;
      setMember(memberRes.data as Member);
      setHistory((historyRes.data ?? []) as EloHistory[]);
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  if (!club || !me) return <LoadingView />;

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) return <LoadingView />;
  if (!member) return <EmptyState message="회원 정보를 찾을 수 없습니다" />;

  const { wins, losses } = calcWinLoss(history);
  const displayName = member.nickname
    ? `${member.name} (${member.nickname})`
    : member.name;

  return (
    <ScreenContainer>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerPadding}>
            {/* 기본 정보 */}
            <Card style={styles.profileCard}>
              <Text style={Typography.h2}>{displayName}</Text>
              <Text style={[Typography.body, { color: Colors.textMuted, marginTop: 4 }]}>
                {roleLabel(member.role)}
              </Text>
              <Text style={[Typography.caption, { marginTop: 4 }]}>
                가입일 {formatDate(member.joined_at)}
              </Text>
            </Card>

            {/* ELO 카드 */}
            <Card style={styles.eloCard}>
              <View style={styles.eloRow}>
                <View style={styles.eloItem}>
                  <Text style={[Typography.caption, styles.eloLabel]}>복식</Text>
                  <TierBadge elo={member.elo_doubles} />
                </View>
                <View style={[styles.eloItem, styles.eloItemRight]}>
                  <Text style={[Typography.caption, styles.eloLabel]}>단식</Text>
                  <TierBadge elo={member.elo_singles} />
                </View>
              </View>
            </Card>

            {/* 승패 */}
            <Card style={styles.winLossCard}>
              <Text style={[Typography.h3, { textAlign: 'center' }]}>
                {wins}승 {losses}패
              </Text>
              <Text style={[Typography.caption, { textAlign: 'center', marginTop: 4 }]}>
                최근 20경기 기준
              </Text>
            </Card>

            <SectionTitle title="최근 ELO 변동" />
          </View>
        }
        renderItem={({ item }) => <EloHistoryRow item={item} />}
        ListEmptyComponent={
          <EmptyState message="아직 경기 기록이 없습니다" />
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerPadding: {
    padding: Spacing.sm,
    paddingBottom: 0,
  },
  profileCard: {
    marginBottom: Spacing.sm,
  },
  eloCard: {
    marginBottom: Spacing.sm,
  },
  eloRow: {
    flexDirection: 'row',
  },
  eloItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  eloItemRight: {
    alignItems: 'flex-end',
  },
  eloLabel: {
    marginBottom: 6,
  },
  winLossCard: {
    marginBottom: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    minHeight: 44,
    gap: 4,
  },
  historyType: {
    color: Colors.textMuted,
    marginRight: 4,
  },
  historyDate: {
    marginLeft: 'auto',
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
});
