import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Searchbar, Text, useTheme } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';

export default function MembersScreen() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="회원 검색"
          onChangeText={setSearchQuery}
          value={searchQuery}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emptyText}>등록된 회원이 없습니다</Text>
        <Text style={styles.emptySubtext}>Band 연동 후 회원 정보가 표시됩니다</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { padding: GymStyles.spacing.md },
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
