/*
 * DEMO MODE — a pretend backend that runs entirely in the browser.
 *
 * Turns on automatically on GitHub Pages (*.github.io), or anywhere with ?demo in the URL
 * (turn off again with ?demo=off). When the real Node server is running this file does nothing.
 *
 * It intercepts fetch('/api/...') calls and answers them from data saved in localStorage,
 * so the whole site and portal can be clicked through without a server. Data lives only in
 * the visitor's browser: it is NOT shared between people and NOT private. Use for testing only.
 */
(() => {
  const FLAG = 'rem_demo';
  const KEY = 'rem_demo_db_v1';
  const params = new URLSearchParams(location.search);
  try {
    if (params.get('demo') === 'off') localStorage.removeItem(FLAG);
    else if (params.has('demo')) localStorage.setItem(FLAG, '1');
  } catch {}
  let flagged = false;
  try { flagged = localStorage.getItem(FLAG) === '1'; } catch {}
  if (!location.hostname.endsWith('github.io') && !flagged) return;

  const SITE_URL = new URL('content/site.json', document.currentScript.src).href;
  const DEMO_PASSWORD = 'demo1234';
  const FIELD_TYPES = ['text', 'longtext', 'number', 'date', 'select', 'yesno', 'link'];
  const CLIENT_STATUSES = ['inquiry', 'booked', 'planning', 'final-details', 'completed'];

  // ---------- storage ----------
  const pad = (n) => String(n).padStart(2, '0');
  const dayOffset = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  const nowStamp = (minsAgo = 0) => new Date(Date.now() - minsAgo * 60000).toISOString().slice(0, 19).replace('T', ' ');

  function seed() {
    const db = { seq: 100, users: [], clients: [], requests: [], messages: [], documents: [], timeline: [], inquiries: [], session: null };
    db.users.push({ id: 1, email: 'planner@demo.com', password: DEMO_PASSWORD, role: 'admin', name: 'Royals Events Team' });
    db.users.push({ id: 2, email: 'couple@demo.com', password: DEMO_PASSWORD, role: 'client', name: 'Priya & Arjun' });
    db.users.push({ id: 3, email: 'sarah@demo.com', password: DEMO_PASSWORD, role: 'client', name: 'Bravaen & Keerthi' });
    db.clients.push({ id: 1, user_id: 2, couple_names: 'Priya & Arjun', phone: '+1 555 010 2030', event_date: dayOffset(120), venue: 'The Grand Ballroom', guest_count: 250, package: 'Full Wedding Planning', budget: '$60,000', status: 'planning', internal_notes: 'Mehndi on Friday, ceremony Saturday. Groom\'s family prefers vegetarian menu.', created_at: nowStamp(60 * 24 * 30) });
    db.clients.push({ id: 2, user_id: 3, couple_names: 'Bravaen & Keerthi', phone: '', event_date: dayOffset(38), venue: 'Oshwall Centre', guest_count: 90, package: 'Day-of Coordination', budget: '', status: 'final-details', internal_notes: '', created_at: nowStamp(60 * 24 * 60) });
    const req = (client_id, title, field_type, extra = {}) => db.requests.push({ id: ++db.seq, client_id, title, field_type, description: null, options: null, due_date: null, response: null, responded_at: null, status: 'open', created_at: nowStamp(), ...extra });
    req(1, 'Final guest count', 'number', { due_date: dayOffset(30) });
    req(1, 'Colour palette & theme', 'longtext', { response: 'Deep maroon, gold and ivory. Traditional with a modern touch.', responded_at: nowStamp(600), status: 'submitted' });
    req(1, 'Menu choice', 'select', { options: JSON.stringify(['Classic Indian', 'Fusion', 'Vegetarian only']), due_date: dayOffset(14) });
    req(1, 'Inspiration / mood board', 'link', { description: 'A Pinterest board or folder of photos you love.', response: 'https://www.pinterest.com/', responded_at: nowStamp(3000), status: 'done' });
    req(1, 'Do you need guest transport?', 'yesno', { due_date: dayOffset(-3) });
    req(2, 'First dance song', 'text', { response: 'At Last — Etta James', responded_at: nowStamp(200), status: 'submitted' });
    req(2, 'Ceremony start time', 'text', { due_date: dayOffset(7) });
    const msg = (client_id, author_role, body, minsAgo) => db.messages.push({ id: ++db.seq, client_id, author_role, body, created_at: nowStamp(minsAgo) });
    msg(1, 'admin', 'Welcome to your portal! Everything we need from you will appear on the left.', 5000);
    msg(1, 'client', 'Thank you! We\'ve added our colour palette. Can we visit the venue next month?', 700);
    msg(1, 'admin', 'Absolutely — I\'ve added a walkthrough to your timeline.', 650);
    msg(2, 'admin', 'Only a few final details to go. You\'re nearly there!', 300);
    const tl = (client_id, title, d, done = 0) => db.timeline.push({ id: ++db.seq, client_id, title, due_date: dayOffset(d), done, created_at: nowStamp() });
    tl(1, 'Contract signed & deposit paid', -30, 1); tl(1, 'Venue walkthrough', 25); tl(1, 'Décor & mandap design review', 60); tl(1, 'Final payment due', 100);
    tl(2, 'Final vendor confirmations', 20); tl(2, 'Rehearsal', 37);
    const doc = (client_id, title, url) => db.documents.push({ id: ++db.seq, client_id, title, url, created_at: nowStamp(2000) });
    doc(1, 'Signed contract', 'https://example.com/contract.pdf'); doc(1, 'Mood board', 'https://example.com/moodboard');
    db.inquiries.push({ id: ++db.seq, name: 'Lena & Theo', email: 'lena@example.com', phone: '+1 555 222 3344', event_date: dayOffset(240), guest_count: '150', service: 'Full Wedding Planning', message: 'Garden ceremony, sage & gold colours. Would love a consultation!', status: 'new', created_at: nowStamp(90) });
    db.inquiries.push({ id: ++db.seq, name: 'Aisha Khan', email: 'aisha@example.com', phone: '', event_date: dayOffset(300), guest_count: '300', service: 'Multi-day & Cultural Ceremonies', message: 'Three events over a weekend.', status: 'contacted', created_at: nowStamp(60 * 24 * 3) });
    return db;
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  save();

  let sitePromise;
  const site = () => (sitePromise ||= realFetch(SITE_URL).then((r) => r.json()));

  // ---------- helpers (mirror server.js) ----------
  class HttpError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
  const str = (v, max = 2000) => (v === undefined || v === null ? null : String(v).trim().slice(0, max) || null);
  const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
  const safeUrl = (u) => { try { const p = new URL(u); return ['http:', 'https:'].includes(p.protocol) ? p.href : null; } catch { return null; } };
  const randomPw = () => Math.random().toString(36).slice(2, 10);
  const byId = (list, id) => list.find((x) => String(x.id) === String(id));
  const currentUser = () => db.users.find((u) => u.id === db.session) || null;
  const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role, name: u.name });

  function requireRole(role) {
    const u = currentUser();
    if (!u) throw new HttpError('Please sign in', 401);
    if (u.role !== role) throw new HttpError('Not allowed', 403);
    return u;
  }

  function bundle(clientId) {
    const c = byId(db.clients, clientId);
    if (!c) return null;
    const u = byId(db.users, c.user_id);
    const of = (list) => list.filter((x) => x.client_id === c.id);
    const statusRank = (r) => (r.status === 'done' ? 1 : 0);
    return {
      client: { ...c, email: u.email, user_name: u.name },
      requests: of(db.requests).sort((a, b) => statusRank(a) - statusRank(b) || (!a.due_date - !b.due_date) || String(a.due_date).localeCompare(String(b.due_date)) || b.id - a.id),
      messages: of(db.messages).sort((a, b) => a.id - b.id),
      documents: of(db.documents).sort((a, b) => b.id - a.id),
      timeline: of(db.timeline).sort((a, b) => (!a.due_date - !b.due_date) || String(a.due_date).localeCompare(String(b.due_date)) || a.id - b.id),
    };
  }

  function removeClient(c) {
    const keep = (list) => list.filter((x) => x.client_id !== c.id);
    db.requests = keep(db.requests); db.messages = keep(db.messages); db.documents = keep(db.documents); db.timeline = keep(db.timeline);
    db.clients = db.clients.filter((x) => x.id !== c.id);
    db.users = db.users.filter((u) => u.id !== c.user_id);
  }

  // ---------- routes ----------
  const routes = [];
  const on = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:\w+/g, '([^/]+)')}$`), fn });

  on('GET', '/api/site', () => site());
  on('POST', '/api/inquiries', (b) => {
    if (str(b.website)) return { ok: true };
    const name = str(b.name, 200); const email = str(b.email, 200);
    if (!name) throw new HttpError('Please tell us your name');
    if (!isEmail(email)) throw new HttpError('Please enter a valid email');
    db.inquiries.unshift({ id: ++db.seq, name, email, phone: str(b.phone, 50), event_date: str(b.event_date, 20), guest_count: str(b.guest_count, 20), service: str(b.service, 100), message: str(b.message, 5000), status: 'new', created_at: nowStamp() });
    return { ok: true };
  });

  on('POST', '/api/auth/login', (b) => {
    const u = db.users.find((x) => x.email.toLowerCase() === String(b.email || '').trim().toLowerCase());
    if (!u || u.password !== String(b.password || '')) throw new HttpError('Email or password is incorrect', 401);
    db.session = u.id;
    return { role: u.role, name: u.name };
  });
  on('POST', '/api/auth/logout', () => { db.session = null; return { ok: true }; });
  on('GET', '/api/me', () => { const u = currentUser(); if (!u) throw new HttpError('Not signed in', 401); return publicUser(u); });
  on('POST', '/api/me/password', (b) => {
    const u = currentUser(); if (!u) throw new HttpError('Please sign in', 401);
    if (u.password !== String(b.current || '')) throw new HttpError('Current password is incorrect');
    if (String(b.next || '').length < 8) throw new HttpError('New password must be at least 8 characters');
    u.password = String(b.next); return { ok: true };
  });

  // admin
  on('GET', '/api/admin/dashboard', () => {
    requireRole('admin');
    const clients = db.clients.map((c) => ({
      id: c.id, couple_names: c.couple_names, event_date: c.event_date, venue: c.venue, status: c.status, email: byId(db.users, c.user_id).email,
      open_requests: db.requests.filter((r) => r.client_id === c.id && r.status === 'open').length,
      submitted_requests: db.requests.filter((r) => r.client_id === c.id && r.status === 'submitted').length,
    })).sort((a, b) => (!a.event_date - !b.event_date) || String(a.event_date).localeCompare(String(b.event_date)));
    return { clients, inquiries: [...db.inquiries].sort((a, b) => b.id - a.id), statuses: CLIENT_STATUSES, fieldTypes: FIELD_TYPES };
  });
  on('PATCH', '/api/admin/inquiries/:id', (b, id) => {
    requireRole('admin');
    if (!['new', 'contacted', 'booked', 'archived'].includes(b.status)) throw new HttpError('Invalid status');
    const i = byId(db.inquiries, id); if (i) i.status = b.status; return { ok: true };
  });
  on('POST', '/api/admin/clients', (b) => {
    requireRole('admin');
    const email = str(b.email, 200); const couple = str(b.couple_names, 200);
    if (!couple) throw new HttpError('Couple names are required');
    if (!isEmail(email)) throw new HttpError('A valid email is required');
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new HttpError('That email already has an account');
    const password = str(b.password, 200) || randomPw();
    if (b.password && password.length < 8) throw new HttpError('Password must be at least 8 characters');
    const user = { id: ++db.seq, email, password, role: 'client', name: couple };
    db.users.push(user);
    const client = { id: ++db.seq, user_id: user.id, couple_names: couple, phone: str(b.phone, 50), event_date: str(b.event_date, 20), venue: str(b.venue, 300), guest_count: Number(b.guest_count) || null, package: str(b.package, 200), budget: str(b.budget, 100), status: CLIENT_STATUSES.includes(b.status) ? b.status : 'planning', internal_notes: null, created_at: nowStamp() };
    db.clients.push(client);
    if (b.inquiry_id) { const i = byId(db.inquiries, b.inquiry_id); if (i) i.status = 'booked'; }
    return { id: client.id, password };
  });
  on('GET', '/api/admin/clients/:id', (_b, id) => { requireRole('admin'); const out = bundle(id); if (!out) throw new HttpError('Client not found', 404); return out; });
  on('PATCH', '/api/admin/clients/:id', (b, id) => {
    requireRole('admin');
    const c = byId(db.clients, id); if (!c) throw new HttpError('Client not found', 404);
    const fields = ['couple_names', 'phone', 'event_date', 'venue', 'guest_count', 'package', 'budget', 'status', 'internal_notes'];
    const next = { ...c };
    for (const f of fields) if (f in b) next[f] = f === 'guest_count' ? (Number(b[f]) || null) : str(b[f], f === 'internal_notes' ? 10000 : 300);
    if (!CLIENT_STATUSES.includes(next.status)) next.status = c.status;
    if (!next.couple_names) throw new HttpError('Couple names are required');
    const u = byId(db.users, c.user_id);
    if (b.email && isEmail(b.email)) {
      if (db.users.some((x) => x.id !== u.id && x.email.toLowerCase() === String(b.email).toLowerCase())) throw new HttpError('That email is used by another account');
      u.email = String(b.email).trim();
    }
    if (b.new_password) {
      if (String(b.new_password).length < 8) throw new HttpError('Password must be at least 8 characters');
      u.password = String(b.new_password);
    }
    Object.assign(c, next); u.name = c.couple_names;
    return { ok: true };
  });
  on('DELETE', '/api/admin/clients/:id', (_b, id) => { requireRole('admin'); const c = byId(db.clients, id); if (!c) throw new HttpError('Client not found', 404); removeClient(c); return { ok: true }; });
  on('POST', '/api/admin/clients/:id/requests', (b, id) => {
    requireRole('admin');
    const title = str(b.title, 300); if (!title) throw new HttpError('A title is required');
    const type = FIELD_TYPES.includes(b.field_type) ? b.field_type : 'text';
    const options = type === 'select' ? (Array.isArray(b.options) ? b.options : String(b.options || '').split(',')).map((o) => String(o).trim()).filter(Boolean) : null;
    if (type === 'select' && !options.length) throw new HttpError('Add at least one option for a choice question');
    db.requests.push({ id: ++db.seq, client_id: Number(id), title, description: str(b.description, 3000), field_type: type, options: options ? JSON.stringify(options) : null, due_date: str(b.due_date, 20), response: null, responded_at: null, status: 'open', created_at: nowStamp() });
    return { ok: true };
  });
  on('PATCH', '/api/admin/requests/:id', (b, id) => {
    requireRole('admin');
    if (!['open', 'submitted', 'done'].includes(b.status)) throw new HttpError('Invalid status');
    const r = byId(db.requests, id); if (r) r.status = b.status; return { ok: true };
  });
  const del = (listName) => (_b, id) => { requireRole('admin'); db[listName] = db[listName].filter((x) => String(x.id) !== String(id)); return { ok: true }; };
  on('DELETE', '/api/admin/requests/:id', del('requests'));
  on('POST', '/api/admin/clients/:id/documents', (b, id) => {
    requireRole('admin');
    const title = str(b.title, 300); const url = safeUrl(str(b.url, 2000));
    if (!title || !url) throw new HttpError('A title and a valid http(s) link are required');
    db.documents.push({ id: ++db.seq, client_id: Number(id), title, url, created_at: nowStamp() }); return { ok: true };
  });
  on('DELETE', '/api/admin/documents/:id', del('documents'));
  on('POST', '/api/admin/clients/:id/timeline', (b, id) => {
    requireRole('admin');
    const title = str(b.title, 300); if (!title) throw new HttpError('A title is required');
    db.timeline.push({ id: ++db.seq, client_id: Number(id), title, due_date: str(b.due_date, 20), done: 0, created_at: nowStamp() }); return { ok: true };
  });
  on('PATCH', '/api/admin/timeline/:id', (b, id) => { requireRole('admin'); const t = byId(db.timeline, id); if (t) t.done = b.done ? 1 : 0; return { ok: true }; });
  on('DELETE', '/api/admin/timeline/:id', del('timeline'));
  on('POST', '/api/admin/clients/:id/messages', (b, id) => {
    requireRole('admin');
    const body = str(b.body, 5000); if (!body) throw new HttpError('Message is empty');
    db.messages.push({ id: ++db.seq, client_id: Number(id), author_role: 'admin', body, created_at: nowStamp() }); return { ok: true };
  });

  // client
  const myClient = () => {
    const u = requireRole('client');
    const c = db.clients.find((x) => x.user_id === u.id);
    if (!c) throw new HttpError('No event linked to this account', 404);
    return c;
  };
  on('GET', '/api/client/overview', async () => {
    const c = myClient(); const out = bundle(c.id);
    delete out.client.internal_notes;
    return { ...out, contact: (await site()).contact };
  });
  on('POST', '/api/client/requests/:id', (b, id) => {
    const c = myClient();
    const r = db.requests.find((x) => String(x.id) === String(id) && x.client_id === c.id);
    if (!r) throw new HttpError('Request not found', 404);
    if (r.status === 'done') throw new HttpError('This item has been finalised — message us if something needs to change');
    let response = str(b.response, 10000);
    if (!response) throw new HttpError('Please fill in an answer');
    if (r.field_type === 'number' && Number.isNaN(Number(response))) throw new HttpError('Please enter a number');
    if (r.field_type === 'select' && !JSON.parse(r.options || '[]').includes(response)) throw new HttpError('Please choose one of the options');
    if (r.field_type === 'yesno' && !['Yes', 'No'].includes(response)) throw new HttpError('Please choose Yes or No');
    if (r.field_type === 'link') { response = safeUrl(response); if (!response) throw new HttpError('Please enter a valid link starting with https://'); }
    Object.assign(r, { response, responded_at: nowStamp(), status: 'submitted' });
    return { ok: true };
  });
  on('POST', '/api/client/messages', (b) => {
    const c = myClient();
    const body = str(b.body, 5000); if (!body) throw new HttpError('Message is empty');
    db.messages.push({ id: ++db.seq, client_id: c.id, author_role: 'client', body, created_at: nowStamp() }); return { ok: true };
  });

  // ---------- fetch interception ----------
  const realFetch = window.fetch.bind(window);
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const at = url.pathname.indexOf('/api/');
    if (at === -1) return realFetch(input, init);
    const path = url.pathname.slice(at);
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch {}
    for (const r of routes) {
      const m = r.method === method && path.match(r.re);
      if (!m) continue;
      try {
        const out = await r.fn(body, ...m.slice(1).map(decodeURIComponent));
        save();
        return json(out);
      } catch (err) {
        return json({ error: err.message || 'Something went wrong' }, err.status || 500);
      }
    }
    return json({ error: 'Not found' }, 404);
  };

  // ---------- demo UI ----------
  window.REM_DEMO = true;
  function addBanner() {
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#96630a;color:#fff;font:500 13px/1.4 Jost,system-ui,sans-serif;text-align:center;padding:7px 16px;';
    bar.innerHTML = '<b>Demo mode</b> — no server; data is saved only in this browser. <button type="button" style="margin-left:8px;background:#fff;color:#2a1e12;border:0;border-radius:999px;padding:2px 10px;font:inherit;cursor:pointer">Reset demo data</button>';
    bar.querySelector('button').onclick = () => {
      if (!confirm('Reset all demo data back to the sample couples?')) return;
      try { localStorage.removeItem(KEY); } catch {}
      location.reload();
    };
    document.body.prepend(bar);

    const form = document.getElementById('login-form');
    if (form) {
      const box = document.createElement('div');
      box.style.cssText = 'background:#fbf0d9;border-radius:10px;padding:12px 14px;font-size:.9rem;display:grid;gap:8px';
      box.innerHTML = '<span><b>Demo logins</b> (password <code>demo1234</code>)</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn small" data-demo="planner@demo.com">Sign in as planner</button><button type="button" class="btn ghost small" data-demo="couple@demo.com">Sign in as couple</button></div>';
      box.querySelectorAll('[data-demo]').forEach((b) => (b.onclick = () => {
        form.email.value = b.dataset.demo; form.password.value = DEMO_PASSWORD; form.requestSubmit();
      }));
      form.insertBefore(box, form.querySelector('label'));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBanner); else addBanner();
})();
