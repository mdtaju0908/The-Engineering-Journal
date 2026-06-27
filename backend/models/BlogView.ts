const mongoose = require('mongoose');

const blogViewSchema = new mongoose.Schema({
  blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true, index: true },
  viewerHash: { type: String, required: true, index: true },
  deviceType: { type: String, default: 'unknown', index: true },
  deviceOs: { type: String, default: 'unknown', index: true },
  deviceBrowser: { type: String, default: 'unknown' },
  ipHash: { type: String, default: '' },
  userAgentHash: { type: String, default: '' }
}, { timestamps: true });

blogViewSchema.index({ blog: 1, viewerHash: 1 }, { unique: true });

module.exports = mongoose.model('BlogView', blogViewSchema);

export {};
