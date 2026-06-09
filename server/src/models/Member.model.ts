import mongoose, { Schema, Document } from 'mongoose';

export interface IMember extends Document {
  bandId?: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;

  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  position: 'all' | 'front' | 'back';

  elo: number;
  eloHistory: Array<{ elo: number; gameId: mongoose.Types.ObjectId; date: Date }>;
  highestElo: number;
  lowestElo: number;

  stats: {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    currentStreak: number; // 양수=연승, 음수=연패
    longestWinStreak: number;
    longestLoseStreak: number;
  };

  joinDate: Date;
  lastActiveDate?: Date;
  attendanceCount: number;
  isActive: boolean;
  role: 'member' | 'admin' | 'owner';

  createdAt: Date;
  updatedAt: Date;

  updateElo(newElo: number, gameId: mongoose.Types.ObjectId): Promise<IMember>;
  updateStats(isWin: boolean): Promise<IMember>;
}

const MemberSchema = new Schema<IMember>(
  {
    bandId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, index: true },
    email: { type: String, sparse: true },
    phone: { type: String, sparse: true },
    profileImage: { type: String },

    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'beginner',
    },
    position: { type: String, enum: ['all', 'front', 'back'], default: 'all' },

    elo: { type: Number, default: 1200, index: true },
    eloHistory: [
      {
        elo: { type: Number, required: true },
        gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
        date: { type: Date, default: Date.now },
      },
    ],
    highestElo: { type: Number, default: 1200 },
    lowestElo: { type: Number, default: 1200 },

    stats: {
      totalGames: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
      longestWinStreak: { type: Number, default: 0 },
      longestLoseStreak: { type: Number, default: 0 },
    },

    joinDate: { type: Date, default: Date.now },
    lastActiveDate: { type: Date },
    attendanceCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    role: { type: String, enum: ['member', 'admin', 'owner'], default: 'member' },
  },
  { timestamps: true }
);

// 리더보드/랭킹용 인덱스
MemberSchema.index({ elo: -1 });
MemberSchema.index({ isActive: 1, elo: -1 });

MemberSchema.methods.updateElo = function (
  this: IMember,
  newElo: number,
  gameId: mongoose.Types.ObjectId
) {
  this.eloHistory.push({ elo: newElo, gameId, date: new Date() });
  this.elo = newElo;
  if (newElo > this.highestElo) this.highestElo = newElo;
  if (newElo < this.lowestElo) this.lowestElo = newElo;
  return this.save();
};

MemberSchema.methods.updateStats = function (this: IMember, isWin: boolean) {
  this.stats.totalGames += 1;

  if (isWin) {
    this.stats.wins += 1;
    this.stats.currentStreak = this.stats.currentStreak >= 0 ? this.stats.currentStreak + 1 : 1;
    if (this.stats.currentStreak > this.stats.longestWinStreak) {
      this.stats.longestWinStreak = this.stats.currentStreak;
    }
  } else {
    this.stats.losses += 1;
    this.stats.currentStreak = this.stats.currentStreak <= 0 ? this.stats.currentStreak - 1 : -1;
    if (Math.abs(this.stats.currentStreak) > this.stats.longestLoseStreak) {
      this.stats.longestLoseStreak = Math.abs(this.stats.currentStreak);
    }
  }

  this.stats.winRate =
    this.stats.totalGames > 0
      ? Math.round((this.stats.wins / this.stats.totalGames) * 100) / 100
      : 0;
  this.lastActiveDate = new Date();
  return this.save();
};

export default mongoose.model<IMember>('Member', MemberSchema);
