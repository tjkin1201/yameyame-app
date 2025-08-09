# 홈 페이지 설계

## 📱 홈 화면 레이아웃 구조

```jsx
📱 홈 화면 (ClubHomeScreen)
├── 🎯 헤더 (고정)
│   ├── 동배즐 로고 (상단 중앙)
│   ├── 알림 아이콘 (우상단)
│   └── 설정 아이콘 (우상단)
├── 📋 모임 정보 카드
│   ├── 모임명 (예: "서울 동배즐 배드민턴 클럽")
│   ├── 간단 소개/슬로건
│   └── 현재 멤버 수 (예: 125/200명)
├── 📢 공지사항 섹션
│   ├── 고정 공지 (1개, 배경색 구분)
│   ├── 최신 공지 (2-3개)
│   └── "더보기" 버튼 → 게시판으로 이동
├── 🏸 게임 현황판
│   ├── 금일 진행 게임 (진행중)
│   ├── 예정된 게임 (이번 주)
│   ├── 참가 신청 버튼
│   └── "전체 현황 보기" → 게임 현황판으로
└── 👥 멤버 미리보기
    ├── 랜덤 멤버 아바타 (6-8명)
    ├── 총 멤버 수 표시
    └── "전체 멤버 보기" → 멤버 목록으로
```

## 🧩 컴포넌트 분할 구조

### 메인 컴포넌트
```jsx
// src/screens/main/ClubHomeScreen.js
const ClubHomeScreen = () => {
  return (
    <ScrollView>
      <ClubHeader />
      <ClubInfoCard />
      <NoticeSection />
      <GameStatusBoard />
      <MemberPreview />
    </ScrollView>
  );
};
```

### 1. 클럽 헤더
```jsx
// src/components/club/ClubHeader.js
const ClubHeader = () => (
  <View style={styles.header}>
    <Image source={require('../../assets/logo.png')} />
    <View style={styles.actions}>
      <NotificationButton />
      <SettingsButton />
    </View>
  </View>
);
```

### 2. 클럽 정보 카드
```jsx
// src/components/club/ClubInfoCard.js
const ClubInfoCard = ({ club }) => (
  <Card style={styles.clubCard}>
    <Text style={styles.clubName}>{club.name}</Text>
    <Text style={styles.clubDesc}>{club.description}</Text>
    <Text style={styles.memberCount}>
      {club.currentMembers}/{club.maxMembers}명
    </Text>
  </Card>
);
```

### 3. 공지사항 섹션
```jsx
// src/components/club/NoticeSection.js
const NoticeSection = ({ notices }) => (
  <Card style={styles.noticeCard}>
    <Text style={styles.sectionTitle}>공지사항</Text>
    
    {/* 고정 공지 */}
    {notices.pinned && (
      <NoticeItem 
        notice={notices.pinned} 
        isPinned={true}
      />
    )}
    
    {/* 일반 공지 */}
    {notices.recent.slice(0, 3).map(notice => (
      <NoticeItem 
        key={notice.id} 
        notice={notice} 
        isPinned={false}
      />
    ))}
    
    <Button onPress={navigateToBoard}>
      더보기
    </Button>
  </Card>
);

const NoticeItem = ({ notice, isPinned }) => (
  <Surface 
    style={[
      styles.noticeItem,
      isPinned && styles.pinnedNotice
    ]}
  >
    {isPinned && (
      <Chip icon="pin" style={styles.pinChip}>
        고정
      </Chip>
    )}
    <Text style={styles.noticeTitle}>{notice.title}</Text>
    <Text style={styles.noticeDate}>
      {formatDate(notice.createdAt)}
    </Text>
  </Surface>
);
```

