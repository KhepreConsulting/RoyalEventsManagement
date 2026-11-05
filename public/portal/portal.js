// Shared helpers for the client portal and planner dashboard
window.Portal = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(url, { method = 'GET', body } = {}) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.includes('/auth/login') && url !== '/api/me' && !/login(\.html)?$/.test(location.pathname)) { location.href = 'login.html'; throw new Error('Please sign in'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  const me = () => api('/api/me').catch(() => null);

  // Dates stored as YYYY-MM-DD or "YYYY-MM-DD HH:MM:SS" (UTC)
  function fmtDate(d) {
    if (!d) return '—';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d.replace(' ', 'T') + 'Z');
    return isNaN(date) ? d : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(d) {
    if (!d) return '';
    const date = new Date(d.replace(' ', 'T') + 'Z');
    return isNaN(date) ? d : date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }
  function daysUntil(d) {
    if (!d) return null;
    const t = new Date(d + 'T00:00:00'); const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((t - now) / 86400000);
  }
  const isOverdue = (r) => r.status === 'open' && r.due_date && daysUntil(r.due_date) < 0;

  function toast(text, err) {
    const t = document.getElementById('toast');
    t.textContent = text; t.className = `toast show${err ? ' err' : ''}`;
    clearTimeout(t._h); t._h = setTimeout(() => (t.className = 'toast'), 2800);
  }

  function statusBadge(r) {
    if (isOverdue(r)) return '<span class="badge overdue">Overdue</span>';
    const label = { open: 'To do', submitted: 'Submitted', done: 'Approved' }[r.status] || r.status;
    return `<span class="badge ${esc(r.status)}">${esc(label)}</span>`;
  }

  function renderAnswer(r) {
    if (!r.response) return '';
    const val = r.field_type === 'link'
      ? `<a href="${esc(r.response)}" target="_blank" rel="noopener noreferrer">${esc(r.response)}</a>`
      : r.field_type === 'date' ? esc(fmtDate(r.response)) : esc(r.response);
    return `<div class="answer">${val}<small>Submitted ${esc(fmtDateTime(r.responded_at))}</small></div>`;
  }

  function addSignOut(name) {
    const nav = document.getElementById('nav-actions');
    nav.innerHTML = `<span class="muted nav-user" style="font-size:.9rem">${esc(name)}</span>
      <button class="btn ghost small" id="pw-btn" type="button">Password</button>
      <button class="btn small" id="logout-btn" type="button">Sign out</button>`;
    document.getElementById('logout-btn').onclick = async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); location.href = 'login.html'; };
    document.getElementById('pw-btn').onclick = async () => {
      const current = prompt('Current password');
      if (!current) return;
      const next = prompt('New password (at least 8 characters)');
      if (!next) return;
      try { await api('/api/me/password', { method: 'POST', body: { current, next } }); toast('Password updated'); }
      catch (e) { toast(e.message, true); }
    };
  }

  return { esc, api, me, fmtDate, fmtDateTime, daysUntil, isOverdue, toast, statusBadge, renderAnswer, addSignOut };
})();
