const express = require('express');
const router = express.Router();
const { generateToken } = require('../middleware/auth');

// POST /api/auth/token — get a JWT for API access
router.post('/token', (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  const token = generateToken({ role: 'api', iat: Date.now() });
  res.json({ token, expiresIn: '30d' });
});

module.exports = router;
