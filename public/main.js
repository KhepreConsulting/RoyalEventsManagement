(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Mobile nav
  const toggle = $('.nav-toggle');
  const links = $('.nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', (e) => { if (e.target.tagName === 'A') links.classList.remove('open'); });

  $('#year').textContent = new Date().getFullYear();

  const initials = (couple) => couple.split('&').map((p) => p.trim()[0] || '').join(' & ');

  fetch('/api/site').then((r) => r.json()).then((site) => {
    document.querySelectorAll('[data-site]').forEach((el) => { if (site[el.dataset.site]) el.textContent = site[el.dataset.site]; });

    $('#services-grid').innerHTML = site.services.map((s, i) => `
      <article class="card service-card">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
      </article>`).join('');

    $('#service-select').innerHTML += site.services.map((s) => `<option>${esc(s.title)}</option>`).join('') + '<option>Not sure yet</option>';

    $('#process-steps').innerHTML = site.process.map((p) => `
      <div class="step"><h3>${esc(p.step)}</h3><p>${esc(p.text)}</p></div>`).join('');

    $('#gallery').innerHTML = site.weddings.map((w) => {
      const [a, b] = w.palette || ['#785313', '#b98519'];
      const bg = w.image
        ? `background-image:url('${encodeURI(w.image)}')`
        : `background:radial-gradient(circle at 30% 20%, ${b}88, transparent 60%), linear-gradient(150deg, ${a}, #261b11)`;
      const detailUrl = w.slug && Array.isArray(w.media) && w.media.length
        ? `wedding.html?slug=${encodeURIComponent(w.slug)}`
        : '';
      const tag = detailUrl ? 'a' : 'article';
      const meta = [w.venue, w.date].filter(Boolean).map(esc).join(' · ');
      return `
      <${tag} class="wedding${detailUrl ? ' has-media' : ''}" ${detailUrl ? `href="${esc(detailUrl)}" aria-label="View photos and videos from ${esc(w.couple)}"` : ''}>
        <div class="bg" style="${esc(bg)}"></div>
        ${w.image ? '' : `<div class="monogram">${esc(initials(w.couple))}</div>`}
        <div class="info">
          ${meta ? `<span class="meta">${meta}</span>` : ''}
          <h3>${esc(w.couple)}</h3>
          <p>${esc(w.style)}</p>
          ${detailUrl ? '<span class="wedding-media-cta">View photos & videos</span>' : ''}
        </div>
      </${tag}>`;
    }).join('');

    $('#testimonials').innerHTML = site.testimonials.map((t) => `
      <blockquote style="margin:0"><p class="quote">“${esc(t.quote)}”</p><span class="quote-who">— ${esc(t.who)}</span></blockquote>`).join('');

    const c = site.contact;
    $('#c-email').textContent = c.email; $('#c-email').href = `mailto:${c.email}`;
    $('#c-phone').textContent = c.phone; $('#c-phone').href = `tel:${c.phone.replace(/[^\d+]/g, '')}`;
    $('#c-insta').textContent = c.instagramHandle; $('#c-insta').href = c.instagram;
    $('#c-location').textContent = c.location;
    $('#insta-link').href = c.instagram;
  });

  // Contact form
  const form = $('#contact-form');
  const msg = $('#contact-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const show = (text, ok) => { msg.textContent = text; msg.className = `form-msg show ${ok ? 'ok' : 'err'}`; };
    if (!data.name.trim()) return show('Please tell us your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return show('Please enter a valid email address.');
    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const res = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Something went wrong');
      form.reset();
      show('Thank you! Your enquiry has been received — we\'ll be in touch within 48 hours.', true);
    } catch (err) {
      show(err.message || 'Something went wrong. Please email us directly.');
    } finally {
      btn.disabled = false; btn.textContent = 'Send Enquiry';
    }
  });
})();
