# 🏸 YameYame

> **동배즐** — 동탄 배드민턴 동호회 통합 관리 시스템
> 체육관 현장에서 쓰기 위해 설계된 React Native + Node.js 앱

## 핵심 특징

- **🏟️ 체육관 특화 UI** — 고대비 색상(7:1), 큰 터치 영역(44pt+), 큰 폰트(18sp+)
- **📊 ELO 레이팅** — 단식/복식 자동 레이팅, 승률 예측, 6단계 등급
- **🎯 스마트 대진표** — 실력 균형 자동 매칭
- **⚡ 실시간** — Socket.io 기반 스코어/채팅, 배터리 효율 최적화
- **🔄 오프라인 우선** — 네트워크 없이도 동작 (개발 중)

## 구조

```
yameyame/
├── server/   # Express + TypeScript + Socket.io + MongoDB
├── mobile/   # React Native (Expo)
└── docs/     # ARCHITECTURE.md, ROADMAP.md
```

## 빠른 시작

```bash
# 의존성 설치 (루트에서, workspaces 일괄)
npm install

# 백엔드 개발 서버 (포트 3001)
npm run dev

# 모바일 (Expo)
npm run dev:mobile
```

MongoDB가 없어도 서버는 기동된다 (`MONGODB_URI` 미설정 시 DB 없이 시작).

## API 미리보기

```bash
# 헬스 체크
curl http://localhost:3001/api/health

# ELO 계산 (단식)
curl -X POST http://localhost:3001/api/elo/singles \
  -H "Content-Type: application/json" \
  -d '{"player1Elo":1500,"player2Elo":1400,"winner":1}'

# 균형 대진표 생성 (복식)
curl -X POST http://localhost:3001/api/matching/generate \
  -H "Content-Type: application/json" \
  -d '{"players":[{"id":"a","name":"A","elo":1500},{"id":"b","name":"B","elo":1450},{"id":"c","name":"C","elo":1400},{"id":"d","name":"D","elo":1350}]}'
```

## 문서

- [아키텍처 및 재설계 근거](./docs/ARCHITECTURE.md)
- [기능 로드맵](./docs/ROADMAP.md)

## 라이센스

MIT
