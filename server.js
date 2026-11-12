const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { db, hashPassword, verifyPassword, ensureAdmin } = require('./db');
const site = require('./public/content/site.json');

ensureAdmin();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

const SESSION_DAYS = 14;
const COOKIE = 'rem_session';
const FIELD_TYPES = ['text', 'longtext', 'number', 'date', 'select', 'yesno', 'link'];
const CLIENT_STATUSES = ['inquiry', 'booked', 'planning', 'final-details', 'completed'];

// ---------- helpers ----------
const str = (v, max = 2000) => (v === undefined || v === null ? null : String(v).trim().slice(0, max) || null);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
const safeUrl = (u) => { try { const p = new URL(u); return ['http:', 'https:'].includes(p.protocol) ? p.href : null; } catch { return null; } };

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

function setSessionCookie(req, res, token, maxAgeSec) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`);
}

// Attach the logged-in user (if any)
app.use((req, _res, next) => {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const row = db.prepare(`SELECT u.id, u.email, u.role, u.name FROM sessions s JOIN users u ON u.id = s.user_id
                            WHERE s.token = ? AND s.expires_at > datetime('now')`).get(token);
    if (row) { req.user = row; req.sessionToken = token; }
  }
  next();
});

// Basic CSRF defence: state-changing API calls must be JSON (forms on other sites can't send that cross-origin without CORS)
app.use('/api', (req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return bad(res, 'Expected JSON', 415);
  }
  next();
});

const requireRole = (role) => (req, res, next) => {
  if (!req.user) return bad(res, 'Please sign in', 401);
  if (req.user.role !== role) return bad(res, 'Not allowed', 403);
  next();
};

// Simple in-memory rate limiter
function rateLimit(windowMs, max) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return bad(res, 'Too many attempts, please try again shortly', 429);
    list.push(now);
    hits.set(key, list);
    next();
  };
}

// ---------- public ----------
app.get('/api/site', (_req, res) => res.json(site));

app.post('/api/inquiries', rateLimit(60 * 60 * 1000, 10), (req, res) => {
  const b = req.body || {};
  if (str(b.website)) return res.json({ ok: true }); // honeypot
  const name = str(b.name, 200);
  const email = str(b.email, 200);
  if (!name) return bad(res, 'Please tell us your name');
  if (!isEmail(email)) return bad(res, 'Please enter a valid email');
  db.prepare(`INSERT INTO inquiries (name, email, phone, event_date, guest_count, service, message)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(name, email, str(b.phone, 50), str(b.event_date, 20), str(b.guest_count, 20), str(b.service, 100), str(b.message, 5000));
  res.json({ ok: true });
});

// ---------- auth ----------
app.post('/api/auth/login', rateLimit(15 * 60 * 1000, 20), (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim());
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) return bad(res, 'Email or password is incorrect', 401);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).run(token, user.id);
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  setSessionCookie(req, res, token, SESSION_DAYS * 86400);
  res.json({ role: user.role, name: user.name });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.sessionToken) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  setSessionCookie(req, res, '', 0);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return bad(res, 'Not signed in', 401);
  res.json(req.user);
});

app.post('/api/me/password', (req, res) => {
  if (!req.user) return bad(res, 'Please sign in', 401);
  const { current, next: newPw } = req.body || {};
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(String(current || ''), user.password_hash)) return bad(res, 'Current password is incorrect');
  if (String(newPw || '').length < 8) return bad(res, 'New password must be at least 8 characters');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(newPw)), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.sessionToken);
  res.json({ ok: true });
});

// ---------- shared loaders ----------
function loadClientBundle(clientId) {
  const client = db.prepare(`SELECT c.*, u.email, u.name AS user_name FROM clients c JOIN users u ON u.id = c.user_id WHERE c.id = ?`).get(clientId);
  if (!client) return null;
  return {
    client,
    requests: db.prepare('SELECT * FROM requests WHERE client_id = ? ORDER BY status = \'done\', due_date IS NULL, due_date, id DESC').all(clientId),
    messages: db.prepare('SELECT * FROM messages WHERE client_id = ? ORDER BY id').all(clientId),
    documents: db.prepare('SELECT * FROM documents WHERE client_id = ? ORDER BY id DESC').all(clientId),
    timeline: db.prepare('SELECT * FROM timeline WHERE client_id = ? ORDER BY due_date IS NULL, due_date, id').all(clientId),
  };
}

