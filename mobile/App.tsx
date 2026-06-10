import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GymLightTheme } from './src/theme/gymTheme';
import AppNavigator from './src/navigation/AppNavigator';
import { socketService } from './src/services/socket';

export default function App() {
  React.useEffect(() => {
    // Socket.io 연결 (실제로는 로그인한 사용자 ID 사용)
    const userId = 'demo-user-1';
    const clubId = 'demo-club-1';

    socketService.connect(userId, clubId);

    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={GymLightTheme}>
        <AppNavigator />
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
