import React from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Button, Card, Text, ActivityIndicator, useTheme, Banner } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';
import { socketService } from '../services/socket';
import { offlineApi } from '../services/offlineApi';

export default function HomeScreen() {
  const theme = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [todayGames, setTodayGames] = React.useState(0);
  const [inProgressGames, setInProgressGames] = React.useState(0);
  const [myRating, setMyRating] = React.useState({ elo: 1200, rank: 0, wins: 0, losses: 0 });
  const [isOnline, setIsOnline] = React.useState(offlineApi.isOnline());
  const [syncing, setSyncing] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const [gamesResponse, membersResponse] = await Promise.all([
        offlineApi.getGames({ status: 'in_progress', limit: 100 }),
        offlineApi.getMembers({ isActive: true, limit: 100 }),
      ]);

      setInProgressGames(gamesResponse.total);

      // 가장 높은 ELO를 "나의 레이팅"으로 표시 (실제로는 로그인한 사용자 정보 필요)
      if (membersResponse.members.length > 0) {
        const topPlayer = membersResponse.members[0];
        setMyRating({
          elo: topPlayer.elo,
          rank: 1,
          wins: topPlayer.stats.wins,
          losses: topPlayer.stats.losses,
        });
      }

      // 오늘 날짜의 게임 수 계산
      const today = new Date().toISOString().split('T')[0];
      const todayGamesResponse = await offlineApi.getGames({ limit: 1000 });
      const todayCount = todayGamesResponse.games.filter((game: any) =>
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

  const handleSync = async () => {
    try {
      setSyncing(true);
      await offlineApi.syncNow();
      await loadData();
    } catch (err) {
      console.error('동기화 실패:', err);
    } finally {
      setSyncing(false);
    }
  };

  React.useEffect(() => {
    const handleNetworkChange = (online: boolean) => {
      setIsOnline(online);
      if (online) {
        loadData(); // 온라인으로 전환되면 새로고침
      }
    };

    offlineApi.onNetworkChange(handleNetworkChange);

    return () => {
      offlineApi.offNetworkChange(handleNetworkChange);
    };
  }, []);

  React.useEffect(() => {
    loadData();

    // Socket.io 실시간 업데이트
    const handleGameCreated = () => {
      loadData(); // 새 게임이 생성되면 데이터 새로고침
    };

    const handleGameCompleted = (data: any) => {
      console.log('Game completed:', data);
      loadData(); // 게임 완료 시 통계 새로고침
    };

    const handleEloUpdated = (data: any) => {
      console.log('ELO updated:', data);
      // 자신의 ELO가 업데이트된 경우 알림
      if (data.isWin) {
        console.log(`축하합니다! ELO ${data.change > 0 ? '+' : ''}${data.change}`);
      }
      loadData(); // ELO 변경 시 레이팅 새로고침
    };

    socketService.on('game:created', handleGameCreated);
    socketService.on('game:completed', handleGameCompleted);
    socketService.on('elo:updated', handleEloUpdated);

    return () => {
      socketService.off('game:created', handleGameCreated);
      socketService.off('game:completed', handleGameCompleted);
      socketService.off('elo:updated', handleEloUpdated);
    };
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
      {!isOnline && (
        <Banner
          visible={true}
          icon="wifi-off"
          actions={[
            {
              label: syncing ? '동기화 중...' : '동기화',
              onPress: handleSync,
              disabled: syncing,
            },
          ]}
        >
          오프라인 모드 - 로컬 데이터를 사용 중입니다
        </Banner>
      )}
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
