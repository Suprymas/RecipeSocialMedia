import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '../../components/ThemedText';
import { backend, uploadImage } from '../../services/Backend';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function ProfileSettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await backend.auth.getUser();

      if (authUser) {
        setEmail(authUser.email || '');

        // Get user profile
        const { data: profileData, error } = await backend
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error) throw error;

        if (profileData) {
          setUser(profileData);
          setUsername(profileData.username || '');
          setBio(profileData.bio || '');
          if (profileData.avatar_url) {
            setAvatarUri(profileData.avatar_url);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaLibraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || mediaLibraryStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera and photo library permissions are required to upload images',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const handleImagePicker = async (source) => {
    console.log('handleImagePicker called with source:', source);
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log('Permissions not granted');
      return;
    }

    try {
      let result;
      if (source === 'camera') {
        console.log('Launching camera...');
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        console.log('Launching image library...');
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      console.log('Image picker result:', result);
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('Image selected:', result.assets[0].uri);
        setAvatarUri(result.assets[0].uri);
      } else {
        console.log('Image selection canceled');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', `Error selecting image: ${error.message}`);
    }
  };

  const handleChangeAvatar = () => {
    console.log('handleChangeAvatar called');
    Alert.alert(
      'Change Avatar',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => {
            console.log('Take Photo selected');
            handleImagePicker('camera');
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            console.log('Choose from Library selected');
            handleImagePicker('library');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    try {
      setSaving(true);
      const { data: { user: authUser } } = await backend.auth.getUser();

      if (!authUser) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      let avatarUrl = user?.avatar_url || null;

      // Upload new avatar if a local URI is set and it's different from the current one
      // Don't block the entire save if avatar upload fails
      if (avatarUri && avatarUri !== user?.avatar_url && !avatarUri.startsWith('http')) {
        setUploadingAvatar(true);
        try {
          avatarUrl = await uploadImage(avatarUri, 'avatars', authUser.id);
          console.log('Avatar uploaded successfully:', avatarUrl);
        } catch (uploadError) {
          console.error('Error uploading avatar:', uploadError);
          // Don't return - allow saving other data even if avatar fails
          Alert.alert(
            'Warning', 
            'Failed to upload avatar image, but other changes will be saved.',
            [{ text: 'OK' }]
          );
          // Keep the existing avatar_url if upload fails
          avatarUrl = user?.avatar_url || null;
        }
        setUploadingAvatar(false);
      }

      // Check if profile exists, if not create it first
      const { data: existingProfile, error: checkError } = await backend
        .from('profiles')
        .select('id')
        .eq('id', authUser.id)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // Profile doesn't exist, create it first
        console.log('Profile does not exist, creating new profile...');
        const { error: insertError } = await backend
          .from('profiles')
          .insert({
            id: authUser.id,
            username: username.trim(),
            bio: bio.trim(),
            avatar_url: avatarUrl,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }

        Alert.alert('Success', 'Profile created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      // Update existing profile
      console.log('Updating profile for user:', authUser.id);
      const { error: updateError } = await backend
        .from('profiles')
        .update({
          username: username.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        console.error('Error details:', JSON.stringify(updateError, null, 2));
        throw updateError;
      }

      console.log('Profile updated successfully');
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'Failed to update profile';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      } else if (error.code) {
        errorMessage += ` (${error.code})`;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <ThemedText style={styles.headerTitle} lightColor="#fff" darkColor="#fff">
              Profile Settings
            </ThemedText>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText} lightColor="#999" darkColor="#999">
            Loading...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} lightColor="#fff" darkColor="#fff">
            Profile Settings
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
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.7}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={50} color="#999" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.changeAvatarButton}
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.changeAvatarText} lightColor="#CC684F" darkColor="#CC684F">
              {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Username */}
        <View style={styles.inputSection}>
          <ThemedText style={styles.label} lightColor="#fff" darkColor="#fff">
            Username
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        {/* Email (read-only) */}
        <View style={styles.inputSection}>
          <ThemedText style={styles.label} lightColor="#fff" darkColor="#fff">
            Email
          </ThemedText>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email}
            editable={false}
            placeholderTextColor="#999"
          />
          <ThemedText style={styles.hintText} lightColor="#999" darkColor="#999">
            Email cannot be changed
          </ThemedText>
        </View>

        {/* Bio */}
        <View style={styles.inputSection}>
          <ThemedText style={styles.label} lightColor="#fff" darkColor="#fff">
            Bio
          </ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about yourself"
            placeholderTextColor="#999"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, (saving || uploadingAvatar) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || uploadingAvatar}
        >
          <ThemedText style={styles.saveButtonText} lightColor="#fff" darkColor="#fff">
            {(saving || uploadingAvatar) ? 'Saving...' : 'Save Changes'}
          </ThemedText>
        </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  changeAvatarButton: {
    padding: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeAvatarText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#CC684F',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#2C2C2E',
    color: '#999',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#CC684F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});

