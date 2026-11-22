import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../../../components/ThemedText';
import { formatJoinDate, formatProfileId } from './profileFormat';

// Austria flag (horizontal stripes: red-white-red)
function AustriaFlag() {
  return (
    <View style={styles.flagContainer}>
      <View style={[styles.flagStripe, { backgroundColor: '#CC684F' }]} />
      <View style={[styles.flagStripe, { backgroundColor: '#FFFFFF' }]} />
      <View style={[styles.flagStripe, { backgroundColor: '#CC684F' }]} />
    </View>
  );
}

function Avatar({ uri }) {
  return (
    <View style={styles.avatarPlaceholder}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} />
      ) : (
        <Ionicons name="person" size={50} color="#999" />
      )}
    </View>
  );
}

function CountButton({ label, count, onPress }) {
  return (
    <TouchableOpacity style={styles.friendsGroupsItem} onPress={onPress}>
      <ThemedText style={styles.friendsGroupsText} lightColor="#999" darkColor="#999">
        {label}: {count}
      </ThemedText>
    </TouchableOpacity>
  );
}

// Name, profile id, bio, join date and picture, with the friends / groups counts.
// onShowList('friends' | 'groups') opens the matching list.
export function ProfileDetails({ user, friendsCount, groupsCount, onShowList }) {
  return (
    <View style={styles.profileInfoContainer}>
      <View style={styles.userInfo}>
        <ThemedText style={styles.userName} lightColor="#fff" darkColor="#fff">
          {user.username}
        </ThemedText>
        <ThemedText style={styles.profileId} lightColor="#999" darkColor="#999">
          Profile ID: {formatProfileId(user.id)}
        </ThemedText>
        <ThemedText style={styles.bio} lightColor="#fff" darkColor="#fff">
          {user.bio || 'I love food because you can eat it!'}
        </ThemedText>
        <View style={styles.joinInfo}>
          <AustriaFlag />
          <ThemedText style={styles.joinDate} lightColor="#fff" darkColor="#fff">
            Joined: {formatJoinDate(user.created_at)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.avatarContainer}>
        <Avatar uri={user.avatar_url} />
        <View style={styles.friendsGroupsContainer}>
          <CountButton label="Friends" count={friendsCount} onPress={() => onShowList('friends')} />
          <CountButton label="Groups" count={groupsCount} onPress={() => onShowList('groups')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
  },
  userInfo: {
    flex: 1,
    marginRight: 20,
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    paddingTop: 4,
  },
  profileId: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  bio: {
    fontSize: 16,
    color: '#fff',
    marginTop: 12,
  },
  joinInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  flagContainer: {
    width: 24,
    height: 18,
    flexDirection: 'column',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  flagStripe: {
    flex: 1,
  },
  joinDate: {
    fontSize: 14,
    color: '#fff',
  },
  avatarContainer: {
    width: 120,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#5A9FD4',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  friendsGroupsContainer: {
    marginTop: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  friendsGroupsItem: {
    flex: 1,
  },
  friendsGroupsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
