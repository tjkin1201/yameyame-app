import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, Text, Card, Chip, ActivityIndicator, useTheme } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';
import { getGames, Game } from '../services/api';

export default function GamesScreen() {
  const theme = useTheme();
  const [games, setGames] = React.useState<Game[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadGames = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getGames({ limit: 50, sortBy: 'date', order: 'desc' });
      setGames(response.games);
    } catch (err) {
      setError('게임 목록을 불러올 수 없습니다');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadGames();
  }, [loadGames]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'scheduled':
        return '#FF9800';
      case 'cancelled':
        return '#9E9E9E';
      default:
        return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'in_progress':
        return '진행중';
      case 'scheduled':
        return '예정';
      case 'cancelled':
        return '취소';
      default:
        return status;
    }
  };

  const renderGame = ({ item }: { item: Game }) => (
    <Card style={styles.card} mode="outlined">
      <Card.Content>
        <View style={styles.gameHeader}>
          <Chip
            mode="flat"
            compact
            style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
            textStyle={{ color: '#FFF' }}
          >
            {getStatusText(item.status)}
          </Chip>
          <Text style={styles.gameType}>{item.type === 'singles' ? '단식' : '복식'}</Text>
        </View>

        <View style={styles.teamRow}>
          <View style={styles.team}>
            <Text style={styles.teamLabel}>팀 1</Text>
            {item.team1.players.map((player) => (
              <Text key={player._id} style={styles.playerName}>
                {player.name} ({player.elo})
              </Text>
            ))}
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.score}>{item.team1.score}</Text>
            <Text style={styles.scoreDivider}>:</Text>
            <Text style={styles.score}>{item.team2.score}</Text>
          </View>

          <View style={styles.team}>
            <Text style={styles.teamLabel}>팀 2</Text>
            {item.team2.players.map((player) => (
              <Text key={player._id} style={styles.playerName}>
                {player.name} ({player.elo})
              </Text>
            ))}
          </View>
        </View>

        {item.status === 'completed' && item.eloChanges && (
          <View style={styles.eloChanges}>
            <Text style={styles.eloLabel}>ELO 변동:</Text>
            <Text style={styles.eloText}>
              팀1: {item.eloChanges.team1.map((c) => (c > 0 ? `+${c}` : c)).join(', ')} · 팀2:{' '}
              {item.eloChanges.team2.map((c) => (c > 0 ? `+${c}` : c)).join(', ')}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>게임 정보 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>서버 연결을 확인하세요</Text>
        </View>
      ) : games.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>등록된 게임이 없습니다</Text>
          <Text style={styles.emptySubtext}>+ 버튼을 눌러 새 게임을 시작하세요</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          renderItem={renderGame}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
        />
      )}

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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: GymStyles.spacing.md },
  list: { padding: GymStyles.spacing.md },
  card: { marginBottom: GymStyles.spacing.md },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: GymStyles.spacing.md },
  statusChip: { height: 28 },
  gameType: { ...GymStyles.typography.h3 },
  teamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  team: { flex: 1 },
  teamLabel: { ...GymStyles.typography.caption, fontWeight: 'bold', marginBottom: GymStyles.spacing.xs },
  playerName: { ...GymStyles.typography.body, marginBottom: 2 },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GymStyles.spacing.md },
  score: { ...GymStyles.typography.h1, fontWeight: 'bold', width: 40, textAlign: 'center' },
  scoreDivider: { ...GymStyles.typography.h2, marginHorizontal: GymStyles.spacing.xs },
  eloChanges: {
    marginTop: GymStyles.spacing.md,
    paddingTop: GymStyles.spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  eloLabel: { ...GymStyles.typography.caption, fontWeight: 'bold' },
  eloText: { ...GymStyles.typography.body, marginTop: 4 },
  loadingText: { ...GymStyles.typography.body, marginTop: GymStyles.spacing.md },
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
  errorText: {
    ...GymStyles.typography.h2,
    textAlign: 'center',
    color: '#FF5252',
  },
  errorSubtext: {
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
