import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import your screen components
import HomeScreen from '../main/HomeScreen';
import PublishRecipeScreen from '../main/PublishRecipeScreen';
import FriendsScreen from '../social/FriendsScreen';
import ProfileScreen from '../main/ProfileScreen';

const Tab = createBottomTabNavigator();

const Colors = {
  light: {
    tint: '#FFFFFF', // White for active icons
    background: '#fff',
    text: '#000',
    tabBar: '#CC684F', // Warm reddish-brown matching Stories section
  },
  dark: {
    tint: '#FFFFFF', // White for active icons
    background: '#000',
    text: '#fff',
    tabBar: '#CC684F', // Warm reddish-brown matching Stories section
  },
};

export default function TabNavigator() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Tab.Navigator
      id={"tabNavigator"}
      screenOptions={{
        tabBarActiveTintColor: colors.tint, // White for active
        tabBarInactiveTintColor: '#FFFFFF', // White for inactive icons too (with opacity handled by React Navigation)
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
        },
        tabBarLabelStyle: {
          color: '#FFFFFF', // White text for labels
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PublishRecipe"
        component={PublishRecipeScreen}
        options={{
          title: 'Publish Recipe',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}