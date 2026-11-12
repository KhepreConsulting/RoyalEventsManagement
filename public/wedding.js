(() => {
  const story = document.querySelector('#wedding-story');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const slug = new URLSearchParams(location.search).get('slug');

  function showError(message) {
    story.innerHTML = `
      <a class="back-link" href="index.html#weddings">← All weddings</a>
      <section class="wedding-detail-error">
        <h1>Wedding story unavailable</h1>
        <p class="muted">${esc(message)}</p>
        <a class="btn" href="index.html#weddings">Back to weddings</a>
      </section>`;
  }

  function renderMedia(item, index, couple) {
    const url = esc(item.url);
    const caption = item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : '';

    if (item.type === 'image') {
      return `<figure class="wedding-media-item"><img src="${url}" alt="${esc(item.alt || `${couple} wedding photo ${index + 1}`)}" loading="lazy">${caption}</figure>`;
    }

    if (item.type === 'video') {
      return `<figure class="wedding-media-item"><video src="${url}" controls playsinline preload="metadata"></video>${caption}</figure>`;
    }

    if (item.type === 'instagram') {
      return `<figure class="wedding-media-item instagram-media-item">
        <blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote>
        <figcaption><a class="wedding-media-fallback" href="${url}" target="_blank" rel="noopener">Open on Instagram</a></figcaption>
      </figure>`;
    }

    console.error(`Unsupported media type "${item.type}" in wedding story.`);
    return `<p class="wedding-media-error">This media item could not be displayed.</p>`;
  }

  function loadInstagramEmbeds() {
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.addEventListener('load', () => {
      if (!window.instgrm || !window.instgrm.Embeds) {
        console.error('Instagram embed script loaded without the embed API.');
        return;
      }
      window.instgrm.Embeds.process();
    }, { once: true });
    script.addEventListener('error', () => {
      console.error('Failed to load the Instagram embed script. Use the Instagram links instead.');
    }, { once: true });
    document.body.append(script);
  }

  if (!slug) {
    showError('Choose a wedding from the gallery to view its photos and videos.');
    return;
  }

  fetch('/api/site')
    .then((response) => {
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      return response.json();
    })
    .then((site) => {
      const wedding = site.weddings.find((item) => item.slug === slug);
      if (!wedding) {
        showError('We could not find that wedding gallery.');
        return;
      }

      document.title = `${wedding.couple} | Royals Events Management`;
      const media = Array.isArray(wedding.media) ? wedding.media : [];
      const mediaContent = media.length
        ? media.map((item, index) => renderMedia(item, index, wedding.couple)).join('')
        : '<p class="muted">Photos and videos will be added to this gallery soon.</p>';

      story.innerHTML = `
        <a class="back-link" href="index.html#weddings">← All weddings</a>
        <header class="wedding-detail-header">
          <span class="eyebrow">Wedding story</span>
          <h1>${esc(wedding.couple)}</h1>
          ${[wedding.venue, wedding.date].filter(Boolean).length ? `<p class="wedding-detail-meta">${[wedding.venue, wedding.date].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
          <p class="wedding-detail-style">${esc(wedding.style)}</p>
        </header>
        <section aria-labelledby="wedding-gallery-heading">
          <h2 class="wedding-gallery-title" id="wedding-gallery-heading">Photos &amp; videos</h2>
          <div class="wedding-media-list">${mediaContent}</div>
        </section>`;

      if (media.some((item) => item.type === 'instagram')) loadInstagramEmbeds();
    })
    .catch((error) => {
      console.error('Failed to load wedding story.', error);
      showError('We could not load this gallery. Please try again later.');
    });
})();
