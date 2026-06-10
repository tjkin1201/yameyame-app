import React from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Searchbar, Text, Card, Avatar, Chip, ActivityIndicator, useTheme } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';
import { getMembers, Member } from '../services/api';

interface MembersScreenProps {
  navigation: any;
}

export default function MembersScreen({ navigation }: MembersScreenProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadMembers = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMembers({ search: searchQuery, limit: 100 });
      setMembers(response.members);
    } catch (err) {
      setError('회원 목록을 불러올 수 없습니다');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleMemberPress = (member: Member) => {
    navigation.navigate('MemberDetail', {
      memberId: member._id,
      memberName: member.name,
    });
  };

  const renderMember = ({ item }: { item: Member }) => (
    <TouchableOpacity onPress={() => handleMemberPress(item)}>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.memberRow}>
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
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="회원 검색"
          onChangeText={setSearchQuery}
          value={searchQuery}
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
  searchContainer: { padding: GymStyles.spacing.md },
  list: { padding: GymStyles.spacing.md },
  card: { marginBottom: GymStyles.spacing.md },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberInfo: { flex: 1, marginLeft: GymStyles.spacing.md },
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
