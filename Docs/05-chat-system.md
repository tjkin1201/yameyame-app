# 채팅 시스템 설계

## 💬 채팅 시스템 개요

동배즐 앱의 채팅 시스템은 Socket.io를 기반으로 한 실시간 커뮤니케이션 플랫폼으로, 전체 채팅, 1:1 개인 채팅, 그리고 귓속말(멘션) 기능을 제공합니다.

## 🏗️ 채팅 화면 구조

```jsx
💬 채팅 (ChatScreen)
├── 📋 채팅방 목록
│   ├── 🌐 전체 채팅방 (고정)
│   ├── 👥 그룹 채팅방들
│   ├── 💬 1:1 개인 채팅방들
│   └── 🔕 음소거된 채팅방들
├── 💬 채팅 상세 화면
│   ├── 메시지 목록 (무한 스크롤)
│   ├── 사용자 온라인 상태
│   ├── 읽음 표시 (1:1만)
│   ├── 타이핑 인디케이터
│   └── 메시지 입력창
└── ⚙️ 채팅 기능
    ├── 텍스트 메시지
    ├── 이미지/파일 전송
    ├── 귓속말 (멘션)
    └── 메시지 삭제/수정
```

## 🔧 Socket.io 기반 실시간 통신

### 1. ChatSocket 서비스
```javascript
// src/services/chatSocket.js
class ChatSocket {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
  }

  connect(userId, token) {
    this.socket = io(SOCKET_SERVER_URL, {
      auth: { token },
      query: { userId },
      transports: ['websocket'],
      upgrade: true,
      rememberUpgrade: true
    });

    this.setupEventListeners();
    this.setupConnectionHandlers();
  }

  setupEventListeners() {
    // 메시지 수신
    this.socket.on('message:received', (message) => {
      this.handleNewMessage(message);
    });

    // 타이핑 상태
    this.socket.on('typing:start', (data) => {
      this.handleTypingStart(data);
    });

    this.socket.on('typing:stop', (data) => {
      this.handleTypingStop(data);
    });

    // 온라인 상태
    this.socket.on('user:online', (userId) => {
      this.handleUserOnline(userId);
    });

    this.socket.on('user:offline', (userId) => {
      this.handleUserOffline(userId);
    });

    // 귓속말 (멘션)
    this.socket.on('whisper:received', (data) => {
      this.handleWhisperReceived(data);
    });

    // 메시지 읽음 확인
    this.socket.on('message:read', (data) => {
      this.handleMessageRead(data);
    });

    // 채팅방 업데이트
    this.socket.on('room:updated', (roomData) => {
      this.handleRoomUpdated(roomData);
    });
  }

  setupConnectionHandlers() {
    this.socket.on('connect', () => {
      console.log('Socket 연결됨');
      this.reconnectAttempts = 0;
      this.notifyListeners('connection:success');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket 연결 끊김:', reason);
      this.notifyListeners('connection:lost', reason);
      
      if (reason === 'io server disconnect') {
        // 서버에서 강제 종료된 경우
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket 연결 오류:', error);
      this.handleReconnection();
    });
  }

  // 메시지 전송
  sendMessage(roomId, content, type = 'text', attachments = []) {
    const message = {
      roomId,
      content,
      type,
      attachments,
      timestamp: Date.now(),
      tempId: `temp_${Date.now()}_${Math.random()}`
    };
    
    this.socket.emit('message:send', message);
    return message.tempId;
  }

  // 귓속말 전송
  sendWhisper(targetUserId, content) {
    const whisper = {
      targetUserId,
      content,
      timestamp: Date.now()
    };
    
    this.socket.emit('whisper:send', whisper);
  }

  // 타이핑 상태 전송
  sendTyping(roomId, isTyping) {
    this.socket.emit('typing:status', {
      roomId,
      isTyping
    });
  }

  // 메시지 읽음 표시
  markAsRead(roomId, messageIds) {
    this.socket.emit('message:mark_read', {
      roomId,
      messageIds
    });
  }

  // 채팅방 입장
  joinRoom(roomId) {
    this.socket.emit('room:join', { roomId });
  }

  // 채팅방 퇴장
  leaveRoom(roomId) {
    this.socket.emit('room:leave', { roomId });
  }

  // 이벤트 리스너 등록
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  // 이벤트 리스너 제거
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  // 리스너들에게 이벤트 알림
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  // 이벤트 핸들러들
  handleNewMessage(message) {
    this.notifyListeners('message:new', message);
  }

  handleTypingStart(data) {
    this.notifyListeners('typing:start', data);
  }

  handleTypingStop(data) {
    this.notifyListeners('typing:stop', data);
  }

  handleUserOnline(userId) {
    this.notifyListeners('user:online', userId);
  }

  handleUserOffline(userId) {
    this.notifyListeners('user:offline', userId);
  }

  handleWhisperReceived(data) {
    this.notifyListeners('whisper:received', data);
  }

  handleMessageRead(data) {
    this.notifyListeners('message:read', data);
  }

  handleRoomUpdated(roomData) {
    this.notifyListeners('room:updated', roomData);
  }

  // 재연결 처리
  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // 지수 백오프
      
      setTimeout(() => {
        console.log(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.socket.connect();
      }, delay);
    } else {
      this.notifyListeners('connection:failed');
    }
  }

  // 연결 해제
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }
}

export default new ChatSocket();
```

