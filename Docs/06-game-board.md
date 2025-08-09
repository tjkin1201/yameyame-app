# 베드민턴 게임 현황판 설계

## 🏸 게임 현황판 개요

동배즐 앱의 게임 현황판은 베드민턴 게임의 생성, 참가, 진행, 결과 관리를 담당하는 핵심 모듈입니다. 실시간으로 게임 상황을 추적하고 멤버들의 참여를 관리합니다.

## 📊 게임 현황판 화면 구조

```jsx
🏸 게임 현황판 (GameBoardScreen)
├── 📊 현황 요약
│   ├── 오늘 진행 게임 수
│   ├── 참가 대기 인원
│   ├── 완료된 게임 수
│   └── 이번 주 총 게임 수
├── 🎯 진행중인 게임
│   ├── 코트별 현재 경기
│   ├── 점수 현황 (실시간)
│   ├── 경기 시간
│   └── 다음 경기 대기자
├── ⏰ 예정된 게임
│   ├── 시간별 게임 스케줄
│   ├── 참가 신청 현황
│   ├── 대기 순서
│   └── 참가/취소 버튼
├── ➕ 게임 생성 (운영진)
│   ├── 빠른 게임 생성
│   ├── 상세 게임 설정
│   └── 정기 게임 설정
└── 📈 통계 및 기록
    ├── 개인 통계
    ├── 승부 기록
    └── 랭킹 정보
```

## 🔧 게임 상태 관리

