/**
 * 홈 탭 — 내 ELO 카드 / 다음 모임 / 공지 미리보기
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  LoadingView,
  SectionTitle,
  TierBadge,
} from '../../components/ui';
import { useClub } from '../../lib/club-context';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../../lib/theme';
import type { Announcement, Attendance, AttendanceStatus, Session } from '../../lib/types';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface NextSessionData {
  session: Session;
  attendingCount: number;
  myStatus: AttendanceStatus | null;
}

// ─── 메인 화면 ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { club, me, refresh: refreshClub } = useClub();
  const router = useRouter();

  const [nextSessionData, setNextSessionData] = useState<NextSessionData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!club || !me) return;

    try {
      const now = new Date().toISOString();

      // 다음 모임 조회
      const { data: sessionRow, error: sessionErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('club_id', club.id)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (sessionErr) throw sessionErr;

      if (sessionRow) {
        const session = sessionRow as Session;

        // 참석 인원 수
        const { count: attendingCount, error: countErr } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('status', 'attending');

        if (countErr) throw countErr;

        // 내 RSVP 상태
        const { data: myAttRow, error: myAttErr } = await supabase
          .from('attendance')
          .select('status')
          .eq('session_id', session.id)
          .eq('member_id', me.id)
          .maybeSingle();

        if (myAttErr) throw myAttErr;

        setNextSessionData({
          session,
          attendingCount: attendingCount ?? 0,
          myStatus: myAttRow ? (myAttRow as Pick<Attendance, 'status'>).status : null,
        });
      } else {
        setNextSessionData(null);
      }

      // 공지 미리보기
      const { data: announceRows, error: announceErr } = await supabase
        .from('announcements')
        .select('*')
        .eq('club_id', club.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3);

      if (announceErr) throw announceErr;
      setAnnouncements((announceRows ?? []) as Announcement[]);
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    }
  }, [club, me]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshClub();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshClub, loadData]);

  const handleRsvp = useCallback(
    async (status: AttendanceStatus) => {
      if (!me || !nextSessionData) return;
      setRsvpLoading(true);
      try {
        const { error } = await supabase.from('attendance').upsert(
          {
            session_id: nextSessionData.session.id,
            member_id: me.id,
            status,
          },
          { onConflict: 'session_id,member_id' },
        );
        if (error) throw error;
        await loadData();
      } catch (e: unknown) {
        Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
      } finally {
        setRsvpLoading(false);
      }
    },
    [me, nextSessionData, loadData],
  );

  if (!club || !me) return <LoadingView />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
      }
    >
      {/* ── 1) 내 ELO 카드 ───────────────────────────────────────── */}
      <SectionTitle title="내 랭킹" />
      <Card>
        <Text style={[Typography.h3, styles.memberName]}>{me.name}</Text>

        <View style={styles.eloRow}>
          <View style={styles.eloItem}>
            <Text style={[Typography.caption, styles.eloLabel]}>복식</Text>
            <TierBadge elo={me.elo_doubles} />
            <Text style={[Typography.caption, styles.gamesText]}>{me.games_doubles}전</Text>
          </View>
          <View style={styles.eloDivider} />
          <View style={styles.eloItem}>
            <Text style={[Typography.caption, styles.eloLabel]}>단식</Text>
            <TierBadge elo={me.elo_singles} />
            <Text style={[Typography.caption, styles.gamesText]}>{me.games_singles}전</Text>
          </View>
        </View>
      </Card>

      {/* ── 2) 다음 모임 카드 ─────────────────────────────────────── */}
      <SectionTitle title="다음 모임" />
      {nextSessionData ? (
        <NextSessionCard
          data={nextSessionData}
          onRsvp={handleRsvp}
          rsvpLoading={rsvpLoading}
        />
      ) : (
        <Card>
          <EmptyState message="예정된 모임이 없어요" />
        </Card>
      )}

      {/* ── 3) 공지 미리보기 ──────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <SectionTitle title="공지사항" />
        <Pressable onPress={() => router.push('/announcements')} style={styles.moreButton}>
          <Text style={[Typography.caption, { color: Colors.primary }]}>전체보기</Text>
        </Pressable>
      </View>

      {announcements.length === 0 ? (
        <Card>
          <EmptyState message="공지사항이 없어요" />
        </Card>
      ) : (
        announcements.map((item) => <AnnouncementRow key={item.id} item={item} />)
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

// ─── 다음 모임 카드 서브 컴포넌트 ────────────────────────────────────────────

interface NextSessionCardProps {
  data: NextSessionData;
  onRsvp: (status: AttendanceStatus) => void;
  rsvpLoading: boolean;
}

const RSVP_OPTIONS: { status: AttendanceStatus; label: string }[] = [
  { status: 'attending', label: '참석' },
  { status: 'maybe', label: '미정' },
  { status: 'absent', label: '불참' },
];

function NextSessionCard({ data, onRsvp, rsvpLoading }: NextSessionCardProps) {
  const { session, attendingCount, myStatus } = data;

  return (
    <Card>
      <Text style={Typography.h3}>{session.title}</Text>
      <View style={styles.sessionMeta}>
        <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
        <Text style={[Typography.caption, styles.metaText]}>{formatDate(session.starts_at)}</Text>
      </View>
      {session.location ? (
        <View style={styles.sessionMeta}>
          <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
          <Text style={[Typography.caption, styles.metaText]}>{session.location}</Text>
        </View>
      ) : null}
      <Text style={[Typography.caption, styles.attendingText]}>
        참석 예정 <Text style={{ color: Colors.primary, fontWeight: '700' }}>{attendingCount}명</Text>
      </Text>

      <View style={styles.rsvpRow}>
        {RSVP_OPTIONS.map(({ status, label }) => (
          <Button
            key={status}
            title={label}
            variant={myStatus === status ? 'primary' : 'outline'}
            onPress={() => onRsvp(status)}
            disabled={rsvpLoading}
            style={styles.rsvpButton}
          />
        ))}
      </View>
    </Card>
  );
}

// ─── 공지 행 서브 컴포넌트 ───────────────────────────────────────────────────

function AnnouncementRow({ item }: { item: Announcement }) {
  return (
    <Card style={styles.announceCard}>
      <View style={styles.announceHeader}>
        {item.pinned && (
          <Text style={styles.pinEmoji}>📌</Text>
        )}
        <Text style={[Typography.body, styles.announceTitle]} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
      <Text style={[Typography.caption, styles.announceDate]}>
        {formatDate(item.created_at)}
      </Text>
    </Card>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  memberName: {
    marginBottom: Spacing.xs,
  },
  eloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  eloItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  eloLabel: {
    marginBottom: 2,
  },
  gamesText: {
    marginTop: 2,
  },
  eloDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreButton: {
    padding: Spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  metaText: {
    flexShrink: 1,
  },
  attendingText: {
    marginTop: Spacing.xs,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  rsvpButton: {
    flex: 1,
  },
  announceCard: {
    paddingVertical: Spacing.xs,
  },
  announceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinEmoji: {
    fontSize: 16,
  },
  announceTitle: {
    flex: 1,
    fontWeight: '600',
  },
  announceDate: {
    marginTop: 2,
  },
  bottomPad: {
    height: Spacing.lg,
  },
});
