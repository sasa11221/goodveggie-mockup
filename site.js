// A 版模擬站共用腳本（示意用：購物車存在記憶體，重新整理就清空）
(() => {
  const $ = (id) => document.getElementById(id);
  // 購物車存在瀏覽器裡，重新整理或換頁都還在（正式版改存伺服器，登入後換裝置也看得到）
  const KEY = 'gv-cart-v1';
  const cart = (() => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const drawer = $('drawer'), scrim = $('scrim');
  const open = () => { drawer.classList.add('open'); scrim.classList.add('show'); drawer.inert = false; drawer.setAttribute('aria-hidden', 'false'); setTimeout(() => $('cart-close').focus(), 50); };
  const close = () => { drawer.classList.remove('open'); scrim.classList.remove('show'); drawer.inert = true; drawer.setAttribute('aria-hidden', 'true'); $('cart-open').focus(); };
  $('cart-open').addEventListener('click', open);
  $('cart-close').addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });
  $('burger').addEventListener('click', () => {
    const o = $('nav').classList.toggle('open');
    $('burger').setAttribute('aria-expanded', o);
    $('burger').setAttribute('aria-label', o ? '關閉選單' : '開啟選單');
  });

  function render() {
    save();
    const c = $('count'), n = cart.reduce((s, x) => s + x.qty, 0);
    if (String(n) !== c.textContent) { c.textContent = n; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    $('total').textContent = 'NT$' + cart.reduce((s, x) => s + x.qty * x.price, 0).toLocaleString() + (cart.some((x) => !x.price) ? '＋待填品項' : '');
    $('cart-open').classList.toggle('has-items', cart.length > 0);
    $('cart-open').setAttribute('aria-label', n ? `購物車，${n} 件` : '購物車');
    if (!cart.length) { $('drawer-body').innerHTML = '<p class="empty">購物車是空的。到市集挑這週採收的菜吧。</p>'; return; }
    const g = {};
    cart.forEach((x) => (g[x.src] = g[x.src] || []).push(x));
    const full = packTotal() >= PACK_LIMIT ? `<p class="limit-note">萵苣已達每日上限 ${PACK_LIMIT} 包（每個帳號每天）。需要更多？<a href="custom.html">大量採購請找我們</a></p>` : '';
    $('drawer-body').innerHTML = full + Object.entries(g).map(([src, items]) =>
      `<div class="group"><h3>${src}</h3>${items.map((x) => {
        const i = cart.indexOf(x);
        return `<div class="line" data-i="${i}">
          <div class="line-main"><span class="line-name">${x.name}</span><span class="line-unit">${x.price ? `NT$${x.price} / 件` : '單價待填'}</span></div>
          <div class="line-ctrl">
            <div class="qty qty-sm"><button type="button" data-act="dec" aria-label="${x.name} 減少一件">−</button><span aria-live="polite">${x.qty}</span><button type="button" data-act="inc" aria-label="${x.name} 增加一件"${(isPack(x) ? packTotal() >= PACK_LIMIT : x.qty >= 10) ? ' disabled' : ''}>＋</button></div>
            <span class="line-sum">${x.price ? `NT$${(x.qty * x.price).toLocaleString()}` : '—'}</span>
            <button type="button" class="remove" data-act="del">移除</button>
          </div></div>`; }).join('')}</div>`).join('');
  }
  $('drawer-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = Number(b.closest('.line').dataset.i), x = cart[i];
    if (b.dataset.act === 'inc') { if (isPack(x) && packTotal() >= PACK_LIMIT) return; x.qty = Math.min(10, x.qty + 1); }
    if (b.dataset.act === 'dec') x.qty -= 1;
    if (b.dataset.act === 'del' || x.qty <= 0) {
      b.closest('.line').classList.add('leaving');
      setTimeout(() => { cart.splice(i, 1); render(); $('cart-close').focus(); }, 220);
      return;
    }
    render();
    const again = $('drawer-body').querySelector(`.line[data-i="${i}"] [data-act="${b.dataset.act}"]`);
    if (again && !again.disabled) again.focus();
  });
  // ── 每日上限：每個帳號每天最多 10 包萵苣（後端仍會再檢查）──
  const PACK_LIMIT = 10;
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
  document.addEventListener('click', (e) => { if (!pop.contains(e.target) && !e.target.closest('[data-add],#buy')) hidePop(); });

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

  window.addToCart = (name, price, src, qty = 1, img = null, pack = false) => {
    const item = { name, price: Number(price), src, qty, pack };
    if (isPack(item) && packTotal() + qty > PACK_LIMIT) {
      const room = PACK_LIMIT - packTotal();
      showPop(`<div class="pop-body"><b>已達每日訂購上限</b>
        <p>每個帳號每天最多訂 ${PACK_LIMIT} 包萵苣，購物車裡已經有 ${packTotal()} 包${room > 0 ? `，這次最多再加 ${room} 包` : ''}。</p></div>
        <div class="pop-acts"><button type="button" class="btn-small" data-go>查看購物車</button><button type="button" class="pop-close" data-close>知道了</button></div>`, true);
      return false;
    }
    const hit = cart.find((x) => x.name === name);
    if (hit) hit.qty += qty; else cart.push(item);
    render();
    fly(img);
    const thumb = img ? `<img src="${img.currentSrc || img.src}" alt="">` : '';
    const rest = PACK_LIMIT - packTotal();
    const left = isPack(item) ? `<span class="pop-left">${rest > 0 ? `今天還可以再訂 ${rest} 包萵苣` : `今天的 ${PACK_LIMIT} 包額度已訂滿`}</span>` : '';
    setTimeout(() => showPop(`<div class="pop-item">${thumb}<div><b>已加入購物車</b><span>${name} × ${qty}</span>${left}</div></div>
      <div class="pop-acts"><button type="button" class="btn-small" data-go>查看購物車（${cart.reduce((s, x) => s + x.qty, 0)}）</button><button type="button" class="pop-close" data-close>繼續逛</button></div>`), img ? 450 : 0);
    return true;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const card = b.closest('.pcard,.vcard,li');
    const img = card ? card.querySelector('img') : null;
    const qEl = b.closest('.add-row')?.querySelector('[data-q] span');
    const n = qEl ? Number(qEl.textContent) : 1;
    if (!addToCart(b.dataset.add, b.dataset.price, b.dataset.src, n, img, !!b.dataset.pack)) return;
    if (qEl) qEl.textContent = 1;
    if (b.classList.contains('added')) return;
    const t = b.textContent; b.classList.add('added'); b.textContent = '已加入';
    setTimeout(() => { b.classList.remove('added'); b.textContent = t; }, 1400);
  });
  // 卡片上的數量加減
  document.addEventListener('click', (e) => {
    const st = e.target.closest('[data-step]'); if (!st) return;
    const sp = st.parentElement.querySelector('span');
    sp.textContent = Math.max(1, Math.min(10, Number(sp.textContent) + Number(st.dataset.step)));
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
    const apply = () => {
      const src = [...document.querySelectorAll('input[name=src]:checked')].map((i) => i.value);
      const cat = [...document.querySelectorAll('input[name=cat]:checked')].map((i) => i.value);
      const kw = norm(q.value);
      let n = 0;
      cards.forEach((c) => {
        const hit = !kw || norm(c.textContent).includes(kw);
        const ok = hit && src.includes(c.dataset.src) && cat.includes(c.dataset.cat);
        c.hidden = !ok; n += ok;
      });
      $('shown').textContent = `共 ${n} 件商品`;
      $('no-result').hidden = n > 0;
      const off = [...side.querySelectorAll('input')].filter((i) => !i.checked).length;
      $('filter-sum').textContent = off ? '（已篩選）' : '';
    };
    side.querySelectorAll('input').forEach((i) => i.addEventListener('change', apply));
    q.addEventListener('input', apply);
    fbtn.addEventListener('click', () => {
      const o = side.classList.toggle('open');
      fbtn.setAttribute('aria-expanded', o);
    });
    const qs = new URLSearchParams(location.search).get('src');
    if (qs) document.querySelectorAll('input[name=src]').forEach((i) => { i.checked = qs === 'farm' ? i.value !== 'own' : i.value === qs; });
    apply();
  }

  // 首頁：大圖淡入淡出輪播（5 秒一張；滑鼠移上去暫停；減少動態時不自動播）
  const hs = $('hero-show');
  if (hs) {
    const pics = [...hs.querySelectorAll('.hs-stage img')], hd = [...hs.querySelectorAll('[data-hs]')];
    let k = 0, ht = null;
    const show = (n) => {
      k = (n + pics.length) % pics.length;
      pics.forEach((im, i) => { im.classList.toggle('is-on', i === k); if (i === k) im.loading = 'eager'; });
      hd.forEach((d, i) => d.toggleAttribute('aria-current', i === k));
    };
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const run = () => { if (!still) { clearInterval(ht); ht = setInterval(() => show(k + 1), 5000); } };
    hd.forEach((d) => d.addEventListener('click', () => { show(Number(d.dataset.hs)); run(); }));
    if (!hs.classList.contains('hero2')) { hs.addEventListener('mouseenter', () => clearInterval(ht)); hs.addEventListener('mouseleave', run); }
    pics.slice(1).forEach((im) => { im.loading = 'eager'; });
    run();
  }

  // 首頁：合作農場輪播（6 秒換一家；滑鼠移上去或鍵盤聚焦時暫停；減少動態時不自動播）
  const fs = $('fs');
  if (fs) {
    const track = $('fs-track'), slides = [...track.children], dots = [...document.querySelectorAll('.fs-dot')];
    let at = 0, timer = null;
    const go = (n) => {
      at = (n + slides.length) % slides.length;
      track.style.transform = `translateX(-${at * 100}%)`;
      slides.forEach((sl, k) => { sl.inert = k !== at; sl.setAttribute('aria-hidden', k !== at); });
      dots.forEach((d, k) => d.toggleAttribute('aria-current', k === at));
      $('fs-now').textContent = at + 1;
    };
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const play = () => { if (!calm) { clearInterval(timer); timer = setInterval(() => go(at + 1), 6000); } };
    const stop = () => clearInterval(timer);
    document.querySelectorAll('[data-fs]').forEach((b) => b.addEventListener('click', () => { go(at + (b.dataset.fs === 'next' ? 1 : -1)); play(); }));
    dots.forEach((d) => d.addEventListener('click', () => { go(Number(d.dataset.fsTo)); play(); }));
    const box = fs.closest('section');
    box.addEventListener('mouseenter', stop); box.addEventListener('mouseleave', play);
    box.addEventListener('focusin', stop); box.addEventListener('focusout', play);
    let x0 = null;
    fs.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    fs.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) go(at + (dx < 0 ? 1 : -1));
      play();
    });
    go(0); play();
  }

  // 商品頁：縮圖、數量、加入購物車
  if ($('buy')) {
    document.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
      const m = $('main-img'); m.classList.add('swap'); setTimeout(() => { m.src = b.dataset.img; m.classList.remove('swap'); }, 160);
      document.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    }));
    const bb = $('buy'), unitOf = () => Number(bb.dataset.price);
    const upd = () => { const n = Math.max(1, Math.min(10, parseInt($('qty').value, 10) || 1)); $('qty').value = n; if ($('sum')) $('sum').textContent = unitOf() * n; };
    // 搭配包：這次買一包／每週固定一包
    if ($('plan')) {
      const base = { name: bb.dataset.name, price: bb.dataset.price };
      $('plan').addEventListener('change', (e) => {
        const wk = e.target.value === 'weekly';
        bb.dataset.name = wk ? base.name + '（每週固定）' : base.name;
        bb.dataset.price = wk ? e.target.dataset.price : base.price;
        bb.innerHTML = (wk ? '開始每週固定' : '加入購物車') + '　NT$<span id="sum"></span>' + (wk ? '／週' : '');
        upd();
      });
    }
    $('minus').onclick = () => { $('qty').value--; upd(); };
    $('plus').onclick = () => { $('qty').value++; upd(); };
    $('qty').oninput = upd;
    bb.onclick = () => {
      if (!addToCart(bb.dataset.name, unitOf(), bb.dataset.src || '食在好蔬 北投農場', Number($('qty').value), $('main-img'), !!bb.dataset.pack)) return;
      const t = bb.innerHTML; bb.classList.add('added'); bb.textContent = '已加入購物車';
      setTimeout(() => { bb.classList.remove('added'); bb.innerHTML = t; $('qty').value = 1; upd(); }, 1600); };
  }

  // ── 標題列 LINE 登入（前端示意：正式版改成跳轉 LINE Login 授權頁，回來後由後端建立登入狀態）──
  const UKEY = 'gv-user-v1';
  const getUser = () => { try { return JSON.parse(localStorage.getItem(UKEY)); } catch (e) { return null; } };
  const loginBtn = $('line-login-h'), menu = $('user-menu'), chip = $('user-chip'), upop = $('user-pop');
  if (loginBtn && menu) {
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