### 4. 게임 현황판
```jsx
// src/components/club/GameStatusBoard.js
const GameStatusBoard = ({ games }) => (
  <Card style={styles.gameBoard}>
    <Text style={styles.sectionTitle}>오늘의 게임 현황</Text>
    
    {/* 진행중인 게임 */}
    {games.ongoing.length > 0 && (
      <View style={styles.ongoingSection}>
        <Text style={styles.subTitle}>진행중 🏸</Text>
        {games.ongoing.map(game => (
          <OngoingGameItem key={game.id} game={game} />
        ))}
      </View>
    )}
    
    {/* 예정된 게임 */}
    {games.scheduled.length > 0 && (
      <View style={styles.scheduledSection}>
        <Text style={styles.subTitle}>예정된 게임 ⏰</Text>
        {games.scheduled.slice(0, 3).map(game => (
          <ScheduledGameItem key={game.id} game={game} />
        ))}
      </View>
    )}
    
    <Button onPress={navigateToGameBoard}>
      전체 현황 보기
    </Button>
  </Card>
);

const OngoingGameItem = ({ game }) => (
  <Surface style={styles.gameItem}>
    <View style={styles.gameHeader}>
      <Text style={styles.gameTitle}>{game.title}</Text>
      <Chip style={styles.liveChip}>LIVE</Chip>
    </View>
    <Text style={styles.gameScore}>
      {game.score.team1} : {game.score.team2}
    </Text>
    <Text style={styles.gameTime}>
      {formatGameTime(game.startTime)}
    </Text>
  </Surface>
);

const ScheduledGameItem = ({ game }) => (
  <Surface style={styles.gameItem}>
    <View style={styles.gameHeader}>
      <Text style={styles.gameTitle}>{game.title}</Text>
      <Chip style={styles.timeChip}>
        {formatTime(game.gameDate)}
      </Chip>
    </View>
    <Text style={styles.gameParticipants}>
      참가자: {game.participants.length}/{game.maxParticipants}명
    </Text>
    <Button 
      mode="outlined" 
      onPress={() => joinGame(game.id)}
      disabled={game.participants.length >= game.maxParticipants}
    >
      {game.participants.length >= game.maxParticipants ? '마감' : '참가'}
    </Button>
  </Surface>
);
```

### 5. 멤버 미리보기
```jsx
// src/components/club/MemberPreview.js
const MemberPreview = ({ members }) => {
  const randomMembers = members
    .sort(() => 0.5 - Math.random())
    .slice(0, 8);

  return (
    <Card style={styles.memberCard}>
      <Text style={styles.sectionTitle}>
        멤버 ({members.length}명)
      </Text>
      
      <View style={styles.avatarGrid}>
        {randomMembers.map(member => (
          <Avatar.Image
            key={member.id}
            size={50}
            source={{ uri: member.profileImage }}
            style={styles.memberAvatar}
          />
        ))}
        
        {members.length > 8 && (
          <Avatar.Text
            size={50}
            label={`+${members.length - 8}`}
            style={styles.moreAvatar}
          />
        )}
      </View>
      
      <Button onPress={navigateToMembers}>
        전체 멤버 보기
      </Button>
    </Card>
  );
};
```

## 📊 데이터 구조

### 홈 화면 데이터 모델
```javascript
const HomeScreenData = {
  club: {
    name: "동탄 배드민턴을 즐기는 사람들",
    description: "함께 즐기는 배드민턴, 건강한 만남",
    logo: "https://...",
    currentMembers: 125,
    maxMembers: 200,
    createdAt: "2023-01-01",
    location: "동탄 체육관"
  },
  
  notices: {
    pinned: {
      id: "notice_1",
      title: "1월 정기 모임 안내",
      content: "...",
      author: "관리자",
      createdAt: "2025-01-01",
      isPinned: true
    },
    recent: [
      {
        id: "notice_2",
        title: "새해 인사",
        content: "...",
        author: "관리자",
        createdAt: "2025-01-01",
        readCount: 45
      }
    ]
  },
  
  games: {
    ongoing: [
      {
        id: "game_1",
        title: "점심시간 복식 게임",
        status: "ongoing",
        startTime: "2025-01-02T12:00:00Z",
        participants: [...],
        score: { team1: 15, team2: 12 },
        courtNumber: "1번 코트"
      }
    ],
    scheduled: [
      {
        id: "game_2",
        title: "저녁 단식 연습",
        gameDate: "2025-01-02T19:00:00Z",
        participants: [...],
        maxParticipants: 8,
        skillLevel: "intermediate",
        location: "동탄 체육관"
      }
    ]
  },
  
  members: [
    {
      id: "member_1",
      name: "김배드",
      profileImage: "https://...",
      role: "admin",
      skillLevel: "advanced",
      joinedAt: "2024-03-15",
      isOnline: true
    }
  ]
};
```

