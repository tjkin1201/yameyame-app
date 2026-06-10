import React from 'react';
import { ScrollView, StyleSheet, View, Dimensions } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, useTheme, Divider } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import { GymStyles } from '../theme/gymTheme';
import { getMemberDashboard, MemberDashboard } from '../services/api';
import { offlineApi } from '../services/offlineApi';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MemberDetailScreenProps {
  route: { params: { memberId: string; memberName: string } };
}

export default function MemberDetailScreen({ route }: MemberDetailScreenProps) {
  const theme = useTheme();
  const { memberId, memberName } = route.params;
  const [dashboard, setDashboard] = React.useState<MemberDashboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadDashboard();
  }, [memberId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMemberDashboard(memberId);
      setDashboard(data);
    } catch (err) {
      setError(
        offlineApi.isOnline()
          ? '대시보드를 불러올 수 없습니다'
          : '오프라인 상태입니다 — 대시보드는 온라인에서 볼 수 있어요'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>대시보드 로딩 중...</Text>
      </View>
    );
  }

  if (error || !dashboard) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={styles.errorText}>{error || '데이터를 불러올 수 없습니다'}</Text>
      </View>
    );
  }

  const { member, eloTrend, recentGames, monthlyStats, headToHead, form } = dashboard;

  // ELO 차트 데이터
  const chartData = eloTrend.map((point, index) => ({
    value: point.elo,
    label: index % 10 === 0 ? `${index}` : '',
    dataPointText: point.elo.toString(),
  }));

  const getFormColor = () => {
    if (form.status === 'hot') return '#4CAF50';
    if (form.status === 'cold') return '#F44336';
    return '#FF9800';
  };

  const getFormText = () => {
    if (form.status === 'hot') return '상승세 🔥';
    if (form.status === 'cold') return '하락세 ❄️';
    return '안정세';
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* 기본 정보 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.memberName}>{member.name}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>현재 ELO</Text>
                <Text style={styles.statValue}>{member.elo}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>최고 ELO</Text>
                <Text style={styles.statValue}>{member.highestElo}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>최저 ELO</Text>
                <Text style={styles.statValue}>{member.lowestElo}</Text>
              </View>
            </View>

            <View style={styles.chipsRow}>
              <Chip mode="flat" compact>{member.level}</Chip>
              <Chip mode="flat" compact>{member.position}</Chip>
              <Chip mode="flat" compact style={{ backgroundColor: getFormColor() }}>
                {getFormText()}
              </Chip>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.recordRow}>
              <Text style={styles.recordText}>
                {member.stats.totalGames}전 {member.stats.wins}승 {member.stats.losses}패
              </Text>
              <Text style={styles.winRateText}>
                승률 {(member.stats.winRate * 100).toFixed(1)}%
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* ELO 추이 차트 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>ELO 추이 (최근 {eloTrend.length}게임)</Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={chartData}
                width={SCREEN_WIDTH - 80}
                height={220}
                spacing={Math.max(50, (SCREEN_WIDTH - 80) / chartData.length)}
                initialSpacing={10}
                color={theme.colors.primary}
                thickness={3}
                startFillColor={theme.colors.primary}
                endFillColor={theme.colors.background}
                startOpacity={0.4}
                endOpacity={0.1}
                backgroundColor={theme.colors.background}
                rulesColor="#E0E0E0"
                rulesType="solid"
                yAxisColor="#E0E0E0"
                xAxisColor="#E0E0E0"
                yAxisTextStyle={{ color: '#666', fontSize: 12 }}
                xAxisLabelTextStyle={{ color: '#666', fontSize: 10 }}
                hideDataPoints={chartData.length > 20}
                dataPointsColor={theme.colors.primary}
                dataPointsRadius={4}
                textShiftY={-8}
                textShiftX={-5}
                textFontSize={10}
                showVerticalLines
                verticalLinesColor="#F0F0F0"
              />
            </View>
          </Card.Content>
        </Card>

        {/* 월별 통계 */}
        {monthlyStats.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>월별 통계</Text>
              {monthlyStats.slice(0, 6).map((stat) => (
                <View key={stat.month} style={styles.monthRow}>
                  <Text style={styles.monthText}>{stat.month}</Text>
                  <Text style={styles.monthStats}>
                    {stat.games}게임 · {stat.wins}승 {stat.losses}패 · 승률 {stat.winRate}%
                  </Text>
                  <Text
                    style={[
                      styles.eloChange,
                      { color: stat.eloChange >= 0 ? '#4CAF50' : '#F44336' },
                    ]}
                  >
                    {stat.eloChange >= 0 ? '+' : ''}
                    {stat.eloChange}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* 최근 경기 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>최근 경기 ({recentGames.length})</Text>
            {recentGames.slice(0, 10).map((game) => (
              <View key={game._id} style={styles.gameRow}>
                <Chip
                  mode="flat"
                  compact
                  style={[
                    styles.resultChip,
                    { backgroundColor: game.isWin ? '#4CAF50' : '#F44336' },
                  ]}
                  textStyle={{ color: '#FFF', fontSize: 12 }}
                >
                  {game.isWin ? '승' : '패'}
                </Chip>
                <Text style={styles.gameType}>{game.type === 'singles' ? '단식' : '복식'}</Text>
                <Text style={styles.gameScore}>
                  {game.team1.score} : {game.team2.score}
                </Text>
                <Text style={styles.gameDate}>
                  {new Date(game.date).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* 상대 전적 */}
        {headToHead.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>상대 전적 Top 5</Text>
              {headToHead.slice(0, 5).map((record, index) => (
                <View key={record.opponent._id} style={styles.opponentRow}>
                  <Text style={styles.opponentRank}>#{index + 1}</Text>
                  <Text style={styles.opponentName}>{record.opponent.name}</Text>
                  <Text style={styles.opponentRecord}>
                    {record.wins}승 {record.losses}패
                  </Text>
                  <Text style={styles.opponentWinRate}>
                    {record.total > 0
                      ? Math.round((record.wins / record.total) * 100)
                      : 0}%
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: GymStyles.spacing.md },
  card: { marginBottom: GymStyles.spacing.md },
  memberName: { ...GymStyles.typography.h1, textAlign: 'center', marginBottom: GymStyles.spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: GymStyles.spacing.md },
  statItem: { alignItems: 'center' },
  statLabel: { ...GymStyles.typography.caption, opacity: 0.7 },
  statValue: { ...GymStyles.typography.h2, fontWeight: 'bold', marginTop: 4 },
  chipsRow: { flexDirection: 'row', gap: GymStyles.spacing.xs, justifyContent: 'center', marginBottom: GymStyles.spacing.md },
  divider: { marginVertical: GymStyles.spacing.md },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordText: { ...GymStyles.typography.body },
  winRateText: { ...GymStyles.typography.h3, color: '#4CAF50' },
  cardTitle: { ...GymStyles.typography.h3, marginBottom: GymStyles.spacing.md },
  chartContainer: { alignItems: 'center', marginVertical: GymStyles.spacing.sm },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  monthText: { ...GymStyles.typography.body, fontWeight: 'bold', width: 70 },
  monthStats: { ...GymStyles.typography.caption, flex: 1 },
  eloChange: { ...GymStyles.typography.body, fontWeight: 'bold', width: 50, textAlign: 'right' },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: GymStyles.spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  resultChip: { width: 40 },
  gameType: { ...GymStyles.typography.body, width: 50 },
  gameScore: { ...GymStyles.typography.body, flex: 1, textAlign: 'center' },
  gameDate: { ...GymStyles.typography.caption, width: 60, textAlign: 'right' },
  opponentRow: { flexDirection: 'row', alignItems: 'center', gap: GymStyles.spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  opponentRank: { ...GymStyles.typography.body, fontWeight: 'bold', width: 40 },
  opponentName: { ...GymStyles.typography.body, flex: 1 },
  opponentRecord: { ...GymStyles.typography.body, width: 80, textAlign: 'right' },
  opponentWinRate: { ...GymStyles.typography.body, fontWeight: 'bold', width: 50, textAlign: 'right', color: '#4CAF50' },
  loadingText: { ...GymStyles.typography.body, marginTop: GymStyles.spacing.md },
  errorText: { ...GymStyles.typography.h2, textAlign: 'center', color: '#F44336' },
});
