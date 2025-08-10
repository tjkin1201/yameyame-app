/**
 * YameYame 프로젝트 공유 타입 정의
 * 프론트엔드와 백엔드에서 공통으로 사용되는 타입들
 */

// =============================================================================
// 사용자 관련 타입
// =============================================================================

export interface User {
  id: string;
  bandId?: string;
  name: string;
  email: string;
  phoneNumber?: string;
  profileImage?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type UserRole = 'admin' | 'member' | 'guest';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface UserProfile extends Omit<User, 'email' | 'role'> {
  bio?: string;
  skillLevel: SkillLevel;
  preferredPosition: Position;
  joinedAt: string;
  gamesPlayed: number;
  winRate: number;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type Position = 'singles' | 'doubles' | 'mixed';

// =============================================================================
// 게임 관련 타입
// =============================================================================

export interface Game {
  id: string;
  title: string;
  description?: string;
  type: GameType;
  status: GameStatus;
  maxPlayers: number;
  currentPlayers: number;
  skillLevel?: SkillLevel;
  courtNumber?: number;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  createdBy: string;
  participants: GameParticipant[];
  scores?: GameScore[];
  createdAt: string;
  updatedAt: string;
}

export type GameType = 'casual' | 'tournament' | 'league' | 'practice';
export type GameStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface GameParticipant {
  userId: string;
  userName: string;
  joinedAt: string;
  status: ParticipantStatus;
  team?: 'A' | 'B';
  position?: number;
}

export type ParticipantStatus = 'confirmed' | 'pending' | 'declined' | 'no-show';

export interface GameScore {
  team: 'A' | 'B';
  set: number;
  points: number;
  timestamp: string;
}

// =============================================================================
// 채팅 관련 타입
// =============================================================================

export interface ChatRoom {
  id: string;
  name: string;
  type: ChatRoomType;
  description?: string;
  isPrivate: boolean;
  participants: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

export type ChatRoomType = 'general' | 'game' | 'private' | 'announcement';

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  content: string;
  type: MessageType;
  attachments?: MessageAttachment[];
  replyTo?: string;
  reactions?: MessageReaction[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageType = 'text' | 'image' | 'file' | 'system' | 'game-invite' | 'announcement';

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
  timestamp: string;
}

// =============================================================================
// 게시판 관련 타입
// =============================================================================

export interface Post {
  id: string;
  title: string;
  content: string;
  type: PostType;
  category?: PostCategory;
  tags: string[];
  attachments?: PostAttachment[];
  authorId: string;
  authorName: string;
  isPublic: boolean;
  isPinned: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PostType = 'announcement' | 'general' | 'question' | 'tips' | 'event';
export type PostCategory = 'notice' | 'tournament' | 'social' | 'equipment' | 'rules' | 'other';

export interface PostAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId?: string;
  likeCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// 클럽 관련 타입
// =============================================================================

export interface Club {
  id: string;
  name: string;
  description: string;
  location: string;
  contactInfo: ContactInfo;
  settings: ClubSettings;
  stats: ClubStats;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

export interface ClubSettings {
  isPublic: boolean;
  requireApproval: boolean;
  maxMembers: number;
  courtCount: number;
  operatingHours: OperatingHours[];
}

export interface OperatingHours {
  day: number; // 0-6 (일-토)
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface ClubStats {
  totalMembers: number;
  activeMembers: number;
  totalGames: number;
  thisMonthGames: number;
}

// =============================================================================
// 예약 관련 타입
// =============================================================================

export interface Reservation {
  id: string;
  courtNumber: number;
  userId: string;
  userName: string;
  startTime: string;
  endTime: string;
  purpose: ReservationPurpose;
  status: ReservationStatus;
  participantCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReservationPurpose = 'practice' | 'casual' | 'tournament' | 'lesson' | 'event';
export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';

// =============================================================================
// Band 연동 관련 타입
// =============================================================================

export interface BandSyncStatus {
  isEnabled: boolean;
  lastSyncAt?: string;
  syncInterval: number;
  autoSync: boolean;
  syncedDataTypes: BandDataType[];
}

export type BandDataType = 'members' | 'posts' | 'photos' | 'events';

export interface BandMember {
  bandId: string;
  name: string;
  profileImage?: string;
  role: string;
  joinedAt: string;
  isActive: boolean;
}

// =============================================================================
// API 및 네트워킹 타입
// =============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  details?: unknown;
}

// =============================================================================
// 시스템 및 설정 타입
// =============================================================================

export interface SystemConfig {
  appVersion: string;
  maintenanceMode: boolean;
  featuresEnabled: FeatureFlags;
  limits: SystemLimits;
}

export interface FeatureFlags {
  bandIntegration: boolean;
  realTimeChat: boolean;
  tournaments: boolean;
  fileUploads: boolean;
  pushNotifications: boolean;
}

export interface SystemLimits {
  maxFileSize: number;
  maxParticipantsPerGame: number;
  maxChatRooms: number;
  maxMessageLength: number;
}

// =============================================================================
// 유틸리티 타입
// =============================================================================

export type ID = string;
export type Timestamp = string;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// 생성 시 필요한 필드만 요구하는 타입
export type CreateUserRequest = Optional<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>;
export type CreateGameRequest = Optional<Game, 'id' | 'createdAt' | 'updatedAt' | 'currentPlayers' | 'participants' | 'scores'>;
export type CreatePostRequest = Optional<Post, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'likeCount' | 'commentCount'>;

// 업데이트 시 사용하는 타입
export type UpdateUserRequest = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & { id: string };
export type UpdateGameRequest = Partial<Omit<Game, 'id' | 'createdAt' | 'updatedAt'>> & { id: string };
export type UpdatePostRequest = Partial<Omit<Post, 'id' | 'createdAt' | 'updatedAt'>> & { id: string };