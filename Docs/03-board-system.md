# 게시판 시스템 설계

## 📋 게시판 화면 구조

```jsx
📋 게시판 (BoardScreen)
├── 🔝 고정 공지 영역
│   ├── "📌 고정" 태그
│   ├── 중요 공지 제목
│   └── 관리자/운영진 표시
├── 📝 일반 공지 목록
│   ├── 제목 + 작성자
│   ├── 작성일시
│   ├── 댓글 수 표시
│   └── 읽음/안읽음 상태
├── ➕ 글쓰기 버튼 (운영진만)
└── 🔍 검색 기능
```

## 📄 게시글 상세 화면

```jsx
📄 게시글 상세 (PostDetailScreen)
├── 📋 게시글 내용
│   ├── 제목
│   ├── 작성자 (프로필 사진)
│   ├── 작성일시
│   ├── 본문 (마크다운 지원)
│   └── 첨부파일 (이미지)
├── 💬 댓글 시스템
│   ├── 댓글 목록
│   ├── 대댓글 (1단계)
│   ├── 좋아요 기능
│   └── 댓글 작성 입력창
└── ⚙️ 관리 기능 (운영진)
    ├── 게시글 수정/삭제
    ├── 고정글 설정
    └── 댓글 관리
```

## 🗂️ 데이터 구조

### 게시글 스키마
```javascript
const PostSchema = {
  id: String,
  title: String,
  content: String,
  author: {
    id: String,
    name: String,
    avatar: String,
    role: 'admin' | 'member'
  },
  isPinned: Boolean,
  createdAt: Date,
  updatedAt: Date,
  attachments: [String], // 이미지 URLs
  comments: [CommentSchema],
  readBy: [String], // 읽은 사용자 IDs
  likes: [String] // 좋아요한 사용자 IDs
};
```

### 댓글 스키마
```javascript
const CommentSchema = {
  id: String,
  content: String,
  author: {
    id: String,
    name: String,
    avatar: String
  },
  parentId: String, // 대댓글인 경우
  createdAt: Date,
  likes: [String]
};
```

## 🧩 컴포넌트 구조

### 1. 메인 게시판 화면
```jsx
// src/screens/main/BoardScreen.js
const BoardScreen = ({ navigation }) => {
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, hasPermission } = useBandAuth();

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>게시판</Text>
        <PermissionGuard permission="write_posts">
          <IconButton
            icon="plus"
            onPress={() => navigation.navigate('PostCreate')}
          />
        </PermissionGuard>
      </View>

      {/* 검색바 */}
      <Searchbar
        placeholder="게시글 검색..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
      />

      {/* 게시글 목록 */}
      <FlatList
        data={filteredPosts}
        renderItem={({ item }) => (
          <PostListItem 
            post={item} 
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          />
        )}
        ListHeaderComponent={<PinnedPosts posts={pinnedPosts} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
};
```

### 2. 고정 공지 컴포넌트
```jsx
// src/components/board/PinnedPosts.js
const PinnedPosts = ({ posts }) => {
  if (!posts || posts.length === 0) return null;

  return (
    <View style={styles.pinnedSection}>
      <Text style={styles.sectionTitle}>📌 고정 공지</Text>
      {posts.map(post => (
        <PinnedPostItem key={post.id} post={post} />
      ))}
    </View>
  );
};

const PinnedPostItem = ({ post }) => (
  <Surface style={styles.pinnedPost} elevation={1}>
    <View style={styles.pinnedHeader}>
      <Chip icon="pin" style={styles.pinChip}>고정</Chip>
      <Text style={styles.adminBadge}>운영진</Text>
    </View>
    
    <Text style={styles.pinnedTitle}>{post.title}</Text>
    
    <View style={styles.postMeta}>
      <Text style={styles.author}>{post.author.name}</Text>
      <Text style={styles.date}>{formatDate(post.createdAt)}</Text>
    </View>
  </Surface>
);
```

