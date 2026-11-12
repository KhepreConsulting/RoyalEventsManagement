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
  const videoModal = $('#wedding-video-modal');
  const videoEmbed = $('#instagram-video-embed');
  const videoStatus = $('#instagram-video-status');
  let videoTrigger;

  function processInstagramEmbeds() {
    if (!window.instgrm || !window.instgrm.Embeds) {
      videoStatus.textContent = 'Instagram could not load the embed. Use the link below to watch the video.';
      console.error('Instagram embed script loaded without the embed API.');
      return;
    }
    window.instgrm.Embeds.process();
  }

  function openWeddingVideo(card) {
    const url = card.dataset.videoUrl;
    const couple = card.querySelector('h3').textContent;
    videoTrigger = card;
    $('#wedding-video-title').textContent = `${couple} wedding video`;
    $('#instagram-video-fallback').href = url;
    videoStatus.textContent = '';
    videoEmbed.innerHTML = `<blockquote class="instagram-media" data-instgrm-permalink="${esc(url)}" data-instgrm-version="14"></blockquote>`;
    videoModal.classList.add('show');
    videoModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    $('#wedding-video-close').focus();

    if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
      return;
    }

    let script = $('#instagram-embed-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'instagram-embed-script';
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.addEventListener('load', processInstagramEmbeds, { once: true });
      script.addEventListener('error', () => {
        videoStatus.textContent = 'Instagram could not load the embed. Use the link below to watch the video.';
        console.error('Failed to load the Instagram embed script.');
      }, { once: true });
      document.body.append(script);
    } else {
      script.addEventListener('load', processInstagramEmbeds, { once: true });
    }
  }

  function closeWeddingVideo() {
    videoModal.classList.remove('show');
    videoModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    videoEmbed.replaceChildren();
    videoTrigger?.focus();
  }

  $('#gallery').addEventListener('click', (event) => {
    const card = event.target.closest('.wedding[data-video-url]');
    if (card) openWeddingVideo(card);
  });
  $('#gallery').addEventListener('keydown', (event) => {
    const card = event.target.closest('.wedding[data-video-url]');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openWeddingVideo(card);
    }
  });
  $('#wedding-video-close').addEventListener('click', closeWeddingVideo);
  videoModal.addEventListener('click', (event) => {
    if (event.target === videoModal) closeWeddingVideo();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && videoModal.classList.contains('show')) closeWeddingVideo();
  });

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
      const videoUrl = w.videoUrl ? esc(w.videoUrl) : '';
      return `
      <article class="wedding${videoUrl ? ' has-video' : ''}" ${videoUrl ? `role="button" tabindex="0" data-video-url="${videoUrl}" aria-label="Watch ${esc(w.couple)} wedding video"` : ''}>
        <div class="bg" style="${esc(bg)}"></div>
        ${w.image ? '' : `<div class="monogram">${esc(initials(w.couple))}</div>`}
        <div class="info">
          <span class="meta">${esc(w.venue)} · ${esc(w.date)}</span>
          <h3>${esc(w.couple)}</h3>
          <p>${esc(w.style)}</p>
          ${videoUrl ? '<span class="wedding-video-cta">Watch video</span>' : ''}
        </div>
      </article>`;
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