// ---------- admin ----------
const admin = express.Router();
admin.use(requireRole('admin'));

admin.get('/dashboard', (_req, res) => {
  res.json({
    clients: db.prepare(`SELECT c.id, c.couple_names, c.event_date, c.venue, c.status, u.email,
                          (SELECT COUNT(*) FROM requests r WHERE r.client_id = c.id AND r.status = 'open') AS open_requests,
                          (SELECT COUNT(*) FROM requests r WHERE r.client_id = c.id AND r.status = 'submitted') AS submitted_requests
                         FROM clients c JOIN users u ON u.id = c.user_id
                         ORDER BY c.event_date IS NULL, c.event_date`).all(),
    inquiries: db.prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT 200').all(),
    statuses: CLIENT_STATUSES,
    fieldTypes: FIELD_TYPES,
  });
});

admin.patch('/inquiries/:id', (req, res) => {
  const status = str(req.body.status, 20);
  if (!['new', 'contacted', 'booked', 'archived'].includes(status)) return bad(res, 'Invalid status');
  db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

admin.post('/clients', (req, res) => {
  const b = req.body || {};
  const email = str(b.email, 200);
  const couple = str(b.couple_names, 200);
  if (!couple) return bad(res, 'Couple names are required');
  if (!isEmail(email)) return bad(res, 'A valid email is required');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return bad(res, 'That email already has an account');
  const password = str(b.password, 200) || crypto.randomBytes(6).toString('base64url');
  if (password.length < 8 && b.password) return bad(res, 'Password must be at least 8 characters');
  const status = CLIENT_STATUSES.includes(b.status) ? b.status : 'planning';
  const userId = db.prepare("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'client', ?)").run(email, hashPassword(password), couple).lastInsertRowid;
  const clientId = db.prepare(`INSERT INTO clients (user_id, couple_names, phone, event_date, venue, guest_count, package, budget, status)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, couple, str(b.phone, 50), str(b.event_date, 20), str(b.venue, 300), Number(b.guest_count) || null, str(b.package, 200), str(b.budget, 100), status).lastInsertRowid;
  if (b.inquiry_id) db.prepare("UPDATE inquiries SET status = 'booked' WHERE id = ?").run(b.inquiry_id);
  res.json({ id: Number(clientId), password });
});

admin.get('/clients/:id', (req, res) => {
  const bundle = loadClientBundle(req.params.id);
  if (!bundle) return bad(res, 'Client not found', 404);
  res.json(bundle);
});

admin.patch('/clients/:id', (req, res) => {
  const b = req.body || {};
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return bad(res, 'Client not found', 404);
  const fields = ['couple_names', 'phone', 'event_date', 'venue', 'guest_count', 'package', 'budget', 'status', 'internal_notes'];
  const next = { ...client };
  for (const f of fields) if (f in b) next[f] = f === 'guest_count' ? (Number(b[f]) || null) : str(b[f], f === 'internal_notes' ? 10000 : 300);
  if (!CLIENT_STATUSES.includes(next.status)) next.status = client.status;
  if (!next.couple_names) return bad(res, 'Couple names are required');
  db.prepare(`UPDATE clients SET couple_names=?, phone=?, event_date=?, venue=?, guest_count=?, package=?, budget=?, status=?, internal_notes=? WHERE id=?`)
    .run(next.couple_names, next.phone, next.event_date, next.venue, next.guest_count, next.package, next.budget, next.status, next.internal_notes, client.id);
  if (b.email && isEmail(b.email)) {
    const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(b.email, client.user_id);
    if (clash) return bad(res, 'That email is used by another account');
    db.prepare('UPDATE users SET email = ?, name = ? WHERE id = ?').run(String(b.email).trim(), next.couple_names, client.user_id);
  }
  if (b.new_password) {
    if (String(b.new_password).length < 8) return bad(res, 'Password must be at least 8 characters');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(b.new_password)), client.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(client.user_id);
  }
  res.json({ ok: true });
});

admin.delete('/clients/:id', (req, res) => {
  const client = db.prepare('SELECT user_id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return bad(res, 'Client not found', 404);
  db.prepare('DELETE FROM users WHERE id = ?').run(client.user_id);
  res.json({ ok: true });
});

admin.post('/clients/:id/requests', (req, res) => {
  const b = req.body || {};
  const title = str(b.title, 300);
  if (!title) return bad(res, 'A title is required');
  const type = FIELD_TYPES.includes(b.field_type) ? b.field_type : 'text';
  const options = type === 'select' ? (Array.isArray(b.options) ? b.options : String(b.options || '').split(',')).map((o) => String(o).trim()).filter(Boolean) : null;
  if (type === 'select' && !options.length) return bad(res, 'Add at least one option for a choice question');
  db.prepare('INSERT INTO requests (client_id, title, description, field_type, options, due_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.params.id, title, str(b.description, 3000), type, options ? JSON.stringify(options) : null, str(b.due_date, 20));
  res.json({ ok: true });
});

admin.patch('/requests/:id', (req, res) => {
  const status = str(req.body.status, 20);
  if (!['open', 'submitted', 'done'].includes(status)) return bad(res, 'Invalid status');
  db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

admin.delete('/requests/:id', (req, res) => {
  db.prepare('DELETE FROM requests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

admin.post('/clients/:id/documents', (req, res) => {
  const title = str(req.body.title, 300);
  const url = safeUrl(str(req.body.url, 2000));
  if (!title || !url) return bad(res, 'A title and a valid http(s) link are required');
  db.prepare('INSERT INTO documents (client_id, title, url) VALUES (?, ?, ?)').run(req.params.id, title, url);
  res.json({ ok: true });
});

admin.delete('/documents/:id', (req, res) => {
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

admin.post('/clients/:id/timeline', (req, res) => {
  const title = str(req.body.title, 300);
  if (!title) return bad(res, 'A title is required');
  db.prepare('INSERT INTO timeline (client_id, title, due_date) VALUES (?, ?, ?)').run(req.params.id, title, str(req.body.due_date, 20));
  res.json({ ok: true });
});

admin.patch('/timeline/:id', (req, res) => {
  db.prepare('UPDATE timeline SET done = ? WHERE id = ?').run(req.body.done ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

admin.delete('/timeline/:id', (req, res) => {
  db.prepare('DELETE FROM timeline WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

admin.post('/clients/:id/messages', (req, res) => {
  const body = str(req.body.body, 5000);
  if (!body) return bad(res, 'Message is empty');
  db.prepare("INSERT INTO messages (client_id, author_role, body) VALUES (?, 'admin', ?)").run(req.params.id, body);
  res.json({ ok: true });
});

app.use('/api/admin', admin);

// ---------- client ----------
const client = express.Router();
client.use(requireRole('client'));
client.use((req, res, next) => {
  const row = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(req.user.id);
  if (!row) return bad(res, 'No event linked to this account', 404);
  req.clientId = row.id;
  next();
});

client.get('/overview', (req, res) => {
  const bundle = loadClientBundle(req.clientId);
  delete bundle.client.internal_notes; // staff-only
  res.json({ ...bundle, contact: site.contact });
});

client.post('/requests/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM requests WHERE id = ? AND client_id = ?').get(req.params.id, req.clientId);
  if (!r) return bad(res, 'Request not found', 404);
  if (r.status === 'done') return bad(res, 'This item has been finalised — message us if something needs to change');
  let response = str(req.body.response, 10000);
  if (!response) return bad(res, 'Please fill in an answer');
  if (r.field_type === 'number' && Number.isNaN(Number(response))) return bad(res, 'Please enter a number');
  if (r.field_type === 'select' && !JSON.parse(r.options || '[]').includes(response)) return bad(res, 'Please choose one of the options');
  if (r.field_type === 'yesno' && !['Yes', 'No'].includes(response)) return bad(res, 'Please choose Yes or No');
  if (r.field_type === 'link') { response = safeUrl(response); if (!response) return bad(res, 'Please enter a valid link starting with https://'); }
  db.prepare("UPDATE requests SET response = ?, responded_at = datetime('now'), status = 'submitted' WHERE id = ?").run(response, r.id);
  res.json({ ok: true });
});

client.post('/messages', (req, res) => {
  const body = str(req.body.body, 5000);
  if (!body) return bad(res, 'Message is empty');
  db.prepare("INSERT INTO messages (client_id, author_role, body) VALUES (?, 'client', ?)").run(req.clientId, body);
  res.json({ ok: true });
});

app.use('/api/client', client);

app.use('/api', (_req, res) => bad(res, 'Not found', 404));

// ---------- static ----------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/portal', (_req, res) => res.redirect('/portal/login.html'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Royals Events Management running on http://localhost:${PORT}`));
