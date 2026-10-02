import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { backend } from '../../services/Backend';
import { useFocusEffect } from '@react-navigation/native';

export default function GroupChatScreen({ route, navigation }) {
  const {
    roomId: group_id
  } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [chatName, setChatName] = useState('')
  const scrollViewRef = useRef(null);


  useFocusEffect(
    React.useCallback(() => {
      let channel;

      const fetchData = async () => {
        try {
          // Fetch the room info
          const { data: roomData, error: roomError } = await backend
            .from('groups')
            .select('*')
            .eq('id', group_id)
            .single();

          if (roomError) {
            console.error('Error fetching room:', roomError);
          } else {
            setChatName(roomData.name || 'Chat');
          }

          // Fetch the users in the room
          const { data: usersData, error: usersError } = await backend
            .from('group_members')
            .select('user_id')
            .eq('group_id', group_id);

          if (usersError) {
            console.error('Error fetching users:', usersError);
          } else {
            const { data: { user } } = await backend.auth.getUser();
            setCurrentUserId(user.id);

            // Fetch current user's username
            const { data: profileData, error: profileError } = await backend
              .from('profiles')
              .select('username')
              .eq('id', user.id)
              .single();

            if (profileError) {
              console.error('Error fetching profile:', profileError);
            } else {
              setCurrentUserName(profileData.username);
            }
          }

          // Fetch messages for the room
          const { data: messagesData, error: messagesError } = await backend
            .from('messages')
            .select('*')
            .eq('group_id', group_id)
            .order('created_at', { ascending: true });

          if (messagesError) {
            console.error('Error fetching messages:', messagesError);
          } else {
            setMessages(messagesData || []);
          }
          console.log("fetched messages", messages)

          setLoading(false);

          // --- Subscribe to broadcast messages for this room ---
          channel = backend
            .channel(`room:${group_id}`)
            .on('broadcast', { event: 'message' }, (payload) => {
              const newMessage = payload.payload;
              console.log(newMessage);
              setMessages((prevMessages) => [...prevMessages, newMessage]);

              // Scroll to bottom if needed
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 50);
            })
            .subscribe();

        } catch (err) {
          console.error('Unexpected error fetching chat data:', err);
          setLoading(false);
        }
      };

      fetchData();

      // Cleanup subscription on unmount
      return () => {
        if (channel) backend.removeChannel(channel);
      };
    }, [group_id])
  );


  const loadUserData = async () => {
    try {
      const { data: { user } } = await backend.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await backend
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUserName(profile.username || 'You');
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    console.log("sending the messages")
    const newMessage = {
      id: Date.now().toString(),
      author_id: currentUserId,
      content: messageText,
      created_at: new Date()
    };

    // 1️⃣Update local state immediately for optimistic UI
    setMessages((prev) => [...prev, newMessage]);
    setMessageText('');
    setShowAttachmentMenu(false);

    // 2️⃣Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // 3️⃣ Broadcast the message to the room
    try {
      const channel = backend.channel(`room:${group_id}`);

      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: newMessage,
      });
    } catch (err) {
      console.error('Error broadcasting message:', err);
    }

    // 4️⃣ Optionally, persist the message in the DB for history
    const { data, error } = await backend.from('messages').insert({
      group_id: group_id,
      author_id: currentUserId,
      content: messageText,
      created_at: new Date().toISOString(),
    });

    console.log('Inserted data:', data);
    //console.error('Insert error:', error);
  };

  const handleAttachmentPress = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
  };

  const handleAttachmentOption = (option) => {
    // Handle attachment options (Recipe, Image, Camera)
    console.log('Selected attachment option:', option);
    setShowAttachmentMenu(false);
    // Implement actual attachment logic here
  };

  const renderMessage = (message) => {
    console.log(message)
    const isCurrentUser = message.author_id === currentUserId;

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.messageContainerRight : styles.messageContainerLeft,
        ]}
      >
        {!isCurrentUser && (
          <Image source={{ uri: message.senderAvatar }} style={styles.messageAvatar} />
        )}
        <View
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
          ]}
        >
          {message.image && (
            <Image source={{ uri: message.image }} style={styles.messageImage} />
          )}
          <Text style={styles.messageText}>{message.content}</Text>
          <Text style={styles.messageTimestamp}>
            {message.created_at instanceof Date
              ? message.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isCurrentUser && (
          <Image source={{ uri: message.senderAvatar }} style={styles.messageAvatar} />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {chatName}
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.roomInfo}>
          {/*
          <Image
            source={{
              uri: isDirectChat
                ? (friendAvatar || 'https://i.pinimg.com/736x/c4/0c/67/c40c6735f15972c25e6d8ef722d6f1f2.jpg')
                : 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&h=200&fit=crop'
            }}
            style={styles.roomAvatar}
          />
          */}
          <Text style={styles.roomName}>
            {chatName}
          </Text>
        </View>
      </View>

      {/* Messages Area */}
      <FlatList
        ref={scrollViewRef}
        data={messages}
        keyExtractor={(item, index) => item.id || item.created_at + index} // fallback for local messages
        contentContainerStyle={styles.messagesContent}
        style={styles.messagesArea}
        renderItem={({ item: message }) => {
          const isCurrentUser = message.author_id === currentUserId;

          return (
            <View
              style={[
                styles.messageContainer,
                isCurrentUser ? styles.messageContainerRight : styles.messageContainerLeft,
              ]}
            >
              {!isCurrentUser && message.senderAvatar && (
                <Image
                  source={{ uri: message.senderAvatar }}
                  style={styles.messageAvatar}
                />
              )}

              <View
                style={[
                  styles.messageBubble,
                  isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
                ]}
              >
                {message.image && (
                  <Image
                    source={{ uri: message.image }}
                    style={styles.messageImage}
                  />
                )}
                <Text style={styles.messageText}>{message.content}</Text>
                <Text style={styles.messageTimestamp}>
                  {formatTimestamp(message.created_at)}
                </Text>
              </View>

              {isCurrentUser && message.senderAvatar && (
                <Image
                  source={{ uri: message.senderAvatar }}
                  style={styles.messageAvatar}
                />
              )}
            </View>
          );
        }}
      />

      {/* Attachment Menu */}
      {showAttachmentMenu && (
        <View style={styles.attachmentMenu}>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => handleAttachmentOption('recipe')}
          >
            <Ionicons name="restaurant" size={32} color="#CC684F" />
            <Text style={styles.attachmentOptionText}>Recipe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => handleAttachmentOption('image')}
          >
            <Ionicons name="image" size={32} color="#CC684F" />
            <Text style={styles.attachmentOptionText}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachmentOption}
            onPress={() => handleAttachmentOption('camera')}
          >
            <Ionicons name="camera" size={32} color="#CC684F" />
            <Text style={styles.attachmentOptionText}>Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.inputIcon}>
          <Ionicons name="happy" size={24} color="#666" />
        </TouchableOpacity>
        <TextInput
          style={styles.inputField}
          placeholder="write something ..."
          placeholderTextColor="#999"
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        {!showAttachmentMenu && (
          <TouchableOpacity onPress={handleAttachmentPress} style={styles.inputIcon}>
            <Ionicons name="paperclip" size={24} color="#666" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={async () => { await handleSendMessage() }} style={styles.sendButton}>
          <Ionicons name="paper-plane" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 60,
  },
  header: {
    backgroundColor: '#CC684F',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerRight: {
    width: 32,
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#E5E5E5',
  },
  roomAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageContainerLeft: {
    justifyContent: 'flex-start',
  },
  messageContainerRight: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 8,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleLeft: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: '#fff',
    borderBottomRightRadius: 4,
  },
  messageImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  messageTimestamp: {
    fontSize: 11,
    color: '#999',
    alignSelf: 'flex-end',
  },
  attachmentMenu: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    minWidth: 80,
  },
  attachmentOptionText: {
    marginTop: 8,
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  inputIcon: {
    padding: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    paddingHorizontal: 12,
  },
  sendButton: {
    backgroundColor: '#CC684F',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
  },
});