### 3. 일반 게시글 아이템
```jsx
// src/components/board/PostListItem.js
const PostListItem = ({ post, onPress }) => {
  const { user } = useBandAuth();
  const isUnread = !post.readBy.includes(user.id);

  return (
    <Surface 
      style={[
        styles.postItem,
        isUnread && styles.unreadPost
      ]} 
      elevation={1}
    >
      <TouchableRipple onPress={onPress}>
        <View style={styles.postContent}>
          {/* 읽지 않은 표시 */}
          {isUnread && <View style={styles.unreadDot} />}
          
          {/* 게시글 제목 */}
          <Text 
            style={[
              styles.postTitle,
              isUnread && styles.unreadTitle
            ]}
            numberOfLines={2}
          >
            {post.title}
          </Text>
          
          {/* 게시글 미리보기 */}
          <Text style={styles.postPreview} numberOfLines={1}>
            {post.content.replace(/\n/g, ' ').substring(0, 100)}...
          </Text>
          
          {/* 첨부파일 표시 */}
          {post.attachments.length > 0 && (
            <View style={styles.attachmentIndicator}>
              <Icon name="image" size={16} color={theme.colors.outline} />
              <Text style={styles.attachmentCount}>
                {post.attachments.length}
              </Text>
            </View>
          )}
          
          {/* 메타 정보 */}
          <View style={styles.postMeta}>
            <View style={styles.authorInfo}>
              <Avatar.Image
                size={24}
                source={{ uri: post.author.avatar }}
              />
              <Text style={styles.authorName}>{post.author.name}</Text>
              {post.author.role === 'admin' && (
                <Chip style={styles.adminBadge}>운영진</Chip>
              )}
            </View>
            
            <View style={styles.postStats}>
              <Text style={styles.date}>
                {formatRelativeTime(post.createdAt)}
              </Text>
              
              {/* 댓글 수 */}
              {post.comments.length > 0 && (
                <View style={styles.commentCount}>
                  <Icon name="comment" size={14} />
                  <Text style={styles.commentText}>
                    {post.comments.length}
                  </Text>
                </View>
              )}
              
              {/* 좋아요 수 */}
              {post.likes.length > 0 && (
                <View style={styles.likeCount}>
                  <Icon name="heart" size={14} />
                  <Text style={styles.likeText}>
                    {post.likes.length}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableRipple>
    </Surface>
  );
};
```

### 4. 게시글 상세 화면
```jsx
// src/screens/detail/PostDetailScreen.js
const PostDetailScreen = ({ route, navigation }) => {
  const { postId } = route.params;
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const { user, hasPermission } = useBandAuth();

  useEffect(() => {
    loadPost();
    markAsRead();
  }, [postId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* 게시글 헤더 */}
        <PostHeader 
          post={post} 
          canEdit={hasPermission('write_posts') || post.author.id === user.id}
          onEdit={() => navigation.navigate('PostEdit', { postId })}
          onDelete={handleDelete}
          onPin={handlePin}
        />
        
        {/* 게시글 내용 */}
        <PostContent post={post} />
        
        {/* 댓글 섹션 */}
        <CommentsSection 
          comments={comments}
          onAddComment={handleAddComment}
          onReplyComment={handleReplyComment}
          onLikeComment={handleLikeComment}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
```

### 5. 게시글 헤더
```jsx
// src/components/board/PostHeader.js
const PostHeader = ({ post, canEdit, onEdit, onDelete, onPin }) => {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.header}>
      <View style={styles.titleSection}>
        {post.isPinned && (
          <Chip icon="pin" style={styles.pinnedChip}>고정</Chip>
        )}
        <Text style={styles.title}>{post.title}</Text>
      </View>
      
      <View style={styles.authorSection}>
        <Avatar.Image
          size={40}
          source={{ uri: post.author.avatar }}
        />
        <View style={styles.authorInfo}>
          <View style={styles.authorName}>
            <Text style={styles.name}>{post.author.name}</Text>
            {post.author.role === 'admin' && (
              <Chip style={styles.adminBadge}>운영진</Chip>
            )}
          </View>
          <Text style={styles.date}>
            {formatFullDate(post.createdAt)}
          </Text>
        </View>
        
        {canEdit && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item onPress={onEdit} title="수정" />
            <Menu.Item onPress={onPin} title={post.isPinned ? "고정 해제" : "고정"} />
            <Menu.Item onPress={onDelete} title="삭제" />
          </Menu>
        )}
      </View>
    </View>
  );
};
```

