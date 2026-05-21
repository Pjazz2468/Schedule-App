const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'schedulerapp-jwt-secret-2026-change-in-prod';

const requireAuth = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.userId = jwt.verify(token, SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/received', requireAuth, async (req, res) => {
  const myEmail = (await db.query('SELECT email FROM users WHERE id = $1', [req.userId])).rows[0]?.email;
  if (!myEmail) return res.status(401).json({ error: 'User not found' });
  const result = await db.query(
    `SELECT s.id, s.role, u.id AS owner_id, u.email AS owner_email, u.name AS owner_name
     FROM shares s
     JOIN users u ON u.id = s.owner_id
     WHERE s.member_email = $1
     ORDER BY u.name`,
    [myEmail]
  );
  res.json(result.rows);
});

router.get('/', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT id, member_email, role, created_at FROM shares WHERE owner_id = $1 ORDER BY created_at',
    [req.userId]
  );
  res.json(result.rows);
});

router.post('/', requireAuth, async (req, res) => {
  const { email, role } = req.body;
  if (!email || !['admin', 'contributor'].includes(role)) {
    return res.status(400).json({ error: 'Valid email and role (admin or contributor) required' });
  }
  const lowerEmail = email.toLowerCase().trim();
  const self = await db.query('SELECT email FROM users WHERE id = $1', [req.userId]);
  if (self.rows[0]?.email === lowerEmail) {
    return res.status(400).json({ error: "You can't share with yourself" });
  }
  try {
    const result = await db.query(
      'INSERT INTO shares (owner_id, member_email, role) VALUES ($1, $2, $3) RETURNING id, member_email, role',
      [req.userId, lowerEmail, role]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const result = await db.query(
        'UPDATE shares SET role = $1 WHERE owner_id = $2 AND member_email = $3 RETURNING id, member_email, role',
        [role, req.userId, lowerEmail]
      );
      res.json(result.rows[0]);
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'contributor'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const result = await db.query(
    'UPDATE shares SET role = $1 WHERE id = $2 AND owner_id = $3 RETURNING id, member_email, role',
    [role, parseInt(req.params.id), req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Share not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.query('DELETE FROM shares WHERE id = $1 AND owner_id = $2', [parseInt(req.params.id), req.userId]);
  res.json({ ok: true });
});

module.exports = router;
