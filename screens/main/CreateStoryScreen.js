import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Text,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '../../components/ThemedText';
import { backend, uploadImage } from '../../services/Backend';
import { Ionicons } from '@expo/vector-icons';

const CORAL = '#CC684F'; // Coral color from design
const DARK_GREY = '#2C2C2E'; // Dark grey for background

export default function CreateStoryScreen({ navigation }) {
  const [storyContent, setStoryContent] = useState('');
  const [storyImageUri, setStoryImageUri] = useState(null);
  const [creatingStory, setCreatingStory] = useState(false);

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
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setStoryImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Error selecting image');
    }
  };

  const handleCreateStory = async () => {
    if (!storyImageUri) {
      Alert.alert('Notice', 'Please select an image first');
      return;
    }

    try {
      setCreatingStory(true);
      const { data: { user } } = await backend.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in first');
        return;
      }

      // Upload image to the backend
      const imageUrl = await uploadImage(storyImageUri,
        'story-images', // bucket name
        `${user.id}`
      );

      // Save story to database
      const { data, error } = await backend
        .from('stories')
        .insert({
          title: storyContent.trim() || 'My Food Story',
          image: imageUrl,
          user_id: user.id,
          likes: 0,
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert('Success', 'Story published!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert('Error', error.message || 'Error publishing story');
    } finally {
      setCreatingStory(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header - Grey text at top */}
      <View style={styles.headerTop}>
        <ThemedText style={styles.headerTopText}>Create Story</ThemedText>
      </View>

      {/* Header - Coral bar */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Create new Story</ThemedText>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {storyImageUri ? (
        // Image Selected State - Full screen image with editing tools
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: storyImageUri }}
            style={styles.fullScreenImage}
            resizeMode="cover"
          />

          {/* Text Input Overlay - Always visible when image is selected */}
          <View style={styles.textInputOverlay}>
            <TextInput
              style={styles.storyTextInput}
              value={storyContent}
              onChangeText={setStoryContent}
              placeholder="Write your Inspiration..."
              placeholderTextColor="#666"
              multiline
              textAlignVertical="top"
              maxLength={250}
            />
            <ThemedText style={styles.characterCount}>
              {storyContent.length}/250
            </ThemedText>
          </View>

          {/* Editing Tools Bar */}
          <View style={styles.editingToolsBar}>
            <View style={styles.toolGroup}>
              <TouchableOpacity
                style={styles.toolButton}
                onPress={() => {
                  // Sticker/Emoji functionality - placeholder
                  Alert.alert('Notice', 'Sticker feature coming soon');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="happy" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolButton}
                onPress={() => {
                  // Sticker/Emoji functionality - placeholder
                  Alert.alert('Notice', 'Sticker feature coming soon');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="images" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => {
                // Tag/Mention functionality - placeholder
                Alert.alert('Notice', 'Tag feature coming soon');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="people" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={handleCreateStory}
              disabled={creatingStory}
              activeOpacity={0.7}
            >
              <Ionicons
                name={creatingStory ? "hourglass" : "arrow-forward"}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Initial State - Background image with phone illustration and buttons
        <View style={styles.backgroundContainer}>
          <ImageBackground
            source={require('../../assets/icon.png')}
            style={styles.backgroundImage}
            blurRadius={15}
            imageStyle={styles.backgroundImageStyle}
          >
            <View style={styles.overlay} />
            <View style={styles.initialContent}>
              {/* Phone Outline with Text and Icons */}
              <View style={styles.phoneOutline}>
                <View style={styles.phoneInner}>
                  {/* Decorative Icons */}
                  <View style={styles.phoneIconsContainer}>
                    <Ionicons name="camera" size={20} color="#fff" style={styles.phoneIcon} />
                    <Ionicons name="restaurant" size={20} color="#fff" style={styles.phoneIcon} />
                    <Ionicons name="chatbubble" size={20} color="#fff" style={styles.phoneIcon} />
                    <Ionicons name="heart" size={20} color="#fff" style={styles.phoneIcon} />
                    <Ionicons name="restaurant-outline" size={20} color="#fff" style={styles.phoneIcon} />
                  </View>
                  <Text style={styles.phoneText}>
                    SHARE YOUR <Text style={styles.phoneTextHighlight}>FOOD</Text> JOURNEY!
                  </Text>
                </View>
              </View>

              {/* Upload Image Button */}
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handleImagePicker('library')}
                activeOpacity={0.8}
              >
                <Ionicons name="images" size={20} color="#fff" />
                <ThemedText style={styles.uploadButtonText}>Upload Image</ThemedText>
              </TouchableOpacity>

              {/* Take Photo Button */}
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handleImagePicker('camera')}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <ThemedText style={styles.uploadButtonText}>Take Photo</ThemedText>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_GREY,
  },
  headerTop: {
    paddingTop: 60,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: DARK_GREY,
  },
  headerTopText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  header: {
    backgroundColor: CORAL,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'left',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Initial State Styles
  backgroundContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImageStyle: {
    opacity: 0.6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  initialContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    zIndex: 1,
  },
  phoneOutline: {
    width: 200,
    height: 300,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  phoneInner: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneIconsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  phoneIcon: {
    marginHorizontal: 4,
  },
  phoneText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  phoneTextHighlight: {
    color: CORAL,
  },
  uploadButton: {
    backgroundColor: CORAL,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    marginBottom: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Image Selected State Styles
  imageContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  textInputOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    maxHeight: 150,
  },
  storyTextInput: {
    fontSize: 16,
    color: '#000',
    minHeight: 60,
    textAlignVertical: 'top',
    paddingRight: 60,
  },
  characterCount: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    fontSize: 12,
    color: '#666',
  },
  editingToolsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CORAL,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  toolGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  toolButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

