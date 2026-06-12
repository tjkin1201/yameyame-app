import { Redirect } from 'expo-router';
import React from 'react';
import { LoadingView } from '../components/ui';
import { useClub } from '../lib/club-context';

/** 진입 게이트: 세션 → 클럽 유무에 따라 라우팅 */
export default function Index() {
  const { authSession, authLoading, club, clubLoading } = useClub();

  if (authLoading || (authSession && clubLoading)) return <LoadingView />;
  if (!authSession) return <Redirect href="/(auth)/login" />;
  if (!club) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
