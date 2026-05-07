const mongoose = require('mongoose');

const UserMediaSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video'], required: true },
  storageProvider: { type: String, default: 'local' },
  mimeType: { type: String, required: true },
  originalName: { type: String, default: '' },
  size: { type: Number, default: 0 },
  publicId: { type: String, default: '' },
  url: { type: String, required: true }
}, { _id: false });

const TrustedDeviceSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },
  deviceName: { type: String, default: '' },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  profilePhoto: { type: UserMediaSchema, default: null },
  loginOtpHash: { type: String, default: null },
  loginOtpExpiresAt: { type: Date, default: null },
  trustedDevices: { type: [TrustedDeviceSchema], default: [] },
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  savedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  savedProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }]
}, { timestamps: true });

module.exports = mongoose.model('user', UserSchema);