### 2. 채팅 Context 관리
```javascript
// src/context/ChatContext.js
const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const { user } = useBandAuth();
  const chatSocket = useRef(new ChatSocket());

  useEffect(() => {
    if (user) {
      initializeChatSocket();
    }

    return () => {
      chatSocket.current.disconnect();
    };
  }, [user]);

  const initializeChatSocket = () => {
    // 연결 이벤트 리스너
    chatSocket.current.addEventListener('connection:success', () => {
      setConnectionStatus('connected');
      loadChatRooms();
    });

    chatSocket.current.addEventListener('connection:lost', () => {
      setConnectionStatus('disconnected');
    });

    chatSocket.current.addEventListener('connection:failed', () => {
      setConnectionStatus('failed');
    });

    // 메시지 이벤트 리스너
    chatSocket.current.addEventListener('message:new', handleNewMessage);
    chatSocket.current.addEventListener('typing:start', handleTypingStart);
    chatSocket.current.addEventListener('typing:stop', handleTypingStop);
    chatSocket.current.addEventListener('user:online', handleUserOnline);
    chatSocket.current.addEventListener('user:offline', handleUserOffline);
    chatSocket.current.addEventListener('whisper:received', handleWhisperReceived);

    // Socket 연결
    chatSocket.current.connect(user.id, user.accessToken);
  };

  // 전체 채팅방 (기본)
  const globalRoom = {
    id: 'global',
    name: '전체 채팅',
    type: 'global',
    participants: [], // 모든 멤버
    unreadCount: 0,
    lastMessage: null
  };

  // 채팅방 목록 로드
  const loadChatRooms = async () => {
    try {
      const rooms = await chatAPI.getChatRooms();
      setChatRooms([globalRoom, ...rooms]);
    } catch (error) {
      console.error('채팅방 목록 로드 실패:', error);
    }
  };

  // 1:1 채팅방 생성
  const createPrivateRoom = async (targetUserId, targetUserName) => {
    const roomId = `private_${[user.id, targetUserId].sort().join('_')}`;
    
    // 기존 채팅방 확인
    const existingRoom = chatRooms.find(room => room.id === roomId);
    if (existingRoom) {
      return existingRoom;
    }

    const room = {
      id: roomId,
      name: targetUserName,
      type: 'private',
      participants: [user.id, targetUserId],
      unreadCount: 0,
      lastMessage: null,
      targetUser: {
        id: targetUserId,
        name: targetUserName
      }
    };

    setChatRooms(prev => [...prev, room]);
    return room;
  };

  // 메시지 전송
  const sendMessage = (roomId, content, type = 'text', attachments = []) => {
    const tempId = chatSocket.current.sendMessage(roomId, content, type, attachments);
    
    // 임시 메시지 추가 (즉시 UI 업데이트)
    const tempMessage = {
      id: tempId,
      content,
      type,
      attachments,
      senderId: user.id,
      senderName: user.name,
      timestamp: new Date(),
      status: 'sending',
      isTemp: true
    };

    setMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), tempMessage]
    }));

    return tempId;
  };

  // 귓속말 처리
  const sendWhisper = (targetUserId, content) => {
    // @사용자명 형태로 멘션 처리
    const targetUser = getChatMember(targetUserId);
    const mentionContent = `@${targetUser.name} ${content}`;
    
    // 전체 채팅방에 멘션 메시지 전송
    sendMessage('global', mentionContent, 'whisper');
    
    // 개별 알림도 전송
    chatSocket.current.sendWhisper(targetUserId, content);
  };

  // 채팅방 입장
  const enterRoom = (roomId) => {
    if (activeRoom) {
      chatSocket.current.leaveRoom(activeRoom.id);
    }
    
    setActiveRoom(chatRooms.find(room => room.id === roomId));
    chatSocket.current.joinRoom(roomId);
    loadMessages(roomId);
  };

  // 메시지 로드
  const loadMessages = async (roomId) => {
    try {
      if (!messages[roomId]) {
        const roomMessages = await chatAPI.getMessages(roomId);
        setMessages(prev => ({
          ...prev,
          [roomId]: roomMessages
        }));
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
  };

  // 이벤트 핸들러들
  const handleNewMessage = (message) => {
    setMessages(prev => ({
      ...prev,
      [message.roomId]: [...(prev[message.roomId] || []), message]
    }));

    // 읽지 않은 메시지 수 업데이트
    if (message.roomId !== activeRoom?.id) {
      setChatRooms(prev => prev.map(room => 
        room.id === message.roomId 
          ? { ...room, unreadCount: room.unreadCount + 1 }
          : room
      ));
    }
  };

  const handleTypingStart = ({ roomId, userId, userName }) => {
    setTypingUsers(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), { userId, userName }]
    }));
  };

  const handleTypingStop = ({ roomId, userId }) => {
    setTypingUsers(prev => ({
      ...prev,
      [roomId]: (prev[roomId] || []).filter(user => user.userId !== userId)
    }));
  };

  const handleUserOnline = (userId) => {
    setOnlineUsers(prev => new Set([...prev, userId]));
  };

  const handleUserOffline = (userId) => {
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  const handleWhisperReceived = (data) => {
    // 귓속말 알림 처리
    showNotification('귓속말', data.content);
  };

  return (
    <ChatContext.Provider value={{
      chatRooms,
      activeRoom,
      messages,
      onlineUsers,
      typingUsers,
      connectionStatus,
      sendMessage,
      sendWhisper,
      createPrivateRoom,
      enterRoom,
      loadMessages
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
```

