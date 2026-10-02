import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function AboutScreen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} lightColor="#fff" darkColor="#fff">
            About
          </ThemedText>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title} lightColor="#fff" darkColor="#fff">
          About Hungry Bear:
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          Hungry Bear is a cozy food-sharing app for small circles of friends, roommates, and families. It gives you a private space to share what you cook, discover new ideas, and talk about food in a trusted setting.
        </ThemedText>

        <ThemedText style={styles.subtitle} lightColor="#fff" darkColor="#fff">
          With Hungry Bear:
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          • Share public recipes with photos, ingredients, and steps
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          • Chat privately with your group about cooking and culture
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          • Post 24-hour food stories about meals, drinks, or places you enjoy
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          Hungry Bear brings people closer through everyday food, one recipe, one story, and one conversation at a time.
        </ThemedText>

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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
});

