import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { USER_ROLES, UserRole } from '@shopsense/shared';

export interface IRefreshToken {
  tokenHash: string;
  device?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  permissions: string[];
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpiresAt?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiresAt?: Date;
  refreshTokens: IRefreshToken[];
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true },
    device: { type: String },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CUSTOMER,
      index: true,
    },
    permissions: [{ type: String }],
    isEmailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpiresAt: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpiresAt: { type: Date },
    refreshTokens: [refreshTokenSchema],
    isBlocked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);