### 6. 게시글 내용
```jsx
// src/components/board/PostContent.js
const PostContent = ({ post }) => {
  return (
    <View style={styles.content}>
      {/* 본문 내용 */}
      <Text style={styles.contentText}>
        {post.content}
      </Text>
      
      {/* 첨부 이미지 */}
      {post.attachments.length > 0 && (
        <View style={styles.attachments}>
          <Text style={styles.attachmentTitle}>첨부 이미지</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {post.attachments.map((image, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => openImageViewer(post.attachments, index)}
              >
                <Image 
                  source={{ uri: image }}
                  style={styles.attachmentImage}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* 좋아요 버튼 */}
      <View style={styles.actions}>
        <LikeButton 
          likes={post.likes}
          onToggle={handleToggleLike}
        />
      </View>
    </View>
  );
};
```

### 7. 댓글 섹션
```jsx
// src/components/board/CommentsSection.js
const CommentsSection = ({ 
  comments, 
  onAddComment, 
  onReplyComment, 
  onLikeComment 
}) => {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

  return (
    <View style={styles.commentsSection}>
      <Text style={styles.commentsTitle}>
        댓글 {comments.length}개
      </Text>
      
      {/* 댓글 목록 */}
      <FlatList
        data={comments}
        renderItem={({ item }) => (
          <CommentItem 
            comment={item}
            onReply={() => setReplyingTo(item)}
            onLike={() => onLikeComment(item.id)}
          />
        )}
        nestedScrollEnabled
      />
      
      {/* 댓글 작성 */}
      <CommentInput
        value={newComment}
        onChangeText={setNewComment}
        onSubmit={replyingTo ? 
          () => onReplyComment(replyingTo.id, newComment) :
          () => onAddComment(newComment)
        }
        placeholder={replyingTo ? 
          `${replyingTo.author.name}님에게 답글...` : 
          "댓글을 입력하세요..."
        }
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </View>
  );
};
```

### 8. 댓글 아이템
```jsx
// src/components/board/CommentItem.js
const CommentItem = ({ comment, onReply, onLike, level = 0 }) => {
  const isLiked = comment.likes.includes(user.id);

  return (
    <View style={[
      styles.commentItem,
      level > 0 && styles.replyComment
    ]}>
      <Avatar.Image
        size={level > 0 ? 32 : 36}
        source={{ uri: comment.author.avatar }}
      />
      
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.authorName}>
            {comment.author.name}
          </Text>
          <Text style={styles.commentDate}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>
        
        <Text style={styles.commentText}>
          {comment.content}
        </Text>
        
        <View style={styles.commentActions}>
          <TouchableOpacity 
            onPress={onLike}
            style={styles.likeButton}
          >
            <Icon 
              name={isLiked ? "heart" : "heart-outline"}
              size={16}
              color={isLiked ? theme.colors.error : theme.colors.outline}
            />
            {comment.likes.length > 0 && (
              <Text style={styles.likeCount}>
                {comment.likes.length}
              </Text>
            )}
          </TouchableOpacity>
          
          {level === 0 && (
            <TouchableOpacity onPress={onReply}>
              <Text style={styles.replyButton}>답글</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};
```

## 🔍 검색 및 필터링

### 1. 검색 기능
```javascript
// src/hooks/useBoardSearch.js
const useBoardSearch = (posts) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPosts, setFilteredPosts] = useState(posts);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPosts(posts);
      return;
    }

    const filtered = posts.filter(post => 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.author.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredPosts(filtered);
  }, [searchQuery, posts]);

  return {
    searchQuery,
    setSearchQuery,
    filteredPosts
  };
};
```

