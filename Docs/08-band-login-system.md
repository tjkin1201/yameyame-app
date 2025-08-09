# Naver Band 연동 로그인 시스템

## 🔐 개요

동배즐 앱은 Naver Band "동탄 배드민턴을 즐기는 사람들" 그룹과 완전 연동되어, Band 멤버만 접근할 수 있는 폐쇄형 동호회 앱입니다.

**Band 그룹**: https://www.band.us/band/61541241

## 🚪 Band OAuth 인증 플로우

```
🔑 Naver Band 로그인 플로우
├── 📱 앱 시작
│   ├── 저장된 토큰 확인
│   ├── 토큰 유효성 검사
│   └── Band 멤버십 재확인
├── 🔑 Band OAuth 로그인
│   ├── Band 로그인 페이지
│   ├── 권한 승인 요청
│   └── Authorization Code 수신
├── ✅ 멤버십 검증
│   ├── "동탄 배드민턴을 즐기는 사람들" 가입 확인
│   ├── Band 내 역할 확인
│   └── 앱 사용 권한 부여
├── 🔄 데이터 동기화
│   ├── 프로필 정보 동기화
│   ├── 멤버 목록 동기화
│   └── 초기 데이터 로드
└── 🏠 메인 화면 진입
    └── 개인화된 홈 대시보드 표시
```

## ⚙️ Band OAuth 설정

```javascript
// src/config/bandConfig.js
export const BAND_CONFIG = {
  // Band 개발자 센터에서 발급받은 정보
  CLIENT_ID: 'your_band_client_id',
  CLIENT_SECRET: 'your_band_client_secret',
  REDIRECT_URI: 'dongbaejul://auth/callback',
  
  // 특정 Band 정보
  TARGET_BAND_KEY: '61541241', // "동탄 배드민턴을 즐기는 사람들"
  
  // OAuth 엔드포인트
  OAUTH_URL: 'https://auth.band.us/oauth2/authorize',
  TOKEN_URL: 'https://auth.band.us/oauth2/token',
  API_BASE_URL: 'https://openapi.band.us/v2.1',
  
  // 요청할 권한 범위
  SCOPE: 'band.read band.write profile'
};
```

## 🔧 OAuth 인증 서비스

### 1. 기본 인증 플로우
```javascript
// src/services/bandAuthService.js
class BandAuthService {
  // OAuth 로그인 시작
  async startOAuthFlow() {
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'dongbaejul'
    });

    const authUrl = `${BAND_CONFIG.OAUTH_URL}?` +
      `client_id=${BAND_CONFIG.CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(BAND_CONFIG.SCOPE)}&` +
      `response_type=code`;

    const result = await AuthSession.startAsync({
      authUrl,
      returnUrl: redirectUri
    });

    if (result.type === 'success') {
      const { code } = result.params;
      return await this.exchangeCodeForToken(code, redirectUri);
    }

    throw new Error('OAuth 인증이 취소되었습니다.');
  }

  // Authorization Code를 Access Token으로 교환
  async exchangeCodeForToken(code, redirectUri) {
    const response = await fetch(BAND_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: BAND_CONFIG.CLIENT_ID,
        client_secret: BAND_CONFIG.CLIENT_SECRET,
        redirect_uri: redirectUri,
        code: code
      })
    });

    const tokenData = await response.json();
    
    if (tokenData.access_token) {
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      
      await this.saveTokens(tokenData);
      return await this.validateBandMembership();
    }

    throw new Error('토큰 교환 실패');
  }
}
```