## 📱 UI 컴포넌트 구조

### 1. 메인 채팅 화면
```jsx
// src/screens/main/ChatScreen.js
const ChatScreen = ({ navigation }) => {
  const { 
    chatRooms, 
    connectionStatus, 
    createPrivateRoom 
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = chatRooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startPrivateChat = async (targetUser) => {
    const room = await createPrivateRoom(targetUser.id, targetUser.name);
    navigation.navigate('ChatRoom', { 
      roomId: room.id,
      roomName: room.name 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>채팅</Text>
        <ConnectionStatusIndicator status={connectionStatus} />
      </View>

      {/* 검색바 */}
      <Searchbar
        placeholder="채팅방 검색..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
      />

      {/* 채팅방 목록 */}
      <FlatList
        data={filteredRooms}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatRoomItem 
            room={item}
            onPress={() => navigation.navigate('ChatRoom', {
              roomId: item.id,
              roomName: item.name
            })}
          />
        )}
        ItemSeparatorComponent={() => <Divider />}
      />

      {/* 새 채팅 버튼 */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('MemberSelect', {
          onSelect: startPrivateChat
        })}
      />
    </SafeAreaView>
  );
};
```

### 2. 연결 상태 표시기
```jsx
// src/components/chat/ConnectionStatusIndicator.js
const ConnectionStatusIndicator = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return { 
          color: theme.colors.success, 
          icon: 'wifi', 
          text: '연결됨' 
        };
      case 'disconnected':
        return { 
          color: theme.colors.warning, 
          icon: 'wifi-off', 
          text: '연결 끊김' 
        };
      case 'failed':
        return { 
          color: theme.colors.error, 
          icon: 'alert-circle', 
          text: '연결 실패' 
        };
      default:
        return { 
          color: theme.colors.outline, 
          icon: 'loading', 
          text: '연결 중...' 
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={styles.statusContainer}>
      <Icon 
        name={config.icon} 
        size={16} 
        color={config.color} 
      />
      <Text style={[styles.statusText, { color: config.color }]}>
        {config.text}
      </Text>
    </View>
  );
};
```

