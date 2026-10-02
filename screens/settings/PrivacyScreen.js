import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function PrivacyScreen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} lightColor="#fff" darkColor="#fff">
            Privacy
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
          Privacy Statement:
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          We respect your privacy.
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          We collect information you provide when you create an account, such as your username, email, and any content you share. We also collect basic usage data to help us improve the app.
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          • Public recipes are visible to everyone.
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          • Group discussions and stories are visible only to your private groups (stories disappear after 24 hours).
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          • We don't sell your data to anyone.
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          • We use secure services to store your content and keep the app working.
        </ThemedText>

        <ThemedText style={styles.paragraph} lightColor="#fff" darkColor="#fff">
          You can edit or delete your content anytime, and you can delete your account if you want your personal data removed. Questions? Contact us.
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

