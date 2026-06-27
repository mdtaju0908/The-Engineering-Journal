const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe } = require('../controllers/notificationController');

router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);
router.post('/register-token', subscribe);

module.exports = router;

export {};