### 3. 채팅방 아이템
```jsx
// src/components/chat/ChatRoomItem.js
const ChatRoomItem = ({ room, onPress }) => {
  const { onlineUsers } = useChat();
  const isOnline = room.type === 'private' && 
    room.targetUser && 
    onlineUsers.has(room.targetUser.id);

  return (
    <Surface style={styles.roomItem} elevation={1}>
      <TouchableRipple onPress={onPress}>
        <View style={styles.roomContent}>
          {/* 아바타 */}
          <View style={styles.avatarContainer}>
            <Avatar.Text
              size={50}
              label={room.name[0]}
              style={styles.avatar}
            />
            {room.type === 'global' && (
              <Icon 
                name="earth" 
                size={16} 
                style={styles.roomTypeIcon}
              />
            )}
            {isOnline && (
              <View style={styles.onlineIndicator} />
            )}
          </View>

          {/* 채팅방 정보 */}
          <View style={styles.roomInfo}>
            <View style={styles.roomHeader}>
              <Text style={styles.roomName} numberOfLines={1}>
                {room.name}
              </Text>
              {room.lastMessage && (
                <Text style={styles.lastMessageTime}>
                  {formatRelativeTime(room.lastMessage.timestamp)}
                </Text>
              )}
            </View>

            {/* 마지막 메시지 */}
            {room.lastMessage ? (
              <Text 
                style={styles.lastMessage} 
                numberOfLines={1}
              >
                {room.lastMessage.type === 'image' 
                  ? '📷 사진' 
                  : room.lastMessage.content
                }
              </Text>
            ) : (
              <Text style={styles.noMessage}>
                메시지가 없습니다
              </Text>
            )}
          </View>

          {/* 읽지 않은 메시지 */}
          {room.unreadCount > 0 && (
            <Badge style={styles.unreadBadge}>
              {room.unreadCount > 99 ? '99+' : room.unreadCount}
            </Badge>
          )}
        </View>
      </TouchableRipple>
    </Surface>
  );
};
```

### 4. 채팅방 상세 화면
```jsx
// src/screens/detail/ChatRoomScreen.js
const ChatRoomScreen = ({ route, navigation }) => {
  const { roomId, roomName } = route.params;
  const { 
    messages, 
    activeRoom, 
    sendMessage, 
    enterRoom,
    typingUsers,
    onlineUsers 
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ 
      title: roomName,
      headerRight: () => (
        <ChatRoomMenu 
          roomId={roomId}
          onlineCount={onlineUsers.size}
        />
      )
    });

    enterRoom(roomId);
  }, [roomId]);

  const handleSendMessage = () => {
    if (inputText.trim()) {
      sendMessage(roomId, inputText.trim());
      setInputText('');
      setIsTyping(false);
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    
    // 타이핑 상태 업데이트
    const newIsTyping = text.length > 0;
    if (newIsTyping !== isTyping) {
      setIsTyping(newIsTyping);
      chatSocket.current.sendTyping(roomId, newIsTyping);
    }
  };

  const roomMessages = messages[roomId] || [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* 메시지 목록 */}
        <FlatList
          ref={flatListRef}
          data={roomMessages}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <MessageItem 
              message={item}
              previousMessage={roomMessages[index - 1]}
              isConsecutive={
                index > 0 && 
                roomMessages[index - 1].senderId === item.senderId &&
                (item.timestamp - roomMessages[index - 1].timestamp) < 60000
              }
            />
          )}
          onContentSizeChange={() => 
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          style={styles.messagesList}
        />

        {/* 타이핑 인디케이터 */}
        <TypingIndicator 
          typingUsers={typingUsers[roomId] || []}
        />

        {/* 메시지 입력 */}
        <MessageInput
          value={inputText}
          onChangeText={handleInputChange}
          onSend={handleSendMessage}
          onAttachment={() => {/* 첨부파일 기능 */}}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
```

### 5. 메시지 아이템
```jsx
// src/components/chat/MessageItem.js
const MessageItem = ({ message, isConsecutive }) => {
  const { user } = useBandAuth();
  const isOwnMessage = message.senderId === user.id;
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const renderMessageContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <TouchableOpacity onPress={() => setImageViewerVisible(true)}>
            <Image 
              source={{ uri: message.attachments[0] }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      
      case 'whisper':
        return (
          <View style={styles.whisperContainer}>
            <Icon name="at" size={16} color={theme.colors.primary} />
            <Text style={styles.whisperText}>{message.content}</Text>
          </View>
        );
      
      default:
        return (
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.content}
          </Text>
        );
    }
  };

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      {/* 프로필 이미지 (연속 메시지가 아닌 경우만) */}
      {!isOwnMessage && !isConsecutive && (
        <Avatar.Text
          size={32}
          label={message.senderName[0]}
          style={styles.senderAvatar}
        />
      )}

      {/* 메시지 버블 */}
      <View style={[
        styles.messageBubble,
        isOwnMessage ? styles.ownBubble : styles.otherBubble,
        isConsecutive && styles.consecutiveBubble
      ]}>
        {/* 발신자 이름 (타인 메시지 & 연속 메시지가 아닌 경우) */}
        {!isOwnMessage && !isConsecutive && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}

        {/* 메시지 내용 */}
        {renderMessageContent()}

        {/* 메시지 시간 */}
        <Text style={[
          styles.messageTime,
          isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
        ]}>
          {formatMessageTime(message.timestamp)}
        </Text>

        {/* 메시지 상태 (본인 메시지만) */}
        {isOwnMessage && (
          <MessageStatus status={message.status} />
        )}
      </View>

      {/* 이미지 뷰어 */}
      {message.type === 'image' && (
        <ImageViewing
          images={[{ uri: message.attachments[0] }]}
          imageIndex={0}
          visible={imageViewerVisible}
          onRequestClose={() => setImageViewerVisible(false)}
        />
      )}
    </View>
  );
};
```

