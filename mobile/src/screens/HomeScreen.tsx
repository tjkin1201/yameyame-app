import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import { GymStyles } from '../theme/gymTheme';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={styles.title}>YameYame</Text>
        <Text style={styles.subtitle}>동탄 배드민턴을 즐기는 사람들</Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>오늘의 게임</Text>
            <Text style={styles.cardText}>진행 중인 게임이 없습니다</Text>
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
            <Text style={styles.cardText}>1200 (실버) · 0승 0패</Text>
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
});