### 1. GameBoard Context
```javascript
// src/context/GameBoardContext.js
const GameBoardContext = createContext();

export const GameBoardProvider = ({ children }) => {
  const [games, setGames] = useState({
    ongoing: [],      // 진행중인 게임
    scheduled: [],    // 예정된 게임
    completed: [],    // 완료된 게임
    waiting: []       // 대기중인 게임
  });

  const [courts, setCourts] = useState([
    { id: 1, name: '1번 코트', status: 'playing', currentGame: null },
    { id: 2, name: '2번 코트', status: 'available', currentGame: null },
    { id: 3, name: '3번 코트', status: 'maintenance', currentGame: null }
  ]);

  const [boardStats, setBoardStats] = useState({
    todayGames: 0,
    waitingPlayers: 0,
    completedGames: 0,
    weeklyGames: 0
  });

  const socket = useSocket();

  useEffect(() => {
    loadGameBoard();
    setupSocketListeners();
  }, []);

  // 게임보드 데이터 로드
  const loadGameBoard = async () => {
    try {
      const [gamesData, courtsData, statsData] = await Promise.all([
        gameAPI.getAllGames(),
        gameAPI.getCourts(),
        gameAPI.getBoardStats()
      ]);

      setGames(gamesData);
      setCourts(courtsData);
      setBoardStats(statsData);
    } catch (error) {
      console.error('게임보드 로드 실패:', error);
    }
  };

  // Socket 이벤트 리스너 설정
  const setupSocketListeners = () => {
    socket.on('game:created', handleGameCreated);
    socket.on('game:updated', handleGameUpdated);
    socket.on('game:started', handleGameStarted);
    socket.on('game:completed', handleGameCompleted);
    socket.on('player:joined', handlePlayerJoined);
    socket.on('player:left', handlePlayerLeft);
    socket.on('score:updated', handleScoreUpdated);

    return () => {
      socket.off('game:created');
      socket.off('game:updated');
      socket.off('game:started');
      socket.off('game:completed');
      socket.off('player:joined');
      socket.off('player:left');
      socket.off('score:updated');
    };
  };

  // 게임 생성
  const createGame = async (gameData) => {
    try {
      const newGame = {
        id: generateId(),
        ...gameData,
        status: 'scheduled',
        participants: [],
        waitingList: [],
        createdAt: Date.now(),
        createdBy: user.id
      };

      const savedGame = await gameAPI.createGame(newGame);
      
      setGames(prev => ({
        ...prev,
        scheduled: [...prev.scheduled, savedGame]
      }));

      // Socket으로 다른 사용자들에게 알림
      socket.emit('game:create', savedGame);

      return savedGame;
    } catch (error) {
      console.error('게임 생성 실패:', error);
      throw error;
    }
  };

  // 게임 참가
  const joinGame = async (gameId, userId) => {
    try {
      const game = games.scheduled.find(g => g.id === gameId);
      if (!game) throw new Error('게임을 찾을 수 없습니다');

      const updatedGame = await gameAPI.joinGame(gameId, userId);

      setGames(prev => ({
        ...prev,
        scheduled: prev.scheduled.map(g => 
          g.id === gameId ? updatedGame : g
        )
      }));

      socket.emit('player:join', { gameId, userId });

      return updatedGame;
    } catch (error) {
      console.error('게임 참가 실패:', error);
      throw error;
    }
  };

  // 게임 시작
  const startGame = async (gameId, courtId) => {
    try {
      const game = games.scheduled.find(g => g.id === gameId);
      if (!game) throw new Error('게임을 찾을 수 없습니다');

      const startedGame = {
        ...game,
        status: 'ongoing',
        courtId,
        startTime: Date.now(),
        score: { team1: 0, team2: 0 },
        sets: []
      };

      const updatedGame = await gameAPI.startGame(gameId, courtId);

      setGames(prev => ({
        ...prev,
        scheduled: prev.scheduled.filter(g => g.id !== gameId),
        ongoing: [...prev.ongoing, updatedGame]
      }));

      // 코트 상태 업데이트
      setCourts(prev => prev.map(court => 
        court.id === courtId 
          ? { ...court, status: 'playing', currentGame: gameId }
          : court
      ));

      socket.emit('game:start', updatedGame);

      return updatedGame;
    } catch (error) {
      console.error('게임 시작 실패:', error);
      throw error;
    }
  };

  // 점수 업데이트
  const updateScore = async (gameId, scoreUpdate) => {
    try {
      const updatedGame = await gameAPI.updateScore(gameId, scoreUpdate);

      setGames(prev => ({
        ...prev,
        ongoing: prev.ongoing.map(g => 
          g.id === gameId ? updatedGame : g
        )
      }));

      socket.emit('score:update', { gameId, score: updatedGame.score });

      return updatedGame;
    } catch (error) {
      console.error('점수 업데이트 실패:', error);
      throw error;
    }
  };

  // 게임 완료
  const completeGame = async (gameId, gameResult) => {
    try {
      const completedGame = await gameAPI.completeGame(gameId, gameResult);

      setGames(prev => ({
        ...prev,
        ongoing: prev.ongoing.filter(g => g.id !== gameId),
        completed: [...prev.completed, completedGame]
      }));

      // 코트 상태 업데이트
      setCourts(prev => prev.map(court => 
        court.currentGame === gameId 
          ? { ...court, status: 'available', currentGame: null }
          : court
      ));

      socket.emit('game:complete', completedGame);

      return completedGame;
    } catch (error) {
      console.error('게임 완료 실패:', error);
      throw error;
    }
  };

  // Socket 이벤트 핸들러들
  const handleGameCreated = (game) => {
    setGames(prev => ({
      ...prev,
      scheduled: [...prev.scheduled, game]
    }));
  };

  const handleGameStarted = (game) => {
    setGames(prev => ({
      ...prev,
      scheduled: prev.scheduled.filter(g => g.id !== game.id),
      ongoing: [...prev.ongoing, game]
    }));
  };

  const handleScoreUpdated = ({ gameId, score }) => {
    setGames(prev => ({
      ...prev,
      ongoing: prev.ongoing.map(g => 
        g.id === gameId ? { ...g, score } : g
      )
    }));
  };

  return (
    <GameBoardContext.Provider value={{
      games,
      courts,
      boardStats,
      createGame,
      joinGame,
      startGame,
      updateScore,
      completeGame,
      loadGameBoard
    }}>
      {children}
    </GameBoardContext.Provider>
  );
};

export const useGameBoard = () => {
  const context = useContext(GameBoardContext);
  if (!context) {
    throw new Error('useGameBoard must be used within a GameBoardProvider');
  }
  return context;
};
```

## 📱 UI 컴포넌트 구조

