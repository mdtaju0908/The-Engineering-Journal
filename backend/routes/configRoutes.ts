const express = require('express');
const router = express.Router();

function firstEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

router.get('/firebase-sw.js', (_req, res) => {
  const config = {
    apiKey: firstEnv('FIREBASE_WEB_API_KEY', 'FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: firstEnv(
      'FIREBASE_WEB_AUTH_DOMAIN',
      'FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
    ),
    projectId: firstEnv('FIREBASE_WEB_PROJECT_ID', 'FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: firstEnv(
      'FIREBASE_WEB_STORAGE_BUCKET',
      'FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
    ),
    messagingSenderId: firstEnv(
      'FIREBASE_WEB_MESSAGING_SENDER_ID',
      'FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
    ),
    appId: firstEnv('FIREBASE_WEB_APP_ID', 'FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'),
    measurementId: firstEnv(
      'FIREBASE_WEB_MEASUREMENT_ID',
      'FIREBASE_MEASUREMENT_ID',
      'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'
    )
  };

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
    res.send('self.__FIREBASE_SW_CONFIG_MISSING__ = true;');
    return;
  }

  res.send(`firebase.initializeApp(${safeScriptJson(config)});`);
});

module.exports = router;

export {};
