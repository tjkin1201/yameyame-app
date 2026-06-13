import React from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Searchbar, Text, Card, Avatar, Chip, ActivityIndicator, useTheme, SegmentedButtons, IconButton, Menu, Divider, Banner } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';
import { offlineApi } from '../services/offlineApi';

interface MembersScreenProps {
  navigation: any;
}

export default function MembersScreen({ navigation }: MembersScreenProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [members, setMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [levelFilter, setLevelFilter] = React.useState<string>('');
  const [period, setPeriod] = React.useState<'all' | 'month' | 'week'>('all');
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(offlineApi.isOnline());
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    const handleNetworkChange = (online: boolean) => {
      setIsOnline(online);
      if (online) {
        loadMembers(); // 온라인으로 전환되면 새로고침
      }
    };

    offlineApi.onNetworkChange(handleNetworkChange);

    return () => {
      offlineApi.offNetworkChange(handleNetworkChange);
    };
  }, []);

  const loadMembers = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await offlineApi.getMembers({
        search: searchQuery,
        isActive: true,
        limit: 100
      });

      setMembers(response.members);
    } catch (err) {
      setError('회원 목록을 불러올 수 없습니다');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, levelFilter]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await offlineApi.syncNow();
      await loadMembers();
    } catch (err) {
      console.error('동기화 실패:', err);
    } finally {
      setSyncing(false);
    }
  };

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleMemberPress = (member: any) => {
    navigation.navigate('MemberDetail', {
      memberId: member._id,
      memberName: member.name,
    });
  };

  const renderMember = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity onPress={() => handleMemberPress(item)}>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.memberRow}>
            <View style={styles.rankContainer}>
              <Text style={styles.rankText}>#{index + 1}</Text>
            </View>
            <Avatar.Text
              size={56}
              label={item.name[0]}
              style={{ backgroundColor: theme.colors.primary }}
            />
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.name}</Text>
            <View style={styles.memberStats}>
              <Chip mode="flat" compact style={styles.chip}>
                ELO: {item.elo}
              </Chip>
              <Chip mode="flat" compact style={styles.chip}>
                {item.stats.totalGames}전 {item.stats.wins}승 {item.stats.losses}패
              </Chip>
            </View>
            <Text style={styles.memberSubtext}>
              승률: {(item.stats.winRate * 100).toFixed(1)}% · {item.level}
              {item.stats.currentStreak !== 0 && ` · ${item.stats.currentStreak > 0 ? item.stats.currentStreak + '연승' : Math.abs(item.stats.currentStreak) + '연패'}`}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>회원 정보 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder="회원 검색"
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="filter"
                size={24}
                onPress={() => setMenuVisible(true)}
                style={styles.filterButton}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setLevelFilter('');
                setMenuVisible(false);
              }}
              title="전체 레벨"
              leadingIcon={!levelFilter ? 'check' : undefined}
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setLevelFilter('beginner');
                setMenuVisible(false);
              }}
              title="초급"
              leadingIcon={levelFilter === 'beginner' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => {
                setLevelFilter('intermediate');
                setMenuVisible(false);
              }}
              title="중급"
              leadingIcon={levelFilter === 'intermediate' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => {
                setLevelFilter('advanced');
                setMenuVisible(false);
              }}
              title="고급"
              leadingIcon={levelFilter === 'advanced' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => {
                setLevelFilter('expert');
                setMenuVisible(false);
              }}
              title="전문가"
              leadingIcon={levelFilter === 'expert' ? 'check' : undefined}
            />
          </Menu>
        </View>

        <SegmentedButtons
          value={period}
          onValueChange={(value) => setPeriod(value as 'all' | 'month' | 'week')}
          buttons={[
            { value: 'all', label: '전체' },
            { value: 'month', label: '월간' },
            { value: 'week', label: '주간' },
          ]}
          style={styles.periodButtons}
        />
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>서버 연결을 확인하세요</Text>
        </View>
      ) : members.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>등록된 회원이 없습니다</Text>
          <Text style={styles.emptySubtext}>새 회원을 추가하세요</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: GymStyles.spacing.md },
  filterContainer: { padding: GymStyles.spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: GymStyles.spacing.sm },
  searchbar: { flex: 1 },
  filterButton: { margin: 0 },
  periodButtons: { marginTop: GymStyles.spacing.sm },
  list: { padding: GymStyles.spacing.md },
  card: { marginBottom: GymStyles.spacing.md },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: GymStyles.spacing.sm },
  rankContainer: { width: 40, alignItems: 'center' },
  rankText: { ...GymStyles.typography.h3, fontWeight: 'bold', color: '#FF9800' },
  memberInfo: { flex: 1, marginLeft: GymStyles.spacing.xs },
  memberName: { ...GymStyles.typography.h3, marginBottom: GymStyles.spacing.xs },
  memberStats: { flexDirection: 'row', gap: GymStyles.spacing.xs, marginBottom: GymStyles.spacing.xs },
  chip: { height: 28 },
  memberSubtext: { ...GymStyles.typography.caption, opacity: 0.7 },
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
});