### 2. Band 멤버십 검증
```javascript
// Band 멤버십 검증
async validateBandMembership() {
  // 1. 사용자 프로필 가져오기
  const userProfile = await this.getUserProfile();
  
  // 2. 사용자의 Band 목록 확인
  const userBands = await this.getUserBands();
  
  // 3. 특정 Band 가입 여부 확인
  const targetBand = userBands.find(
    band => band.band_key === BAND_CONFIG.TARGET_BAND_KEY
  );

  if (!targetBand) {
    throw new Error('동탄 배드민턴 Band에 가입되어 있지 않습니다.');
  }

  // 4. Band 내 역할 확인
  const memberInfo = await this.getBandMemberInfo(
    BAND_CONFIG.TARGET_BAND_KEY
  );

  this.userInfo = {
    ...userProfile,
    bandInfo: {
      bandKey: BAND_CONFIG.TARGET_BAND_KEY,
      role: memberInfo.role,
      joinedAt: memberInfo.joined_at,
      isAdmin: memberInfo.role === 'admin'
    }
  };

  return this.userInfo;
}
```

## 👥 멤버 동기화 시스템

### 1. 실시간 멤버 동기화
```javascript
// src/services/bandMemberSyncService.js
class BandMemberSyncService {
  // 전체 멤버 동기화
  async syncAllMembers() {
    // 1. Band 멤버 목록 가져오기
    const bandMembers = await this.getBandMembers();
    
    // 2. 로컬 DB와 비교하여 업데이트
    const syncResults = await this.updateLocalMembers(bandMembers);
    
    // 3. 동기화 로그 저장
    await this.saveSyncLog(syncResults);
    
    return {
      success: true,
      syncedCount: syncResults.updated + syncResults.added,
      results: syncResults
    };
  }

  // Band에서 멤버 목록 가져오기
  async getBandMembers() {
    const response = await this.bandAuthService.apiRequest(
      `/bands/${BAND_CONFIG.TARGET_BAND_KEY}/members`
    );
    
    return response.result_data.members.map(member => ({
      bandUserId: member.user_key,
      name: member.name,
      profileImage: member.profile_image_url,
      role: member.role, // 'admin', 'co_admin', 'member'
      joinedAt: new Date(member.joined_at),
      isActive: member.is_app_member,
      description: member.description,
      cover_image: member.cover_image_url
    }));
  }
}
```

### 2. 자동 동기화 스케줄러
```javascript
// 자동 동기화 스케줄러
startAutoSync() {
  // 멤버 동기화 (30분마다)
  setInterval(async () => {
    try {
      await bandMemberSyncService.syncAllMembers();
      console.log('자동 멤버 동기화 완료');
    } catch (error) {
      console.error('자동 멤버 동기화 실패:', error);
    }
  }, 30 * 60 * 1000);
}
```

## 🔄 데이터 연동 구조

### 1. Band 데이터 동기화 아키텍처
```
🔄 Band 연동 데이터 플로우
├── 📊 실시간 동기화
│   ├── 멤버 정보 (30분마다)
│   ├── 게시글 (1시간마다)
│   └── 사진/앨범 (6시간마다)
├── 📱 사용자 요청 동기화
│   ├── 수동 새로고침
│   ├── 앱 포그라운드 진입
│   └── 네트워크 재연결
├── 🗂️ 로컬 캐시 관리
│   ├── 메타데이터 저장
│   ├── 이미지 캐싱
│   └── 오프라인 지원
└── 🔔 변경사항 알림
    ├── 새 멤버 가입
    ├── 새 게시글
    └── 중요 공지
```

### 2. 게시글 동기화
```javascript
// Band 게시글 동기화
async syncBandPosts() {
  const lastSync = await this.getLastSyncTime('posts');
  const posts = await this.getBandPosts(lastSync);
  
  for (const post of posts) {
    const localPost = await this.findLocalPost(post.post_key);
    
    if (localPost) {
      // 기존 게시글 업데이트
      if (this.hasPostChanges(localPost, post)) {
        await this.updateLocalPost(localPost._id, post);
      }
    } else {
      // 새 게시글 추가
      await this.addNewPost(post);
      
      // 새 게시글 알림 (중요 공지인 경우)
      if (post.type === 'notice') {
        await this.sendNewPostNotification(post);
      }
    }
  }
}
```

