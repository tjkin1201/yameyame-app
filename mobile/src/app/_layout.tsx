import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ClubProvider } from '../lib/club-context';
import { Colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <ClubProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="announcements" options={{ title: '공지사항' }} />
        <Stack.Screen name="member/[id]" options={{ title: '멤버 상세' }} />
      </Stack>
    </ClubProvider>
  );
}
