const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  reactToBlog,
  incrementView,
  redirectBySlug,
  generateCover,
  ogMetaBySlug,
  getCommentsByBlog,
  addComment,
  likeComment
} = require('../controllers/blogController');

router.get('/', getBlogs);
router.get('/slug/:slug', getBlogBySlug);
router.get('/redirect/:slug', redirectBySlug);
router.get('/og/:slug', ogMetaBySlug);
router.get('/:id', getBlogById);
router.get('/:id/comments', getCommentsByBlog);
router.post('/:id/comments', addComment);
router.post('/:id/comments/:commentId/like', likeComment);
router.post('/', protect, admin, createBlog);
router.put('/:id', protect, admin, updateBlog);
router.delete('/:id', protect, admin, deleteBlog);
router.post('/:id/react', reactToBlog);
router.post('/:slug/view', incrementView);
router.post('/generate-cover', protect, admin, generateCover);

module.exports = router;

export {};