### 1. 메인 게임보드 화면
```jsx
// src/screens/detail/GameBoardScreen.js
const GameBoardScreen = ({ navigation }) => {
  const { 
    games, 
    courts, 
    boardStats, 
    createGame 
  } = useGameBoard();
  
  const { hasPermission } = useBandAuth();
  const canManageGames = hasPermission('manage_games');

  const [selectedTab, setSelectedTab] = useState('ongoing');

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>게임 현황판</Text>
        {canManageGames && (
          <IconButton
            icon="plus"
            onPress={() => navigation.navigate('GameCreate')}
          />
        )}
      </View>

      {/* 통계 요약 */}
      <StatsOverview stats={boardStats} />

      {/* 코트 상태 */}
      <CourtStatus courts={courts} />

      {/* 탭 네비게이션 */}
      <View style={styles.tabContainer}>
        <Chip
          selected={selectedTab === 'ongoing'}
          onPress={() => setSelectedTab('ongoing')}
          style={styles.tab}
        >
          진행중 ({games.ongoing.length})
        </Chip>
        <Chip
          selected={selectedTab === 'scheduled'}
          onPress={() => setSelectedTab('scheduled')}
          style={styles.tab}
        >
          예정 ({games.scheduled.length})
        </Chip>
        <Chip
          selected={selectedTab === 'completed'}
          onPress={() => setSelectedTab('completed')}
          style={styles.tab}
        >
          완료 ({games.completed.length})
        </Chip>
      </View>

      {/* 게임 목록 */}
      <GameList 
        games={games[selectedTab]}
        type={selectedTab}
        onGamePress={(game) => navigation.navigate('GameDetail', { 
          gameId: game.id 
        })}
      />

      {/* 빠른 게임 생성 FAB */}
      {canManageGames && (
        <FAB
          icon="lightning-bolt"
          label="빠른 게임"
          style={styles.fab}
          onPress={() => createQuickGame()}
        />
      )}
    </SafeAreaView>
  );
};
```

### 2. 통계 요약 카드
```jsx
// src/components/game/StatsOverview.js
const StatsOverview = ({ stats }) => {
  return (
    <Card style={styles.statsCard}>
      <Card.Content>
        <Text style={styles.sectionTitle}>오늘의 현황</Text>
        <View style={styles.statsGrid}>
          <StatItem 
            icon="play" 
            label="진행중" 
            value={stats.ongoingGames}
            color={theme.colors.success}
          />
          <StatItem 
            icon="clock" 
            label="예정" 
            value={stats.scheduledGames}
            color={theme.colors.warning}
          />
          <StatItem 
            icon="account-group" 
            label="대기자" 
            value={stats.waitingPlayers}
            color={theme.colors.info}
          />
          <StatItem 
            icon="check" 
            label="완료" 
            value={stats.completedGames}
            color={theme.colors.outline}
          />
        </View>
      </Card.Content>
    </Card>
  );
};

const StatItem = ({ icon, label, value, color }) => (
  <View style={styles.statItem}>
    <Icon name={icon} size={24} color={color} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);
```

### 3. 코트 상태 표시
```jsx
// src/components/game/CourtStatus.js
const CourtStatus = ({ courts }) => {
  return (
    <Card style={styles.courtCard}>
      <Card.Content>
        <Text style={styles.sectionTitle}>코트 현황</Text>
        <View style={styles.courtsGrid}>
          {courts.map(court => (
            <CourtItem key={court.id} court={court} />
          ))}
        </View>
      </Card.Content>
    </Card>
  );
};

const CourtItem = ({ court }) => {
  const getStatusConfig = () => {
    switch (court.status) {
      case 'playing':
        return { 
          color: theme.colors.success, 
          icon: 'play', 
          text: '사용중' 
        };
      case 'available':
        return { 
          color: theme.colors.outline, 
          icon: 'check', 
          text: '사용가능' 
        };
      case 'maintenance':
        return { 
          color: theme.colors.error, 
          icon: 'wrench', 
          text: '정비중' 
        };
      default:
        return { 
          color: theme.colors.outline, 
          icon: 'help', 
          text: '알 수 없음' 
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Surface style={styles.courtItem} elevation={1}>
      <View style={styles.courtHeader}>
        <Text style={styles.courtName}>{court.name}</Text>
        <Icon name={config.icon} size={16} color={config.color} />
      </View>
      <Text style={[styles.courtStatus, { color: config.color }]}>
        {config.text}
      </Text>
      {court.currentGame && (
        <Text style={styles.currentGame}>
          게임 진행중
        </Text>
      )}
    </Surface>
  );
};
```

