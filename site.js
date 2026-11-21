// A 版模擬站共用腳本（示意用：購物車存在這台瀏覽器的 localStorage）
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nt = (n) => Number(n).toLocaleString('zh-TW');
  // 購物車存在瀏覽器裡，重新整理或換頁都還在（正式版改存伺服器，登入後換裝置也看得到）
  const KEY = 'gv-cart-v1';
  const cart = (() => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const drawer = $('drawer'), scrim = $('scrim');
  drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true');
  const open = () => { drawer.classList.add('open'); scrim.classList.add('show'); drawer.inert = false; drawer.setAttribute('aria-hidden', 'false'); setTimeout(() => $('cart-close').focus(), 50); };
  const close = () => { drawer.classList.remove('open'); scrim.classList.remove('show'); drawer.inert = true; drawer.setAttribute('aria-hidden', 'true'); $('cart-open').focus(); };
  $('cart-open').addEventListener('click', open);
  $('cart-close').addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (!drawer.classList.contains('open')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...drawer.querySelectorAll('a[href],button:not([disabled]),input,select,textarea')].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  const setNav = (o, refocus) => {
    $('nav').classList.toggle('open', o);
    $('burger').setAttribute('aria-expanded', o);
    $('burger').setAttribute('aria-label', o ? '關閉選單' : '開啟選單');
    if (!o && refocus) $('burger').focus();
  };
  $('burger').addEventListener('click', () => setNav(!$('nav').classList.contains('open')));
  $('nav').addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('nav').classList.contains('open')) setNav(false, true); });
  document.addEventListener('click', (e) => { if ($('nav').classList.contains('open') && !e.target.closest('#nav,#burger')) setNav(false); });

  function render(listToo = true) {
    save();
    const c = $('count'), n = cart.reduce((s, x) => s + x.qty, 0);
    if (String(n) !== c.textContent) { c.textContent = n; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    window.dispatchEvent(new Event('gv-cart'));
    $('total').textContent = 'NT$' + nt(cart.reduce((s, x) => s + x.qty * x.price, 0)) + (cart.some((x) => !x.price) ? '＋待填品項' : '');
    $('cart-open').classList.toggle('has-items', cart.length > 0);
    $('cart-open').setAttribute('aria-label', n ? `購物車，${n} 件` : '購物車');
    if (!listToo) return;
    if (!cart.length) { $('drawer-body').innerHTML = '<p class="empty">購物車是空的。到市集挑這週採收的菜吧。</p>'; return; }
    const g = {};
    cart.forEach((x) => (g[x.src] = g[x.src] || []).push(x));
    const full = packTotal() >= PACK_LIMIT ? `<p class="limit-note">萵苣已達每日上限 ${PACK_LIMIT} 包（每個帳號每天）。需要更多？<a href="custom.html">大量採購請找我們</a></p>` : '';
    const order = (src) => (src.includes('食在好蔬') ? '0' : '1') + src;  // 分組順序固定：自家農場在前，其餘依名稱
    $('drawer-body').innerHTML = full + Object.entries(g).sort((a, b) => order(a[0]).localeCompare(order(b[0]), 'zh-Hant')).map(([src, items]) =>
      `<div class="group"><h3>${esc(src)}</h3>${items.map((x) => {
        const i = cart.indexOf(x);
        return `<div class="line" data-i="${i}">
          ${photoOf(x) ? `<img class="line-thumb" src="${esc(photoOf(x))}" alt="" loading="lazy">` : '<span class="line-thumb line-thumb-none" aria-hidden="true"></span>'}
          <div class="line-body"><div class="line-main"><span class="line-name">${esc(x.name)}</span><span class="line-unit">${x.price ? `NT$${nt(x.price)} / ${esc(x.unit || '件')}` : '單價待填'}</span></div>
          <div class="line-ctrl">
            <div class="qty qty-sm"><button type="button" data-act="dec" aria-label="${esc(x.name)} 減少一件">−</button><span aria-live="polite">${x.qty}</span><button type="button" data-act="inc" aria-label="${esc(x.name)} 增加一件"${(isPack(x) ? packTotal() >= PACK_LIMIT : x.qty >= 10) ? ' disabled' : ''}>＋</button></div>
            <span class="line-sum">${x.price ? `NT$${nt(x.qty * x.price)}` : '—'}</span>
            <button type="button" class="remove" data-act="del">移除</button>
          </div></div></div>`; }).join('')}</div>`).join('');
  }
  const say = document.createElement('p'); say.className = 'sr-only'; say.setAttribute('aria-live', 'polite');
  drawer.appendChild(say);
  let removing = false;
  $('drawer-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || removing) return;
    const i = Number(b.closest('.line').dataset.i), x = cart[i];
    if (b.dataset.act === 'inc') { if (isPack(x) && packTotal() >= PACK_LIMIT) return; x.qty = Math.min(10, x.qty + 1); }
    if (b.dataset.act === 'dec') x.qty -= 1;
    if (b.dataset.act === 'del' || x.qty <= 0) {
      const line = b.closest('.line');
      cart.splice(i, 1); removing = true;
      render(false);                       // 數量、總計立刻更新
      say.textContent = ''; setTimeout(() => { say.textContent = `已移除 ${x.name}`; }, 30);
      const lines = [...$('drawer-body').querySelectorAll('.line')], pos = lines.indexOf(line);
      line.classList.add('leaving');
      setTimeout(() => {
        removing = false; render();
        if (!drawer.classList.contains('open')) return;
        const now = [...$('drawer-body').querySelectorAll('.line [data-act="del"]')];
        (now[Math.min(pos, now.length - 1)] || $('cart-close')).focus();
      }, 220);
      return;
    }
    render();
    const again = $('drawer-body').querySelector(`.line[data-i="${i}"] [data-act="${b.dataset.act}"]`);
    if (again && !again.disabled) again.focus();
  });
  // ── 每日上限：每個帳號每天最多 10 包萵苣（後端仍會再檢查）──
  const PACK_LIMIT = 10;
  // 商品照片（示意：正式版由後台商品資料提供）
  const PHOTO = {"五福XO醬":"img/farms/tianding/xo-sauce.jpg","有機乾燥猴頭菇":"img/farms/tianding/dried-lions-mane.jpg","有機乾燥香菇":"img/farms/tianding/dried-shiitake.jpg","有機乾燥黑木耳":"img/farms/tianding/dried-black-fungus.jpg","森川捲葉苦苣（一包）":"img/farms/morikawa/frisee-1.jpg","森川紅綠橡木萵苣混合包":"img/farms/morikawa/oak-mix-1.jpg","森川綠皺葉萵苣（一包）":"img/farms/morikawa/curly-1.jpg","特濃黑木耳露":"img/farms/tianding/fungus-drink.jpg","甜脆萵苣（一包）":"img/menu/sweet-crisp-1.jpg","甜蘿蔓萵苣（一包）":"img/menu/sweet-romaine-1.jpg","皺葉萵苣（一包）":"img/menu/frilly-1.jpg","紅奶油萵苣（一包）":"img/menu/red-butter-1.jpg","紅橡木萵苣（一包）":"img/menu/red-oak-1.jpg","紅火焰萵苣（一包）":"img/menu/red-flame-1.jpg","綜合菇脆餅":"img/farms/tianding/mushroom-crisps.jpg","綠奶油萵苣（一包）":"img/menu/green-butter-1.jpg","綠橡木萵苣（一包）":"img/menu/green-oak-1.jpg","綠火焰萵苣（一包）":"img/menu/green-flame-1.jpg","羽衣甘藍":"img/menu/kale-1.jpg","芝麻葉":"img/menu/arugula-1.jpg","蘿蔓萵苣（一包）":"img/menu/romaine-1.jpg","農場搭配萵苣包":"img/menu/frilly-2.jpg"};
  window.gvPhotoOf = (x) => photoOf(x);
  const photoOf = (x) => x.thumb || PHOTO[x.name] || PHOTO[x.name.replace(/（.*?）$/, '')] || (window.gvCatalog ? (gvCatalog.products(true).find((p) => p.cart === x.name) || {}).img : '') || '';
  const isPack = (x) => !!x.pack;
  const packTotal = () => cart.filter(isPack).reduce((s, x) => s + x.qty, 0);

  // ── 加入後：商品照片飛進購物車，購物車下方跳出小視窗 ──
  const pop = document.createElement('div');
  pop.className = 'cart-pop'; pop.setAttribute('role', 'status'); pop.setAttribute('aria-live', 'polite');
  document.querySelector('.head-row').appendChild(pop);
  let popTimer = null;
  const hidePop = () => pop.classList.remove('show');
  const showPop = (html, warn) => {
    pop.innerHTML = html; pop.classList.toggle('warn', !!warn); pop.classList.add('show');
    const go = pop.querySelector('[data-go]'); if (go) go.onclick = () => { hidePop(); open(); };
    const x = pop.querySelector('[data-close]'); if (x) x.onclick = hidePop;
    clearTimeout(popTimer); popTimer = setTimeout(hidePop, warn ? 6000 : 4000);
  };
  pop.addEventListener('mouseenter', () => clearTimeout(popTimer));
  pop.addEventListener('mouseleave', () => { popTimer = setTimeout(hidePop, 1500); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target) && !e.target.closest('[data-add],#buy,[data-act="again"]')) hidePop(); });

  const fly = (img) => {
    if (!img || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = img.getBoundingClientRect(), b = $('cart-open').getBoundingClientRect();
    const c = img.cloneNode(); c.className = 'fly-img';
    Object.assign(c.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    document.body.appendChild(c);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
               { transform: `translate(${dx}px,${dy}px) scale(${Math.max(24 / a.width, .08)})`, opacity: .6 }],
              { duration: 650, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' }).onfinish = () => c.remove();
    setTimeout(() => c.remove(), 900);
  };

  window.addToCart = (name, price, src, qty = 1, img = null, pack = false, unit = '') => {
    const pic = img ? (img.getAttribute('src') || '') : '';
    const item = { name, price: Number(price), src, qty, pack, ...(unit ? { unit } : {}), ...(pic && !pic.startsWith('data:') ? { thumb: pic } : {}) };
    if (isPack(item) && packTotal() + qty > PACK_LIMIT) {
      const room = PACK_LIMIT - packTotal();
      showPop(`<div class="pop-body"><b>已達每日訂購上限</b>
        <p>每個帳號每天最多訂 ${PACK_LIMIT} 包萵苣，購物車裡已經有 ${packTotal()} 包${room > 0 ? `，這次最多再加 ${room} 包` : ''}。</p></div>
        <div class="pop-acts"><button type="button" class="btn-small" data-go>查看購物車</button><button type="button" class="pop-close" data-close>知道了</button></div>`, true);
      return false;
    }
    const hit = cart.find((x) => x.name === name && x.price === item.price);
    const had = hit ? hit.qty : 0, ITEM_MAX = 10;
    // 這項已經 10 件：不再加，直接告訴客人已達上限
    if (had >= ITEM_MAX) {
      showPop(`<div class="pop-body"><b>已達上限</b><p>${esc(name)} 每次最多訂 ${ITEM_MAX} 件，購物車裡已經有 ${had} 件。</p></div>
        <div class="pop-acts"><button type="button" class="btn-small" data-go>查看購物車</button><button type="button" class="pop-close" data-close>知道了</button></div>`, true);
      return false;
    }
    const added = Math.min(ITEM_MAX, had + qty) - had;
    if (hit) hit.qty += added; else { item.qty = added; cart.push(item); }
    render();
    fly(img);
    const thumb = img ? `<img src="${esc(img.currentSrc || img.src)}" alt="">` : '';
    const rest = PACK_LIMIT - packTotal();
    const itemFull = had + added >= ITEM_MAX, packFull = isPack(item) && rest <= 0;
    const full = itemFull || packFull;
    const left = isPack(item) && !packFull ? `<span class="pop-left">今天還可以再訂 ${rest} 包萵苣</span>` : '';
    const note = packFull ? `今天的 ${PACK_LIMIT} 包萵苣額度已訂滿` : itemFull ? `這項最多 ${ITEM_MAX} 件，已經訂滿` : '';
    setTimeout(() => showPop(`<div class="pop-item">${thumb}<div><b>${full ? '已加入，已達上限' : '已加入購物車'}</b><span>${esc(name)} × ${added}${added < qty ? `（只加了 ${added} 件）` : ''}</span>${left}${note ? `<span class="pop-left pop-full">${note}</span>` : ''}</div></div>
      <div class="pop-acts"><button type="button" class="btn-small" data-go>查看購物車（${cart.reduce((s, x) => s + x.qty, 0)}）</button><button type="button" class="pop-close" data-close>繼續逛</button></div>`, full), img ? 450 : 0);
    return true;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const card = b.closest('.pcard,.vcard,li');
    const img = card ? card.querySelector('img') : null;
    const qEl = b.closest('.add-row')?.querySelector('[data-q] span');
    const n = qEl ? Number(qEl.textContent) : 1;
    if (b.classList.contains('added')) return;
    if (!addToCart(b.dataset.add, b.dataset.price, b.dataset.src, n, img, !!b.dataset.pack, b.dataset.unit)) return;
    if (qEl) qEl.textContent = 1;
    const t = b.textContent; b.style.minWidth = b.offsetWidth + 'px'; b.classList.add('added'); b.textContent = '已加入';
    setTimeout(() => { b.classList.remove('added'); b.textContent = t; b.style.minWidth = ''; }, 1400);
  });
  window.addManyToCart = (list) => {
    let ok = 0; const skipped = [];
    list.forEach((x) => {
      const hit = cart.find((y) => y.name === x.name && y.price === Number(x.price));
      const had = hit ? hit.qty : 0;
      let room = 10 - had;
      if (x.pack) room = Math.min(room, PACK_LIMIT - packTotal());
      const n = Math.min(room, x.qty);
      const why = x.pack && PACK_LIMIT - packTotal() <= 10 - had ? '今天 10 包萵苣額度已滿' : '這項最多 10 件';
      if (n <= 0) { skipped.push(`${x.name}（${why}）`); return; }
      if (hit) hit.qty += n; else cart.push({ name: x.name, price: Number(x.price), src: x.src, qty: n, pack: !!x.pack, ...(x.unit ? { unit: x.unit } : {}) });
      ok += 1; if (n < x.qty) skipped.push(`${x.name}（只加了 ${n} 件，${why}）`);
    });
    render();
    showPop(`<div class="pop-body"><b>${ok ? `已加入 ${ok} 項商品` : '沒有加入任何商品'}</b>${skipped.length ? `<p class="pop-full">已達上限，以下沒有全部加入：${skipped.map(esc).join('、')}</p>` : ''}</div>
      <div class="pop-acts"><button type="button" class="btn-small" data-go>查看購物車（${cart.reduce((s, x) => s + x.qty, 0)}）</button><button type="button" class="pop-close" data-close>知道了</button></div>`, skipped.length > 0);
  };
  // 卡片上的數量加減
  document.addEventListener('click', (e) => {
    const st = e.target.closest('[data-step]'); if (!st) return;
    const sp = st.parentElement.querySelector('span');
    sp.textContent = Math.max(1, Math.min(10, Number(sp.textContent) + Number(st.dataset.step)));
  });
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    try { const v = JSON.parse(e.newValue || '[]'); if (Array.isArray(v)) { cart.length = 0; cart.push(...v); render(); } } catch (err) {}
  });
  render();
  // 給結帳頁用：讀購物車、送出後清空
  window.gvCart = { items: cart, clear: () => { cart.length = 0; render(); } };

  // ── 採收日：每週二、週五（示意，正式版由後台排程）──
  const WD = '日一二三四五六';
  window.gvHarvests = (n = 3) => {
    const out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    if (new Date().getHours() >= 20) d.setDate(d.getDate() + 1); // 晚上 8 點後下單排到下一批
    while (out.length < n) { if (d.getDay() === 2 || d.getDay() === 5) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  };
  window.gvFmt = (d) => `週${WD[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
  window.gvSeedOrders = () => {
    const OKEY = 'gv-orders-v2';
    const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
    const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    // 第一次打開時放兩筆示意訂單（一筆個人、一筆公司），讓頁面不是空的
    let orders = load(OKEY, null);
  if (!orders) {
    const h = gvHarvests(1)[0], past = new Date(h); past.setDate(past.getDate() - 7);
    orders = [
      { id: 'GV-示意-002', demo: true, status: 'ready', created: new Date().toISOString(), addr: '台北市北投區學園路 1 號', day: h.toISOString(), pay: '銀行轉帳', name: '王小明', phone: '0912345678', team: null,
        items: [{ name: '農場搭配萵苣包', price: 200, qty: 2, src: '食在好蔬 北投農場', pack: true, unit: '包' }, { name: '有機乾燥猴頭菇', price: 220, qty: 1, src: '添丁養生黑木耳（桃園大溪）', unit: '包' }] },
      { id: 'GV-示意-001', demo: true, status: 'done', created: past.toISOString(), addr: '台北市內湖區瑞光路 100 號 8 樓', day: past.toISOString(), pay: '開發票請款', name: '王小明', phone: '0912345678',
        team: { org: '好日子設計有限公司', tax: '12345678', split: true, list: '' },
        items: [{ name: '農場搭配萵苣包', price: 200, qty: 10, src: '食在好蔬 北投農場', pack: true, unit: '包' }, { name: '有機乾燥香菇', price: 220, qty: 4, src: '添丁養生黑木耳（桃園大溪）', unit: '包' }] },
    ];
    store(OKEY, orders);
  }

    return orders;
  };
  const nh = $('next-harvest');
  if (nh) nh.textContent = `下一批採收：${gvFmt(gvHarvests(1)[0])}。`;
  const bd = $('batch-date');
  if (bd) bd.textContent = gvFmt(gvHarvests(1)[0]);

  // 好蔬頁：篩選
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    document.querySelectorAll('[data-kind]').forEach((el) => { el.hidden = b.dataset.filter !== 'all' && el.dataset.kind !== b.dataset.filter; el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in'); });
  }));

  // 市集：勾選篩選＋網址參數 ?src=own / ?src=farm
  const cards = [...document.querySelectorAll('#pgrid .pcard')];
  if (cards.length) {
    const q = $('q'), side = $('side'), fbtn = $('filter-btn');
    const norm = (t) => t.toLowerCase().replace(/\s+/g, '');
    // 分頁：電腦一頁 12 項、手機 6 項（頁碼記在網址 ?page=，上一頁回來還在同一頁）
    const mqPhone = matchMedia('(max-width: 600px)');
    let PER = mqPhone.matches ? 6 : 12;
    let page = Math.max(1, parseInt(new URLSearchParams(location.search).get('page'), 10) || 1);
    const pager = document.createElement('nav');
    pager.className = 'shop-pager'; pager.setAttribute('aria-label', '商品分頁');
    $('pgrid').after(pager);
    const setUrl = () => { try { const u = new URL(location.href); if (page > 1) u.searchParams.set('page', page); else u.searchParams.delete('page'); history.replaceState(null, '', u); } catch (e) {} };
    const paginate = () => {
      const vis = [...$('pgrid').children].filter((c) => c.matches('.pcard') && !c.dataset.filtered);
      const pages = Math.max(1, Math.ceil(vis.length / PER)); page = Math.min(page, pages);
      vis.forEach((c, i) => { c.hidden = Math.floor(i / PER) !== page - 1; });
      if (pages <= 1) { pager.innerHTML = ''; pager.hidden = true; setUrl(); return; }
      const nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
      pager.hidden = false;
      pager.innerHTML = `<button type="button" data-pg="${page - 1}"${page > 1 ? '' : ' disabled'} aria-label="上一頁">上一頁</button>`
        + nums.map((n) => n === '…' ? '<span aria-hidden="true">…</span>' : `<button type="button" data-pg="${n}"${n === page ? ' aria-current="page"' : ''} aria-label="第 ${n} 頁">${n}</button>`).join('')
        + `<button type="button" data-pg="${page + 1}"${page < pages ? '' : ' disabled'} aria-label="下一頁">下一頁</button>`
        + `<p class="shop-pager-info">第 ${(page - 1) * PER + 1}–${Math.min(page * PER, vis.length)} 項，共 ${vis.length} 項</p>`;
      setUrl();
    };
    // 轉向或縮放跨過手機寬度時，換算成新的頁碼，停在原本看的那幾項
    const rePer = () => { const want = mqPhone.matches ? 6 : 12; if (want === PER) return; const first = (page - 1) * PER; PER = want; page = Math.floor(first / PER) + 1; paginate(); };
    mqPhone.addEventListener('change', rePer); window.addEventListener('resize', rePer);
    pager.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return;
      page = Number(b.dataset.pg); paginate();
      const top = document.querySelector('.shop-list') || $('pgrid');
      top.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    const apply = (keepPage) => {
      if (keepPage !== true) page = 1;
      const src = [...document.querySelectorAll('input[name=src]:checked')].map((i) => i.value);
      const cat = [...document.querySelectorAll('input[name=cat]:checked')].map((i) => i.value);
      const kw = norm(q.value);
      let n = 0;
      cards.forEach((c) => {
        const hit = !kw || norm((c.querySelector('h3')?.textContent || '') + (c.querySelector('.src')?.textContent || '')).includes(kw);
        const ok = hit && src.includes(c.dataset.src) && cat.includes(c.dataset.cat);
        if (ok) delete c.dataset.filtered; else c.dataset.filtered = '1';
        c.hidden = !ok; n += ok;
      });
      paginate();
      $('shown').textContent = `共 ${n} 件商品`;
      $('no-result').hidden = n > 0;
      const off = [...side.querySelectorAll('input')].filter((i) => !i.checked).length;
      $('filter-sum').textContent = off ? '（已篩選）' : '';
    };
    side.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => apply()));
    q.addEventListener('input', () => apply());
    fbtn.addEventListener('click', () => {
      const o = side.classList.toggle('open');
      fbtn.setAttribute('aria-expanded', o);
    });
    const qs = new URLSearchParams(location.search).get('src');
    const known = [...document.querySelectorAll('input[name=src]')].map((i) => i.value);
    if (qs && (qs === 'farm' || known.includes(qs))) document.querySelectorAll('input[name=src]').forEach((i) => { i.checked = qs === 'farm' ? i.value !== 'own' : i.value === qs; });
    // 排序
    const sortSel = document.querySelector('select[name=sort], #sort'), grid = $('pgrid');
    if (sortSel && grid) {
      const orig = [...cards];
      const price = (c) => Number(c.querySelector('[data-price]')?.dataset.price || 0);
      sortSel.addEventListener('change', (ev) => {
        const v = sortSel.value; let list = [...orig];
        if (/low|asc|便宜|低/.test(v)) list.sort((a, b) => price(a) - price(b));
        else if (/high|desc|貴|高/.test(v)) list.sort((a, b) => price(b) - price(a));
        list.forEach((c) => grid.appendChild(c));
        apply(!ev.isTrusted);   // 使用者自己換排序才回到第 1 頁；載入或返回時保持原本的頁
      });
      const resort = () => sortSel.dispatchEvent(new Event('change'));
      resort(); window.addEventListener('pageshow', resort);
    }
    apply(true);
  }

  // 首頁：大圖淡入淡出輪播（5 秒一張；可按暫停、鍵盤聚焦時暫停；減少動態時不自動播）
  const hs = $('hero-show');
  if (hs) {
    const pics = [...hs.querySelectorAll('.hs-stage img')], hd = [...hs.querySelectorAll('[data-hs]')];
    let k = 0, ht = null;
    const show = (n) => {
      k = (n + pics.length) % pics.length;
      pics.forEach((im, i) => { const on = i === k; im.classList.toggle('is-on', on); im.setAttribute('aria-hidden', String(!on)); if (on || i === (k + 1) % pics.length) { im.loading = 'eager'; if (im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); } } });
      hd.forEach((d, i) => { if (i === k) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    };
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let paused = still;
    const pb = $('hs-pause');
    const dotFocused = () => !!document.activeElement?.closest?.('[data-hs]');
    const run = () => { clearInterval(ht); if (!paused && !dotFocused()) ht = setInterval(() => show(k + 1), 5000); };
    const setPaused = (p) => { paused = p; if (pb) { pb.setAttribute('aria-pressed', String(p)); pb.setAttribute('aria-label', p ? '播放輪播' : '暫停輪播'); } run(); };
    if (pb) pb.addEventListener('click', () => setPaused(!paused));
    const preload = (n) => { const im = pics[n]; if (im && im.dataset.src) { im.loading = 'eager'; im.src = im.dataset.src; im.removeAttribute('data-src'); } };
    hd.forEach((d) => { d.addEventListener('click', () => { show(Number(d.dataset.hs)); run(); }); ['mouseenter', 'focus'].forEach((ev) => d.addEventListener(ev, () => preload(Number(d.dataset.hs)))); });
    hs.addEventListener('focusin', () => clearInterval(ht)); hs.addEventListener('focusout', run);
    show(0); setPaused(paused);
  }

  // 商品頁：縮圖、數量、加入購物車
  if ($('buy')) {
    document.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
      const m = $('main-img'); m.classList.add('swap'); setTimeout(() => { m.src = b.dataset.img; m.classList.remove('swap'); }, 160);
      document.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    }));
    const bb = $('buy'), unitOf = () => Number(bb.dataset.price);
    const upd = () => { const n = Math.max(1, Math.min(10, parseInt($('qty').value, 10) || 1)); $('qty').value = n; if ($('sum')) $('sum').textContent = nt(unitOf() * n); };
    $('minus').onclick = () => { $('qty').value--; upd(); };
    $('plus').onclick = () => { $('qty').value++; upd(); };
    $('qty').oninput = upd;
    bb.onclick = () => {
      if (bb.classList.contains('added')) return;
      if (!addToCart(bb.dataset.name, unitOf(), bb.dataset.src || '食在好蔬 北投農場', Number($('qty').value), $('main-img'), !!bb.dataset.pack, bb.dataset.unit)) return;
      const t = bb.innerHTML; bb.style.minWidth = bb.offsetWidth + 'px'; bb.classList.add('added'); bb.textContent = '已加入購物車';
      setTimeout(() => { bb.classList.remove('added'); bb.innerHTML = t; bb.style.minWidth = ''; $('qty').value = 1; upd(); }, 1600); };
  }

  // ── 標題列 LINE 登入（前端示意：正式版改成跳轉 LINE Login 授權頁，回來後由後端建立登入狀態）──
  const UKEY = 'gv-user-v1';
  const getUser = () => { try { return JSON.parse(localStorage.getItem(UKEY)); } catch (e) { return null; } };
  const loginBtn = $('line-login-h'), menu = $('user-menu'), chip = $('user-chip'), upop = $('user-pop');
  if (loginBtn && menu) {
    loginBtn.setAttribute('aria-label', 'LINE 登入');
    const paintUser = () => {
      const u = getUser();
      loginBtn.hidden = !!u; menu.hidden = !u;
      if (u) { $('user-ava').textContent = u.name[0]; $('user-nm').textContent = u.name; chip.setAttribute('aria-label', `${u.name}，帳號選單`); }
    };
    const closePop = () => { upop.hidden = true; chip.setAttribute('aria-expanded', 'false'); };
    loginBtn.addEventListener('click', () => {
      try { localStorage.setItem(UKEY, JSON.stringify({ ...(getUser() || {}), name: '王小明' })); } catch (e) {}
      paintUser(); window.dispatchEvent(new Event('gv-user'));
      showPop('<div class="pop-body"><b>已用 LINE 登入</b><p>這是示意帳號。正式版會先跳到 LINE 授權頁，同意後再回到這裡。</p></div><div class="pop-acts"><button type="button" class="pop-close" data-close>知道了</button></div>');
    });
    chip.addEventListener('click', (e) => { e.stopPropagation(); const o = upop.hidden; upop.hidden = !o; chip.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) closePop(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !upop.hidden) { closePop(); chip.focus(); } });
    $('logout-h').addEventListener('click', () => { try { localStorage.removeItem(UKEY); } catch (e) {} closePop(); paintUser(); window.dispatchEvent(new Event('gv-user')); });
    window.addEventListener('gv-user', paintUser);
    window.addEventListener('storage', (e) => { if (e.key === UKEY) paintUser(); });
    paintUser();
  }
})();
