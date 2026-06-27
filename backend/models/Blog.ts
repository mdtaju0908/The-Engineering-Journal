const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  content: { type: String, default: '' },
  category: { type: String, default: 'General' },
  author: { type: String, default: 'Admin' },
  image: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  youtubeUrl: { type: String, default: '' },
  imageSource: { type: String, enum: ['tavily', 'serpapi', 'pexels', 'unsplash', 'gemini', 'google', 'pollinations', ''], default: '' },
  metaKeywords: [{ type: String }],
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Blog', blogSchema);

export {};
