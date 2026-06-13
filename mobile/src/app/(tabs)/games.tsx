/**
 * 게임 탭 — 대진표 | 기록 | 리더보드
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  LoadingView,
  ScreenContainer,
  SectionTitle,
  TierBadge,
} from '../../components/ui';
import { useClub } from '../../lib/club-context';
import { generateDoubles } from '../../lib/matching';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, TouchTarget, Typography } from '../../lib/theme';
import type { Game, GameType, Member, RecordGameResult, Session } from '../../lib/types';

// ─── 날짜 헬퍼 ────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── 세그먼트 탭 타입 ──────────────────────────────────────
type TabKey = 'bracket' | 'record' | 'leaderboard';

const TAB_LABELS: Record<TabKey, string> = {
  bracket: '대진표',
  record: '기록',
  leaderboard: '리더보드',
};

// ─── 대진표 탭 ────────────────────────────────────────────
interface BracketTabProps {
  activeMembers: Member[];
}

function BracketTab({ activeMembers }: BracketTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ReturnType<typeof generateDoubles> | null>(null);

  function toggleMember(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setResult(null);
  }

  function handleGenerate() {
    if (selected.size < 4) {
      Alert.alert('인원 부족', '대진표 생성은 최소 4명이 필요합니다.');
      return;
    }
    const players = activeMembers
      .filter(m => selected.has(m.id))
      .map(m => ({ id: m.id, name: m.name, elo: m.elo_doubles }));
    try {
      setResult(generateDoubles(players));
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <SectionTitle title={`멤버 선택 (${selected.size}명 선택됨)`} />
      {activeMembers.map(m => (
        <Pressable
          key={m.id}
          onPress={() => toggleMember(m.id)}
          style={({ pressed }) => [
            styles.memberRow,
            selected.has(m.id) && styles.memberRowSelected,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name={selected.has(m.id) ? 'checkbox' : 'square-outline'}
            size={24}
            color={selected.has(m.id) ? Colors.primary : Colors.textMuted}
          />
          <Text style={[Typography.body, styles.memberRowName]}>{m.name}</Text>
          <Text style={[Typography.caption]}>{m.elo_doubles}</Text>
        </Pressable>
      ))}

      <Button
        title={`대진표 생성 (${selected.size}명)`}
        onPress={handleGenerate}
        disabled={selected.size < 4}
        style={styles.actionButton}
      />

      {result && (
        <>
          <SectionTitle title="대진표" />
          {result.matches.map(match => (
            <Card key={match.court}>
              <Text style={[Typography.h3, { marginBottom: Spacing.xs }]}>
                Court {match.court}
              </Text>
              <Text style={Typography.body}>
                {match.team1.map(p => p.name).join(' · ')}
                {'\n'}vs{'\n'}
                {match.team2.map(p => p.name).join(' · ')}
              </Text>
              <View style={styles.eloRow}>
                <Text style={Typography.caption}>
                  팀1 평균 {Math.round(match.team1AvgElo)} vs 팀2 평균 {Math.round(match.team2AvgElo)}
                </Text>
              </View>
              <Text style={[Typography.caption, styles.predictionText]}>
                승률 예측: 팀1 {Math.round(match.prediction.team1WinProbability * 100)}% vs 팀2{' '}
                {Math.round(match.prediction.team2WinProbability * 100)}%
              </Text>
              <Text style={[Typography.caption, { color: Colors.primary }]}>
                {match.prediction.interpretation}
              </Text>
            </Card>
          ))}
          {result.resting.length > 0 && (
            <Card>
              <Text style={[Typography.body, { color: Colors.textMuted }]}>
                휴식: {result.resting.map(p => p.name).join(', ')}
              </Text>
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── 기록 탭 ─────────────────────────────────────────────
interface RecordTabProps {
  activeMembers: Member[];
  clubId: string;
  onRecorded: () => void;
}

interface SlotState {
  t1p1: Member | null;
  t1p2: Member | null;
  t2p1: Member | null;
  t2p2: Member | null;
}

type SlotKey = keyof SlotState;

const SLOT_LABELS: Record<SlotKey, string> = {
  t1p1: '팀1 선수1',
  t1p2: '팀1 선수2',
  t2p1: '팀2 선수1',
  t2p2: '팀2 선수2',
};

function RecordTab({ activeMembers, clubId, onRecorded }: RecordTabProps) {
  const [gameType, setGameType] = useState<GameType>('doubles');
  const [slots, setSlots] = useState<SlotState>({ t1p1: null, t1p2: null, t2p1: null, t2p2: null });
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [winner, setWinner] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // 오늘 진행되는 모임 — 있으면 게임이 자동으로 그 모임에 연결됨
  const [todaySession, setTodaySession] = useState<Session | null>(null);

  const loadTodaySession = useCallback(async () => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('club_id', clubId)
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString())
      .order('starts_at')
      .limit(1)
      .maybeSingle();
    setTodaySession((data as Session | null) ?? null);
  }, [clubId]);

  useEffect(() => {
    void loadTodaySession();
  }, [loadTodaySession]);

  const loadRecentGames = useCallback(async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('club_id', clubId)
      .order('played_at', { ascending: false })
      .limit(10);
    if (error) {
      Alert.alert('오류', error.message);
      return;
    }
    setRecentGames((data ?? []) as Game[]);
  }, [clubId]);

  useEffect(() => {
    void loadRecentGames();
  }, [loadRecentGames]);

  function resetForm() {
    setSlots({ t1p1: null, t1p2: null, t2p1: null, t2p2: null });
    setScore1('');
    setScore2('');
    setWinner(1);
    setGameType('doubles');
  }

  function handleSlotPress(slot: SlotKey) {
    if (gameType === 'singles' && (slot === 't1p2' || slot === 't2p2')) return;
    setActiveSlot(slot);
  }

  function handleSelectMember(member: Member) {
    if (!activeSlot) return;
    setSlots(prev => ({ ...prev, [activeSlot]: member }));
    setActiveSlot(null);
  }

  // 이미 선택된 멤버 id 집합
  const selectedIds = new Set(
    Object.values(slots)
      .filter((v): v is Member => v !== null)
      .map(m => m.id),
  );

  async function handleRecord() {
    const { t1p1, t1p2, t2p1, t2p2 } = slots;
    if (gameType === 'doubles' && (!t1p1 || !t1p2 || !t2p1 || !t2p2)) {
      Alert.alert('입력 오류', '복식은 선수 4명을 모두 선택하세요.');
      return;
    }
    if (gameType === 'singles' && (!t1p1 || !t2p1)) {
      Alert.alert('입력 오류', '단식은 선수 2명을 선택하세요.');
      return;
    }
    const s1 = parseInt(score1, 10);
    const s2 = parseInt(score2, 10);
    if (isNaN(s1) || isNaN(s2)) {
      Alert.alert('입력 오류', '점수를 입력하세요.');
      return;
    }
    if (s1 < 0 || s2 < 0 || s1 > 99 || s2 > 99) {
      Alert.alert('입력 오류', '점수는 0~99 사이여야 합니다.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('record_game', {
        p_club: clubId,
        p_type: gameType,
        p_t1p1: t1p1!.id,
        p_t1p2: gameType === 'doubles' ? t1p2!.id : null,
        p_t2p1: t2p1!.id,
        p_t2p2: gameType === 'doubles' ? t2p2!.id : null,
        p_score1: s1,
        p_score2: s2,
        p_winner: winner,
        p_session: todaySession?.id ?? null,
      });
      if (error) throw error;
      const result = data as RecordGameResult | null;
      const memberMap = new Map(activeMembers.map(m => [m.id, m.name]));
      const ratingLines = Array.isArray(result?.ratings)
        ? result.ratings
            .map(r => `${memberMap.get(r.member_id) ?? r.member_id}: ${r.before} → ${r.after}`)
            .join('\n')
        : '기록되었습니다';
      Alert.alert('기록 완료', ratingLines);
      resetForm();
      void loadRecentGames();
      onRecorded(); // ELO 변동을 리더보드·선수목록에 즉시 반영
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  const visibleSlots: SlotKey[] =
    gameType === 'doubles' ? ['t1p1', 't1p2', 't2p1', 't2p2'] : ['t1p1', 't2p1'];

  const memberMap = new Map(activeMembers.map(m => [m.id, m.name]));

  function gameLabel(g: Game): string {
    const type = g.game_type === 'doubles' ? '복식' : '단식';
    const t1 = [g.team1_p1, g.team1_p2]
      .filter(Boolean)
      .map(id => memberMap.get(id!) ?? id!)
      .join('·');
    const t2 = [g.team2_p1, g.team2_p2]
      .filter(Boolean)
      .map(id => memberMap.get(id!) ?? id!)
      .join('·');
    const score = g.score1 != null && g.score2 != null ? ` ${g.score1}:${g.score2}` : '';
    const win = g.winner === 1 ? '(팀1 승)' : '(팀2 승)';
    return `${type} | ${t1}${score} ${t2} ${win}`;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={recentGames}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadRecentGames();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.tabContent}>
            {/* 오늘 모임 자동 연결 배지 */}
            {todaySession && (
              <View
                style={{
                  backgroundColor: Colors.tertiaryContainer,
                  borderRadius: Radius,
                  paddingVertical: Spacing.xs,
                  paddingHorizontal: Spacing.sm,
                  marginTop: Spacing.sm,
                }}
              >
                <Text style={[Typography.caption, { color: Colors.text }]}>
                  📍 오늘 모임 「{todaySession.title}」에 자동 기록됩니다
                </Text>
              </View>
            )}
            {/* 게임 타입 토글 */}
            <SectionTitle title="게임 유형" />
            <View style={styles.toggleRow}>
              {(['doubles', 'singles'] as GameType[]).map(t => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setGameType(t);
                    setSlots({ t1p1: null, t1p2: null, t2p1: null, t2p2: null });
                  }}
                  style={[styles.toggleBtn, gameType === t && styles.toggleBtnActive]}
                >
                  <Text
                    style={[
                      Typography.body,
                      { color: gameType === t ? Colors.onPrimary : Colors.text },
                    ]}
                  >
                    {t === 'doubles' ? '복식' : '단식'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 선수 슬롯 */}
            <SectionTitle title="선수 선택" />
            {visibleSlots.map(slot => (
              <Pressable
                key={slot}
                onPress={() => handleSlotPress(slot)}
                style={({ pressed }) => [styles.slotBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={[Typography.body, { color: Colors.textMuted, width: 90 }]}>
                  {SLOT_LABELS[slot]}
                </Text>
                <Text style={[Typography.body, { flex: 1 }]}>
                  {slots[slot]?.name ?? '— 선택 —'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </Pressable>
            ))}

            {/* 점수 */}
            <SectionTitle title="점수" />
            <View style={styles.scoreRow}>
              <TextInput
                style={styles.scoreInput}
                value={score1}
                onChangeText={setScore1}
                keyboardType="numeric"
                placeholder="팀1"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={[Typography.h3, { marginHorizontal: Spacing.sm }]}>:</Text>
              <TextInput
                style={styles.scoreInput}
                value={score2}
                onChangeText={setScore2}
                keyboardType="numeric"
                placeholder="팀2"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* 승리팀 */}
            <SectionTitle title="승리팀" />
            <View style={styles.toggleRow}>
              {([1, 2] as const).map(t => (
                <Pressable
                  key={t}
                  onPress={() => setWinner(t)}
                  style={[styles.toggleBtn, winner === t && styles.toggleBtnActive]}
                >
                  <Text
                    style={[
                      Typography.body,
                      { color: winner === t ? Colors.onPrimary : Colors.text },
                    ]}
                  >
                    팀{t} 승
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              title="게임 기록"
              onPress={handleRecord}
              loading={loading}
              style={styles.actionButton}
            />

            <SectionTitle title="최근 게임" />
          </View>
        }
        ListEmptyComponent={<EmptyState message="아직 기록된 게임이 없습니다." />}
        renderItem={({ item }) => (
          <Card style={styles.gameCard}>
            <Text style={Typography.body}>{gameLabel(item)}</Text>
            <Text style={Typography.caption}>{formatDate(item.played_at)}</Text>
          </Card>
        )}
      />

      {/* 멤버 선택 모달 */}
      <Modal
        visible={activeSlot !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveSlot(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={Typography.h3}>
                {activeSlot ? SLOT_LABELS[activeSlot] : ''} 선택
              </Text>
              <Pressable onPress={() => setActiveSlot(null)} hitSlop={12}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={activeMembers.filter(m => !selectedIds.has(m.id))}
              keyExtractor={item => item.id}
              ListEmptyComponent={<EmptyState message="선택 가능한 멤버가 없습니다." />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectMember(item)}
                  style={styles.modalMemberRow}
                >
                  <Text style={Typography.body}>{item.name}</Text>
                  <Text style={Typography.caption}>{item.elo_doubles}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── 리더보드 탭 ──────────────────────────────────────────
interface LeaderboardTabProps {
  activeMembers: Member[];
  refreshing: boolean;
  onRefresh: () => void;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function LeaderboardTab({ activeMembers, refreshing, onRefresh }: LeaderboardTabProps) {
  const [mode, setMode] = useState<'doubles' | 'singles'>('doubles');

  const sorted = [...activeMembers].sort((a, b) =>
    mode === 'doubles' ? b.elo_doubles - a.elo_doubles : b.elo_singles - a.elo_singles,
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.tabContent}>
          <View style={styles.toggleRow}>
            {(['doubles', 'singles'] as const).map(t => (
              <Pressable
                key={t}
                onPress={() => setMode(t)}
                style={[styles.toggleBtn, mode === t && styles.toggleBtnActive]}
              >
                <Text
                  style={[
                    Typography.body,
                    { color: mode === t ? Colors.onPrimary : Colors.text },
                  ]}
                >
                  {t === 'doubles' ? '복식' : '단식'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState message="멤버가 없습니다." />}
      renderItem={({ item, index }) => {
        const rank = index + 1;
        const games = mode === 'doubles' ? item.games_doubles : item.games_singles;
        const elo = mode === 'doubles' ? item.elo_doubles : item.elo_singles;
        return (
          <View style={styles.leaderRow}>
            <Text style={styles.rankText}>{MEDAL[rank] ?? String(rank)}</Text>
            <View style={styles.leaderInfo}>
              <Text style={Typography.body}>{item.name}</Text>
              <TierBadge elo={elo} />
            </View>
            <Text style={Typography.caption}>{games}전</Text>
          </View>
        );
      }}
    />
  );
}

// ─── 메인 화면 ────────────────────────────────────────────
export default function GamesScreen() {
  const { club, me, refresh } = useClub();
  const [tab, setTab] = useState<TabKey>('bracket');
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const clubId = club?.id ?? '';

  const loadMembers = useCallback(async () => {
    if (!clubId) return;
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('club_id', clubId)
      .eq('status', 'active');
    if (error) {
      Alert.alert('오류', error.message);
      return;
    }
    setActiveMembers((data ?? []) as Member[]);
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    setMembersLoading(true);
    loadMembers().finally(() => setMembersLoading(false));
  }, [loadMembers, clubId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadMembers()]);
    setRefreshing(false);
  }, [refresh, loadMembers]);

  if (!club || !me) return <LoadingView />;
  if (membersLoading) return <LoadingView />;

  return (
    <ScreenContainer>
      {/* 세그먼트 탭 */}
      <View style={styles.segmentRow}>
        {(Object.keys(TAB_LABELS) as TabKey[]).map(key => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.segmentBtn, tab === key && styles.segmentBtnActive]}
          >
            <Text
              style={[
                Typography.body,
                { color: tab === key ? Colors.onPrimary : Colors.textMuted, fontWeight: '600' },
              ]}
            >
              {TAB_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'bracket' && <BracketTab activeMembers={activeMembers} />}
      {tab === 'record' && (
        <RecordTab activeMembers={activeMembers} clubId={club.id} onRecorded={() => void loadMembers()} />
      )}
      {tab === 'leaderboard' && (
        <LeaderboardTab
          activeMembers={activeMembers}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </ScreenContainer>
  );
}

// ─── 스타일 ───────────────────────────────────────────────
const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    margin: Spacing.sm,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TouchTarget.min,
    borderRadius: Radius - 2,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabContent: {
    padding: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget.min,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius,
    marginBottom: 4,
    backgroundColor: Colors.surface,
  },
  memberRowSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  memberRowName: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  actionButton: {
    marginTop: Spacing.sm,
  },
  eloRow: {
    marginTop: 4,
  },
  predictionText: {
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TouchTarget.min,
    borderRadius: Radius,
    backgroundColor: Colors.surfaceVariant,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  slotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget.recommended,
    backgroundColor: Colors.surface,
    borderRadius: Radius,
    paddingHorizontal: Spacing.sm,
    marginBottom: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  scoreInput: {
    flex: 1,
    minHeight: TouchTarget.recommended,
    backgroundColor: Colors.surface,
    borderRadius: Radius,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gameCard: {
    marginHorizontal: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius * 2,
    borderTopRightRadius: Radius * 2,
    maxHeight: '70%',
    paddingBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  modalMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget.recommended,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget.recommended,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  rankText: {
    fontSize: 22,
    width: 48,
    textAlign: 'center',
  },
  leaderInfo: {
    flex: 1,
    gap: 4,
  },
});