## 🔄 실시간 업데이트

### Socket 이벤트 구독
```javascript
// src/hooks/useHomeData.js
const useHomeData = () => {
  const [homeData, setHomeData] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    // 초기 데이터 로드
    loadHomeData();

    // 실시간 업데이트 구독
    socket.on('game:started', handleGameStarted);
    socket.on('game:updated', handleGameUpdated);
    socket.on('member:joined', handleMemberJoined);
    socket.on('notice:created', handleNoticeCreated);

    return () => {
      socket.off('game:started');
      socket.off('game:updated');
      socket.off('member:joined');
      socket.off('notice:created');
    };
  }, []);

  const handleGameStarted = (game) => {
    setHomeData(prev => ({
      ...prev,
      games: {
        ...prev.games,
        ongoing: [...prev.games.ongoing, game],
        scheduled: prev.games.scheduled.filter(g => g.id !== game.id)
      }
    }));
  };

  const handleGameUpdated = (gameUpdate) => {
    setHomeData(prev => ({
      ...prev,
      games: {
        ...prev.games,
        ongoing: prev.games.ongoing.map(game =>
          game.id === gameUpdate.id ? { ...game, ...gameUpdate } : game
        )
      }
    }));
  };

  return { homeData, refreshData: loadHomeData };
};
```

## 🎨 스타일링 가이드

### 컬러 팔레트
```javascript
const homeTheme = {
  colors: {
    primary: '#2E7D32',      // 배드민턴 그린
    secondary: '#FFA726',     // 활기찬 오렌지
    background: '#F5F5F5',    // 라이트 그레이
    surface: '#FFFFFF',       // 화이트
    accent: '#1976D2',        // 블루
    
    // 게임 상태별 컬러
    live: '#E53935',          // 라이브 빨강
    scheduled: '#FFA726',     // 예정 오렌지
    completed: '#4CAF50',     // 완료 그린
    
    // 알림 컬러
    pinned: '#FFE0B2',        // 고정글 배경
    urgent: '#FFCDD2'         // 긴급 알림
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  
  borderRadius: {
    small: 4,
    medium: 8,
    large: 16
  }
};
```

### 공통 스타일
```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeTheme.colors.background,
  },
  
  sectionCard: {
    margin: homeTheme.spacing.md,
    marginBottom: homeTheme.spacing.sm,
    borderRadius: homeTheme.borderRadius.large,
    elevation: 2,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: homeTheme.colors.primary,
    marginBottom: homeTheme.spacing.sm,
  },
  
  liveIndicator: {
    backgroundColor: homeTheme.colors.live,
    paddingHorizontal: homeTheme.spacing.sm,
    paddingVertical: homeTheme.spacing.xs,
    borderRadius: homeTheme.borderRadius.small,
  },
  
  pinnedNotice: {
    backgroundColor: homeTheme.colors.pinned,
    borderLeftWidth: 4,
    borderLeftColor: homeTheme.colors.primary,
  }
});
```

## 📱 반응형 디자인

### 화면 크기별 최적화
```javascript
const useScreenSize = () => {
  const { width, height } = useWindowDimensions();
  
  return {
    isSmall: width < 360,
    isMedium: width >= 360 && width < 600,
    isLarge: width >= 600,
    
    // 그리드 컬럼 수 계산
    avatarColumns: width < 360 ? 4 : width < 600 ? 6 : 8,
    cardMargin: width < 360 ? 12 : 16,
  };
};
```

이 설계를 통해 사용자가 한 눈에 동호회의 모든 핵심 정보를 파악할 수 있는 직관적인 홈 화면을 구현할 수 있습니다.