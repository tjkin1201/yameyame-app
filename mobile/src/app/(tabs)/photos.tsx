/**
 * 사진첩 탭
 * - 클럽 사진 그리드(3열), FAB 업로드, long-press 삭제
 */
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, LoadingView, ScreenContainer } from '../../components/ui';
import { useClub } from '../../lib/club-context';
import { supabase } from '../../lib/supabase';
import type { Photo } from '../../lib/types';
import { Colors, Spacing } from '../../lib/theme';

// ─── 상수 ───────────────────────────────────────────────────────────────────
const NUM_COLUMNS = 3;
const CELL_GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - CELL_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────
/** storage path → signed URL 맵 */
async function buildSignedUrlMap(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) {
      map[item.path] = item.signedUrl;
    }
  }
  return map;
}

/** 에포크 ms + 난수로 고유 파일명 생성 */
function makeFilename(clubId: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${clubId}/${ts}_${rand}.jpg`;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────
interface PhotoRow extends Photo {
  signedUrl: string | null;
}

export default function PhotosScreen() {
  const { club, me } = useClub();
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── 데이터 조회 ──────────────────────────────────────────────────────────
  const fetchPhotos = useCallback(async () => {
    if (!club) return;
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('club_id', club.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Photo[];
      const paths = rows.map((p) => p.storage_path);
      const urlMap = await buildSignedUrlMap(paths);

      setPhotos(
        rows.map((p) => ({
          ...p,
          signedUrl: urlMap[p.storage_path] ?? null,
        })),
      );
    } catch (e: unknown) {
      Alert.alert('오류', e instanceof Error ? e.message : '실패했습니다');
    }
  }, [club]);

  useEffect(() => {
    setLoading(true);
    fetchPhotos().finally(() => setLoading(false));
  }, [fetchPhotos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPhotos();
    setRefreshing(false);
  }, [fetchPhotos]);

  // ── 업로드 ──────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!club || !me) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진첩 접근 권한이 필요합니다. 설정에서 허용해 주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('오류', '이미지 데이터를 읽을 수 없습니다.');
      return;
    }

    setUploading(true);
    try {
      const filePath = makeFilename(club.id);
      const buffer = decode(asset.base64);

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, buffer, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('photos').insert({
        club_id: club.id,
        uploader_id: me.id,
        storage_path: filePath,
      });
      if (insertError) throw insertError;

      await fetchPhotos();
    } catch (e: unknown) {
      Alert.alert('업로드 실패', e instanceof Error ? e.message : '실패했습니다');
    } finally {
      setUploading(false);
    }
  }, [club, me, fetchPhotos]);

  // ── 삭제 ──────────────────────────────────────────────────────────────
  const handleLongPress = useCallback(
    (photo: PhotoRow) => {
      if (!me) return;
      const canDelete = photo.uploader_id === me.id || me.role !== 'member';
      if (!canDelete) return;

      Alert.alert('사진 삭제', '이 사진을 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              // DB row 먼저 삭제(UI 일관성 우선) — storage 실패 시 고아 파일만 남고 화면엔 안 보임
              const { error: dbError } = await supabase
                .from('photos')
                .delete()
                .eq('id', photo.id);
              if (dbError) throw dbError;

              const { error: storageError } = await supabase.storage
                .from('photos')
                .remove([photo.storage_path]);
              if (storageError) {
                console.warn('storage 정리 실패(고아 파일):', storageError.message);
              }

              await fetchPhotos();
            } catch (e: unknown) {
              Alert.alert('삭제 실패', e instanceof Error ? e.message : '실패했습니다');
            }
          },
        },
      ]);
    },
    [me, fetchPhotos],
  );

  // ── 가드 ──────────────────────────────────────────────────────────────
  if (!club || !me) return <LoadingView />;
  if (loading) return <LoadingView />;

  // ── 렌더 ──────────────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={photos.length === 0 ? styles.emptyContainer : styles.listContent}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState message="첫 사진을 올려보세요 📷" />}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            style={styles.cell}
          >
            {item.signedUrl ? (
              <Image
                source={{ uri: item.signedUrl }}
                style={styles.cellImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.cellImage, styles.cellPlaceholder]} />
            )}
          </Pressable>
        )}
      />

      {/* FAB 업로드 버튼 */}
      <Pressable
        onPress={handleUpload}
        disabled={uploading}
        style={({ pressed }) => [
          styles.fab,
          { opacity: pressed || uploading ? 0.8 : 1 },
        ]}
        accessibilityLabel="사진 업로드"
        accessibilityRole="button"
      >
        {uploading ? (
          <ActivityIndicator color={Colors.onSecondary} size="small" />
        ) : (
          <Ionicons name="add" size={32} color={Colors.onSecondary} />
        )}
      </Pressable>
    </ScreenContainer>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: CELL_GAP,
    paddingTop: CELL_GAP,
    paddingBottom: 100, // FAB 여백
  },
  emptyContainer: {
    flex: 1,
  },
  row: {
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  cellImage: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  cellPlaceholder: {
    backgroundColor: Colors.surfaceVariant,
  },
  fab: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
