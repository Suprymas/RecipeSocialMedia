import { Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../../../components/ThemedText';
import { StatusMessage } from './StatusMessage';

function FriendRow({ friend, onPress }) {
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress}>
      <Image source={{ uri: friend.avatar }} style={styles.listItemAvatar} />
      <ThemedText style={styles.listItemName} lightColor="#fff" darkColor="#fff">
        {friend.name}
      </ThemedText>
    </TouchableOpacity>
  );
}

function GroupRow({ group, onPress }) {
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress}>
      <View style={styles.groupIconContainer}>
        <Ionicons name={group.icon} size={24} color="#fff" />
      </View>
      <ThemedText style={styles.listItemName} lightColor="#fff" darkColor="#fff">
        {group.name}
      </ThemedText>
    </TouchableOpacity>
  );
}

function ListRows({ items, emptyText, renderRow }) {
  if (items.length === 0) return <StatusMessage text={emptyText} variant="emptyList" color="#999" />;
  return items.map(renderRow);
}

// Sliding list of the user's friends or groups.
// listType: 'friends', 'groups', or null while the list is closed.
export function ProfileListModal({ listType, friends, groups, onClose, onSelectFriend, onSelectGroup }) {
  const showFriends = listType === 'friends';
  return (
    <Modal visible={listType !== null} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle} lightColor="#fff" darkColor="#fff">
              {showFriends ? 'Friends' : 'Groups'}
            </ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
            {showFriends ? (
              <ListRows
                items={friends}
                emptyText="No friends yet"
                renderRow={(friend) => <FriendRow key={friend.id} friend={friend} onPress={() => onSelectFriend(friend)} />}
              />
            ) : (
              <ListRows
                items={groups}
                emptyText="No groups yet"
                renderRow={(group) => <GroupRow key={group.id} group={group} onPress={() => onSelectGroup(group)} />}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#363636',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalList: {
    flex: 1,
  },
  modalListContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  listItemAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  groupIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#CC684F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
});
