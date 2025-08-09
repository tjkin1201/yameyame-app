# 시스템 아키텍처 설계

## 📋 현재 프로젝트 상태 분석

### 기술 스택
- **Frontend**: React Native + Expo (51.0.28)
- **UI Library**: React Native Paper
- **네비게이션**: React Navigation 6
- **상태관리**: Context API (Auth, Socket)
- **API 연동**: Axios, Band API 연동

### 현재 구조의 문제점
1. **복잡한 네비게이션 구조**: 여러 Navigator 파일들이 혼재
2. **기능 분산**: Premium, Simple, Club 관련 기능들이 분산됨
3. **명확하지 않은 앱 목적**: 동호회 관리와 게임 매칭이 혼합
4. **Naver Band 연동 미완성**: Band API 설정은 있으나 실제 연동 불완전

## 🏗️ 새로운 시스템 아키텍처

### 1. 메인 구조 (4개 페이지)

```
📱 동배즐 앱
├── 🏠 홈 (Home)
│   ├── 로고 (상단 고정)
│   ├── 모임명 & 소개
│   ├── 공지사항 (최신 3개)
│   ├── 운영진 게임 현황 (진행중/예정)
│   └── 전체 멤버 목록 (최대 200명)
├── 📋 게시판 (Board)
│   ├── 고정 공지 (상단)
│   ├── 일반 공지글
│   └── 댓글 시스템
├── 📸 사진첩 (Photos)
│   └── Naver Band 연동 갤러리
└── 💬 채팅 (Chat)
    ├── 전체 채팅방
    ├── 1:1 개인 채팅
    └── 귓속말 기능
```

### 2. 게임 현황판 (추가 기능)
```
🏸 베드민턴 게임 현황판
├── 진행중인 게임
├── 예정된 게임
├── 참가자 관리
└── 결과 기록
```

## 📁 권장 파일 구조

```
src/
├── screens/
│   ├── main/
│   │   ├── ClubHomeScreen.js      // 홈
│   │   ├── BoardScreen.js         // 게시판  
│   │   ├── PhotosScreen.js        // 사진첩
│   │   └── ChatScreen.js          // 채팅
│   └── detail/
│       ├── PostDetailScreen.js
│       ├── GameBoardScreen.js     // 게임현황판
│       └── PhotoViewerScreen.js
├── components/
│   ├── club/                      // 클럽 관련
│   ├── board/                     // 게시판 관련
│   ├── chat/                      // 채팅 관련
│   └── game/                      // 게임 관련
├── services/
│   ├── bandPhotoAPI.js           // Band 연동
│   ├── chatSocket.js             // 실시간 채팅
│   └── gameAPI.js                // 게임 관리
└── context/
    ├── ClubContext.js
    ├── ChatContext.js
    └── GameBoardContext.js
```

## 🔄 데이터 플로우

### 1. 인증 플로우
```
사용자 → Band 로그인 → 멤버십 검증 → 데이터 동기화 → 앱 진입
```

### 2. 실시간 데이터 동기화
```
Band API ←→ 로컬 캐시 ←→ 앱 화면
    ↓           ↓          ↓
Socket.io ←→ 실시간 업데이트 → 알림
```

### 3. 권한 관리
```
Band 역할 → 앱 권한 → 기능 접근 제어
(admin)   (write)   (게임생성, 공지작성)
(member)  (read)    (참가, 댓글작성)
```

## 🎯 핵심 개선점

1. **단순하고 명확한 구조**: 4개 페이지로 기능 집중
2. **실용적인 외부 연동**: Naver Band로 사진 관리 효율화
3. **실시간 기능**: Socket.io 기반 채팅과 게임 현황 추적
4. **확장 가능한 설계**: 멤버 200명까지 지원하는 스케일러블 구조
5. **사용자 중심**: 동호회 운영에 실제 필요한 기능들만 선별

## 🚀 구현 로드맵

### Phase 1: 기반 구조 (1-2주)
- Band 로그인 시스템 구현
- 기본 네비게이션 구조 정리
- 멤버 동기화 시스템

### Phase 2: 핵심 기능 (2-3주)
- 홈 페이지 통합 대시보드
- 게시판 시스템 구현
- 기본 채팅 기능

### Phase 3: 고급 기능 (2-3주)
- 게임 현황판 구현
- 실시간 기능 강화
- 사진첩 Band 연동

### Phase 4: 최적화 및 배포 (1-2주)
- 성능 최적화
- 테스트 완료
- 앱 스토어 배포 준비

## 📊 성능 목표

- **로딩 시간**: 초기 로딩 < 3초
- **동기화**: Band 데이터 동기화 < 10초
- **실시간 응답**: 채팅 메시지 지연 < 500ms
- **메모리 사용량**: 평균 < 150MB
- **배터리 효율**: 백그라운드 최적화

## 🔧 개발 환경 설정

### 필요한 도구
- Node.js 16+
- Expo CLI
- Android Studio (Android 테스트용)
- VS Code + React Native 확장

### 환경 변수
```bash
BAND_CLIENT_ID=your_band_client_id
BAND_CLIENT_SECRET=your_band_client_secret
BAND_TARGET_KEY=61541241
SOCKET_SERVER_URL=ws://your-server.com
```

이제 명확한 목표와 구조를 가지고 단계별로 구현을 진행할 수 있습니다!