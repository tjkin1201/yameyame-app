import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';

export default function CommunityScreen() {
  const theme = useTheme();
  const [tab, setTab] = React.useState('chat');

  const empty: Record<string, [string, string]> = {
    chat: ['채팅방이 없습니다', '첫 메시지를 보내보세요'],
    gallery: ['사진이 없습니다', 'Band 갤러리와 연동됩니다'],
    board: ['게시글이 없습니다', 'Band 게시판과 연동됩니다'],
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'chat', label: '채팅' },
            { value: 'gallery', label: '갤러리' },
            { value: 'board', label: '게시판' },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emptyText}>{empty[tab][0]}</Text>
        <Text style={styles.emptySubtext}>{empty[tab][1]}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: { padding: GymStyles.spacing.md },
  content: { padding: GymStyles.spacing.md, alignItems: 'center' },
  emptyText: {
    ...GymStyles.typography.h2,
    textAlign: 'center',
    marginTop: GymStyles.spacing.xl,
  },
  emptySubtext: {
    ...GymStyles.typography.body,
    textAlign: 'center',
    marginTop: GymStyles.spacing.sm,
    opacity: 0.7,
  },
});
