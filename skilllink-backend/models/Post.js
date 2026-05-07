const mongoose = require('mongoose');

const PostMediaSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video'], required: true },
  storageProvider: { type: String, default: 'local' },
  mimeType: { type: String, required: true },
  originalName: { type: String, default: '' },
  size: { type: Number, default: 0 },
  publicId: { type: String, default: '' },
  url: { type: String, required: true }
}, { _id: false });

const PostCommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  content: { type: String, required: true },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  content: { type: String, default: '' },
  media: { type: [PostMediaSchema], default: [] },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  comments: { type: [PostCommentSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
