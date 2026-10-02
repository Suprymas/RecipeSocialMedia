import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Alert } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { backend } from '../../services/Backend';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen({ navigation }) {
  const handleLogout = async () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await backend.auth.signOut();
              if (error) throw error;
              // Navigation will happen automatically via App.js auth listener
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with coral background */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} lightColor="#fff" darkColor="#fff">
            Settings
          </ThemedText>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Settings Options */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('AddNewFriend')}
        >
          <Ionicons name="person-add" size={24} color="#fff" style={styles.buttonIcon} />
          <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
            Add new friend
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('AddNewGroup')}
        >
          <Ionicons name="people" size={24} color="#fff" style={styles.buttonIcon} />
          <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
            Add new group
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('ProfileSettings')}
        >
          <Ionicons name="person" size={24} color="#fff" style={styles.buttonIcon} />
          <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
            Profile Settings
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Privacy')}
        >
          <Ionicons name="eye-off" size={24} color="#fff" style={styles.buttonIcon} />
          <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
            Privacy
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('About')}
        >
          <Ionicons name="information-circle" size={24} color="#fff" style={styles.buttonIcon} />
          <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
            About
          </ThemedText>
        </TouchableOpacity>

        {/* Log out button with spacing */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#fff" style={styles.buttonIcon} />
            <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
              Log out
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <ThemedText style={styles.versionText} lightColor="#999" darkColor="#999">
          Version: 1.0
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#363636',
  },
  header: {
    backgroundColor: '#CC684F',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CC684F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
  logoutContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CC684F',
    borderRadius: 12,
    padding: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
});