### 4. 실시간 게임 추적
```jsx
// src/components/game/LiveGameTracker.js
const LiveGameTracker = ({ game }) => {
  const [score, setScore] = useState(game.score);
  const [gameTime, setGameTime] = useState(0);
  const { updateScore } = useGameBoard();
  const socket = useSocket();

  useEffect(() => {
    // 실시간 점수 업데이트 구독
    socket.on(`game:${game.id}:score`, (newScore) => {
      setScore(newScore);
    });

    // 게임 시간 타이머
    const startTime = game.startTime;
    const timer = setInterval(() => {
      setGameTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      socket.off(`game:${game.id}:score`);
      clearInterval(timer);
    };
  }, [game.id]);

  const handleScoreUpdate = (team, points) => {
    const newScore = {
      ...score,
      [team]: Math.max(0, score[team] + points)
    };
    
    setScore(newScore);
    updateScore(game.id, newScore);
  };

  return (
    <Card style={styles.liveGameCard}>
      <Card.Content>
        <View style={styles.gameHeader}>
          <Text style={styles.gameTitle}>{game.title}</Text>
          <Chip icon="broadcast" style={styles.liveChip}>
            LIVE
          </Chip>
        </View>

        <View style={styles.courtInfo}>
          <Text style={styles.courtName}>{game.courtName}</Text>
          <Text style={styles.gameTime}>
            {formatGameTime(gameTime)}
          </Text>
        </View>
        
        <View style={styles.scoreBoard}>
          <TeamScore
            teamName="팀 1"
            score={score.team1}
            players={game.team1Players}
            onScoreChange={(delta) => handleScoreUpdate('team1', delta)}
            canEdit={game.canEditScore}
          />
          
          <Text style={styles.vs}>VS</Text>
          
          <TeamScore
            teamName="팀 2"
            score={score.team2}
            players={game.team2Players}
            onScoreChange={(delta) => handleScoreUpdate('team2', delta)}
            canEdit={game.canEditScore}
          />
        </View>
        
        {/* 게임 세트 정보 */}
        <SetProgress sets={game.sets} currentSet={game.currentSet} />
        
        {/* 참가자 목록 */}
        <View style={styles.participants}>
          <Text style={styles.participantsTitle}>참가자</Text>
          <View style={styles.participantsList}>
            {game.participants.map(participant => (
              <Avatar.Text
                key={participant.id}
                size={32}
                label={participant.name[0]}
                style={styles.participantAvatar}
              />
            ))}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};
```

### 5. 팀 점수 컴포넌트
```jsx
// src/components/game/TeamScore.js
const TeamScore = ({ 
  teamName, 
  score, 
  players, 
  onScoreChange, 
  canEdit 
}) => {
  return (
    <View style={styles.teamContainer}>
      <Text style={styles.teamName}>{teamName}</Text>
      
      {/* 점수 표시 */}
      <Text style={styles.score}>{score}</Text>
      
      {/* 점수 조정 버튼 (편집 가능한 경우) */}
      {canEdit && (
        <View style={styles.scoreControls}>
          <IconButton
            icon="minus"
            size={20}
            onPress={() => onScoreChange(-1)}
            disabled={score === 0}
          />
          <IconButton
            icon="plus"
            size={20}
            onPress={() => onScoreChange(1)}
          />
        </View>
      )}
      
      {/* 플레이어 목록 */}
      <View style={styles.players}>
        {players.map(player => (
          <Text key={player.id} style={styles.playerName}>
            {player.name}
          </Text>
        ))}
      </View>
    </View>
  );
};
```

### 6. 세트 진행 상황
```jsx
// src/components/game/SetProgress.js
const SetProgress = ({ sets, currentSet }) => {
  if (!sets || sets.length === 0) return null;

  return (
    <View style={styles.setProgress}>
      <Text style={styles.setTitle}>세트 현황</Text>
      <View style={styles.setsContainer}>
        {sets.map((set, index) => (
          <SetItem 
            key={index}
            setNumber={index + 1}
            set={set}
            isCurrent={index === currentSet}
          />
        ))}
      </View>
    </View>
  );
};

const SetItem = ({ setNumber, set, isCurrent }) => (
  <Surface 
    style={[
      styles.setItem,
      isCurrent && styles.currentSetItem
    ]} 
    elevation={1}
  >
    <Text style={styles.setNumber}>세트 {setNumber}</Text>
    <Text style={styles.setScore}>
      {set.team1Score} : {set.team2Score}
    </Text>
    {set.winner && (
      <Text style={styles.setWinner}>
        팀 {set.winner} 승
      </Text>
    )}
  </Surface>
);
```

