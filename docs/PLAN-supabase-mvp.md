# PLAN — Supabase MVP (인원·참석·공지·사진첩·게임)

> 2026-06-13. L011 워크플로우 Phase 1 산출물. 구현 전 승인된 설계.
> 결정: Supabase 전환 / 풀 5기능 / Expo Go 타깃 (사용자 확정)

## 0. 결정 요약

| 항목 | 결정 | 근거 |
|------|------|------|
| 백엔드 | **Supabase** (Postgres+Auth+Storage+RLS) | 사진첩=파일 스토리지 내장, 서버 호스팅 0원, 운영 부담 제거 |
| 기존 Express 서버 | `server/` 보존(참조용), ELO·매칭 로직만 TS lib로 이식 | v2 설계 존중, 재사용 |
| 모바일 | **새 Expo 앱**(최신 SDK, expo-router, TS) — 구 mobile은 `mobile-legacy/` | Expo 51은 스토어 Expo Go와 비호환. 화면 6개는 골격뿐이라 이식 < 재작성 |
| 인증 | 이메일+비번 가입 → 클럽 생성(=owner) 또는 **가입코드**로 참여 | Band OAuth는 후순위(커스텀 OAuth 복잡도) |
| ELO 무결성 | **Postgres RPC `record_game`이 서버측 계산·원자적 기록**. TS lib는 UI 예측·대진표용 | 클라이언트 신뢰 문제 제거. TS↔SQL 패리티 테스트로 발산 방지 |
| 미가입 회원 | `members.user_id` nullable — 운영진이 이름만 등록 가능 | 체육관 현실(전원이 앱 설치 안 함) |

Supabase 프로젝트: `cmtyfofqtjjdtpvuxiig` (ap-northeast-2)

## 1. DB 스키마 (Postgres)

```
clubs          id, name, description, join_code(uniq), created_at
members        id, club_id→clubs, user_id→auth.users(null허용), name, nickname,
               role(owner|manager|member), elo_singles, elo_doubles,
               games_singles, games_doubles, status(active|inactive),
               avatar_url, joined_at  · uniq(club_id,user_id)
sessions       id, club_id, title, location, starts_at, ends_at, note, created_by
attendance     id, session_id, member_id, status(attending|absent|maybe),
               checked_in_at  · uniq(session_id,member_id)
announcements  id, club_id, author_id, title, body, pinned, created_at, updated_at
photos         id, club_id, uploader_id, session_id(null), storage_path, caption, created_at
games          id, club_id, session_id(null), game_type(singles|doubles),
               team1_p1, team1_p2(null), team2_p1, team2_p2(null),
               score1, score2, winner(1|2), recorded_by, played_at
elo_history    id, game_id, member_id, game_type, elo_before, elo_after, created_at
```

## 2. RLS 정책 (요지)

헬퍼(security definer): `is_club_member(club_id)`, `is_club_manager(club_id)`, `my_member_id(club_id)`

| 테이블 | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|---------------------|
| clubs | 멤버만 | owner만 update |
| members | 클럽 멤버 | manager+ 전체 / 본인 row는 name·nickname·avatar만 |
| sessions | 클럽 멤버 | manager+ |
| attendance | 클럽 멤버 | **본인 RSVP upsert** / manager는 전체(체크인 포함) |
| announcements | 클럽 멤버 | manager+ |
| photos | 클럽 멤버 | 멤버 insert(본인 업로드) / 삭제는 본인 or manager |
| games·elo_history | 클럽 멤버 | **직접 쓰기 금지 — RPC 경유만** |

## 3. RPC (security definer)

- `create_club(p_name, p_member_name)` → 클럽+owner 멤버 생성, join_code 반환
- `join_club(p_code, p_name)` → 코드 검증 후 members row 생성(중복 가입 방지)
- `record_game(p_club, p_type, p_t1p1, p_t1p2, p_t2p1, p_t2p2, p_score1, p_score2, p_winner, p_session)` →
  ELO 계산(K=32, 20게임 미만 K=40, 복식=팀평균) + games·elo_history insert + members elo/games 갱신을 **한 트랜잭션**으로. 멤버 권한 체크.

## 4. Storage

- 버킷 `photos` (private). 경로 규약: `{club_id}/{photo_id}.jpg`
- storage.objects RLS: 해당 club 멤버만 read/insert. 표시 시 createSignedUrl 사용.

## 5. 모바일 구조 (expo-router)

```
mobile/
  app/
    _layout.tsx              # 루트: 세션 게이트 + PaperProvider(GymTheme)
    (auth)/login.tsx         # 로그인/가입 토글
    (auth)/onboarding.tsx    # 클럽 만들기 vs 가입코드 입력
    (tabs)/_layout.tsx       # 5탭: 홈/참석/게임/사진첩/멤버
    (tabs)/index.tsx         # 홈: 다음 모임 카드+내 RSVP, 고정공지, 내 ELO 카드
    (tabs)/attendance.tsx    # 세션 목록(다가오는/지난), RSVP 버튼, manager: 세션 생성·체크인
    (tabs)/games.tsx         # 탭내 세그먼트: 대진표 생성(참석자→스마트매칭) / 게임 기록 / 리더보드
    (tabs)/photos.tsx        # 그리드(서명URL), FAB 업로드(expo-image-picker)
    (tabs)/members.tsx       # 목록(ELO 티어 배지), manager: 이름만 회원 추가
    announcements.tsx        # 공지 전체 목록 + manager 작성 (홈에서 진입)
    member/[id].tsx          # 멤버 상세: ELO 추이, 전적
  src/
    lib/supabase.ts          # createClient(URL, anon key) + AsyncStorage 세션
    lib/elo.ts               # 서버 EloService 이식 (순수 함수)
    lib/matching.ts          # snake-draft 대진표 이식
    lib/types.ts             # DB row 타입
    components/              # MemberRow, TierBadge, SessionCard, EmptyState …
  __tests__/elo.test.ts      # 패리티: 서버 구현 기대값 고정 케이스
```

UI: react-native-paper + 기존 gymTheme(고대비·44pt 터치·18sp) 이식.

## 6. 검증 계획 (Phase 4)

1. `tsc --noEmit` 0 에러
2. ELO 패리티: TS lib 테스트 + 동일 픽스처를 SQL `record_game` 경로로 execute_sql 검증 (1500vs1400 단식 승자1 → 1512/1388 등)
3. RLS 스모크: 비멤버 anon 쿼리가 0 rows인지 execute_sql로 확인
4. 에이전트 리뷰: typescript-reviewer + security-reviewer
5. `npx expo start` 부팅 + (가능하면) 로그인→홈 흐름

## 7. 비범위 (이번 세션 제외 — 명시)

Band OAuth 연동 / 푸시 알림 / 회비 관리 / 오프라인 동기화(legacy의 SQLite 큐) / 스토어 제출(계정 필요 — EAS 설정 파일만 준비)
