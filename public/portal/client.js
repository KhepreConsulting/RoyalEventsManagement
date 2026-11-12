(async () => {
  const { esc, api, me, fmtDate, fmtDateTime, daysUntil, toast, statusBadge, renderAnswer, addSignOut } = Portal;
  const app = document.getElementById('app');

  const user = await me();
  if (!user) return (location.href = 'login.html');
  if (user.role === 'admin') return (location.href = 'admin.html');
  addSignOut(user.name);

  function inputFor(r) {
    const v = esc(r.response || '');
    switch (r.field_type) {
      case 'longtext': return `<textarea name="response" required>${v}</textarea>`;
      case 'number': return `<input name="response" type="number" inputmode="decimal" value="${v}" required>`;
      case 'date': return `<input name="response" type="date" value="${v}" required>`;
      case 'link': return `<input name="response" type="url" placeholder="https://…" value="${v}" required>`;
      case 'yesno': return `<div class="yesno">${['Yes', 'No'].map((o) => `<label><input type="radio" name="response" value="${o}" ${r.response === o ? 'checked' : ''} required> ${o}</label>`).join('')}</div>`;
      case 'select': {
        const opts = JSON.parse(r.options || '[]');
        return `<select name="response" required><option value="">Choose…</option>${opts.map((o) => `<option ${r.response === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      }
      default: return `<input name="response" value="${v}" required>`;
    }
  }

  function requestCard(r) {
    const due = r.due_date ? `<span class="muted" style="font-size:.85rem">Due ${esc(fmtDate(r.due_date))}</span>` : '';
    const editable = r.status !== 'done';
    const showForm = r.status === 'open';
    return `
      <div class="req" data-id="${r.id}">
        <div class="req-head"><h3>${esc(r.title)}</h3><div style="display:flex;gap:8px;align-items:center">${due}${statusBadge(r)}</div></div>
        ${r.description ? `<div class="desc">${esc(r.description)}</div>` : ''}
        ${renderAnswer(r)}
        <form class="${showForm ? '' : 'hidden'}">
          ${inputFor(r)}
          <div class="actions"><button class="btn small" type="submit">${r.response ? 'Update answer' : 'Submit'}</button>
          ${r.response ? '<button class="btn ghost small cancel" type="button">Cancel</button>' : ''}</div>
        </form>
        ${!showForm && editable ? '<div class="actions"><button class="btn ghost small edit" type="button">Edit answer</button></div>' : ''}
      </div>`;
  }

  async function load() {
    const data = await api('/api/client/overview');
    const { client: c, requests, messages, documents, timeline, contact } = data;
    const open = requests.filter((r) => r.status === 'open');
    const doneCount = requests.length - open.length;
    const pct = requests.length ? Math.round((doneCount / requests.length) * 100) : 100;
    const days = daysUntil(c.event_date);
    const tlDone = timeline.filter((t) => t.done).length;

    app.innerHTML = `
      <div class="portal-head">
        <div><span class="eyebrow">Your Wedding</span><h1>${esc(c.couple_names)}</h1></div>
        <span class="badge ${esc(c.status)}">${esc(c.status.replace('-', ' '))}</span>
      </div>

      <div class="stats">
        <div class="stat countdown"><b>${days === null ? '—' : days >= 0 ? days : '♥'}</b><span>${days === null ? 'Date TBC' : days >= 0 ? 'Days to go' : 'Married!'}</span></div>
        <div class="stat"><b>${open.length}</b><span>Items to fill in</span><div class="progress"><div style="width:${pct}%"></div></div></div>
        <div class="stat"><b>${tlDone}/${timeline.length}</b><span>Milestones done</span></div>
        <div class="stat"><b>${documents.length}</b><span>Shared documents</span></div>
      </div>

      <div class="layout-2">
        <div>
          <section class="panel">
            <h2>Details we need from you <span class="count">${open.length} outstanding</span></h2>
            ${requests.length ? requests.map(requestCard).join('') : '<p class="empty">Nothing to fill in right now — we\'ll let you know when we need something.</p>'}
          </section>

          <section class="panel">
            <h2>Messages</h2>
            <div class="thread" id="thread">
              ${messages.length ? messages.map((m) => `<div class="msg ${m.author_role === 'client' ? 'me' : 'them'}">${esc(m.body)}<small>${m.author_role === 'client' ? 'You' : 'Royals Events'} · ${esc(fmtDateTime(m.created_at))}</small></div>`).join('') : '<p class="empty">No messages yet. Ask us anything!</p>'}
            </div>
            <form id="msg-form" class="form"><textarea name="body" placeholder="Write a message to your planner…" style="min-height:80px" required></textarea><div><button class="btn small">Send</button></div></form>
          </section>
        </div>

        <aside>
          <section class="panel">
            <h2>Event details</h2>
            <dl class="details">
              <dt>Date</dt><dd>${esc(fmtDate(c.event_date))}</dd>
              <dt>Venue</dt><dd>${esc(c.venue || '—')}</dd>
              <dt>Guests</dt><dd>${esc(c.guest_count ?? '—')}</dd>
              <dt>Package</dt><dd>${esc(c.package || '—')}</dd>
              ${c.budget ? `<dt>Budget</dt><dd>${esc(c.budget)}</dd>` : ''}
            </dl>
          </section>

          <section class="panel">
            <h2>Planning timeline</h2>
            ${timeline.length ? `<ul class="list">${timeline.map((t) => `<li><span class="${t.done ? 'done-item' : ''}">${t.done ? '✓ ' : ''}${esc(t.title)}</span><small>${esc(fmtDate(t.due_date))}</small></li>`).join('')}</ul>` : '<p class="empty">Your planner will add milestones here.</p>'}
          </section>

          <section class="panel">
            <h2>Documents</h2>
            ${documents.length ? `<ul class="list">${documents.map((d) => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)}</a><small>${esc(fmtDate(d.created_at))}</small></li>`).join('')}</ul>` : '<p class="empty">Contracts, mood boards and run-sheets will appear here.</p>'}
          </section>

          <section class="panel">
            <h2>Your planning team</h2>
            <dl class="details">
              <dt>Email</dt><dd><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></dd>
              <dt>Phone</dt><dd><a href="tel:${esc(contact.phone.replace(/[^\d+]/g, ''))}">${esc(contact.phone)}</a></dd>
            </dl>
          </section>
        </aside>
      </div>`;

    const thread = document.getElementById('thread');
    thread.scrollTop = thread.scrollHeight;
  }

  app.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type=submit], button:not([type])');
    if (btn) btn.disabled = true;
    try {
      if (form.id === 'msg-form') {
        await api('/api/client/messages', { method: 'POST', body: { body: form.body.value } });
        toast('Message sent');
      } else {
        const id = form.closest('.req').dataset.id;
        const fd = new FormData(form);
        await api(`/api/client/requests/${id}`, { method: 'POST', body: { response: fd.get('response') } });
        toast('Thank you — saved!');
      }
      await load();
    } catch (err) { toast(err.message, true); if (btn) btn.disabled = false; }
  });

  app.addEventListener('click', (e) => {
    const card = e.target.closest('.req');
    if (!card) return;
    if (e.target.classList.contains('edit')) { card.querySelector('form').classList.remove('hidden'); e.target.parentElement.classList.add('hidden'); }
    if (e.target.classList.contains('cancel')) load();
  });

  load().catch((err) => { app.innerHTML = `<p class="empty">${esc(err.message)}</p>`; });
})();
