import React from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Button, Card, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';
import { getGames, getLeaderboard } from '../services/api';

export default function HomeScreen() {
  const theme = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [todayGames, setTodayGames] = React.useState(0);
  const [inProgressGames, setInProgressGames] = React.useState(0);
  const [myRating, setMyRating] = React.useState({ elo: 1200, rank: 0, wins: 0, losses: 0 });

  const loadData = React.useCallback(async () => {
    try {
      const [gamesResponse, leaderboardResponse] = await Promise.all([
        getGames({ status: 'in_progress', limit: 100 }),
        getLeaderboard(100),
      ]);

      setInProgressGames(gamesResponse.total);

      // 가장 높은 ELO를 "나의 레이팅"으로 표시 (실제로는 로그인한 사용자 정보 필요)
      if (leaderboardResponse.leaderboard.length > 0) {
        const topPlayer = leaderboardResponse.leaderboard[0];
        setMyRating({
          elo: topPlayer.elo,
          rank: 1,
          wins: topPlayer.stats.wins,
          losses: topPlayer.stats.losses,
        });
      }

      // 오늘 날짜의 게임 수 계산
      const today = new Date().toISOString().split('T')[0];
      const todayGamesResponse = await getGames({ limit: 1000 });
      const todayCount = todayGamesResponse.games.filter((game) =>
        game.date.startsWith(today)
      ).length;
      setTodayGames(todayCount);
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>데이터 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <Text style={styles.title}>YameYame</Text>
        <Text style={styles.subtitle}>동탄 배드민턴을 즐기는 사람들</Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>오늘의 게임</Text>
            <Text style={styles.cardText}>
              {inProgressGames > 0
                ? `${inProgressGames}개 게임 진행 중`
                : todayGames > 0
                ? `오늘 ${todayGames}개 게임 완료`
                : '진행 중인 게임이 없습니다'}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" style={styles.button} labelStyle={styles.buttonLabel}>
              게임 시작
            </Button>
          </Card.Actions>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>나의 레이팅</Text>
            <Text style={styles.cardText}>
              {myRating.elo} (#{myRating.rank}) · {myRating.wins}승 {myRating.losses}패
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>최근 공지</Text>
            <Text style={styles.cardText}>새로운 공지사항이 없습니다</Text>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: GymStyles.spacing.md },
  title: {
    ...GymStyles.typography.h1,
    marginBottom: GymStyles.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...GymStyles.typography.body,
    textAlign: 'center',
    marginBottom: GymStyles.spacing.lg,
    opacity: 0.7,
  },
  card: { marginBottom: GymStyles.spacing.md },
  cardTitle: { ...GymStyles.typography.h3, marginBottom: GymStyles.spacing.sm },
  cardText: { ...GymStyles.typography.body },
  button: { minHeight: GymStyles.touchTarget.minHeight },
  buttonLabel: { ...GymStyles.typography.button },
  loadingText: { ...GymStyles.typography.body, marginTop: GymStyles.spacing.md },
});
