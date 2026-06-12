/**
 * 참석 탭 — 모임 세션 목록(다가오는/지난), RSVP, 체크인, 세션 생성
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Button, Card, EmptyState, LoadingView, SectionTitle, ScreenContainer } from '../../components/ui';
import { useClub } from '../../lib/club-context';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, TouchTarget, Typography } from '../../lib/theme';
import type { Attendance, AttendanceStatus, Member, Session } from '../../lib/types';

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusEmoji(status: AttendanceStatus): string {
  if (status === 'attending') return '✅';
  if (status === 'absent') return '❌';
  return '🤔';
}

// ──────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────

interface SessionWithAttendance extends Session {
  attendance: Attendance[];
}

// ──────────────────────────────────────────────
// 인라인 폼 (세션 만들기)
// ──────────────────────────────────────────────

interface CreateFormProps {
  clubId: string;
  myMemberId: string;
  onCreated: () => void;
  onCancel: () => void;
}

function CreateSessionForm({ clubId, myMemberId, onCreated, onCancel }: CreateFormProps) {
  const [title, setTitle] = useState('정기 운동');
  const [location, setLocation] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!dateStr.trim() || !timeStr.trim()) {
      Alert.alert('입력 오류', '날짜와 시간을 입력해주세요.');
      return;
    }
    const combined = `${dateStr.trim()}T${timeStr.trim()}:00`;
    const parsed = new Date(combined);
    if (isNaN(parsed.getTime())) {
      Alert.alert('입력 오류', '날짜(YYYY-MM-DD)와 시간(HH:MM) 형식을 확인해주세요.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('sessions').insert({
        club_id: clubId,
        title: title.trim() || '정기 운동',
        location: location.trim() || null,
        starts_at: parsed.toISOString(),
        created_by: myMemberId,
      });
      if (error) throw error;
      onCreated();
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '세션 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.formCard}>
      <Text style={[Typography.h3, { marginBottom: Spacing.xs }]}>모임 만들기</Text>
      <Text style={styles.label}>제목</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="정기 운동"
        placeholderTextColor={Colors.textMuted}
      />
      <Text style={styles.label}>장소</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="체육관 이름 또는 주소"
        placeholderTextColor={Colors.textMuted}
      />
      <Text style={styles.label}>날짜 (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={dateStr}
        onChangeText={setDateStr}
        placeholder="2026-07-01"
        placeholderTextColor={Colors.textMuted}
        keyboardType="numbers-and-punctuation"
      />
      <Text style={styles.label}>시간 (HH:MM)</Text>
      <TextInput
        style={styles.input}
        value={timeStr}
        onChangeText={setTimeStr}
        placeholder="19:00"
        placeholderTextColor={Colors.textMuted}
        keyboardType="numbers-and-punctuation"
      />
      <View style={styles.formRow}>
        <Button title="취소" variant="outline" onPress={onCancel} style={{ flex: 1, marginRight: 8 }} />
        <Button title="만들기" onPress={handleCreate} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

// ──────────────────────────────────────────────
// RSVP 버튼 그룹
// ──────────────────────────────────────────────

interface RsvpButtonsProps {
  sessionId: string;
  myMemberId: string;
  current: AttendanceStatus | null;
  onUpdated: (status: AttendanceStatus) => void;
}

function RsvpButtons({ sessionId, myMemberId, current, onUpdated }: RsvpButtonsProps) {
  const [saving, setSaving] = useState(false);

  async function upsert(status: AttendanceStatus) {
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('attendance').upsert(
        { session_id: sessionId, member_id: myMemberId, status },
        { onConflict: 'session_id,member_id' },
      );
      if (error) throw error;
      onUpdated(status);
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const options: { status: AttendanceStatus; label: string }[] = [
    { status: 'attending', label: '✅ 참석' },
    { status: 'maybe', label: '🤔 미정' },
    { status: 'absent', label: '❌ 불참' },
  ];

  return (
    <View style={styles.rsvpRow}>
      {options.map(({ status, label }) => (
        <Pressable
          key={status}
          onPress={() => upsert(status)}
          disabled={saving}
          style={[
            styles.rsvpBtn,
            current === status && styles.rsvpBtnActive,
          ]}
        >
          <Text style={[styles.rsvpBtnText, current === status && styles.rsvpBtnTextActive]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ──────────────────────────────────────────────
// 참석자 명단 행
// ──────────────────────────────────────────────

interface AttendeeRowProps {
  attendance: Attendance;
  memberName: string;
  isManager: boolean;
  onCheckin: (attendanceId: string) => void;
}

function AttendeeRow({ attendance, memberName, isManager, onCheckin }: AttendeeRowProps) {
  return (
    <View style={styles.attendeeRow}>
      <Text style={styles.attendeeEmoji}>{statusEmoji(attendance.status)}</Text>
      <Text style={[Typography.body, { flex: 1 }]}>{memberName}</Text>
      {isManager && (
        attendance.checked_in_at ? (
          <Text style={[Typography.caption, { color: Colors.success }]}>
            체크인 {formatDate(attendance.checked_in_at)}
          </Text>
        ) : (
          <Pressable
            onPress={() => onCheckin(attendance.id)}
            style={styles.checkinBtn}
          >
            <Text style={styles.checkinBtnText}>체크인</Text>
          </Pressable>
        )
      )}
    </View>
  );
}

// ──────────────────────────────────────────────
// 세션 카드
// ──────────────────────────────────────────────

interface SessionCardProps {
  session: SessionWithAttendance;
  isUpcoming: boolean;
  isManager: boolean;
  myMemberId: string;
  memberMap: Record<string, string>;
  onRefresh: () => void;
}

function SessionCard({
  session,
  isUpcoming,
  isManager,
  myMemberId,
  memberMap,
  onRefresh,
}: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [localAttendance, setLocalAttendance] = useState<Attendance[]>(session.attendance);

  useEffect(() => {
    setLocalAttendance(session.attendance);
  }, [session.attendance]);

  const myAttendance = localAttendance.find((a) => a.member_id === myMemberId) ?? null;
  const attendingCount = localAttendance.filter((a) => a.status === 'attending').length;

  function handleRsvpUpdated(status: AttendanceStatus) {
    setLocalAttendance((prev) => {
      const existing = prev.find((a) => a.member_id === myMemberId);
      if (existing) {
        return prev.map((a) =>
          a.member_id === myMemberId ? { ...a, status } : a,
        );
      }
      // 새 row (낙관적 업데이트)
      const newRow: Attendance = {
        id: `temp-${Date.now()}`,
        session_id: session.id,
        member_id: myMemberId,
        status,
        checked_in_at: null,
        created_at: new Date().toISOString(),
      };
      return [...prev, newRow];
    });
  }

  async function handleCheckin(attendanceId: string) {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('attendance')
        .update({ checked_in_at: now })
        .eq('id', attendanceId);
      if (error) throw error;
      setLocalAttendance((prev) =>
        prev.map((a) => (a.id === attendanceId ? { ...a, checked_in_at: now } : a)),
      );
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '체크인에 실패했습니다.');
    }
  }

  return (
    <Pressable onPress={() => setExpanded((v) => !v)}>
      <Card>
        {/* 헤더 */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={Typography.h3}>{session.title}</Text>
            <Text style={[Typography.caption, { marginTop: 2 }]}>{formatDate(session.starts_at)}</Text>
            {session.location ? (
              <Text style={[Typography.caption, { marginTop: 2 }]}>
                <Ionicons name="location-outline" size={13} color={Colors.textMuted} /> {session.location}
              </Text>
            ) : null}
            <Text style={[Typography.caption, { marginTop: 2, color: Colors.primary }]}>
              참석 {attendingCount}명
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.textMuted}
          />
        </View>

        {/* RSVP (다가오는 모임) */}
        {isUpcoming && (
          <RsvpButtons
            sessionId={session.id}
            myMemberId={myMemberId}
            current={myAttendance?.status ?? null}
            onUpdated={handleRsvpUpdated}
          />
        )}

        {/* 펼침: 참석자 명단 */}
        {expanded && (
          <View style={styles.attendeeList}>
            <Text style={[Typography.caption, { marginBottom: 6, fontWeight: '600' }]}>참석자 명단</Text>
            {localAttendance.length === 0 ? (
              <Text style={[Typography.caption, { color: Colors.textMuted }]}>아직 응답이 없습니다.</Text>
            ) : (
              localAttendance.map((a) => (
                <AttendeeRow
                  key={a.id}
                  attendance={a}
                  memberName={memberMap[a.member_id] ?? '(알 수 없음)'}
                  isManager={isManager}
                  onCheckin={handleCheckin}
                />
              ))
            )}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// 메인 화면
// ──────────────────────────────────────────────

export default function AttendanceScreen() {
  const { club, me } = useClub();

  if (!club || !me) return <LoadingView />;

  return <AttendanceContent club={club} me={me} />;
}

interface AttendanceContentProps {
  club: import('../../lib/types').Club;
  me: Member;
}

function AttendanceContent({ club, me }: AttendanceContentProps) {
  const isManager = me.role !== 'member';

  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
  // 분류 기준 시각 — 데이터 로드 시점에 갱신 (render 중 impure 호출 금지 — React Compiler purity)
  const [nowTs, setNowTs] = useState(0);
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // 세션 + attendance 조인
      const { data: sessionRows, error: sessionErr } = await supabase
        .from('sessions')
        .select('*, attendance(*)')
        .eq('club_id', club.id)
        .order('starts_at', { ascending: false });
      if (sessionErr) throw sessionErr;

      setSessions((sessionRows ?? []) as SessionWithAttendance[]);
      setNowTs(Date.now());

      // 멤버 이름 맵
      const { data: memberRows, error: memberErr } = await supabase
        .from('members')
        .select('id, name')
        .eq('club_id', club.id);
      if (memberErr) throw memberErr;

      const map: Record<string, string> = {};
      for (const m of memberRows ?? []) {
        map[m.id] = m.name;
      }
      setMemberMap(map);
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '데이터 로드에 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [club.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function handleRefresh() {
    setRefreshing(true);
    void fetchData();
  }

  const upcoming = useMemo(
    () =>
      sessions
        .filter((s) => new Date(s.starts_at).getTime() >= nowTs)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [sessions, nowTs],
  );

  const past = useMemo(
    () =>
      sessions
        .filter((s) => new Date(s.starts_at).getTime() < nowTs)
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()),
    [sessions, nowTs],
  );

  // FlatList 데이터 구조: 헤더 + 아이템 혼합
  type ListItem =
    | { type: 'create_btn' }
    | { type: 'create_form' }
    | { type: 'section_header'; title: string }
    | { type: 'session'; session: SessionWithAttendance; isUpcoming: boolean }
    | { type: 'empty'; message: string };

  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];

    if (isManager) {
      if (showCreateForm) {
        items.push({ type: 'create_form' });
      } else {
        items.push({ type: 'create_btn' });
      }
    }

    items.push({ type: 'section_header', title: '다가오는 모임' });
    if (upcoming.length === 0) {
      items.push({ type: 'empty', message: '예정된 모임이 없습니다.' });
    } else {
      for (const s of upcoming) {
        items.push({ type: 'session', session: s, isUpcoming: true });
      }
    }

    items.push({ type: 'section_header', title: '지난 모임' });
    if (past.length === 0) {
      items.push({ type: 'empty', message: '지난 모임 기록이 없습니다.' });
    } else {
      for (const s of past) {
        items.push({ type: 'session', session: s, isUpcoming: false });
      }
    }

    return items;
  }, [isManager, showCreateForm, upcoming, past]);

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'create_btn') {
      return (
        <Button
          title="+ 모임 만들기"
          onPress={() => setShowCreateForm(true)}
          style={styles.createBtn}
        />
      );
    }
    if (item.type === 'create_form') {
      return (
        <CreateSessionForm
          clubId={club.id}
          myMemberId={me.id}
          onCreated={() => {
            setShowCreateForm(false);
            void fetchData();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      );
    }
    if (item.type === 'section_header') {
      return (
        <View style={styles.sectionHeader}>
          <SectionTitle title={item.title} />
        </View>
      );
    }
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyRow}>
          <Text style={[Typography.caption, { color: Colors.textMuted }]}>{item.message}</Text>
        </View>
      );
    }
    // session
    return (
      <SessionCard
        session={item.session}
        isUpcoming={item.isUpcoming}
        isManager={isManager}
        myMemberId={me.id}
        memberMap={memberMap}
        onRefresh={fetchData}
      />
    );
  }

  if (loading) return <LoadingView />;

  return (
    <ScreenContainer>
      <FlatList
        data={listData}
        keyExtractor={(item, index) => {
          if (item.type === 'session') return `session-${item.session.id}`;
          if (item.type === 'section_header') return `header-${item.title}`;
          return `${item.type}-${index}`;
        }}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState message="모임이 없습니다." />}
      />
    </ScreenContainer>
  );
}

// ──────────────────────────────────────────────
// 스타일
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    padding: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  createBtn: {
    marginBottom: Spacing.sm,
  },
  formCard: {
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    padding: Spacing.xs,
    fontSize: 17,
    color: Colors.text,
    backgroundColor: Colors.background,
    minHeight: TouchTarget.min,
  },
  formRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  sectionHeader: {
    marginTop: 4,
  },
  emptyRow: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rsvpRow: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
    gap: 8,
  },
  rsvpBtn: {
    flex: 1,
    minHeight: TouchTarget.min,
    borderRadius: Radius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  rsvpBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryContainer,
  },
  rsvpBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  rsvpBtnTextActive: {
    color: Colors.primary,
  },
  attendeeList: {
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: TouchTarget.min,
  },
  attendeeEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  checkinBtn: {
    backgroundColor: Colors.tertiary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinBtnText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