### 7. 게임 생성 화면
```jsx
// src/screens/detail/GameCreateScreen.js
const GameCreateScreen = ({ navigation }) => {
  const [gameData, setGameData] = useState({
    title: '',
    description: '',
    gameDate: new Date(),
    duration: 60,
    maxParticipants: 4,
    skillLevel: 'all',
    gameType: 'doubles',
    location: '',
    isPrivate: false
  });

  const { createGame } = useGameBoard();

  const handleSubmit = async () => {
    try {
      const newGame = await createGame(gameData);
      navigation.goBack();
      
      // 생성된 게임 상세로 이동
      navigation.navigate('GameDetail', { gameId: newGame.id });
    } catch (error) {
      Alert.alert('오류', '게임 생성에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* 게임 제목 */}
        <TextInput
          label="게임 제목"
          value={gameData.title}
          onChangeText={(title) => setGameData(prev => ({ ...prev, title }))}
          style={styles.input}
        />

        {/* 게임 설명 */}
        <TextInput
          label="게임 설명"
          value={gameData.description}
          onChangeText={(description) => setGameData(prev => ({ ...prev, description }))}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        {/* 게임 일시 */}
        <DateTimePicker
          label="게임 일시"
          value={gameData.gameDate}
          onChange={(gameDate) => setGameData(prev => ({ ...prev, gameDate }))}
        />

        {/* 게임 설정 */}
        <GameSettings
          settings={gameData}
          onChange={setGameData}
        />

        {/* 생성 버튼 */}
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
        >
          게임 생성
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};
```

### 8. 게임 설정 컴포넌트
```jsx
// src/components/game/GameSettings.js
const GameSettings = ({ settings, onChange }) => {
  const updateSetting = (key, value) => {
    onChange(prev => ({ ...prev, [key]: value }));
  };

  return (
    <View style={styles.settingsContainer}>
      {/* 게임 타입 */}
      <SettingSection title="게임 타입">
        <SegmentedButtons
          value={settings.gameType}
          onValueChange={(value) => updateSetting('gameType', value)}
          buttons={[
            { value: 'singles', label: '단식' },
            { value: 'doubles', label: '복식' },
            { value: 'mixed', label: '혼합복식' }
          ]}
        />
      </SettingSection>

      {/* 실력 레벨 */}
      <SettingSection title="실력 레벨">
        <SegmentedButtons
          value={settings.skillLevel}
          onValueChange={(value) => updateSetting('skillLevel', value)}
          buttons={[
            { value: 'all', label: '전체' },
            { value: 'beginner', label: '초급' },
            { value: 'intermediate', label: '중급' },
            { value: 'advanced', label: '고급' }
          ]}
        />
      </SettingSection>

      {/* 최대 참가자 수 */}
      <SettingSection title="최대 참가자">
        <Slider
          value={settings.maxParticipants}
          onValueChange={(value) => updateSetting('maxParticipants', value)}
          minimumValue={2}
          maximumValue={20}
          step={2}
        />
        <Text style={styles.sliderValue}>
          {settings.maxParticipants}명
        </Text>
      </SettingSection>

      {/* 게임 시간 */}
      <SettingSection title="예상 소요시간">
        <Slider
          value={settings.duration}
          onValueChange={(value) => updateSetting('duration', value)}
          minimumValue={30}
          maximumValue={180}
          step={15}
        />
        <Text style={styles.sliderValue}>
          {settings.duration}분
        </Text>
      </SettingSection>

      {/* 비공개 게임 */}
      <SettingSection title="게임 공개 설정">
        <Switch
          value={settings.isPrivate}
          onValueChange={(value) => updateSetting('isPrivate', value)}
        />
        <Text style={styles.switchLabel}>
          {settings.isPrivate ? '비공개 게임' : '공개 게임'}
        </Text>
      </SettingSection>
    </View>
  );
};

const SettingSection = ({ title, children }) => (
  <View style={styles.settingSection}>
    <Text style={styles.settingTitle}>{title}</Text>
    <View style={styles.settingContent}>
      {children}
    </View>
  </View>
);
```

## 📊 게임 통계 및 분석

