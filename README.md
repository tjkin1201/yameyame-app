# 🏸 YameYame - 배드민턴 클럽 관리 시스템

> **동배즐** - 동탄 배드민턴 동호회 통합 관리 시스템  
> React Native + Node.js 기반 크로스플랫폼 모바일 앱

[![Development Status](https://img.shields.io/badge/Development-25--30%25-yellow)](https://github.com/tjkin1201/yameyame-app)
[![Expert Review](https://img.shields.io/badge/Expert%20Review-80/100-brightgreen)](./PROJECT_ANALYSIS.md)
[![React Native](https://img.shields.io/badge/React%20Native-0.79.5-blue)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v24.4.1-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)

## 🚀 프로젝트 개요

YameYame는 체육관 현장에서 사용하기 위해 특별히 설계된 배드민턴 동호회 통합 관리 시스템입니다.

### 🎯 핵심 특징
- **🏃‍♂️ 체육관 특화 UI**: 큰 터치 영역, 고대비 색상, 조명 환경 최적화
- **📱 크로스플랫폼**: React Native로 iOS/Android 동시 지원
- **🔄 오프라인 우선**: SQLite + 자동 동기화로 네트워크 없이도 동작
- **⚡ 실시간 통신**: Socket.io로 게임 현황 실시간 업데이트
- **🔋 배터리 최적화**: 장시간 현장 사용을 위한 전력 효율성
- **🎨 Band 연동**: 기존 동호회 Band와 완벽 통합

## 📁 프로젝트 구조

```
yameyame/
├── 🏗️ worktrees/                    # 병렬 개발 워크트리 (8개 모듈)
│   ├── backend-api/                 # Express + TypeScript API 서버
│   ├── frontend-ui/                 # React Native + Expo 앱
│   ├── band-integration/            # Band OAuth & API 연동
│   ├── database-layer/              # MongoDB + SQLite 스키마
│   ├── realtime-socket/             # Socket.io 실시간 통신
│   ├── testing-suite/               # Jest + Detox E2E 테스트
│   ├── infrastructure/              # Docker + AWS 배포
│   └── ui-design/                   # 체육관 특화 디자인 시스템
├── 📋 docs/                         # 개발 문서
│   ├── DEVELOPMENT_KICKOFF_PLAN.md  # Week 1-2 개발 계획
│   ├── IMMEDIATE_ACTION_ITEMS.md    # 즉시 실행 체크리스트
│   ├── DEVELOPMENT_PROCESS.md       # 품질 관리 & 협업 가이드
│   └── PROJECT_ANALYSIS.md          # 전문가 검토 결과 (80/100)
└── 🤖 scripts/                      # 자동화 스크립트
```

## 🛠️ 기술 스택

### Frontend (Mobile)
- **React Native** 0.79.5 + **Expo** 51.0.28
- **TypeScript** 5.8.3
- **React Navigation** 7.x (네비게이션)
- **React Native Paper** 5.x (Material Design)
- **AsyncStorage** (로컬 저장소)
- **SQLite** (오프라인 데이터베이스)
- **Socket.io Client** (실시간 통신)

### Backend (API Server)
- **Node.js** v24.4.1 + **npm** v11.4.2
- **Express** + **TypeScript**
- **MongoDB** (메인 데이터베이스)
- **Redis** (캐싱 & 세션)
- **Socket.io** (실시간 통신)
- **JWT** (인증)
- **Winston** (로깅)

### Development & DevOps
- **Git Worktrees** (병렬 개발)
- **Jest** + **Detox** (E2E 테스트)
- **ESLint** + **Prettier** (코드 품질)
- **GitHub Actions** (CI/CD)
- **Docker** (컨테이너화)
- **AWS** (클라우드 배포)

## 🚀 빠른 시작

### 1. 환경 요구사항
```bash
# Node.js & npm
node --version  # v24.4.1+
npm --version   # v11.4.2+

# React Native 환경
# - Android Studio (Android 개발)
# - Xcode (iOS 개발, macOS만)
```

### 2. 프로젝트 설정
```bash
# 저장소 클론
git clone https://github.com/tjkin1201/yameyame-app.git
cd yameyame-app

# 모든 워크트리 의존성 설치
npm run setup

# 환경 변수 설정
cp worktrees/backend-api/.env.example worktrees/backend-api/.env
# .env 파일 편집 필요
```

### 3. 개발 서버 시작
```bash
# 모든 워크트리 병렬 실행 (권장)
npm run dev

# 또는 개별 실행
npm run backend   # API 서버 (포트 3000)
npm run frontend  # Expo 앱 (포트 19006)
```

## 👥 팀 협업 가이드

### Git 워크플로우
1. **기능 브랜치 생성**: `git checkout -b feature/기능명`
2. **변경사항 커밋**: 의미있는 단위로 커밋
3. **PR 생성**: GitHub에서 Pull Request 생성
4. **코드 리뷰**: 팀원 리뷰 후 승인
5. **메인 브랜치 병합**: 승인 후 main 브랜치에 병합

### 워크트리별 담당 영역
- **backend-api**: API 엔드포인트, 비즈니스 로직
- **frontend-ui**: 모바일 UI/UX, 사용자 인터페이스
- **band-integration**: Band API 연동, OAuth 인증
- **database-layer**: DB 스키마, 마이그레이션, 동기화
- **realtime-socket**: 실시간 통신, Socket 최적화
- **testing-suite**: 자동화 테스트, E2E 시나리오
- **infrastructure**: 배포, 모니터링, DevOps
- **ui-design**: 디자인 시스템, 테마, 체육관 특화 UI

## 📊 개발 현황

### ✅ 완료된 작업 (25-30%)
- [x] 프로젝트 구조 및 워크트리 설정
- [x] 기본 기술 스택 선정 및 환경 구성
- [x] 전문가 검토 및 개발 계획 수립
- [x] GitHub 저장소 및 협업 환경 구축

### 🔄 진행중인 작업 (Phase 1 - Week 1-2)
- [ ] 체육관 특화 UI 테마 구현
- [ ] SQLite 오프라인 저장소 설계
- [ ] 배터리 효율적 Socket 관리
- [ ] 기본 E2E 테스트 환경 구축
- [ ] 성능 모니터링 기초 설정

### 📋 예정된 작업
- [ ] Band API OAuth 인증 구현
- [ ] 게임 등록/관리 핵심 기능
- [ ] 실시간 게임 현황 알림
- [ ] 사용자 관리 및 권한 시스템
- [ ] 통계 및 리포트 기능

## 🎯 Phase 1 우선순위 태스크

### 🔥 Critical (즉시 시작)
1. **체육관 현장 특화 UI 기초 구현** (3-4일)
   - 큰 터치 영역 (44x44pt), 고대비 색상 적용
   - 체육관 조명 환경 최적화

2. **오프라인 우선 아키텍처 설계** (4-5일)
   - SQLite 오프라인 저장소, 동기화 큐 시스템
   - 네트워크 상태 감지 및 충돌 해결

3. **배터리 효율적 Socket 관리** (3-4일)
   - 지능적 연결 관리, 백그라운드 최적화
   - 재연결 전략 및 배터리 절약 모드

### 🟡 High (병렬 진행)
4. **기본 E2E 테스트 환경** (2-3일)
5. **성능 모니터링 기초** (2-3일)

## 📚 문서 및 가이드

### 개발 문서
- [📋 개발 킥오프 계획](./DEVELOPMENT_KICKOFF_PLAN.md) - Week 1-2 상세 로드맵
- [⚡ 즉시 실행 아이템](./IMMEDIATE_ACTION_ITEMS.md) - Day-by-day 실행 계획
- [🛠️ 개발 프로세스](./DEVELOPMENT_PROCESS.md) - 품질 게이트 & 협업 가이드
- [📊 프로젝트 분석](./PROJECT_ANALYSIS.md) - 전문가 검토 결과 (80/100)

### API 문서
- Backend API: `http://localhost:3000/api/docs` (개발 서버 실행 시)
- Socket.io Events: `./docs/socket-events.md` (추가 예정)

## 🧪 테스트

### 단위 테스트
```bash
# 백엔드 테스트
cd worktrees/backend-api
npm test

# 프론트엔드 테스트
cd worktrees/frontend-ui
npm test
```

### E2E 테스트
```bash
# Detox E2E 테스트
cd worktrees/testing-suite
npm run test:e2e
```

## 🚀 배포

### 개발 환경
- **백엔드**: `http://localhost:3000`
- **프론트엔드**: Expo Go 앱에서 QR 코드 스캔

### 스테이징 환경
- 추후 AWS 환경 설정 예정

## 🤝 기여 가이드

1. **Issue 생성**: 새로운 기능이나 버그 리포트
2. **Fork & Clone**: 저장소 포크 후 로컬에 클론
3. **브랜치 생성**: `feature/기능명` 또는 `bugfix/이슈번호`
4. **개발 & 테스트**: 변경사항 개발 및 테스트 작성
5. **PR 생성**: 상세한 설명과 함께 Pull Request 생성
6. **코드 리뷰**: 팀원 리뷰 후 승인 시 병합

## 📞 지원 및 문의

### 개발팀 연락처
- **프로젝트 매니저**: tjkin1201@gmail.com
- **기술 문의**: GitHub Issues 활용
- **긴급 사항**: Discord 채널 (추가 예정)

### 커뮤니티
- [GitHub Discussions](https://github.com/tjkin1201/yameyame-app/discussions)
- [Issues & Bug Reports](https://github.com/tjkin1201/yameyame-app/issues)
- [Project Board](https://github.com/tjkin1201/yameyame-app/projects)

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

<div align="center">

**🏸 즐거운 배드민턴, 스마트한 관리 - YameYame 🏸**

Made with ❤️ by YameYame Development Team

[🚀 시작하기](#-빠른-시작) • [📚 문서](./docs/) • [🤝 기여하기](#-기여-가이드) • [📞 지원](#-지원-및-문의)

</div>