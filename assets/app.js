/* No network services, analytics, image generation, accounts, or hosting SDKs. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const styles = { cinematic: '电影感', dreamscape: '梦幻艺术' };
  const menu = $('.menu-toggle');
  const nav = $('#primary-nav');
  const closeMenu = () => { menu?.setAttribute('aria-expanded', 'false'); nav?.removeAttribute('data-open'); };
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.dataset.open = String(open);
  });
  nav?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
  matchMedia('(min-width: 601px)').addEventListener('change', closeMenu);

  let works = [];
  let visible = [];
  let selected = -1;
  let trigger = null;
  let loadState = 'loading';
  const grid = $('#gallery-grid');
  const dialog = $('#lightbox');
  let filter = getFilter();
  function getFilter() {
    const value = new URLSearchParams(location.search).get('style');
    return Object.hasOwn(styles, value) ? value : 'all';
  }
  // Reject remote URLs and arbitrary paths; only explicitly approved generated portraits are displayed.
  function isWork(work) {
    const pathOK = p => typeof p === 'string' && /^assets\/portraits\/[a-z0-9][a-z0-9-]*\.(webp|png|jpe?g)$/i.test(p);
    return work && work.approved === true && work.kind === 'generated-art-portrait' &&
      Object.hasOwn(styles, work.style) && typeof work.id === 'string' &&
      typeof work.title === 'string' && work.title.trim() && typeof work.alt === 'string' && work.alt.trim() &&
      pathOK(work.src) && pathOK(work.thumbnail) && Number.isInteger(work.width) && work.width > 0 &&
      Number.isInteger(work.height) && work.height > 0;
  }
  function paintCover(slot, work) {
    if (!slot || !work) return;
    const image = new Image();
    image.className = 'cover-photo';
    image.alt = ''; // The surrounding collection link already names its destination.
    image.decoding = 'async';
    image.addEventListener('load', () => {
      slot.querySelector('.light-study')?.remove();
      slot.querySelector('.cover-photo')?.remove();
      slot.prepend(image);
    });
    image.src = work.thumbnail;
  }
  function paintCovers() {
    for (const style of Object.keys(styles)) {
      const work = works.find(w => w.style === style);
      paintCover($(`[data-cover="${style}"]`), work);
      paintCover($(`[data-series-cover="${style}"]`), work);
    }
    paintCover($('[data-about-cover]'), works.find(w => w.style === 'dreamscape') || works[0]);
  }
  function setFilter(value, push = true) {
    filter = Object.hasOwn(styles, value) ? value : 'all';
    if (push) {
      const url = new URL(location.href);
      if (filter === 'all') url.searchParams.delete('style'); else url.searchParams.set('style', filter);
      url.searchParams.delete('work');
      history.pushState(null, '', url);
    }
    render();
  }
  function render() {
    if (!grid) return;
    visible = works.filter(w => filter === 'all' || w.style === filter);
    $$('.filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    if (loadState !== 'ready') return;
    $('#gallery-count').textContent = `${visible.length} 件作品`;
    $('#gallery-error').hidden = true;
    $('#gallery-empty').hidden = visible.length !== 0;
    $('#reset-filter').hidden = filter === 'all' || works.length === 0;
    grid.replaceChildren(...visible.map((work, index) => {
      const card = document.createElement('article'); card.className = 'work-card';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'work-open';
      button.setAttribute('aria-label', `打开写真：${work.title}，${styles[work.style]}`);
      button.setAttribute('aria-haspopup', 'dialog');
      const frame = document.createElement('span'); frame.className = 'work-image-wrap';
      const image = new Image(work.width, work.height); image.className = 'work-image'; image.alt = work.alt;
      image.loading = index < 3 ? 'eager' : 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => {
        image.hidden = true;
        const error = document.createElement('span'); error.className = 'work-image-failed';
        error.textContent = '图片暂时无法显示，点击重试大图'; frame.prepend(error);
      }, { once: true });
      image.src = work.thumbnail;
      const expand = document.createElement('span'); expand.className = 'work-expand';
      expand.textContent = '↗'; expand.setAttribute('aria-hidden', 'true');
      frame.append(image, expand);
      const details = document.createElement('span'); details.className = 'work-details';
      const title = document.createElement('span'); title.className = 'work-title'; title.textContent = work.title;
      const label = document.createElement('span'); label.className = 'work-style'; label.textContent = styles[work.style];
      details.append(title, label); button.append(frame, details); card.append(button);
      button.addEventListener('click', () => openWork(index, button));
      return card;
    }));
  }
  async function loadWorks() {
    loadState = 'loading';
    try {
      if (grid) { $('#gallery-error').hidden = true; $('#gallery-count').textContent = '正在读取作品…'; }
      const response = await fetch('assets/portraits.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('manifest unavailable');
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.works) || !data.works.every(isWork) || new Set(data.works.map(w => w.id)).size !== data.works.length) throw new Error('invalid manifest');
      works = data.works;
      loadState = 'ready';
      paintCovers(); render();
      if ($('#selected-count')) $('#selected-count').textContent = `共 ${works.length} 件作品`;
      const requested = new URLSearchParams(location.search).get('work');
      const requestedIndex = visible.findIndex(work => work.id === requested);
      if (grid && requestedIndex >= 0) openWork(requestedIndex, $$('.work-open', grid)[requestedIndex]);
    } catch {
      loadState = 'error';
      if (!grid) return;
      grid.replaceChildren(); $('#gallery-empty').hidden = true; $('#gallery-error').hidden = false;
      $('#gallery-count').textContent = '读取失败';
      $('#gallery-error-copy').textContent = location.protocol === 'file:' ? '请使用项目自带的“启动预览.cmd”，在本机浏览器打开网站。' : '作品暂时无法读取，请重试。';
    }
  }
  function openWork(index, button) {
    if (!dialog || !visible[index]) return;
    trigger = button; selected = index; showWork();
    dialog.showModal(); document.body.classList.add('modal-open');
  }
  function showWork() {
    const work = visible[selected]; if (!work) return;
    const image = $('#lightbox-image');
    $('#lightbox-image-error').hidden = true; image.hidden = false;
    image.alt = work.alt; image.src = work.src;
    $('#lightbox-title').textContent = work.title; $('#lightbox-style').textContent = styles[work.style];
    $('#lightbox-counter').textContent = `${selected + 1} / ${visible.length}`;
    $('#lightbox-prev').disabled = visible.length < 2; $('#lightbox-next').disabled = visible.length < 2;
  }
  function step(delta) { if (!dialog?.open || visible.length < 2) return; selected = (selected + delta + visible.length) % visible.length; showWork(); }
  $('#lightbox-close')?.addEventListener('click', () => dialog.close());
  $('#lightbox-prev')?.addEventListener('click', () => step(-1));
  $('#lightbox-next')?.addEventListener('click', () => step(1));
  $('#lightbox-image')?.addEventListener('error', () => { $('#lightbox-image').hidden = true; $('#lightbox-image-error').hidden = false; });
  dialog?.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    $('#lightbox-image').removeAttribute('src');
    const url = new URL(location.href);
    if (url.searchParams.has('work')) { url.searchParams.delete('work'); history.replaceState(null, '', url); }
    trigger?.focus({ preventScroll: true });
  });
  dialog?.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); selected = e.key === 'Home' ? 0 : visible.length - 1; showWork(); }
  });
  let touch = null;
  const imageWrap = $('.lightbox-image-wrap');
  imageWrap?.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touch = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  imageWrap?.addEventListener('pointerup', e => {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });
  imageWrap?.addEventListener('pointercancel', () => { touch = null; });
  $$('.filters button').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.filter)));
  $('#reset-filter')?.addEventListener('click', () => setFilter('all'));
  $('#retry-gallery')?.addEventListener('click', loadWorks);
  window.addEventListener('popstate', () => { if (dialog?.open) dialog.close(); filter = getFilter(); render(); });
  loadWorks();
})();
