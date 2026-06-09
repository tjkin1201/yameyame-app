import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FAB, Text, useTheme } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';

export default function GamesScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emptyText}>등록된 게임이 없습니다</Text>
        <Text style={styles.emptySubtext}>+ 버튼을 눌러 새 게임을 시작하세요</Text>
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        label="게임 등록"
        onPress={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  fab: {
    position: 'absolute',
    right: GymStyles.spacing.md,
    bottom: GymStyles.spacing.md,
  },
});
