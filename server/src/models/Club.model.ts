import mongoose, { Schema, Document } from 'mongoose';

export interface IClub extends Document {
  name: string;
  description?: string;
  location: { address?: string; city?: string; facilities?: string[] };

  bandInfo?: {
    bandKey: string;
    bandName: string;
    syncEnabled: boolean;
    lastSyncDate?: Date;
  };

  members: mongoose.Types.ObjectId[];
  memberCount: number;

  schedule?: { regularDays?: string[]; regularTime?: string; location?: string };
  fees?: { monthlyFee?: number; currency?: string; dueDate?: number };

  stats: {
    totalGames: number;
    averageElo: number;
    activeMembers: number;
  };

  settings: {
    isPublic: boolean;
    requireApproval: boolean;
    eloEnabled: boolean;
    matchmakingEnabled: boolean;
  };

  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClubSchema = new Schema<IClub>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, maxlength: 1000 },
    location: {
      address: { type: String },
      city: { type: String, index: true },
      facilities: [{ type: String }],
    },

    bandInfo: {
      bandKey: { type: String, unique: true, sparse: true },
      bandName: { type: String },
      syncEnabled: { type: Boolean, default: false },
      lastSyncDate: { type: Date },
    },

    members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    memberCount: { type: Number, default: 0 },

    schedule: {
      regularDays: [{ type: String }],
      regularTime: { type: String },
      location: { type: String },
    },
    fees: {
      monthlyFee: { type: Number, min: 0 },
      currency: { type: String, default: 'KRW' },
      dueDate: { type: Number, min: 1, max: 31, default: 1 },
    },

    stats: {
      totalGames: { type: Number, default: 0 },
      averageElo: { type: Number, default: 1200 },
      activeMembers: { type: Number, default: 0 },
    },

    settings: {
      isPublic: { type: Boolean, default: false },
      requireApproval: { type: Boolean, default: true },
      eloEnabled: { type: Boolean, default: true },
      matchmakingEnabled: { type: Boolean, default: true },
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ClubSchema.index({ isActive: 1, 'location.city': 1 });

export default mongoose.model<IClub>('Club', ClubSchema);
