# 🏗️ YameYame 아키텍처 (재설계 v2)

> 2026-06-09 재설계. 기존 구조의 문제점 분석과 새 설계의 결정 근거를 기록한다.

## 1. 기존 설계 분석 (v1의 문제점)

### 1.1 과잉 설계 (Over-engineering)
v1은 8개 git worktree + 6개 독립 서비스로 구성되어 있었다:

| 서비스 | 포트 | 문제 |
|--------|------|------|
| database-layer | 5000 | DB 접근을 별도 HTTP 서비스로 분리 — 불필요한 네트워크 홉 |
| backend-api | 3001 | 본체 |
| realtime-socket | 3002 | Socket.io를 별도 프로세스로 — 세션 공유 복잡도만 증가 |
| band-integration | 3003 | 외부 API 클라이언트를 서비스로 승격 — 모듈이면 충분 |
| frontend-ui | 8081 | 정상 |
| monitoring | 9999 | 운영 전 단계에서 자체 모니터링 서버 구축 |

**판단**: 단일 동호회(수십~수백 명) 규모에서 마이크로서비스는 운영 부담만 가중한다.
서비스 간 헬스체크/시작 순서 조율을 위해 autorun.js(17KB), dev-workflow-enhanced.ps1(48KB) 같은
오케스트레이션 코드가 애플리케이션 코드보다 커지는 본말전도가 발생했다.

### 1.2 Git 구조 결함
- worktree 디렉토리가 gitlink(mode 160000)로 기록되었으나 `.gitmodules`가 없어
  **worktree 내부 코드 전체가 버전 관리에서 누락**되었다.
- 결과: 문서상 "94/100 production-ready"였으나 실제 저장소의 worktree는 비어 있었다.

### 1.3 플랫폼 종속
- 핵심 스크립트(stop/status/health/clean)가 모두 PowerShell — Linux/macOS/CI에서 동작 불가.

### 1.4 문서 과잉
- 루트에 20+ 개의 .md/.ps1 파일. 문서끼리 진행률이 상충 (25% vs 94/100).

## 2. 새 설계 원칙

1. **단일 백엔드 프로세스**: Express + Socket.io + Mongoose를 한 프로세스에서 실행.
   내부는 모듈(서비스 계층)로 분리해 추후 규모가 커지면 분리할 수 있게 한다.
2. **표준 npm workspaces 모노레포**: `server/` + `mobile/` 2개 패키지. gitlink 문제 원천 차단.
3. **크로스 플랫폼**: npm scripts만 사용. OS 종속 스크립트 금지.
4. **문서 3개 원칙**: README(시작 가이드) + ARCHITECTURE(이 문서) + ROADMAP(계획). 상태 주장은 코드로 증명.
5. **검증된 차별점 유지**: 체육관 특화 UI, 오프라인 우선, ELO 레이팅, 배터리 효율 Socket.

## 3. 시스템 구조

```
┌─────────────────────────────┐
│  mobile/  (Expo React Native)│
│  - 체육관 특화 테마          │
│  - 오프라인 우선 (SQLite)    │
└──────────┬──────────────────┘
           │ REST + WebSocket
┌──────────▼──────────────────┐
│  server/  (단일 Node 프로세스)│
│  ├─ routes/controllers (REST)│
│  ├─ services/                │
│  │   ├─ elo (레이팅 엔진)    │
│  │   ├─ matching (대진표)    │
│  │   ├─ socket (실시간)      │
│  │   └─ band (외부연동, 예정) │
│  ├─ models/ (Mongoose)       │
│  └─ utils/ (db 연결 등)      │
└──────────┬──────────────────┘
           │
     ┌─────▼─────┐
     │  MongoDB  │  (없으면 메모리 모드로 기동 — 개발 편의)
     └───────────┘
```

### 3.1 디렉토리 구조

```
yameyame/
├── package.json          # npm workspaces 루트
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
├── server/
│   └── src/
│       ├── index.ts      # 부트스트랩 (HTTP + Socket.io)
│       ├── routes/       # URL → 컨트롤러 매핑
│       ├── controllers/  # 요청 검증/응답 포맷
│       ├── services/     # 도메인 로직 (elo, matching, socket)
│       ├── models/       # Mongoose 스키마 (Member, Game, Club)
│       └── utils/        # database 연결 등
└── mobile/
    └── src/
        ├── theme/        # 체육관 특화 디자인 토큰
        ├── navigation/
        ├── screens/
        └── services/     # API/Socket 클라이언트 (예정)
```

## 4. 핵심 설계 결정

### 4.1 ELO 레이팅 (검증 완료)
- 표준 ELO, K=32 (신규 20게임 미만은 K=40으로 빠른 수렴)
- 복식은 팀 평균 ELO 기준으로 기대 승률 계산 후 개인별 반영
- 등급: 브론즈(<1200) → 실버 → 골드 → 플래티넘 → 다이아 → 마스터(2000+)
- 초기값 1200

### 4.2 스마트 대진표
- ELO 기반 균형 매칭: 정렬 후 snake-draft로 팀 구성, 팀 간 평균 ELO 차 최소화
- 제약: 최근 대전 회피, 선호 파트너 반영 (옵션)

### 4.3 실시간 (Socket.io)
- 배터리 최적화: pingInterval 60s (기본 25s 대비 연장)
- 룸 설계: `club:{id}` (동호회 전체), `game:{id}` (경기별), `user:{id}` (개인 알림)

### 4.4 오프라인 우선 (mobile, 예정)
- expo-sqlite 로컬 저장 + 동기화 큐
- 충돌 해결: Last-Write-Wins (단순 시작, 필요 시 버전 벡터)

### 4.5 Band 연동 (예정)
- 별도 서비스가 아닌 `server/src/services/band/` 모듈
- OAuth 2.0 로그인 + 회원 동기화

## 5. 마이그레이션 노트

v1에서 검증된 코드를 이식했다:
- `elo.service.ts` — v1에서 단식/복식 계산 동작 확인 (curl 테스트 통과)
- `Member/Game/Club` 스키마 — 인덱스 전략 포함
- `socket.service.ts` — 인증/게임/채팅 이벤트 핸들러
- `gymTheme.ts` — 고대비(7:1) 색상, 44pt 터치 영역, 18sp 폰트

폐기한 것: autorun.js, 모든 .ps1 스크립트, monitoring 서버, worktree 구조.
