import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '../../components/ThemedText';
import { backend } from '../../services/Backend';
import { Ionicons } from '@expo/vector-icons';
import { resolveAvatarUrl, saveErrorMessage, saveProfile } from './profileSave';

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

  // Validates, uploads a newly picked avatar, then creates or updates the profile
  const handleSave = async () => {
    const fields = { username: username.trim(), bio: bio.trim() };
    if (!fields.username) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    setSaving(true);
    try {
      const { data: { user: authUser } } = await backend.auth.getUser();
      if (!authUser) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const avatarUrl = await resolveAvatarUrl({
        pickedUri: avatarUri,
        savedUrl: user?.avatar_url,
        userId: authUser.id,
        onUploading: setUploadingAvatar,
      });
      const created = await saveProfile(authUser.id, { ...fields, avatar_url: avatarUrl });

      Alert.alert('Success', created ? 'Profile created successfully!' : 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', saveErrorMessage(error));
    } finally {
      setSaving(false);
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

