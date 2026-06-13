# 🏸 YameYame Mobile

배드민턴 동호회 운영 앱 — **인원·참석·공지·사진첩·게임(ELO)** 을 폰 하나로.
Expo SDK 56 + expo-router + Supabase (스키마·RLS·RPC: `../docs/PLAN-supabase-mvp.md`)

## 폰에서 바로 실행 (Expo Go)

1. 폰에 **Expo Go** 설치 (App Store / Play Store)
2. 개발 서버 실행:
   ```bash
   cd mobile
   npm install        # 최초 1회
   npx expo start
   ```
3. 터미널의 **QR 코드 스캔** — iPhone은 카메라, Android는 Expo Go 앱으로
   (폰과 컴퓨터가 같은 Wi-Fi여야 함. 안 되면 `npx expo start --tunnel`)

첫 화면에서 **회원가입 → 클럽 만들기**(가입 코드 자동 발급) 또는 받은 **가입 코드로 참여**.

## 기능 맵

| 탭 | 기능 |
|----|------|
| 홈 | 내 ELO 카드 · 다음 모임 RSVP · 고정 공지 |
| 참석 | 모임 목록/RSVP · (운영진) 모임 생성·체크인 |
| 게임 | 스마트 대진표(ELO 균형) · 게임 기록→레이팅 자동 반영 · 리더보드 |
| 사진첩 | 클럽 전용 앨범(업로드/삭제, private Storage) |
| 멤버 | 멤버 목록·상세(ELO 추이) · (운영진) 미가입 회원 등록 · 가입 코드 |

## 검증 명령

```bash
npx tsc --noEmit            # 타입체크
npx expo lint               # 린트
npx tsx scripts/elo-parity.ts  # ELO 엔진 TS↔SQL 패리티 테스트
```

## 스토어 빌드 (EAS — 계정 필요)

```bash
npm install -g eas-cli && eas login
eas build --profile preview --platform android   # 설치용 APK
eas build --profile production --platform all     # 스토어 제출용
```

## 알려진 후속 작업

- Supabase Database 타입 생성(`supabase gen types`) → `as` 캐스팅 제거
- 사진 signed URL(1h) 만료 갱신 / Band OAuth 연동 / 푸시 알림
- `react-hooks/set-state-in-effect`는 warn 운용 중 (eslint.config.js 주석 참조)