### 6. 타이핑 인디케이터
```jsx
// src/components/chat/TypingIndicator.js
const TypingIndicator = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName}님이 입력 중...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].userName}님, ${typingUsers[1].userName}님이 입력 중...`;
    } else {
      return `${typingUsers.length}명이 입력 중...`;
    }
  };

  return (
    <View style={styles.typingContainer}>
      <TypingAnimation />
      <Text style={styles.typingText}>{getTypingText()}</Text>
    </View>
  );
};

const TypingAnimation = () => {
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(opacity1, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity2, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity3, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity1, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity2, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity3, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ]).start(() => animate());
    };
    
    animate();
  }, []);

  return (
    <View style={styles.typingDots}>
      <Animated.View style={[styles.dot, { opacity: opacity1 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity2 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity3 }]} />
    </View>
  );
};
```

### 7. 메시지 입력창
```jsx
// src/components/chat/MessageInput.js
const MessageInput = ({ 
  value, 
  onChangeText, 
  onSend, 
  onAttachment 
}) => {
  const [inputHeight, setInputHeight] = useState(40);

  const handleContentSizeChange = (event) => {
    const { height } = event.nativeEvent.contentSize;
    setInputHeight(Math.max(40, Math.min(120, height)));
  };

  return (
    <View style={styles.inputContainer}>
      <Surface style={styles.inputSurface} elevation={2}>
        {/* 첨부파일 버튼 */}
        <IconButton
          icon="attachment"
          size={24}
          onPress={onAttachment}
          style={styles.attachButton}
        />

        {/* 텍스트 입력 */}
        <TextInput
          style={[
            styles.textInput,
            { height: inputHeight }
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder="메시지를 입력하세요..."
          multiline
          maxLength={1000}
          onContentSizeChange={handleContentSizeChange}
          textAlignVertical="center"
        />

        {/* 전송 버튼 */}
        <IconButton
          icon="send"
          size={24}
          onPress={onSend}
          disabled={!value.trim()}
          style={[
            styles.sendButton,
            value.trim() ? styles.sendButtonActive : styles.sendButtonInactive
          ]}
        />
      </Surface>
    </View>
  );
};
```

## 🔔 푸시 알림 연동

### 알림 처리
```javascript
// src/services/chatNotifications.js
class ChatNotificationService {
  constructor() {
    this.isAppActive = true;
  }

  setAppState(isActive) {
    this.isAppActive = isActive;
  }

  // 새 메시지 알림
  showMessageNotification(message) {
    if (this.isAppActive) return; // 앱이 활성화된 경우 알림 표시 안함

    const notification = {
      title: message.senderName,
      body: message.type === 'image' ? '📷 사진을 보냈습니다' : message.content,
      data: {
        type: 'chat_message',
        roomId: message.roomId,
        messageId: message.id
      }
    };

    this.scheduleNotification(notification);
  }

  // 귓속말 알림
  showWhisperNotification(whisper) {
    const notification = {
      title: `${whisper.senderName}님의 귓속말`,
      body: whisper.content,
      data: {
        type: 'whisper',
        senderId: whisper.senderId
      }
    };

    this.scheduleNotification(notification);
  }

  // 알림 예약
  async scheduleNotification(notification) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: notification,
        trigger: null // 즉시 표시
      });
    } catch (error) {
      console.error('알림 표시 실패:', error);
    }
  }
}

export default new ChatNotificationService();
```

## 📊 채팅 통계 및 관리

### 채팅 통계
```javascript
// src/hooks/useChatStats.js
const useChatStats = () => {
  const [stats, setStats] = useState({
    totalMessages: 0,
    activeUsers: 0,
    dailyMessages: [],
    popularTimes: []
  });

  const updateStats = (newMessage) => {
    setStats(prev => ({
      ...prev,
      totalMessages: prev.totalMessages + 1
    }));
  };

  return { stats, updateStats };
};
```

이 설계를 통해 완전한 실시간 채팅 시스템을 구현할 수 있으며, 동호회 멤버들 간의 원활한 소통을 지원합니다.