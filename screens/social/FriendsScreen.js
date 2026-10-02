import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, Image, Text, TextInput } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { backend } from '../../services/Backend';
import { useFocusEffect } from '@react-navigation/native';

export default function FriendsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('groups'); // 'groups', 'friends', or 'feed'
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userAvatar, setUserAvatar] = useState('https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg'); // Default husky avatar
  useFocusEffect(
    React.useCallback(() => {
      loadData();
      return () => {
        // Do something when the screen is unfocused
        // Useful for cleanup functions
      };
    }, [])
  );
  const loadData = async () => {
    console.log("Hi")
    setLoading(true);

    // Get current user
    const { data: { user } } = await backend.auth.getUser();
    if (!user) {
      console.error('No user logged in');
      return;
    }
    setCurrentUserId(user.id);

    //get all groups_id for current user
    const { data: groupIdData, error: groupError } = await backend.from('group_members').select('group_id').eq('user_id', user.id)

    console.log("groupsiddata", groupIdData)
    console.log("groupsiddata", groupError)
    const groupIds = groupIdData.map(item => item.group_id);
    console.log("groupsid", groupIds)

    const { data: groupData, error: groupdataError } = await backend
      .from('groups')
      .select('*')
      .in('id', groupIds);

    console.log(groupData)
    // set groups
    setGroups(groupData);

    // set friends
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

    setFriends(profiles);
    //setNotifications(mockNotifications);

    setLoading(false);
  };

  const renderGroupsTab = () => {
    const filteredGroups = groups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <ScrollView style={styles.contentScroll}>
        {filteredGroups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={styles.groupCard}
            onPress={() => navigation.navigate('GroupChat', {
              roomId: group.id,
            })}
          >
            <View style={styles.groupHeader}>
              <Ionicons
                name={group.icon}
                size={20}
                color="#333"
                style={styles.groupIcon}
              />
              <Text style={styles.groupName}>{group.name}</Text>
            </View>
            {/*
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postsScroll}>
              {group.posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <Image source={{ uri: post.image }} style={styles.postImage} />
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <View style={styles.postMeta}>
                    <Text style={styles.postDate}>{post.date}</Text>
                    <View style={styles.postAuthor}>
                      <Ionicons name="person" size={12} color="#666" />
                      <Text style={styles.postAuthorText}>{post.author}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>*/}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderFriendsTab = () => {
    console.log(friends)

    return (
      <ScrollView style={styles.contentScroll}>
        {friends.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={styles.friendCard}
          >
            {/* Avatar */}
            {friend.avatar_url ? (
              <Image
                source={{ uri: friend.avatar_url }}
                style={styles.friendAvatar}
              />
            ) : (
              <View style={styles.friendAvatarPlaceholder}>
                <ThemedText style={styles.friendAvatarInitial}>
                  {friend.username?.charAt(0).toUpperCase() || "U"}
                </ThemedText>
              </View>
            )}

            {/* Username */}
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{friend.username}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderFeedTab = () => {
    const filteredNotifications = notifications.filter(notification =>
      notification.author.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <ScrollView style={styles.contentScroll}>
        {filteredNotifications.map((notification) => (
          <TouchableOpacity
            key={notification.id}
            style={styles.notificationCard}
            onPress={() => {
              // Navigate to recipe or story detail based on targetType
              if (notification.targetType === 'recipe') {
                navigation.navigate('RecipeDetail', { recipeId: notification.targetId });
              } else if (notification.targetType === 'story') {
                // Navigate to story detail if needed
                console.log('Navigate to story:', notification.targetId);
              }
            }}
          >
            <Image
              source={{ uri: notification.author.avatar }}
              style={styles.notificationAvatar}
            />
            <View style={styles.notificationContent}>
              <Text style={styles.notificationText}>
                <Text style={styles.notificationAuthorName}>{notification.author.name}</Text>
                {' '}
                <Text style={styles.notificationMessage}>{notification.message}</Text>
              </Text>
            </View>
            <Image
              source={{ uri: notification.targetImage }}
              style={styles.notificationThumbnail}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Orange header with Social */}
      <View style={styles.orangeBar}>
        <Text style={styles.messagesText}>Social</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groups
          </Text>
          {activeTab === 'groups' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends
          </Text>
          {activeTab === 'friends' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>
            Feed
          </Text>
          {activeTab === 'feed' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      ) : (
        <>
          {activeTab === 'groups' && renderGroupsTab()}
          {activeTab === 'friends' && renderFriendsTab()}
          {activeTab === 'feed' && renderFeedTab()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2C2C2E', // Dark gray background
    paddingTop: 60,
  },
  orangeBar: {
    backgroundColor: '#CC684F', // Orange color
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messagesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
    paddingHorizontal: 16,
    backgroundColor: '#2C2C2E',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 24,
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#CC684F',
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: '#CC684F',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  contentScroll: {
    flex: 1,
    backgroundColor: '#2C2C2E',
  },
  groupCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupIcon: {
    marginRight: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  postsScroll: {
    marginHorizontal: -12,
  },
  postCard: {
    width: 120,
    marginHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  postImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    padding: 8,
    paddingBottom: 4,
  },
  postMeta: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  postDate: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAuthorText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  friendLastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CC684F',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  notificationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  notificationAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
  },
  notificationThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: "#fff",
    elevation: 3,
  },

  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },

  friendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  friendAvatarInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: "#666",
  },

  friendInfo: {
    flexDirection: "column",
  },

  friendName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },

});
