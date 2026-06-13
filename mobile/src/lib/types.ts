/** DB row 타입 — docs/PLAN-supabase-mvp.md §1 스키마와 1:1 */

export type MemberRole = 'owner' | 'manager' | 'member';
export type MemberStatus = 'active' | 'inactive';
export type AttendanceStatus = 'attending' | 'absent' | 'maybe';
export type GameType = 'singles' | 'doubles';

export interface Club {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  created_at: string;
}

export interface Member {
  id: string;
  club_id: string;
  user_id: string | null;
  name: string;
  nickname: string | null;
  role: MemberRole;
  elo_singles: number;
  elo_doubles: number;
  games_singles: number;
  games_doubles: number;
  status: MemberStatus;
  avatar_url: string | null;
  joined_at: string;
  created_at: string;
}

export interface Session {
  id: string;
  club_id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  member_id: string;
  status: AttendanceStatus;
  checked_in_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  club_id: string;
  author_id: string | null;
  title: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  club_id: string;
  uploader_id: string | null;
  session_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  club_id: string;
  session_id: string | null;
  game_type: GameType;
  team1_p1: string;
  team1_p2: string | null;
  team2_p1: string;
  team2_p2: string | null;
  score1: number | null;
  score2: number | null;
  winner: 1 | 2;
  recorded_by: string | null;
  played_at: string;
  created_at: string;
}

export interface EloHistory {
  id: string;
  game_id: string;
  member_id: string;
  game_type: GameType;
  elo_before: number;
  elo_after: number;
  created_at: string;
}

/** record_game RPC 반환 */
export interface RecordGameResult {
  game_id: string;
  ratings: { member_id: string; before: number; after: number }[];
}
