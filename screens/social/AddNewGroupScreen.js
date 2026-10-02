import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Image,
  Text
} from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { backend, uploadImage } from '../../services/Backend';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

const MAX_GROUP_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 450;

export default function AddNewGroupScreen({ navigation }) {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupImageUri, setGroupImageUri] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadCurrentUser();
    loadFriends();
  }, []);

  useEffect(() => {
    // Filter friends based on search query
    if (searchQuery.trim() === '') {
      setFilteredFriends(friends);
    } else {
      const filtered = friends.filter(friend =>
        friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, friends]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await backend.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadFriends = async () => {
    setLoadingFriends(true);
    const { data: { user } } = await backend.auth.getUser();
    if (!user) {
      setLoadingFriends(false);
      return;
    }

    // Get accepted friends
    // First, get friends where user is the requester
    const { data: friends, error1 } = await backend
      .from('friendships')
      .select('addressee_id,requester_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');

    console.log("friends", friends)

    // Combine friend IDs
    const friendIds = new Set();
    for (let { requester_id, addressee_id } of friends) {
      console.log(requester_id)
      friendIds.add(requester_id);
      friendIds.add(addressee_id);
      console.log(friendIds)
    }
    friendIds.delete(user.id)

    // Get friend profiles
    const { data: profiles, error: profilesError } = await backend
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', Array.from(friendIds));

    if (profilesError) {
      console.error('Error loading friend profiles:', profilesError);
      setFriends(getMockFriends());
      setFilteredFriends(getMockFriends());
    } else {
      const friendsList = (profiles || []).map(profile => ({
        id: profile.id,
        username: profile.username || 'Unknown',
        avatar: profile.avatar_url || 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg',
      }));
      setFriends(friendsList);
      setFilteredFriends(friendsList);
    }
    setLoadingFriends(false);
  };

  const getMockFriends = () => {
    return [
      { id: '1', username: 'Mengmeng', avatar: 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg' },
      { id: '2', username: 'Siebe', avatar: 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg' },
      { id: '3', username: 'Guda', avatar: 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg' },
      { id: '4', username: 'Hans', avatar: 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg' },
      { id: '5', username: 'Tom', avatar: 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg' },
      { id: '6', username: 'Luke', avatar: 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg' },
    ];
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaLibraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return cameraStatus === 'granted' || mediaLibraryStatus === 'granted';
  };

  const handleImagePicker = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant camera and media library permissions to select an image');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setGroupImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const toggleFriendSelection = (friendId) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (groupName.length > MAX_GROUP_NAME_LENGTH) {
      Alert.alert('Error', `Group name must be ${MAX_GROUP_NAME_LENGTH} characters or less`);
      return;
    }

    if (groupDescription.length > MAX_DESCRIPTION_LENGTH) {
      Alert.alert('Error', `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
      return;
    }

    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await backend.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a group');
        return;
      }

      // Upload group image if selected
      let imageUrl = null;
      if (groupImageUri && !groupImageUri.startsWith('http')) {
        try {
          imageUrl = await uploadImage(groupImageUri, 'group-images', user.id);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          Alert.alert('Warning', 'Failed to upload image, but continuing with group creation');
        }
      }

      // Create group in database
      const { data: group, error: groupError } = await backend
        .from('groups')
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          image_url: imageUrl,
          created_by: user.id,
        })
        .select()
        .single();


      // Add creator as admin member
      if (group) {
        await backend
          .from('group_members')
          .insert({
            group_id: group.id,
            user_id: user.id,
            role: 'admin',
          });
      }

      // Add selected friends as members
      if (selectedFriends.size > 0 && group) {
        const membersData = Array.from(selectedFriends).map(friendId => ({
          group_id: group.id,
          user_id: friendId,
          role: 'member',
        }));

        await backend
          .from('group_members')
          .insert(membersData);
      }

      Alert.alert(
        'Success',
        `Group "${groupName}" created successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setGroupName('');
    setGroupDescription('');
    setGroupImageUri(null);
    setSearchQuery('');
    setSelectedFriends(new Set());
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} lightColor="#fff" darkColor="#fff">
            Create Group
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
        {/* Group Name Input */}
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Group Name..."
              placeholderTextColor="#999"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={MAX_GROUP_NAME_LENGTH}
            />
            <Text style={styles.charCount}>
              {groupName.length}/{MAX_GROUP_NAME_LENGTH}
            </Text>
          </View>
        </View>

        {/* Group Description and Image Row */}
        <View style={styles.descriptionRow}>
          <View style={styles.descriptionContainer}>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Enter Group Description..."
              placeholderTextColor="#999"
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              maxLength={MAX_DESCRIPTION_LENGTH}
              textAlignVertical="top"
            />
            <Text style={styles.charCountBottomRight}>
              {groupDescription.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.imagePlaceholder}
            onPress={handleImagePicker}
          >
            {groupImageUri ? (
              <Image source={{ uri: groupImageUri }} style={styles.groupImage} />
            ) : (
              <Ionicons name="image-outline" size={40} color="#999" />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Friends Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Friends"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        </View>

        {/* Friends List */}
        <View style={styles.friendsList}>
          {loadingFriends ? (
            <ThemedText style={styles.loadingText} lightColor="#999" darkColor="#999">
              Loading friends...
            </ThemedText>
          ) : filteredFriends.length === 0 ? (
            <ThemedText style={styles.emptyText} lightColor="#999" darkColor="#999">
              No friends found
            </ThemedText>
          ) : (
            filteredFriends.map((friend) => (
              <TouchableOpacity
                key={friend.id}
                style={styles.friendItem}
                onPress={() => toggleFriendSelection(friend.id)}
              >
                <Image
                  source={{ uri: friend.avatar }}
                  style={styles.friendAvatar}
                />
                <Text style={styles.friendName}>
                  {friend.username}
                </Text>
                <View style={styles.checkboxContainer}>
                  {selectedFriends.has(friend.id) ? (
                    <Ionicons name="checkbox" size={24} color="#CC684F" />
                  ) : (
                    <View style={styles.checkboxEmpty} />
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={loading}
        >
          <ThemedText style={styles.createButtonText} lightColor="#fff" darkColor="#fff">
            {loading ? 'Creating...' : 'Create New Group'}
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
    padding: 16,
    paddingBottom: 100,
  },
  inputRow: {
    marginBottom: 16,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    paddingRight: 60,
    fontSize: 16,
    color: '#333',
  },
  charCount: {
    position: 'absolute',
    right: 16,
    top: 16,
    fontSize: 14,
    color: '#999',
  },
  descriptionRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  descriptionContainer: {
    flex: 1,
    position: 'relative',
  },
  descriptionInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 40,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
  },
  charCountBottomRight: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    fontSize: 14,
    color: '#999',
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  searchIcon: {
    marginLeft: 8,
  },
  friendsList: {
    marginBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxEmpty: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#999',
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#CC684F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
