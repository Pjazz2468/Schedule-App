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

const checkAccess = async (requesterId, ownerId) => {
  if (requesterId === ownerId) return { access: true, role: 'owner' };
  const myEmail = (await db.query('SELECT email FROM users WHERE id = $1', [requesterId])).rows[0]?.email;
  if (!myEmail) return { access: false };
  const result = await db.query(
    'SELECT role FROM shares WHERE owner_id = $1 AND member_email = $2',
    [ownerId, myEmail]
  );
  if (result.rows.length === 0) return { access: false };
  return { access: true, role: result.rows[0].role };
};

router.get('/', requireAuth, async (req, res) => {
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access } = await checkAccess(req.userId, ownerId);
    if (!access) return res.status(403).json({ error: 'Access denied' });
  }
  const result = await db.query(
    'SELECT cell_key, data FROM tracker_cells WHERE user_id = $1',
    [ownerId]
  );
  res.json(result.rows);
});

router.put('/:cellKey', requireAuth, async (req, res) => {
  const { data } = req.body;
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access, role } = await checkAccess(req.userId, ownerId);
    if (!access || role === 'contributor') return res.status(403).json({ error: 'Access denied' });
  }
  await db.query(
    `INSERT INTO tracker_cells (user_id, cell_key, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, cell_key) DO UPDATE SET data = $3`,
    [ownerId, req.params.cellKey, JSON.stringify(data)]
  );
  res.json({ ok: true });
});

router.delete('/:cellKey', requireAuth, async (req, res) => {
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access, role } = await checkAccess(req.userId, ownerId);
    if (!access || role === 'contributor') return res.status(403).json({ error: 'Access denied' });
  }
  await db.query(
    'DELETE FROM tracker_cells WHERE user_id = $1 AND cell_key = $2',
    [ownerId, req.params.cellKey]
  );
  res.json({ ok: true });
});

module.exports = router;
