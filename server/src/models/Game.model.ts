import mongoose, { Schema, Document } from 'mongoose';

export interface IGame extends Document {
  clubId: mongoose.Types.ObjectId;
  date: Date;
  courtNumber?: number;
  type: 'singles' | 'doubles';

  team1: { players: mongoose.Types.ObjectId[]; score: number; elo: number[] };
  team2: { players: mongoose.Types.ObjectId[]; score: number; elo: number[] };

  winner: 1 | 2 | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

  sets?: Array<{ team1Score: number; team2Score: number; duration?: number }>;
  stats?: { duration?: number; rallyCount?: number; deuceCount?: number };
  eloChanges?: { team1: number[]; team2: number[] };
  prediction?: {
    team1WinProbability: number;
    team2WinProbability: number;
    eloDifference: number;
  };

  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    courtNumber: { type: Number, min: 1, max: 20 },
    type: { type: String, enum: ['singles', 'doubles'], required: true },

    team1: {
      players: [{ type: Schema.Types.ObjectId, ref: 'Member', required: true }],
      score: { type: Number, default: 0, min: 0 },
      elo: [{ type: Number }],
    },
    team2: {
      players: [{ type: Schema.Types.ObjectId, ref: 'Member', required: true }],
      score: { type: Number, default: 0, min: 0 },
      elo: [{ type: Number }],
    },

    winner: { type: Number, enum: [1, 2, null], default: null },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },

    sets: [
      {
        team1Score: { type: Number, required: true, min: 0 },
        team2Score: { type: Number, required: true, min: 0 },
        duration: { type: Number, min: 0 },
      },
    ],
    stats: {
      duration: { type: Number, min: 0 },
      rallyCount: { type: Number, min: 0 },
      deuceCount: { type: Number, min: 0 },
    },
    eloChanges: {
      team1: [{ type: Number }],
      team2: [{ type: Number }],
    },
    prediction: {
      team1WinProbability: { type: Number, min: 0, max: 1 },
      team2WinProbability: { type: Number, min: 0, max: 1 },
      eloDifference: { type: Number },
    },

    notes: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Member' },
  },
  { timestamps: true }
);

GameSchema.index({ clubId: 1, date: -1 });
GameSchema.index({ clubId: 1, status: 1, date: -1 });
GameSchema.index({ 'team1.players': 1, date: -1 });
GameSchema.index({ 'team2.players': 1, date: -1 });

// 팀 인원 수 검증 (단식 1명, 복식 2명)
GameSchema.pre('save', function (next) {
  const game = this as IGame;
  const required = game.type === 'singles' ? 1 : 2;

  if (game.team1.players.length !== required || game.team2.players.length !== required) {
    return next(new Error(`${game.type} game must have exactly ${required} player(s) per team`));
  }

  if (game.winner === 1 && game.team1.score <= game.team2.score) {
    return next(new Error('Winner score must be higher'));
  }
  if (game.winner === 2 && game.team2.score <= game.team1.score) {
    return next(new Error('Winner score must be higher'));
  }

  next();
});

export default mongoose.model<IGame>('Game', GameSchema);
