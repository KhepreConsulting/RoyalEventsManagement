(async () => {
  const { esc, api, me, fmtDate, fmtDateTime, daysUntil, isOverdue, toast, statusBadge, renderAnswer, addSignOut } = Portal;
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  const user = await me();
  if (!user) return (location.href = '/portal/login');
  if (user.role !== 'admin') return (location.href = '/portal/client');
  addSignOut(user.name);

  let meta = { statuses: [], fieldTypes: [] };
  let tab = 'clients';
  const TYPE_LABELS = { text: 'Short answer', longtext: 'Long answer', number: 'Number', date: 'Date', select: 'Multiple choice', yesno: 'Yes / No', link: 'Link (e.g. Google Drive, Pinterest)' };

  // Ready-made requests planners send to most couples
  const TEMPLATES = [
    { title: 'Final guest count', field_type: 'number' },
    { title: 'Guest list (link to spreadsheet)', field_type: 'link', description: 'Share a Google Sheet or similar with names, emails and meal choices.' },
    { title: 'Colour palette & theme', field_type: 'longtext' },
    { title: 'Inspiration / mood board', field_type: 'link', description: 'A Pinterest board or folder of photos you love.' },
    { title: 'Ceremony start time', field_type: 'text' },
    { title: 'Dietary requirements', field_type: 'longtext' },
    { title: 'First dance song', field_type: 'text' },
    { title: 'Bridal party names & roles', field_type: 'longtext' },
    { title: 'Menu choice', field_type: 'select', options: 'Option A, Option B, Option C' },
    { title: 'Do you need guest transport?', field_type: 'yesno' },
  ];

  const openModal = (html) => { modalBody.innerHTML = html; modal.classList.add('show'); modalBody.querySelector('input,select,textarea')?.focus(); };
  const closeModal = () => modal.classList.remove('show');
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.dataset.close !== undefined) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  const statusOptions = (cur) => meta.statuses.map((s) => `<option value="${s}" ${s === cur ? 'selected' : ''}>${s.replace('-', ' ')}</option>`).join('');

  // ---------- Dashboard ----------
  async function renderDashboard() {
    const data = await api('/api/admin/dashboard');
    meta = data;
    const { clients, inquiries } = data;
    const newInq = inquiries.filter((i) => i.status === 'new').length;
    const toReview = clients.reduce((n, c) => n + c.submitted_requests, 0);
    const upcoming = clients.filter((c) => { const d = daysUntil(c.event_date); return d !== null && d >= 0 && d <= 60; }).length;

    app.innerHTML = `
      <div class="portal-head">
        <div><span class="eyebrow">Planner Dashboard</span><h1>Good to see you</h1></div>
        <button class="btn" id="new-client">+ New client</button>
      </div>
      <div class="stats">
        <div class="stat"><b>${clients.length}</b><span>Clients</span></div>
        <div class="stat"><b>${upcoming}</b><span>Weddings in 60 days</span></div>
        <div class="stat"><b>${toReview}</b><span>Answers to review</span></div>
        <div class="stat"><b>${newInq}</b><span>New enquiries</span></div>
      </div>
      <div class="tabs">
        <button class="tab ${tab === 'clients' ? 'active' : ''}" data-tab="clients">Clients</button>
        <button class="tab ${tab === 'inquiries' ? 'active' : ''}" data-tab="inquiries">Website enquiries ${newInq ? `(${newInq})` : ''}</button>
      </div>
      <section class="panel ${tab === 'clients' ? '' : 'hidden'}">
        ${clients.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Couple</th><th>Wedding date</th><th>Venue</th><th>Status</th><th>Waiting on client</th><th>To review</th></tr></thead>
          <tbody>${clients.map((c) => `
            <tr class="clickable" data-client="${c.id}">
              <td><b>${esc(c.couple_names)}</b><br><small class="muted">${esc(c.email)}</small></td>
              <td>${esc(fmtDate(c.event_date))}${c.event_date && daysUntil(c.event_date) >= 0 ? `<br><small class="muted">${daysUntil(c.event_date)} days</small>` : ''}</td>
              <td>${esc(c.venue || '—')}</td>
              <td><span class="badge ${esc(c.status)}">${esc(c.status.replace('-', ' '))}</span></td>
              <td>${c.open_requests}</td>
              <td>${c.submitted_requests ? `<span class="badge submitted">${c.submitted_requests}</span>` : '0'}</td>
            </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No clients yet. Add your first couple with “New client”, or convert a website enquiry.</p>'}
      </section>
      <section class="panel ${tab === 'inquiries' ? '' : 'hidden'}">
        ${inquiries.length ? inquiries.map((i) => `
          <div class="req">
            <div class="req-head"><h3>${esc(i.name)}</h3><span class="badge ${esc(i.status)}">${esc(i.status)}</span></div>
            <div class="desc">
              <a href="mailto:${esc(i.email)}">${esc(i.email)}</a>${i.phone ? ` · ${esc(i.phone)}` : ''} · received ${esc(fmtDateTime(i.created_at))}<br>
              Date: ${esc(fmtDate(i.event_date))} · Guests: ${esc(i.guest_count || '—')} · ${esc(i.service || 'No service chosen')}
            </div>
            ${i.message ? `<div class="answer">${esc(i.message)}</div>` : ''}
            <div class="actions">
              <select data-inq-status="${i.id}" style="width:auto">${['new', 'contacted', 'booked', 'archived'].map((s) => `<option ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
              ${i.status !== 'booked' ? `<button class="btn small" data-convert="${i.id}">Create client portal</button>` : ''}
            </div>
          </div>`).join('') : '<p class="empty">No enquiries yet. Submissions from the website contact form will appear here.</p>'}
      </section>`;

    document.getElementById('new-client').onclick = () => clientModal();
    app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderDashboard(); }));
    app.querySelectorAll('[data-client]').forEach((r) => (r.onclick = () => (location.hash = `client/${r.dataset.client}`)));
    app.querySelectorAll('[data-inq-status]').forEach((s) => (s.onchange = async () => {
      await api(`/api/admin/inquiries/${s.dataset.inqStatus}`, { method: 'PATCH', body: { status: s.value } });
      toast('Enquiry updated'); renderDashboard();
    }));
    app.querySelectorAll('[data-convert]').forEach((b) => (b.onclick = () => {
      const i = inquiries.find((x) => String(x.id) === b.dataset.convert);
      clientModal({ couple_names: i.name, email: i.email, phone: i.phone, event_date: i.event_date, guest_count: i.guest_count, package: i.service, inquiry_id: i.id });
    }));
  }

  function clientModal(prefill = {}) {
    const v = (k) => esc(prefill[k] ?? '');
    openModal(`
      <h2>New client</h2>
      <p class="muted">This creates their private portal login.</p>
      <form class="form" id="client-form">
        <label>Couple names *<input name="couple_names" required value="${v('couple_names')}" placeholder="Priya & Arjun"></label>
        <div class="row">
          <label>Login email *<input name="email" type="email" required value="${v('email')}"></label>
          <label>Phone<input name="phone" value="${v('phone')}"></label>
        </div>
        <div class="row">
          <label>Wedding date<input name="event_date" type="date" value="${v('event_date')}"></label>
          <label>Guests<input name="guest_count" type="number" min="0" value="${v('guest_count')}"></label>
        </div>
        <label>Venue<input name="venue" value="${v('venue')}"></label>
        <div class="row">
          <label>Package<input name="package" value="${v('package')}" placeholder="Full Wedding Planning"></label>
          <label>Status<select name="status">${statusOptions('booked')}</select></label>
        </div>
        <label>Temporary password <small class="muted">(leave blank to auto-generate)</small><input name="password" minlength="8"></label>
        <label style="flex-direction:row;display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" name="starter" checked style="width:auto"> Add starter checklist of common requests</label>
        <div class="actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Create client</button></div>
      </form>`);
    document.getElementById('client-form').onsubmit = async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target));
      if (prefill.inquiry_id) body.inquiry_id = prefill.inquiry_id;
      try {
        const out = await api('/api/admin/clients', { method: 'POST', body });
        if (body.starter) {
          for (const t of TEMPLATES.slice(0, 6)) await api(`/api/admin/clients/${out.id}/requests`, { method: 'POST', body: t });
        }
        openModal(`
          <h2>Portal created ✓</h2>
          <p>Send these sign-in details to <b>${esc(body.couple_names)}</b>:</p>
          <div class="answer" style="background:var(--ivory)" id="creds">Sign in at: ${esc(location.origin)}/portal/login
Email: ${esc(body.email)}
Password: ${esc(out.password)}</div>
          <p class="muted" style="font-size:.9rem;margin-top:10px">They can change their password after signing in. This password won't be shown again.</p>
          <div class="actions"><button class="btn ghost" id="copy-creds">Copy</button><button class="btn" id="go-client">Open client</button></div>`);
        document.getElementById('copy-creds').onclick = () => navigator.clipboard.writeText(document.getElementById('creds').textContent).then(() => toast('Copied'));
        document.getElementById('go-client').onclick = () => { closeModal(); location.hash = `client/${out.id}`; };
      } catch (err) { toast(err.message, true); }
    };
  }

  // ---------- Client detail ----------
  async function renderClient(id) {
    if (!meta.statuses.length) meta = await api('/api/admin/dashboard');
    const { client: c, requests, messages, documents, timeline } = await api(`/api/admin/clients/${id}`);
    const open = requests.filter((r) => r.status === 'open').length;
    const submitted = requests.filter((r) => r.status === 'submitted').length;
    const days = daysUntil(c.event_date);

    app.innerHTML = `
      <button class="back-link" onclick="location.hash=''">← All clients</button>
      <div class="portal-head">
        <div><span class="eyebrow">Client</span><h1>${esc(c.couple_names)}</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost small" id="edit-client">Edit details</button>
          <button class="btn ghost small" id="reset-pw">Reset password</button>
        </div>
      </div>
      <div class="stats">
        <div class="stat countdown"><b>${days === null ? '—' : days >= 0 ? days : '✓'}</b><span>${days === null ? 'Date TBC' : days >= 0 ? 'Days to go' : 'Wedding complete'}</span></div>
        <div class="stat"><b>${open}</b><span>Waiting on couple</span></div>
        <div class="stat"><b>${submitted}</b><span>To review</span></div>
        <div class="stat"><b>${messages.length}</b><span>Messages</span></div>
      </div>

      <div class="layout-2">
        <div>
          <section class="panel">
            <h2>Requests for the couple <button class="btn small" id="new-request">+ Request info</button></h2>
            ${requests.length ? requests.map((r) => `
              <div class="req">
                <div class="req-head"><h3>${esc(r.title)}</h3><div style="display:flex;gap:8px;align-items:center">
                  ${r.due_date ? `<span class="muted" style="font-size:.85rem">Due ${esc(fmtDate(r.due_date))}</span>` : ''}${statusBadge(r)}</div></div>
                <div class="desc">${esc(TYPE_LABELS[r.field_type] || r.field_type)}${r.options ? ': ' + esc(JSON.parse(r.options).join(', ')) : ''}${r.description ? ' — ' + esc(r.description) : ''}</div>
                ${renderAnswer(r) || '<p class="empty" style="margin:0">Not answered yet</p>'}
                <div class="actions">
                  ${r.status === 'submitted' ? `<button class="btn small" data-req-status="done" data-id="${r.id}">Approve</button><button class="btn ghost small" data-req-status="open" data-id="${r.id}">Ask to redo</button>` : ''}
                  ${r.status === 'done' ? `<button class="btn ghost small" data-req-status="open" data-id="${r.id}">Re-open</button>` : ''}
                  <button class="btn danger small" data-del-req="${r.id}">Delete</button>
                </div>
              </div>`).join('') : '<p class="empty">No requests yet. Ask the couple for guest counts, song choices, inspiration and more.</p>'}
          </section>

          <section class="panel">
            <h2>Messages</h2>
            <div class="thread" id="thread">
              ${messages.length ? messages.map((m) => `<div class="msg ${m.author_role === 'admin' ? 'me' : 'them'}">${esc(m.body)}<small>${m.author_role === 'admin' ? 'Royal Events' : esc(c.couple_names)} · ${esc(fmtDateTime(m.created_at))}</small></div>`).join('') : '<p class="empty">No messages yet.</p>'}
            </div>
            <form id="msg-form" class="form"><textarea name="body" placeholder="Message ${esc(c.couple_names)}…" style="min-height:80px" required></textarea><div><button class="btn small">Send</button></div></form>
          </section>
        </div>

        <aside>
          <section class="panel">
            <h2>Event details</h2>
            <dl class="details">
              <dt>Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd>
              <dt>Phone</dt><dd>${esc(c.phone || '—')}</dd>
              <dt>Date</dt><dd>${esc(fmtDate(c.event_date))}</dd>
              <dt>Venue</dt><dd>${esc(c.venue || '—')}</dd>
              <dt>Guests</dt><dd>${esc(c.guest_count ?? '—')}</dd>
              <dt>Package</dt><dd>${esc(c.package || '—')}</dd>
              <dt>Budget</dt><dd>${esc(c.budget || '—')}</dd>
              <dt>Status</dt><dd><select id="status-select" style="padding:.3em .6em">${statusOptions(c.status)}</select></dd>
            </dl>
          </section>

          <section class="panel">
            <h2>Private notes <span class="count">staff only</span></h2>
            <textarea id="notes" placeholder="Notes the couple can't see…">${esc(c.internal_notes || '')}</textarea>
            <div style="margin-top:8px"><button class="btn ghost small" id="save-notes">Save notes</button></div>
          </section>

          <section class="panel">
            <h2>Timeline</h2>
            ${timeline.length ? `<ul class="list">${timeline.map((t) => `<li>
              <label class="check"><input type="checkbox" data-tl="${t.id}" ${t.done ? 'checked' : ''}><span class="${t.done ? 'done-item' : ''}">${esc(t.title)}</span></label>
              <span style="display:flex;gap:8px;align-items:center"><small>${esc(fmtDate(t.due_date))}</small><button class="btn danger small" data-del-tl="${t.id}" aria-label="Delete">×</button></span></li>`).join('')}</ul>` : '<p class="empty">No milestones yet.</p>'}
            <form class="inline-form" id="tl-form">
              <input name="title" placeholder="e.g. Final venue walkthrough" required>
              <div class="row"><input name="due_date" type="date"><button class="btn small">Add milestone</button></div>
            </form>
          </section>

          <section class="panel">
            <h2>Documents</h2>
            ${documents.length ? `<ul class="list">${documents.map((d) => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)}</a><button class="btn danger small" data-del-doc="${d.id}" aria-label="Delete">×</button></li>`).join('')}</ul>` : '<p class="empty">Share contracts, invoices, mood boards and run-sheets by link.</p>'}
            <form class="inline-form" id="doc-form">
              <input name="title" placeholder="e.g. Signed contract" required>
              <input name="url" type="url" placeholder="https://drive.google.com/…" required>
              <div><button class="btn small">Share document</button></div>
            </form>
          </section>

          <button class="btn danger small" id="delete-client">Delete client & portal</button>
        </aside>
      </div>`;

    const thread = document.getElementById('thread');
    thread.scrollTop = thread.scrollHeight;
    const reload = () => renderClient(id);
    const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); reload(); } catch (e) { toast(e.message, true); } };
    const formBody = (f) => Object.fromEntries(new FormData(f));

    document.getElementById('new-request').onclick = () => requestModal(id);
    document.getElementById('edit-client').onclick = () => editModal(c);
    document.getElementById('reset-pw').onclick = () => {
      const pw = prompt(`New password for ${c.couple_names} (at least 8 characters)`);
      if (pw) act(() => api(`/api/admin/clients/${id}`, { method: 'PATCH', body: { new_password: pw } }), 'Password reset — share it with the couple');
    };
    document.getElementById('status-select').onchange = (e) => act(() => api(`/api/admin/clients/${id}`, { method: 'PATCH', body: { status: e.target.value } }), 'Status updated');
    document.getElementById('save-notes').onclick = () => act(() => api(`/api/admin/clients/${id}`, { method: 'PATCH', body: { internal_notes: document.getElementById('notes').value } }), 'Notes saved');
    document.getElementById('msg-form').onsubmit = (e) => { e.preventDefault(); act(() => api(`/api/admin/clients/${id}/messages`, { method: 'POST', body: formBody(e.target) }), 'Message sent'); };
    document.getElementById('tl-form').onsubmit = (e) => { e.preventDefault(); act(() => api(`/api/admin/clients/${id}/timeline`, { method: 'POST', body: formBody(e.target) })); };
    document.getElementById('doc-form').onsubmit = (e) => { e.preventDefault(); act(() => api(`/api/admin/clients/${id}/documents`, { method: 'POST', body: formBody(e.target) }), 'Document shared'); };
    document.getElementById('delete-client').onclick = async () => {
      if (!confirm(`Delete ${c.couple_names} and their portal? This cannot be undone.`)) return;
      await api(`/api/admin/clients/${id}`, { method: 'DELETE' }); toast('Client deleted'); location.hash = '';
    };
    app.querySelectorAll('[data-req-status]').forEach((b) => (b.onclick = () => act(() => api(`/api/admin/requests/${b.dataset.id}`, { method: 'PATCH', body: { status: b.dataset.reqStatus } }))));
    app.querySelectorAll('[data-del-req]').forEach((b) => (b.onclick = () => confirm('Delete this request?') && act(() => api(`/api/admin/requests/${b.dataset.delReq}`, { method: 'DELETE' }))));
    app.querySelectorAll('[data-tl]').forEach((b) => (b.onchange = () => act(() => api(`/api/admin/timeline/${b.dataset.tl}`, { method: 'PATCH', body: { done: b.checked } }))));
    app.querySelectorAll('[data-del-tl]').forEach((b) => (b.onclick = () => act(() => api(`/api/admin/timeline/${b.dataset.delTl}`, { method: 'DELETE' }))));
    app.querySelectorAll('[data-del-doc]').forEach((b) => (b.onclick = () => confirm('Remove this document?') && act(() => api(`/api/admin/documents/${b.dataset.delDoc}`, { method: 'DELETE' }))));
  }

  function requestModal(clientId) {
    openModal(`
      <h2>Request information</h2>
      <p class="muted">The couple will see this in their portal and can fill it in.</p>
      <form class="form" id="req-form">
        <label>Quick start
          <select id="tpl"><option value="">Custom request…</option>${TEMPLATES.map((t, i) => `<option value="${i}">${esc(t.title)}</option>`).join('')}</select>
        </label>
        <label>What do you need? *<input name="title" required></label>
        <label>Instructions<textarea name="description" style="min-height:70px"></textarea></label>
        <div class="row">
          <label>Answer type<select name="field_type">${meta.fieldTypes.map((t) => `<option value="${t}">${esc(TYPE_LABELS[t] || t)}</option>`).join('')}</select></label>
          <label>Due date<input name="due_date" type="date"></label>
        </div>
        <label id="opts-wrap" class="hidden">Choices (comma separated)<input name="options" placeholder="Chicken, Fish, Vegetarian"></label>
        <div class="actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Send request</button></div>
      </form>`);
    const f = document.getElementById('req-form');
    const syncOpts = () => document.getElementById('opts-wrap').classList.toggle('hidden', f.field_type.value !== 'select');
    f.field_type.onchange = syncOpts;
    document.getElementById('tpl').onchange = (e) => {
      const t = TEMPLATES[e.target.value]; if (!t) return;
      f.title.value = t.title; f.description.value = t.description || ''; f.field_type.value = t.field_type; f.options.value = t.options || ''; syncOpts();
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api(`/api/admin/clients/${clientId}/requests`, { method: 'POST', body: Object.fromEntries(new FormData(f)) }); closeModal(); toast('Request sent'); renderClient(clientId); }
      catch (err) { toast(err.message, true); }
    };
  }

  function editModal(c) {
    const v = (k) => esc(c[k] ?? '');
    openModal(`
      <h2>Edit details</h2>
      <form class="form" id="edit-form">
        <label>Couple names *<input name="couple_names" required value="${v('couple_names')}"></label>
        <div class="row"><label>Login email<input name="email" type="email" value="${v('email')}"></label><label>Phone<input name="phone" value="${v('phone')}"></label></div>
        <div class="row"><label>Wedding date<input name="event_date" type="date" value="${v('event_date')}"></label><label>Guests<input name="guest_count" type="number" min="0" value="${v('guest_count')}"></label></div>
        <label>Venue<input name="venue" value="${v('venue')}"></label>
        <div class="row"><label>Package<input name="package" value="${v('package')}"></label><label>Budget<input name="budget" value="${v('budget')}"></label></div>
        <div class="actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save</button></div>
      </form>`);
    document.getElementById('edit-form').onsubmit = async (e) => {
      e.preventDefault();
      try { await api(`/api/admin/clients/${c.id}`, { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); closeModal(); toast('Saved'); renderClient(c.id); }
      catch (err) { toast(err.message, true); }
    };
  }

  // ---------- Router ----------
  async function route() {
    closeModal();
    const m = location.hash.match(/^#client\/(\d+)/);
    try { m ? await renderClient(m[1]) : await renderDashboard(); window.scrollTo(0, 0); }
    catch (err) { app.innerHTML = `<button class="back-link" onclick="location.hash=''">← Back</button><p class="empty">${esc(err.message)}</p>`; }
  }
  window.addEventListener('hashchange', route);
  route();
})();
