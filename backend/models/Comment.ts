const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  likes: { type: Number, default: 0 },
  status: { type: String, enum: ['approved', 'pending', 'spam'], default: 'approved' }
}, { timestamps: true });

commentSchema.index({ blog: 1, status: 1, createdAt: -1 });
commentSchema.index({ blog: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);

export {};
