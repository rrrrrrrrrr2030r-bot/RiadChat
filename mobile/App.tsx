import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DarkTheme,
  LinkingOptions,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MobileAppProvider, useMobileApp } from './src/context/MobileAppContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { RoomsScreen } from './src/screens/RoomsScreen';
import { LiveRoomScreen } from './src/screens/LiveRoomScreen';
import { GamesScreen } from './src/screens/GamesScreen';
import { InviteFriendsScreen } from './src/screens/InviteFriendsScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { QueryClientProvider } from '@tanstack/react-query';
import { API_BASE_URL } from './src/services/api';
import { PUBLIC_INVITE_BASE_URL } from './src/services/supabase';
import {
  attachMobileAppStateToFocusManager,
  mobileQueryClient,
} from './src/services/queryClient';

export type RootStackParamList = {
  MainTabs: undefined;
  LiveRoom: { roomId: string };
};

export type MainTabParamList = {
  Rooms: undefined;
  Games: { roomId?: string } | undefined;
  Invites: { code?: string; roomId?: string } | undefined;
  Admin?: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['riyadhchat://', PUBLIC_INVITE_BASE_URL, API_BASE_URL],
  config: {
    screens: {
      LiveRoom: 'room/:roomId',
      MainTabs: {
        screens: {
          Invites: 'invite/:code',
          Games: 'games',
          Rooms: 'rooms',
        },
      },
    },
  },
};

function MainTabs({
  isPrimaryAdmin,
  isApprovedAgent,
}: {
  isPrimaryAdmin: boolean;
  isApprovedAgent: boolean;
}) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#120B2B',
          borderTopColor: 'rgba(139, 92, 246, 0.25)',
          height: 62,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#A78BFA',
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tab.Screen name="Rooms" options={{ title: 'الغرف الصوتية' }}>
        {() => (
          <RoomsScreen
            isPrimaryAdmin={isPrimaryAdmin}
            isApprovedAgent={isApprovedAgent}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Games" options={{ title: 'الألعاب' }}>
        {() => (
          <GamesScreen
            isPrimaryAdmin={isPrimaryAdmin}
            isApprovedAgent={isApprovedAgent}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Invites" options={{ title: 'دعوة الأصدقاء' }}>
        {() => (
          <InviteFriendsScreen
            isPrimaryAdmin={isPrimaryAdmin}
            isApprovedAgent={isApprovedAgent}
          />
        )}
      </Tab.Screen>
      {isPrimaryAdmin && (
        <Tab.Screen name="Admin" options={{ title: '🛡️ لوحة التحكم' }}>
          {() => (
            <AdminDashboardScreen
              isPrimaryAdmin={isPrimaryAdmin}
              isApprovedAgent={isApprovedAgent}
            />
          )}
        </Tab.Screen>
      )}
    </Tab.Navigator>
  );
}

function MobileAuthGate() {
  const { isAuthenticated, authLoading, isPrimaryAdmin, isApprovedAgent } = useMobileApp();

  // Silent RBAC navigation guard: immediately redirect to Rooms if admin access is lost
  useEffect(() => {
    if (!isAuthenticated || isPrimaryAdmin || !navigationRef.isReady()) return;
    const currentRoute = navigationRef.getCurrentRoute();
    if (currentRoute?.name === 'Admin') {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [isAuthenticated, isPrimaryAdmin]);

  if (authLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#A78BFA" />
        <Text style={styles.splashText}>جاري مزامنة جلسة رياض شات...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onStateChange={() => {
        if (!isPrimaryAdmin && navigationRef.isReady()) {
          const currentRoute = navigationRef.getCurrentRoute();
          if (currentRoute?.name === 'Admin') {
            navigationRef.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }],
            });
          }
        }
      }}
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: '#0B0620',
          card: '#120B2B',
          primary: '#7C3AED',
          text: '#FFFFFF',
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs">
          {() => (
            <MainTabs
              isPrimaryAdmin={isPrimaryAdmin}
              isApprovedAgent={isApprovedAgent}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="LiveRoom"
          options={{
            animation: 'fade',
            animationDuration: 260,
          }}
        >
          {() => (
            <LiveRoomScreen
              isPrimaryAdmin={isPrimaryAdmin}
              isApprovedAgent={isApprovedAgent}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => attachMobileAppStateToFocusManager(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={mobileQueryClient}>
          <MobileAppProvider>
            <StatusBar barStyle="light-content" backgroundColor="#0B0620" />
            <MobileAuthGate />
          </MobileAppProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0B0620',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
});
