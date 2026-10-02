import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/auth/LoginScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import TabNavigator from "./screens/navigation/TabNavigator";
import CreateStoryScreen from "./screens/main/CreateStoryScreen";
import {backend} from "./services/Backend";
import {ActivityIndicator, View, StyleSheet} from "react-native";
import RecipeDetailScreen from "./screens/main/RecipeDetailScreen";
import SettingsScreen from './screens/settings/SettingsScreen';
import ProfileScreen from './screens/main/ProfileScreen';
import GroupChatScreen from './screens/social/GroupChatScreen';
import AddNewFriendScreen from './screens/social/AddNewFriendScreen';
import AddNewGroupScreen from './screens/social/AddNewGroupScreen';
import ProfileSettingsScreen from './screens/settings/ProfileSettingsScreen';
import PrivacyScreen from './screens/settings/PrivacyScreen';
import AboutScreen from './screens/settings/AboutScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for existing session on mount
    checkUser();

    // Listen for auth state changes
    const { data: authListener } = backend.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // Cleanup subscription
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await backend.auth.getSession();
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Error checking user session:', error);
    } finally {
      setIsLoading(false);
    }
  };
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  console.log(user);

  return (
    <NavigationContainer>
      <Stack.Navigator
        id={"first"}
        initialRouteName={user ? "tabNavigator" : "Login"}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="tabNavigator" component={TabNavigator} />
        <Stack.Screen name="CreateStory" component={CreateStoryScreen} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="GroupChat" component={GroupChatScreen} />
        <Stack.Screen name="AddNewFriend" component={AddNewFriendScreen} />
        <Stack.Screen name="AddNewGroup" component={AddNewGroupScreen} />
        <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});