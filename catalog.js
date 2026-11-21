// 商品與農場資料層（示意）：讀 catalog-seed.js 的原始資料，再疊上後台改過的設定（存在這台瀏覽器）。
// 前台各頁、後台都用這一份；正式版改成從伺服器 API 讀。
(() => {
  const SEED = window.GV_SEED;
  const KEY = 'gv-admin-v1';
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nt = (n) => Number(n).toLocaleString('zh-TW');
  // 區網分享版：資料存在伺服器（大家看到同一份）；GitHub 或本機預覽沒有伺服器，就存在這台瀏覽器
  const remote = (() => {
    try {
      const x = new XMLHttpRequest(); x.open('GET', 'api/admin-state', false); x.send();
      if (x.status === 200 && /json/.test(x.getResponseHeader('Content-Type') || '')) return { ok: true, data: JSON.parse(x.responseText || '{}') };
    } catch (e) {}
    return { ok: false, data: null };
  })();
  // 共用模式剛開時伺服器還是空的：把這台瀏覽器之前在後台改過的資料搬上去，不用重改
  if (remote.ok && !Object.keys(remote.data || {}).length) {
    try {
      const local = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (local && Object.keys(local).length) {
        const x = new XMLHttpRequest(); x.open('PUT', 'api/admin-state', false);
        x.setRequestHeader('Content-Type', 'application/json'); x.send(JSON.stringify(local));
        if (x.status === 200) { remote.data = local; remote.moved = true; }
      }
    } catch (e) {}
  }
  const load = () => {
    if (remote.ok) return remote.data || {};
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  };
  const CATS = { veg: '萵苣', leafy: '其他葉菜', mushroom: '菇類', goods: '農家加工品' };
  const STOCK = { ok: '充足', low: '剩少量', next: '下週採收' };

  const state = () => {
    const s = load();
    return { farms: s.farms || [], products: s.products || [], edits: s.edits || {}, farmEdits: s.farmEdits || {},
             order: s.order || null, farmOrder: s.farmOrder || null, home: JSON.parse(JSON.stringify(s.home || SEED.home)) };
  };
  const save = (s) => {
    if (remote.ok) {
      try {
        const x = new XMLHttpRequest(); x.open('PUT', 'api/admin-state', false);
        x.setRequestHeader('Content-Type', 'application/json'); x.send(JSON.stringify(s));
        if (x.status !== 200) return false;
        remote.data = JSON.parse(JSON.stringify(s));
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
        return true;
      } catch (e) { return false; }
    }
    try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  };
  const reset = () => { if (remote.ok) return save({}); try { localStorage.removeItem(KEY); } catch (e) {} return true; };

  const farms = () => {
    const s = state();
    let list = [...SEED.farms, ...s.farms].map((f) => ({ ...f, ...(s.farmEdits[f.id] || {}) }));
    list.forEach((f) => { if (!f.label) f.label = f.region ? `${f.name}（${f.region}）` : f.name; if (!f.url) f.url = `farm.html?id=${encodeURIComponent(f.id)}`; });
    if (s.farmOrder) list.sort((a, b) => idx(s.farmOrder, a.id) - idx(s.farmOrder, b.id));
    return list;
  };
  const idx = (arr, id) => { const i = arr.indexOf(id); return i < 0 ? 1e6 : i; };
  const farm = (id) => farms().find((f) => f.id === id);

  const products = (all = false) => {
    const s = state();
    let list = [...SEED.products, ...s.products].map((p) => ({ ...p, ...(s.edits[p.id] || {}) }));
    list.forEach((p) => { if (!p.url) p.url = `p.html?id=${encodeURIComponent(p.id)}`; if (!p.cart) p.cart = p.name; });
    if (s.order) list.sort((a, b) => idx(s.order, a.id) - idx(s.order, b.id));
    const fm = Object.fromEntries(farms().map((f) => [f.id, f]));
    list = list.filter((p) => fm[p.farm]);
    return all ? list : list.filter((p) => !p.hidden && !fm[p.farm].hidden);
  };
  const product = (id) => products(true).find((p) => p.id === id);
  const labelOf = (p) => (farm(p.farm) || {}).label || '';

  // 首頁兩個區塊：依後台規則挑商品
  const homeList = (key) => {
    const cfg = state().home[key] || SEED.home[key];
    const vis = products();
    let list;
    if (cfg.mode === 'auto') {
      list = vis.filter((p) => (cfg.farms || []).includes(p.farm));
      if (key === 'harvest') list = list.filter((p) => p.cat === 'veg' || p.cat === 'leafy');
    } else {
      const byId = Object.fromEntries(vis.map((p) => [p.id, p]));
      list = (cfg.ids || []).map((id) => byId[id]).filter(Boolean);
    }
    if (cfg.skipNext) list = list.filter((p) => p.stock !== 'next');
    return list.slice(0, cfg.limit || 12);
  };

  // ── 卡片樣板（跟原本的 HTML 一樣） ──
  const QTY = '<div class="qty qty-sm" data-q><button type="button" data-step="-1" aria-label="減少數量">−</button><span>1</span><button type="button" data-step="1" aria-label="增加數量">＋</button></div>';
  const addBtn = (p) => `<button class="btn-small" type="button" data-add="${esc(p.cart)}" data-unit="${esc(p.unit)}" data-price="${p.price}" data-src="${esc(labelOf(p))}"${p.pack ? ' data-pack="1"' : ''}>加入購物車</button>`;
  const picTag = (p) => p.stock === 'low' ? '<span class="pic-tag low">剩少量</span>' : p.stock === 'next' ? '<span class="pic-tag next">下週採收</span>' : p.badge ? `<span class="pic-tag ok">${esc(p.badge)}</span>` : '';
  const pcard = (p) => `<li class="pcard" data-src="${esc(p.farm)}" data-cat="${esc(p.cat)}" data-id="${esc(p.id)}"><a class="pic" href="${esc(p.url)}"><span class="pic-wrap"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">${picTag(p)}</span></a>
  <p class="src${p.farm === 'own' ? ' own' : ''}">${esc(labelOf(p))}</p><h3><a href="${esc(p.url)}">${esc(p.name)}</a></h3>
  <div class="row"><p class="price">NT$${nt(p.price)}<span>/ ${esc(p.unit)}${p.note ? '・' + esc(p.note) : ''}</span></p><div class="add-row">${QTY}${addBtn(p)}</div></div></li>`;
  const htile = (p) => `<li><a href="${esc(p.url)}"><img src="${esc(p.img2 || p.img)}" alt="${esc(p.name)}" loading="lazy"></a><div class="h-row"><span class="h-name">${esc(p.name)}</span><span class="tag ${esc(p.stock || 'ok')}">${STOCK[p.stock] || '充足'}</span></div><div class="h-buy"><p class="price">NT$${nt(p.price)}<span>/ ${esc(p.unit)}</span></p>${addBtn(p)}</div></li>`;
  const vcard = (p) => `<article class="vcard"><a href="${esc(p.url)}"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"></a>
  <div class="body"><h3><a href="${esc(p.url)}">${esc(p.name)}</a></h3><p class="en">${esc((farm(p.farm) || {}).name || '')}</p><div class="row"><p class="price">NT$${nt(p.price)}<span>/ ${esc(p.unit)}${p.note ? '・' + esc(p.note) : ''}</span></p><div class="add-row">${QTY}${addBtn(p)}</div></div></div></article>`;


  // ── 農場影片（YouTube）：先放縮圖，按了才載入播放器，手機也不會變慢 ──
  const ytId = (u) => {
    const m = String(u || '').trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
    return m ? { id: m[1], short: /shorts\//.test(u) } : null;
  };
  const videoSection = (f) => {
    const vids = (f.videos || []).map((v) => ({ ...ytId(v.url || v), title: v.title || '' })).filter((v) => v.id);
    if (!vids.length) return '';
    const card = (v, i) => `<figure class="yt${v.short ? ' yt-short' : ''}${i === 0 && !v.short ? ' yt-main' : ''}"><button type="button" class="yt-btn" data-yt="${esc(v.id)}" aria-label="播放影片${v.title ? '：' + esc(v.title) : ''}">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play" aria-hidden="true"></span></button>${v.title ? `<figcaption>${esc(v.title)}</figcaption>` : ''}</figure>`;
    return `<section class="farm-videos tight" aria-labelledby="fv-h"><h2 id="fv-h">看看${esc(f.name)}</h2><div class="yt-grid${vids.length === 1 ? ' is-one' : ''}">${vids.map(card).join('')}</div></section>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-yt]'); if (!b) return;
    const fr = document.createElement('iframe');
    fr.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0&playsinline=1`;
    fr.title = b.getAttribute('aria-label') || '農場影片';
    fr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; fr.allowFullscreen = true; fr.loading = 'lazy'; fr.dataset.ytId = b.dataset.yt;
    b.replaceWith(fr);
  });


  // ── 農場頁右側：影片在第一張的手動幻燈片（不會自己換；換到別張就停掉影片） ──
  const heroMedia = (f, fallbackImg, fallbackAlt) => {
    const vids = (f.videos || []).map((v) => ({ ...ytId(v.url || v), title: v.title || '' })).filter((v) => v.id);
    if (!vids.length) return '';
    const photos = [...new Set([...(f.imgs || []), f.img, fallbackImg].filter(Boolean))];
    const slides = [
      ...vids.map((v) => ({ kind: 'video', ...v, label: v.title ? `影片：${v.title}` : '影片' })),
      ...photos.map((src, i) => ({ kind: 'photo', src, label: `照片 ${i + 1}`, alt: i === 0 && fallbackAlt ? fallbackAlt : `${f.name}的照片` })),
    ];
    const slide = (s, i) => `<div class="fm-slide${i === 0 ? ' is-on' : ''}" role="group" aria-roledescription="投影片" aria-label="${esc(s.label)}（${i + 1}／${slides.length}）"${i ? ' aria-hidden="true"' : ''}>
      ${s.kind === 'video'
        ? `<button type="button" class="yt-btn" data-yt="${esc(s.id)}" aria-label="播放影片${s.title ? '：' + esc(s.title) : ''}"><img src="https://i.ytimg.com/vi/${esc(s.id)}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play" aria-hidden="true"></span></button>`
        : `<img src="${esc(s.src)}" alt="${esc(s.alt)}" loading="lazy">`}</div>`;
    return `<div class="fmedia" data-fmedia aria-roledescription="幻燈片" aria-label="${esc(f.name)}的影片與照片">
      <div class="fm-stage">${slides.map(slide).join('')}
        ${slides.length > 1 ? `<button type="button" class="fm-nav fm-prev" data-fm="-1" aria-label="上一張"></button><button type="button" class="fm-nav fm-next" data-fm="1" aria-label="下一張"></button>` : ''}</div>
      <div class="fm-foot"><p class="fm-cap">${vids[0].title ? `<span class="fm-cap-k">影片</span>${esc(vids[0].title)}` : '<span class="fm-cap-k">影片</span>'}</p>
        ${slides.length > 1 ? `<div class="fm-dots">${slides.map((s, i) => `<button type="button" data-fm-to="${i}" class="${s.kind === 'video' ? 'is-video' : ''}" aria-label="${esc(s.label)}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}</div>` : ''}</div>
    </div>`;
  };
  const fmState = new WeakMap();
  const fmGo = (box, n) => {
    const slides = [...box.querySelectorAll('.fm-slide')], dots = [...box.querySelectorAll('[data-fm-to]')];
    const k = (n + slides.length) % slides.length;
    slides.forEach((s, i) => {
      const on = i === k; s.classList.toggle('is-on', on);
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      // 換走的影片：拿掉播放器，換回縮圖（等於停止播放）
      const fr = s.querySelector('iframe[data-yt-id]');
      if (fr && !on) { const id = fr.dataset.ytId; fr.outerHTML = `<button type="button" class="yt-btn" data-yt="${id}" aria-label="${fr.title}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt=""><span class="yt-play" aria-hidden="true"></span></button>`; }
      s.querySelectorAll('img[loading="lazy"]').forEach((im) => { if (on || Math.abs(i - k) === 1) im.loading = 'eager'; });
    });
    dots.forEach((d, i) => { if (i === k) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    const cur = slides[k], cap = box.querySelector('.fm-cap');
    if (cap) cap.innerHTML = cur.querySelector('.yt-btn,iframe') ? `<span class="fm-cap-k">影片</span>${esc((cur.getAttribute('aria-label') || '').replace(/^影片：?|（.*?）$/g, ''))}` : (() => { const ph = slides.filter((x) => !x.querySelector('.yt-btn,iframe')); return `<span class="fm-cap-k">照片</span>${ph.indexOf(cur) + 1} ／ ${ph.length}`; })();
    fmState.set(box, k);
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fm],[data-fm-to]'); if (!b) return;
    const box = b.closest('[data-fmedia]'), k = fmState.get(box) || 0;
    fmGo(box, b.dataset.fmTo != null ? Number(b.dataset.fmTo) : k + Number(b.dataset.fm));
  });
  document.addEventListener('keydown', (e) => {
    const box = e.target.closest && e.target.closest('[data-fmedia]'); if (!box || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); fmGo(box, (fmState.get(box) || 0) + (e.key === 'ArrowRight' ? 1 : -1));
  });
  let fx = null;
  document.addEventListener('touchstart', (e) => { const s = e.target.closest && e.target.closest('.fm-stage'); fx = s ? e.touches[0].clientX : null; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (fx === null) return; const box = e.target.closest('[data-fmedia]'); const dx = e.changedTouches[0].clientX - fx; fx = null;
    if (box && Math.abs(dx) > 40) fmGo(box, (fmState.get(box) || 0) + (dx < 0 ? 1 : -1));
  });

  window.gvCatalog = { heroMedia, videoSection, ytId, shared: remote.ok, moved: () => !!remote.moved, reset, SEED, KEY, CATS, STOCK, esc, nt, state, save, farms, farm, products, product, homeList, labelOf, pcard, htile, vcard };

  // ── 前台：依資料畫出各區塊 ──
  const $ = (s) => document.querySelector(s);
  const hasAdminData = () => { if (remote.ok) return Object.keys(remote.data || {}).length > 0; try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };

  // 首頁
  const ht = $('.harvest .htiles'), hot = $('.hot-grid');
  if (ht && hasAdminData()) ht.innerHTML = homeList('harvest').map(htile).join('');
  if (hot && hasAdminData()) hot.innerHTML = homeList('hot').map(pcard).join('');

  // 市集：商品格與篩選選項
  const grid = document.getElementById('pgrid');
  if (grid) {
    const list = products();
    if (hasAdminData()) grid.innerHTML = list.map(pcard).join('');
    const fs = document.querySelector('#side input[name=src]')?.closest('fieldset');
    if (fs) {
      // 農場會越來越多：來源只分「自家」和「合作農場」兩大類，要找特定農場再用下拉選單
      const partners = farms().filter((f) => !f.own && !f.hidden && list.some((p) => p.farm === f.id));
      const nOwn = list.filter((p) => p.farm === 'own').length, nPart = list.length - nOwn;
      fs.className = 'src-fs';
      fs.innerHTML = `<legend>來源</legend>
        <label><input type="checkbox" name="src" value="own" checked> 食在好蔬 北投農場<span class="n">${nOwn}</span></label>
        <label><input type="checkbox" name="src" value="partner" checked> 合作農場<span class="n">${nPart}</span></label>
        <label class="src-pick"><span>指定農場</span><select id="src-farm"><option value="">全部 ${partners.length} 家</option>${partners.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}（${list.filter((p) => p.farm === f.id).length}）</option>`).join('')}</select></label>`;
    }
    const cs = document.querySelector('#side input[name=cat]')?.closest('fieldset');
    if (cs) {
      cs.querySelector('legend').textContent = '品項';
      cs.querySelectorAll('input[name=cat]').forEach((i) => { const n = i.parentElement.querySelector('.n'); if (n) n.textContent = list.filter((p) => p.cat === i.value).length; });
      cs.parentElement.prepend(cs);   // 主要用品項篩選，放最上面
    }
  }

  // 合作農場列表：照後台順序排，加上新農場、隱藏下架的農場
  const fl = $('.farm-list');
  if (fl && hasAdminData()) {
    const rows = Object.fromEntries([...fl.querySelectorAll('.farm-row')].map((r) => [(r.querySelector('a')?.getAttribute('href') || '').replace(/^farm-|\.html$/g, ''), r]));
    farms().filter((f) => !f.own).forEach((f) => {
      let row = rows[f.id];
      if (!row) {
        const goods = products().filter((p) => p.farm === f.id).slice(0, 3);
        row = document.createElement('article'); row.className = 'farm-row';
        row.innerHTML = `<a href="${esc(f.url)}"><span class="pic-wrap farm-row-pic"><img src="${esc(f.img || '')}" alt="${esc(f.name)}" loading="lazy"></span></a>
    <div><p class="where">${esc(f.region)}</p><h2><a href="${esc(f.url)}">${esc(f.name)}</a></h2><p>${esc(f.summary)}</p>
      ${f.crops ? `<p class="crops"><b>種什麼</b>${esc(f.crops)}</p>` : ''}
      ${goods.length ? `<ul class="fs-goods">${goods.map((p) => `<li><a href="${esc(p.url)}"><span class="pic-wrap"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"></span><span>${esc(p.name)}</span></a></li>`).join('')}</ul>` : ''}
      <a class="text-link" href="shop.html?src=${encodeURIComponent(f.id)}">買這家農場的商品</a></div>`;
      }
      row.hidden = !!f.hidden; if (f.hidden) row.dataset.off = '1'; else delete row.dataset.off;
      fl.appendChild(row);
    });
  }

  // 原有頁面上的商品：套用後台改過的名稱、價格、照片、介紹、庫存
  if (hasAdminData()) {
    const edited = SEED.products.map((p) => ({ seed: p, now: product(p.id) })).filter((x) => x.now && JSON.stringify(state().edits[x.seed.id] || {}) !== '{}');
    const here = location.pathname.split('/').pop() || 'index.html';
    edited.forEach(({ seed, now }) => {
      // 卡片（市集、首頁以外的商品列、也看看）
      document.querySelectorAll(`[data-add="${CSS.escape(seed.cart)}"]`).forEach((btn) => {
        btn.dataset.price = now.price; btn.dataset.unit = now.unit;
        const card = btn.closest('li,article'); if (!card) return;
        const pr = card.querySelector('.price'); if (pr) pr.innerHTML = `NT$${nt(now.price)}<span>/ ${esc(now.unit)}${now.note && card.matches('.pcard,.vcard') ? '・' + esc(now.note) : ''}</span>`;
        const h = card.querySelector('h3 a, .h-name'); if (h) h.textContent = now.name;
        const im = card.querySelector('img'); if (im && now.img !== seed.img) { im.src = now.img; im.alt = now.name; }
      });
      // 這個商品自己的頁面
      if (seed.url !== here) return;
      const h1 = document.querySelector('.buybox h1'); if (h1) { h1.textContent = now.name; document.title = document.title.replace(seed.name, now.name); }
      const up = document.querySelector('.unit-price'); if (up) up.innerHTML = `NT$${nt(now.price)}<span>/ ${esc(now.unit)}</span>`;
      const buy = document.getElementById('buy'); if (buy) { buy.dataset.price = now.price; buy.dataset.unit = now.unit; const sum = document.getElementById('sum'); if (sum) sum.textContent = nt(now.price); }
      if (now.desc) { const d = document.querySelector('.buybox-top h1 ~ p:not(.en):not(.unit-price):not(.unit-note)'); if (d) d.textContent = now.desc; }
      const stockDd = [...document.querySelectorAll('.facts dt')].find((t) => t.textContent === '這週狀態')?.nextElementSibling;
      if (stockDd && now.stock !== seed.stock) { stockDd.dataset.stock = now.stock; stockDd.textContent = now.stock === 'next' ? '這週沒有，下週採收後出貨' : STOCK[now.stock] || '充足'; }
      [['種法', now.grow], ['保存', now.keep]].forEach(([k, v]) => { const dd = [...document.querySelectorAll('.facts dt')].find((t) => t.textContent === k)?.nextElementSibling; if (dd && v) dd.textContent = v; });
      if (now.eat) { const s = [...document.querySelectorAll('.cols3 h2')].find((h) => h.textContent === '怎麼吃')?.nextElementSibling; if (s) s.textContent = now.eat; }
      if (now.imgs && now.imgs.length) {
        const main = document.getElementById('main-img'); if (main) { main.src = now.imgs[0]; main.alt = now.name; }
        const th = document.querySelector('.thumbs');
        const html = now.imgs.length > 1 ? now.imgs.map((s, i) => `<button type="button" aria-pressed="${i === 0}" data-img="${esc(s)}"><img src="${esc(s)}" alt="照片 ${i + 1}"></button>`).join('') : '';
        if (th) { if (html) th.innerHTML = html; else th.remove(); }
        else if (html && main) main.insertAdjacentHTML('afterend', `<div class="thumbs">${html}</div>`);
      }
    });
  }

  // 原有農場頁：補上後台新增、屬於這家農場的商品
  const fid = (location.pathname.match(/farm-([a-z]+)\.html$/) || [])[1];
  // 原有農場：套用後台填的資料（名稱、地區、介紹、種什麼、種法、認證、照片）
  const farmPatch = (f, root) => {
    const ed = state().farmEdits[f.id]; if (!ed || !root) return;
    const set = (sel, v) => { const el = root.querySelector(sel); if (el && v) el.textContent = v; };
    set('h1', ed.name); set('.farm-hero .lead, :scope > div > p:not(.where):not(.crops)', ed.summary);
    const dd = (k) => [...root.querySelectorAll('.facts dt')].find((t) => t.textContent === k)?.nextElementSibling;
    [['地點', ed.region], ['種什麼', ed.crops], ['種法', ed.grow], ['認證', ed.cert], ['檢驗', ed.cert]].forEach(([k, v]) => { const d = dd(k); if (d && v) d.textContent = v; });
    if (ed.img) root.querySelectorAll('.farm-ph').forEach((ph) => { ph.classList.remove('farm-ph'); ph.innerHTML = `<img src="${esc(ed.img)}" alt="${esc(f.name)}">`; });
  };
  if (fid && farm(fid) && hasAdminData()) farmPatch(farm(fid), document.querySelector('main'));
  if (fl && hasAdminData()) fl.querySelectorAll('.farm-row').forEach((row) => {
    const id = (row.querySelector('a')?.getAttribute('href') || '').replace(/^farm-|\.html$/g, ''), f = farm(id), ed = state().farmEdits[id];
    if (!f || !ed) return;
    farmPatch(f, row);
    if (ed.region) { const w = row.querySelector('.where'); if (w) w.textContent = ed.region; }
    if (ed.name) { const a = row.querySelector('h2 a'); if (a) a.textContent = ed.name; }
    if (ed.summary) { const p = row.querySelector('h2 + p'); if (p) p.textContent = ed.summary; }
    if (ed.crops) { const c = row.querySelector('.crops'); if (c) c.innerHTML = `<b>種什麼</b>${esc(ed.crops)}`; }
  });

  if (fid && farm(fid)) {
    const pic = document.querySelector('main .farm-hero .farm-hero-pic'), im = pic && pic.querySelector('img');
    const html = heroMedia(farm(fid), im && im.getAttribute('src'), im && im.alt);
    if (pic && html) pic.outerHTML = html;
  }
  if (fid) {
    const g = document.querySelector('main .pgrid');
    if (g) products().filter((p) => p.farm === fid && !SEED.products.some((s) => s.id === p.id)).forEach((p) => g.insertAdjacentHTML('beforeend', pcard(p)));
  }
})();