### 3. 사진/앨범 동기화
```javascript
// Band 사진/앨범 동기화
async syncBandPhotos() {
  const albums = await this.getBandAlbums();
  
  for (const album of albums) {
    const localAlbum = await this.findLocalAlbum(album.album_key);
    
    if (localAlbum) {
      // 기존 앨범 업데이트
      if (album.photo_count !== localAlbum.photoCount) {
        await this.updateAlbumPhotos(album);
      }
    } else {
      // 새 앨범 추가
      await this.addNewAlbum(album);
    }
  }
}
```

## 🛡️ 권한 관리 시스템

### 1. 권한 기반 Auth Context
```javascript
// src/context/BandAuthContext.js
export const BandAuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    bandMembership: null,
    permissions: []
  });

  // 권한 계산
  const calculatePermissions = (bandInfo) => {
    const permissions = ['read_posts', 'read_members', 'read_photos'];
    
    if (bandInfo.isAdmin) {
      permissions.push(
        'write_posts',
        'delete_posts',
        'pin_posts',
        'manage_games',
        'manage_members',
        'send_notifications'
      );
    } else {
      permissions.push(
        'comment_posts',
        'join_games',
        'chat_members'
      );
    }
    
    return permissions;
  };

  // 권한 확인 헬퍼
  const hasPermission = (permission) => {
    return authState.permissions.includes(permission);
  };

  const isAdmin = () => {
    return authState.bandMembership?.isAdmin || false;
  };

  return (
    <BandAuthContext.Provider value={{
      authState,
      hasPermission,
      isAdmin,
      loginWithBand,
      logout
    }}>
      {children}
    </BandAuthContext.Provider>
  );
};
```

### 2. 권한 기반 컴포넌트 가드
```javascript
// src/components/auth/PermissionGuard.js
const PermissionGuard = ({ 
  permission, 
  fallback = null, 
  adminOnly = false,
  children 
}) => {
  const { hasPermission, isAdmin } = useBandAuth();

  // 관리자 전용 체크
  if (adminOnly && !isAdmin()) {
    return fallback;
  }

  // 특정 권한 체크
  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  return children;
};

// 사용 예시
const GameCreateButton = () => (
  <PermissionGuard 
    permission="manage_games"
    fallback={<Text>게임 생성 권한이 없습니다</Text>}
  >
    <Button onPress={createGame}>게임 만들기</Button>
  </PermissionGuard>
);
```

## 👤 하이브리드 프로필 관리

### 1. 통합 프로필 데이터 모델
```javascript
export const UserProfileSchema = {
  // Band에서 동기화되는 데이터 (읽기 전용)
  bandData: {
    bandUserId: String,
    name: String,
    profileImage: String,
    description: String,
    role: String,
    joinedAt: Date,
    syncedAt: Date
  },
  
  // 앱에서 관리하는 데이터 (편집 가능)
  appData: {
    displayName: String,
    customAvatar: String,
    
    // 배드민턴 관련 정보
    badminton: {
      skillLevel: String,
      preferredPosition: String,
      playStyle: String,
      experience: Number,
      bio: String
    },
    
    // 게임 통계
    gameStats: {
      totalGames: Number,
      wins: Number,
      losses: Number,
      winRate: Number,
      mvpCount: Number
    },
    
    // 개인 설정
    preferences: {
      notifications: { /* ... */ },
      privacy: { /* ... */ },
      gamePreferences: { /* ... */ }
    }
  }
};
```

