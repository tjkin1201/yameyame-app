/**
 * 공지 전체 목록 — 루트 스택 화면
 * pinned 내림차순 → created_at 내림차순
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
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
} from '../components/ui';
import { useClub } from '../lib/club-context';
import { supabase } from '../lib/supabase';
import { Colors, Radius, Spacing, TouchTarget, Typography } from '../lib/theme';
import type { Announcement } from '../lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AnnouncementCardProps {
  item: Announcement;
  isManager: boolean;
  onTogglePin: (item: Announcement) => void;
  onDelete: (item: Announcement) => void;
}

function AnnouncementCard({
  item,
  isManager,
  onTogglePin,
  onDelete,
}: AnnouncementCardProps) {
  return (
    <Card style={styles.annoCard}>
      <View style={styles.annoHeader}>
        <View style={styles.annoTitleRow}>
          {item.pinned && (
            <Text style={styles.pinEmoji}>📌 </Text>
          )}
          <Text style={[Typography.body, styles.annoTitle]}>{item.title}</Text>
        </View>
        {isManager && (
          <View style={styles.annoActions}>
            <Pressable
              onPress={() => onTogglePin(item)}
              style={styles.iconBtn}
              accessibilityLabel={item.pinned ? '고정 해제' : '상단 고정'}
            >
              <Ionicons
                name="pin"
                size={20}
                color={item.pinned ? Colors.secondary : Colors.textMuted}
              />
            </Pressable>
            <Pressable
              onPress={() => onDelete(item)}
              style={styles.iconBtn}
              accessibilityLabel="공지 삭제"
            >
              <Ionicons name="trash" size={20} color={Colors.error} />
            </Pressable>
          </View>
        )}
      </View>
      {item.body !== null && item.body.trim().length > 0 && (
        <Text style={[Typography.body, styles.annoBody]}>{item.body}</Text>
      )}
      <Text style={[Typography.caption, styles.annoDate]}>{formatDate(item.created_at)}</Text>
    </Card>
  );
}

interface NewAnnoForm {
  title: string;
  body: string;
  pinned: boolean;
}

const EMPTY_FORM: NewAnnoForm = { title: '', body: '', pinned: false };

export default function AnnouncementsScreen() {
  const { club, me, refresh: refreshCtx } = useClub();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewAnnoForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    if (!club) return;
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('club_id', club.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncements((data ?? []) as Announcement[]);
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    }
  }, [club]);

  useEffect(() => {
    setLoading(true);
    loadAnnouncements().finally(() => setLoading(false));
  }, [loadAnnouncements]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnnouncements();
    await refreshCtx();
    setRefreshing(false);
  }, [loadAnnouncements, refreshCtx]);

  const handleSubmit = useCallback(async () => {
    if (!club || !me) return;
    const title = form.title.trim();
    if (!title) {
      Alert.alert('제목을 입력해 주세요');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        club_id: club.id,
        author_id: me.id,
        title,
        body: form.body.trim() || null,
        pinned: form.pinned,
      });
      if (error) throw error;
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await loadAnnouncements();
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    } finally {
      setSubmitting(false);
    }
  }, [club, me, form, loadAnnouncements]);

  const handleTogglePin = useCallback(
    async (item: Announcement) => {
      try {
        const { error } = await supabase
          .from('announcements')
          .update({ pinned: !item.pinned })
          .eq('id', item.id);
        if (error) throw error;
        await loadAnnouncements();
      } catch (e: unknown) {
        Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
      }
    },
    [loadAnnouncements],
  );

  const handleDelete = useCallback(
    (item: Announcement) => {
      Alert.alert(
        '공지 삭제',
        `"${item.title}" 공지를 삭제하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('announcements')
                  .delete()
                  .eq('id', item.id);
                if (error) throw error;
                await loadAnnouncements();
              } catch (e: unknown) {
                Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
              }
            },
          },
        ],
      );
    },
    [loadAnnouncements],
  );

  if (!club || !me) return <LoadingView />;
  const isManager = me.role !== 'member';

  if (loading) return <LoadingView />;

  return (
    <ScreenContainer>
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          isManager ? (
            <View style={styles.formSection}>
              {formOpen ? (
                <Card style={styles.formCard}>
                  <Text style={[Typography.h3, { marginBottom: Spacing.xs }]}>공지 작성</Text>
                  <TextInput
                    style={styles.inputTitle}
                    placeholder="제목"
                    placeholderTextColor={Colors.textMuted}
                    value={form.title}
                    onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                    returnKeyType="next"
                  />
                  <TextInput
                    style={styles.inputBody}
                    placeholder="내용 (선택)"
                    placeholderTextColor={Colors.textMuted}
                    value={form.body}
                    onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <View style={styles.pinnedRow}>
                    <Text style={Typography.body}>상단 고정</Text>
                    <Switch
                      value={form.pinned}
                      onValueChange={(v) => setForm((f) => ({ ...f, pinned: v }))}
                      trackColor={{ false: Colors.border, true: Colors.primary }}
                      thumbColor={Colors.background}
                    />
                  </View>
                  <View style={styles.formButtons}>
                    <Button
                      title="등록"
                      onPress={handleSubmit}
                      loading={submitting}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="취소"
                      variant="outline"
                      onPress={() => {
                        setFormOpen(false);
                        setForm(EMPTY_FORM);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              ) : (
                <Button
                  title="+ 공지 작성"
                  variant="outline"
                  onPress={() => setFormOpen(true)}
                  style={styles.addBtn}
                />
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <AnnouncementCard
            item={item}
            isManager={isManager}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={<EmptyState message="등록된 공지가 없습니다" />}
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  formSection: {
    padding: Spacing.sm,
    paddingBottom: 0,
  },
  formCard: {
    marginBottom: Spacing.sm,
  },
  inputTitle: {
    height: TouchTarget.recommended,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputBody: {
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    minHeight: TouchTarget.min,
  },
  formButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  addBtn: {
    marginBottom: Spacing.sm,
  },
  annoCard: {
    marginHorizontal: Spacing.sm,
  },
  annoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  annoTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pinEmoji: {
    fontSize: 16,
  },
  annoTitle: {
    fontWeight: '700',
    flexShrink: 1,
  },
  annoActions: {
    flexDirection: 'row',
    marginLeft: Spacing.xs,
  },
  iconBtn: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annoBody: {
    color: Colors.textMuted,
    marginBottom: 6,
  },
  annoDate: {
    marginTop: 2,
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
});
