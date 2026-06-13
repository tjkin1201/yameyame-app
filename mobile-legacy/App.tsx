import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { GymLightTheme } from './src/theme/gymTheme';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { socketService } from './src/services/socket';
import { dbService } from './src/services/database';
import { syncService } from './src/services/sync';
import { isGuestMode, restoreAuthHeader } from './src/services/auth';

export default function App() {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [isSignedIn, setIsSignedIn] = React.useState(false);

  React.useEffect(() => {
    initializeApp();

    return () => {
      socketService.disconnect();
      syncService.cleanup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing app...');

      // 0. 저장된 로그인 상태 복원 (Band JWT 또는 게스트 모드)
      const hasToken = await restoreAuthHeader();
      setIsSignedIn(hasToken || (await isGuestMode()));

      // 1. 로컬 DB 초기화
      await dbService.initialize();

      // 2. 동기화 서비스 초기화
      await syncService.initialize();

      // 3. 초기 동기화 시도 (백그라운드)
      syncService.syncNow().catch((err) => {
        console.warn('Initial sync failed:', err);
      });

      // 4. Socket.io 연결
      const userId = 'demo-user-1';
      const clubId = 'demo-club-1';
      socketService.connect(userId, clubId);

      setIsInitialized(true);
      console.log('✅ App initialized');
    } catch (error) {
      console.error('App initialization failed:', error);
      // 실패해도 앱은 계속 실행 (오프라인 모드)
      setIsInitialized(true);
    }
  };

  if (!isInitialized) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={GymLightTheme}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={GymLightTheme.colors.primary} />
          </View>
          <StatusBar style="auto" />
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  if (!isSignedIn) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={GymLightTheme}>
          <LoginScreen
            onSignedIn={() => setIsSignedIn(true)}
            onGuest={() => setIsSignedIn(true)}
          />
          <StatusBar style="auto" />
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={GymLightTheme}>
        <AppNavigator />
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