### 2. 카테고리 필터
```javascript
const CategoryFilter = ({ categories, selectedCategory, onSelect }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <Chip
      selected={selectedCategory === 'all'}
      onPress={() => onSelect('all')}
      style={styles.categoryChip}
    >
      전체
    </Chip>
    
    <Chip
      selected={selectedCategory === 'notice'}
      onPress={() => onSelect('notice')}
      style={styles.categoryChip}
    >
      공지사항
    </Chip>
    
    <Chip
      selected={selectedCategory === 'general'}
      onPress={() => onSelect('general')}
      style={styles.categoryChip}
    >
      자유게시판
    </Chip>
  </ScrollView>
);
```

## 📝 글쓰기 기능

### 게시글 작성 화면
```jsx
// src/screens/detail/PostCreateScreen.js
const PostCreateScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isPinned, setIsPinned] = useState(false);
  
  const { hasPermission } = useBandAuth();
  const canPin = hasPermission('pin_posts');

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('알림', '제목과 내용을 입력해주세요.');
      return;
    }

    try {
      await createPost({
        title: title.trim(),
        content: content.trim(),
        attachments,
        isPinned: canPin ? isPinned : false
      });
      
      navigation.goBack();
    } catch (error) {
      Alert.alert('오류', '게시글 작성에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={styles.content}>
        {/* 제목 입력 */}
        <TextInput
          style={styles.titleInput}
          placeholder="제목을 입력하세요"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
        
        {/* 내용 입력 */}
        <TextInput
          style={styles.contentInput}
          placeholder="내용을 입력하세요"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
        
        {/* 첨부파일 */}
        <AttachmentManager
          attachments={attachments}
          onAdd={handleAddAttachment}
          onRemove={handleRemoveAttachment}
        />
        
        {/* 고정글 설정 (관리자만) */}
        {canPin && (
          <View style={styles.optionRow}>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
            />
            <Text style={styles.optionLabel}>고정글로 설정</Text>
          </View>
        )}
        
        {/* 작성 버튼 */}
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
        >
          게시글 작성
        </Button>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
```

## 🔄 실시간 업데이트

### Socket 연동
```javascript
// src/hooks/useBoardSocket.js
const useBoardSocket = () => {
  const socket = useSocket();
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // 새 게시글 알림
    socket.on('post:created', (newPost) => {
      setPosts(prev => [newPost, ...prev]);
      
      // 관리자 공지인 경우 푸시 알림
      if (newPost.author.role === 'admin') {
        showNotification('새 공지사항', newPost.title);
      }
    });

    // 게시글 업데이트
    socket.on('post:updated', (updatedPost) => {
      setPosts(prev => prev.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      ));
    });

    // 새 댓글 알림
    socket.on('comment:created', ({ postId, comment }) => {
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, comment]
          };
        }
        return post;
      }));
    });

    return () => {
      socket.off('post:created');
      socket.off('post:updated');
      socket.off('comment:created');
    };
  }, []);

  return { posts, setPosts };
};
```

## 📊 상태 관리

### Board Context
```javascript
// src/context/BoardContext.js
const BoardContext = createContext();

export const BoardProvider = ({ children }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const pinnedPosts = posts.filter(post => post.isPinned);
  const regularPosts = posts.filter(post => !post.isPinned);

  const createPost = async (postData) => {
    try {
      const newPost = await boardAPI.createPost(postData);
      setPosts(prev => [newPost, ...prev]);
      return newPost;
    } catch (error) {
      throw error;
    }
  };

  const deletePost = async (postId) => {
    try {
      await boardAPI.deletePost(postId);
      setPosts(prev => prev.filter(post => post.id !== postId));
    } catch (error) {
      throw error;
    }
  };

  return (
    <BoardContext.Provider value={{
      posts,
      pinnedPosts,
      regularPosts,
      loading,
      filter,
      setFilter,
      createPost,
      deletePost
    }}>
      {children}
    </BoardContext.Provider>
  );
};
```

이 설계를 통해 완전한 커뮤니티 게시판 시스템을 구현할 수 있으며, Band 연동을 통한 권한 관리와 실시간 업데이트를 지원합니다.