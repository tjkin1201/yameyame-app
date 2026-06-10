import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

import HomeScreen from '../screens/HomeScreen';
import GamesScreen from '../screens/GamesScreen';
import MembersScreen from '../screens/MembersScreen';
import MemberDetailScreen from '../screens/MemberDetailScreen';
import CommunityScreen from '../screens/CommunityScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MembersStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontSize: 20, fontWeight: 'bold' },
        headerTintColor: theme.colors.primary,
      }}
    >
      <Stack.Screen
        name="MembersList"
        component={MembersScreen}
        options={{ title: '회원', headerShown: false }}
      />
      <Stack.Screen
        name="MemberDetail"
        component={MemberDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.memberName || '회원 상세',
        })}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const theme = useTheme();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          // 체육관 환경: 탭바도 크게
          tabBarStyle: { height: 70, paddingBottom: 10, paddingTop: 10 },
          tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
          headerTitleStyle: { fontSize: 20, fontWeight: 'bold' },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: '홈',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home" color={color} size={size + 4} />
            ),
          }}
        />
        <Tab.Screen
          name="Games"
          component={GamesScreen}
          options={{
            title: '게임',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="badminton" color={color} size={size + 4} />
            ),
          }}
        />
        <Tab.Screen
          name="Members"
          component={MembersStack}
          options={{
            title: '회원',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-group" color={color} size={size + 4} />
            ),
          }}
        />
        <Tab.Screen
          name="Community"
          component={CommunityScreen}
          options={{
            title: '커뮤니티',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="forum" color={color} size={size + 4} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