### 게임 통계 서비스
```javascript
// src/services/gameStatsService.js
class GameStatsService {
  // 개인 통계 계산
  calculatePlayerStats(playerId, games) {
    const playerGames = games.filter(game => 
      game.participants.some(p => p.id === playerId)
    );

    const wins = playerGames.filter(game => 
      this.isPlayerWinner(playerId, game)
    ).length;

    const totalGames = playerGames.length;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    return {
      totalGames,
      wins,
      losses: totalGames - wins,
      winRate,
      averageScore: this.calculateAverageScore(playerId, playerGames),
      favoritePartner: this.findFavoritePartner(playerId, playerGames),
      recentForm: this.calculateRecentForm(playerId, playerGames)
    };
  }

  // 승자 판정
  isPlayerWinner(playerId, game) {
    if (!game.result || !game.result.winner) return false;
    
    const winningTeam = game.result.winner === 'team1' ? 
      game.team1Players : game.team2Players;
    
    return winningTeam.some(player => player.id === playerId);
  }

  // 평균 점수 계산
  calculateAverageScore(playerId, games) {
    const completedGames = games.filter(game => game.status === 'completed');
    if (completedGames.length === 0) return 0;

    const totalScore = completedGames.reduce((sum, game) => {
      const playerTeam = this.getPlayerTeam(playerId, game);
      return sum + (game.result?.[playerTeam]?.score || 0);
    }, 0);

    return Math.round(totalScore / completedGames.length);
  }

  // 최근 폼 계산 (최근 10경기)
  calculateRecentForm(playerId, games) {
    const recentGames = games
      .filter(game => game.status === 'completed')
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 10);

    return recentGames.map(game => 
      this.isPlayerWinner(playerId, game) ? 'W' : 'L'
    );
  }

  // 선호 파트너 찾기
  findFavoritePartner(playerId, games) {
    const partnerCounts = {};
    
    games.forEach(game => {
      const playerTeam = this.getPlayerTeam(playerId, game);
      const teammates = game[`${playerTeam}Players`]
        .filter(player => player.id !== playerId);
      
      teammates.forEach(teammate => {
        partnerCounts[teammate.id] = (partnerCounts[teammate.id] || 0) + 1;
      });
    });

    const favoritePartnerId = Object.keys(partnerCounts)
      .reduce((a, b) => partnerCounts[a] > partnerCounts[b] ? a : b, null);

    return favoritePartnerId;
  }

  // 플레이어가 속한 팀 찾기
  getPlayerTeam(playerId, game) {
    if (game.team1Players.some(p => p.id === playerId)) {
      return 'team1';
    } else if (game.team2Players.some(p => p.id === playerId)) {
      return 'team2';
    }
    return null;
  }
}

export default new GameStatsService();
```

## 🔔 알림 및 푸시

### 게임 알림 서비스
```javascript
// src/services/gameNotificationService.js
class GameNotificationService {
  // 게임 시작 알림
  notifyGameStart(game) {
    game.participants.forEach(participant => {
      this.sendNotification(participant.id, {
        title: '게임 시작!',
        body: `${game.title} 게임이 시작되었습니다.`,
        data: { gameId: game.id, type: 'game_start' }
      });
    });
  }

  // 게임 생성 알림
  notifyGameCreated(game) {
    this.sendBroadcastNotification({
      title: '새 게임 생성',
      body: `${game.title} 게임이 생성되었습니다. 참가하세요!`,
      data: { gameId: game.id, type: 'game_created' }
    });
  }

  // 게임 완료 알림
  notifyGameCompleted(game) {
    game.participants.forEach(participant => {
      const isWinner = gameStatsService.isPlayerWinner(participant.id, game);
      
      this.sendNotification(participant.id, {
        title: isWinner ? '게임 승리!' : '게임 완료',
        body: `${game.title} 게임이 완료되었습니다.`,
        data: { gameId: game.id, type: 'game_completed' }
      });
    });
  }

  // 개별 알림 전송
  async sendNotification(userId, notification) {
    try {
      await notificationAPI.send(userId, notification);
    } catch (error) {
      console.error('알림 전송 실패:', error);
    }
  }

  // 전체 알림 전송
  async sendBroadcastNotification(notification) {
    try {
      await notificationAPI.broadcast(notification);
    } catch (error) {
      console.error('전체 알림 전송 실패:', error);
    }
  }
}

export default new GameNotificationService();
```

이 설계를 통해 완전한 베드민턴 게임 관리 시스템을 구현할 수 있으며, 실시간 점수 추적, 통계 관리, 그리고 멤버들의 참여를 효과적으로 관리할 수 있습니다.