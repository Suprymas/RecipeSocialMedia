import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemedText } from '../../components/ThemedText';
import { useProfileData } from './profile/useProfileData';
import { ProfileDetails } from './profile/ProfileDetails';
import { ProfileTabBar, ProfileTabContent } from './profile/ProfileTabs';
import { ProfileListModal } from './profile/ProfileListModal';
import { StatusMessage } from './profile/StatusMessage';

// Loading text, the profile with its tabs, or the error when the profile could not be loaded
function ProfileBody({ profile, activeTab, onChangeTab, onShowList, onOpenRecipe }) {
  const { user, loading, error, recipes, stories, friends, groups } = profile;
  if (loading) return <StatusMessage text="Loading..." variant="loading" color="#fff" />;
  if (!user) return <StatusMessage text={error || 'Failed to load user data'} variant="error" color="#fff" />;

  return (
    <>
      <ProfileDetails
        user={user}
        friendsCount={friends.length}
        groupsCount={groups.length}
        onShowList={onShowList}
      />
      <ProfileTabBar activeTab={activeTab} onChange={onChangeTab} />
      <ProfileTabContent activeTab={activeTab} recipes={recipes} stories={stories} onOpenRecipe={onOpenRecipe} />
    </>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const profile = useProfileData();
  const [activeTab, setActiveTab] = useState('recipes');
  const [listType, setListType] = useState(null); // 'friends', 'groups' or null when no list is open

  const closeList = () => setListType(null);

  const openFriendChat = (friend) => {
    closeList();
    navigation.navigate('GroupChat', {
      friendId: friend.id,
      friendName: friend.name,
      friendAvatar: friend.avatar,
      isDirectChat: true,
    });
  };

  const openGroupChat = (group) => {
    closeList();
    navigation.navigate('GroupChat', { groupId: group.id, groupName: group.name, groupIcon: group.icon });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} lightColor="#fff" darkColor="#fff">
            Your profile
          </ThemedText>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="menu-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ProfileBody
          profile={profile}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onShowList={setListType}
          onOpenRecipe={(id) => navigation.navigate('RecipeDetail', { id })}
        />
      </ScrollView>

      <ProfileListModal
        listType={listType}
        friends={profile.friends}
        groups={profile.groups}
        onClose={closeList}
        onSelectFriend={openFriendChat}
        onSelectGroup={openGroupChat}
      />
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
  menuButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    backgroundColor: '#363636',
    padding: 20,
    paddingBottom: 100,
  },
});
