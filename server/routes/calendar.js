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

router.get('/events', requireAuth, async (req, res) => {
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access } = await checkAccess(req.userId, ownerId);
    if (!access) return res.status(403).json({ error: 'Access denied' });
  }
  const result = await db.query(
    'SELECT date_key, events FROM work_events WHERE user_id = $1',
    [ownerId]
  );
  res.json(result.rows);
});

router.put('/events/:dateKey', requireAuth, async (req, res) => {
  const { events } = req.body;
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access, role } = await checkAccess(req.userId, ownerId);
    if (!access || role === 'contributor') return res.status(403).json({ error: 'Access denied' });
  }
  if (!events || events.length === 0) {
    await db.query('DELETE FROM work_events WHERE user_id = $1 AND date_key = $2', [ownerId, req.params.dateKey]);
  } else {
    await db.query(
      `INSERT INTO work_events (user_id, date_key, events, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, date_key) DO UPDATE SET events = $3, updated_at = NOW()`,
      [ownerId, req.params.dateKey, JSON.stringify(events)]
    );
  }
  res.json({ ok: true });
});

router.get('/groups', requireAuth, async (req, res) => {
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access } = await checkAccess(req.userId, ownerId);
    if (!access) return res.status(403).json({ error: 'Access denied' });
  }
  const result = await db.query(
    'SELECT id, start_date, end_date FROM work_groups WHERE user_id = $1 ORDER BY created_at',
    [ownerId]
  );
  res.json(result.rows);
});

router.post('/groups', requireAuth, async (req, res) => {
  const { start, end } = req.body;
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access, role } = await checkAccess(req.userId, ownerId);
    if (!access || role === 'contributor') return res.status(403).json({ error: 'Access denied' });
  }
  const result = await db.query(
    'INSERT INTO work_groups (user_id, start_date, end_date) VALUES ($1, $2, $3) RETURNING id',
    [ownerId, start, end]
  );
  res.json({ id: result.rows[0].id });
});

router.delete('/groups/:id', requireAuth, async (req, res) => {
  const ownerId = req.query.owner ? parseInt(req.query.owner) : req.userId;
  if (ownerId !== req.userId) {
    const { access, role } = await checkAccess(req.userId, ownerId);
    if (!access || role === 'contributor') return res.status(403).json({ error: 'Access denied' });
  }
  await db.query(
    'DELETE FROM work_groups WHERE id = $1 AND user_id = $2',
    [parseInt(req.params.id), ownerId]
  );
  res.json({ ok: true });
});

module.exports = router;