### 2. 프로필 동기화 서비스
```javascript
// src/services/profileSyncService.js
class ProfileSyncService {
  // 사용자 프로필 초기 동기화
  async initializeUserProfile(bandUserId) {
    // 1. Band에서 사용자 정보 가져오기
    const bandProfile = await this.getBandUserProfile(bandUserId);
    
    // 2. 로컬 프로필 확인
    const localProfile = await this.getLocalProfile(bandUserId);
    
    if (localProfile) {
      // 기존 프로필 업데이트
      return await this.syncExistingProfile(localProfile, bandProfile);
    } else {
      // 새 프로필 생성
      return await this.createNewProfile(bandProfile);
    }
  }

  // 게임 통계 업데이트
  async updateGameStats(bandUserId, gameResult) {
    const profile = await this.getLocalProfile(bandUserId);
    if (!profile) return;

    const stats = profile.appData.gameStats;
    
    // 통계 업데이트
    stats.totalGames += 1;
    if (gameResult.result === 'win') {
      stats.wins += 1;
    } else {
      stats.losses += 1;
    }
    
    stats.winRate = Math.round((stats.wins / stats.totalGames) * 100);
    
    if (gameResult.isMVP) {
      stats.mvpCount += 1;
    }

    await this.updateAppData(bandUserId, { gameStats: stats });
  }
}
```

## 📱 로그인 화면 구현

```javascript
// src/screens/auth/BandLoginScreen.js
const BandLoginScreen = () => {
  const { loginWithBand, authState, loginError } = useBandAuth();

  const handleBandLogin = async () => {
    try {
      await loginWithBand();
    } catch (error) {
      Alert.alert('로그인 실패', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 앱 로고 */}
        <Image source={require('../../assets/logo.png')} />
        
        {/* 앱 제목 */}
        <Text style={styles.title}>동배즐</Text>
        <Text style={styles.subtitle}>
          동탄 배드민턴을 즐기는 사람들
        </Text>
        
        {/* 설명 */}
        <Text style={styles.description}>
          Naver Band 계정으로 로그인하여{'\n'}
          동호회 활동에 참여하세요
        </Text>
        
        {/* 로그인 에러 표시 */}
        {loginError && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{loginError}</Text>
          </Card>
        )}
        
        {/* Band 로그인 버튼 */}
        <Button
          mode="contained"
          onPress={handleBandLogin}
          loading={authState.isLoading}
          icon="account-group"
        >
          Band로 로그인
        </Button>
        
        {/* 주의사항 */}
        <Text style={styles.notice}>
          ⚠️ "동탄 배드민턴을 즐기는 사람들" Band에{'\n'}
          가입된 계정만 로그인할 수 있습니다
        </Text>
        
        {/* Band 가입 안내 */}
        <Button
          mode="text"
          onPress={() => Linking.openURL('https://www.band.us/band/61541241')}
        >
          Band 가입하기
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};
```

## 🚀 구현 준비사항

### 1. Band API 키 발급
1. https://developers.band.us/ 에서 개발자 등록
2. 애플리케이션 생성 및 Client ID/Secret 발급
3. Redirect URI 설정: `dongbaejul://auth/callback`
4. 권한 범위: `band.read`, `band.write`, `profile`

### 2. 필요한 패키지 설치
```bash
npm install expo-auth-session expo-secure-store
npm install @react-native-async-storage/async-storage
```

### 3. 환경 변수 설정
```javascript
// src/config/bandConfig.js
export const BAND_CONFIG = {
  CLIENT_ID: process.env.BAND_CLIENT_ID,
  CLIENT_SECRET: process.env.BAND_CLIENT_SECRET,
  TARGET_BAND_KEY: '61541241'
};
```

## 🔗 핵심 플로우 요약

```
사용자 → Band 로그인 → 멤버십 검증 → 데이터 동기화 → 앱 사용
  ↓
Band 프로필 변경 감지 → 자동 동기화 → 앱 프로필 업데이트
  ↓
게임 참여 → 통계 업데이트 → Band 활동 연동
```

이 시스템을 통해 "동탄 배드민턴을 즐기는 사람들" Band와 완전히 연동된 폐쇄형 동호회 앱을 구현할 수 있으며, Band 멤버만 접근 가능하고 실시간으로 데이터가 동기화되는 완전한 시스템을 제공합니다.