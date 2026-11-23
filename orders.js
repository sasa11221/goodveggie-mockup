// 結帳頁＋我的訂單（前端示意：登入、訂單都存在這台瀏覽器，之後再接後台）
(() => {
  const $ = (id) => document.getElementById(id);
  const OKEY = 'gv-orders-v2', UKEY = 'gv-user-v1';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const money = (n) => 'NT$' + Number(n).toLocaleString('zh-TW');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sumOf = (items) => items.reduce((s, x) => s + x.qty * x.price, 0);
  const hasTbd = (items) => items.some((x) => !x.price);
  // 運費規則：有生鮮就整單冷藏宅配，金額合併計算；只有乾貨走店到店
  const SHIP = {
    cold: { fee: 150, free: 1000, name: '7-11 冷藏宅配到府', what: '生鮮', eta: '隔天送達' },
    dry: { fee: 60, free: 500, name: '7-11 店到店', what: '乾貨', eta: '約 2 到 3 天到門市' },
  };
  const isCold = (x) => {
    const p = window.gvCatalog && gvCatalog.products(true).find((q) => q.cart === x.name || q.name === x.name);
    return p ? p.cat === 'veg' || p.cat === 'leafy' : !!x.pack;
  };
  const shipOf = (items) => {
    const kind = items.some(isCold) ? 'cold' : 'dry', r = SHIP[kind], sub = sumOf(items);
    return { kind, ...r, cost: sub >= r.free ? 0 : r.fee, left: Math.max(0, r.free - sub) };
  };
  const group = (items) => items.reduce((g, x) => ((g[x.src] = g[x.src] || []).push(x), g), {});
  const linesHtml = (items, edit) => Object.entries(group(items)).sort((a, b) => ((a[0].includes('食在好蔬') ? '0' : '1') + a[0]).localeCompare((b[0].includes('食在好蔬') ? '0' : '1') + b[0], 'zh-Hant')).map(([src, xs]) =>
    `<div class="co-group"><h3>${esc(src)}</h3>${xs.map((x) =>
      edit ? `<div class="co-line co-edit" data-i="${items.indexOf(x)}"><span>${window.gvPhotoOf && gvPhotoOf(x) ? `<img class="co-thumb" src="${esc(gvPhotoOf(x))}" alt="">` : ''}<span class="co-nm">${esc(x.name)}<button type="button" class="co-del" data-act="del">移除</button></span></span>
        <span class="co-right"><span class="qty qty-sm"><button type="button" data-act="dec" aria-label="${esc(x.name)} 減少一件">−</button><span aria-live="polite">${x.qty}</span><button type="button" data-act="inc" aria-label="${esc(x.name)} 增加一件"${window.gvCart.canAdd(x) ? '' : ' disabled'}>＋</button></span><span class="co-amt">${x.price ? money(x.qty * x.price) : ''}</span></span></div>`
      : `<p class="co-line"><span>${window.gvPhotoOf && gvPhotoOf(x) ? `<img class="co-thumb" src="${esc(gvPhotoOf(x))}" alt="">` : ''}${esc(x.name)} <small>× ${x.qty}</small></span><span>${x.price ? money(x.qty * x.price) : ''}</span></p>`).join('')}</div>`).join('');

  // ───────── 結帳頁 ─────────
  const form = $('co');
  if (form) {
    const items = window.gvCart.items;
    const emptyCheck = () => { const e = !items.length; form.hidden = e; $('co-empty').hidden = !e; return e; };
    if (emptyCheck()) { window.addEventListener('gv-cart', () => { if (items.length) location.reload(); }); return; }

    // 登入（示意）
    let editing = false;
    const showUser = () => {
      const u = load(UKEY, null);
      $('co-login').hidden = !!u; $('co-who').hidden = !u;
      if (u) {
        if (!$('f-name').value) $('f-name').value = u.name;
        if (!$('f-phone').value) $('f-phone').value = u.phone || '';
        const saved = !!(u.name && /^09\d{8}$/.test(u.phone || ''));
        if (!editing) {
          $('me-fields').hidden = saved; $('edit-me').hidden = !saved;
          $('me-name').textContent = saved ? $('f-name').value : u.name; $('ava').textContent = ($('f-name').value || u.name)[0];
          $('me-sub').textContent = saved ? `${$('f-phone').value.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1-$2-$3')}・已用 LINE 登入` : '已用 LINE 登入，請補上手機號碼';
        }
        // 會員中心存過的資料，結帳時自動帶入
        if (!$('f-addr').value && u.addr) $('f-addr').value = u.addr;
        if (!$('f-store').value && u.store711) $('f-store').value = u.store711;
      }
    };
    $('line-login').onclick = () => { store(UKEY, { ...(load(UKEY, null) || {}), name: '王小明' }); $('login-err').hidden = true; showUser(); window.dispatchEvent(new Event('gv-user')); $('f-phone').focus(); };
    $('logout').onclick = () => { try { localStorage.removeItem(UKEY); } catch (e) {} $('f-name').value = ''; $('f-phone').value = ''; showUser(); window.dispatchEvent(new Event('gv-user')); };
    // 標題列登入／登出時，結帳頁跟著更新
    window.addEventListener('gv-user', () => { if (!load(UKEY, null)) { $('f-name').value = ''; $('f-phone').value = ''; } else $('login-err').hidden = true; showUser(); paint(); });
    $('edit-me').onclick = () => { editing = true; $('me-fields').hidden = false; $('edit-me').hidden = true; $('f-name').focus(); };
    showUser();

    // 訂單內容：直接改數量、移除；「再加購」打開購物車
    $('sum-lines').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const i = Number(b.closest('.co-edit').dataset.i), x = items[i]; if (!x) return;
      if (b.dataset.act === 'inc') { if (!window.gvCart.canAdd(x)) return; x.qty += 1; }
      if (b.dataset.act === 'dec') x.qty -= 1;
      if (b.dataset.act === 'del' || x.qty <= 0) items.splice(i, 1);
      window.gvCart.refresh();
      const again = $('sum-lines').querySelector(`.co-edit[data-i="${i}"] [data-act="${b.dataset.act}"]`);
      if (again && !again.disabled) again.focus();
    });

    // 出貨日：接下來三批採收（生鮮隔天到；乾貨到門市約 2 到 3 天）
    let dayKind = '';
    const renderDays = (kind) => {
      if (kind === dayKind) return; dayKind = kind;
      const was = form.querySelector('[name=day]:checked')?.value;
      $('days').innerHTML = gvHarvests(3).map((d, i) => {
        const arrive = new Date(d); arrive.setDate(arrive.getDate() + 1);
        const tip = kind === 'cold' ? `早上採收，${gvFmt(arrive)} 送到` : '當天出貨，約 2 到 3 天到門市';
        return `<label class="co-opt"><input type="radio" name="day" value="${d.toISOString()}"${i ? '' : ' required'}${was === d.toISOString() ? ' checked' : ''}><span><b>${gvFmt(d)} 出貨</b><small>${i === 0 ? '最近一批・' : ''}${tip}</small></span></label>`;
      }).join('');
      $('day-sub').textContent = kind === 'cold' ? '萵苣在出貨當天早上採收，連根裝袋，冷藏寄出。' : '每週二、週五出貨。';
    };
    $('farm-note').hidden = !items.some((x) => !String(x.src).includes('食在好蔬'));

    const paint = () => {
      const sh = shipOf(items), cold = sh.kind === 'cold';
      renderDays(sh.kind);
      $('ship-box').innerHTML = `<p class="co-shipway"><b>${sh.name}</b><small>${cold ? '購物車裡有生鮮，整單冷藏寄出，' : ''}${sh.eta}。${sh.what}滿 ${money(sh.free)} 免運，未滿收 ${money(sh.fee)}。</small></p>`;
      $('addr-box').hidden = !cold; $('store-box').hidden = cold;
      // 生鮮不收貨到付款：拒收的話菜會壞掉、來回運費也是我們出
      const cod = $('pay-cod').querySelector('input');
      cod.disabled = cold; $('pay-cod').classList.toggle('is-off', cold);
      if (cold && cod.checked) form.querySelector('[name=pay][value=信用卡]').checked = true;
      $('cod-hint').textContent = cold ? '生鮮商品不提供貨到付款' : '到 7-11 取貨時付款';
      $('sum-lines').innerHTML = linesHtml(items, true);
      const sub = sumOf(items), tbd = hasTbd(items) ? '＋待填' : '';
      $('sum-sub').textContent = money(sub) + tbd;
      $('sum-ship').textContent = sh.cost ? money(sh.cost) : '免運';
      $('sum-total').textContent = money(sub + sh.cost) + tbd;
      $('sum-free').innerHTML = sh.left ? `再買 <b>${money(sh.left)}</b> 就免運` : '<b>已達免運</b>';
      $('sum-free').classList.toggle('is-free', !sh.left);
      $('bar-total').textContent = money(sub + sh.cost) + tbd;
      $('bar-ship').textContent = sh.cost ? `含運費 ${money(sh.cost)}・再買 ${money(sh.left)} 免運` : '已達免運';
      const d = form.querySelector('[name=day]:checked'), a = cold ? $('f-addr').value.trim() : $('f-store').value.trim();
      if (d) {
        const cut = new Date(d.value); cut.setDate(cut.getDate() - 1);
        $('co-fine').innerHTML = `付款完成訂單就成立，LINE 會通知你。這筆訂單在 <b>${gvFmt(cut)} 中午 12 點前</b>可以在「我的訂單」自己取消，全額退款。`;
      }
      $('sum-pick').innerHTML = d && a ? `<b>${gvFmt(new Date(d.value))}</b> 出貨<br>${cold ? '送到' : '7-11'} ${esc(a)}` : (cold ? '還沒填送達地址和出貨日' : '還沒填取貨門市和出貨日');
    };
    form.addEventListener('change', () => { paint(); if (form.querySelector('[name=day]:checked')) $('day-err').hidden = true; });
    form.addEventListener('input', (e) => {
      if (e.target.id === 'f-addr') { paint(); if (e.target.value.trim()) $('addr-err').hidden = true; }
      if (e.target.id === 'f-store') { paint(); if (e.target.value.trim()) $('store-err').hidden = true; }
    });
    paint();
    window.addEventListener('gv-cart', () => { if (!emptyCheck()) paint(); });
    // 手機底部合計列：右側訂單內容的付款按鈕出現在畫面上時就收起來
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => $('co-bar').classList.toggle('is-away', en.isIntersecting)).observe($('submit'));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (emptyCheck()) return;
      // 對外預覽站：不建立訂單，請客人改用 LINE
      if (document.body.dataset.preview) {
        let m = document.getElementById('preview-stop');
        if (!m) { m = document.createElement('p'); m.id = 'preview-stop'; m.className = 'co-hint'; m.setAttribute('role', 'alert'); $('submit').after(m); }
        m.innerHTML = '這是預覽版網站，還沒開放線上下單，這筆訂單不會送出。想買菜請<a href="https://lin.ee/PJHXHVrQ" rel="noopener">加 LINE 官方帳號</a>訂購。';
        return;
      }
      const u = load(UKEY, null);
      const sh = shipOf(items), cold = sh.kind === 'cold', store711 = $('f-store').value.trim();
      const phone = $('f-phone').value.replace(/\D/g, ''), addr = cold ? $('f-addr').value.trim() : store711;
      const day = form.querySelector('[name=day]:checked');
      const bad = [];
      $('login-err').hidden = !!u; if (!u) bad.push($('line-login'));
      if (u) {
        const ok = /^09\d{8}$/.test(phone); $('phone-err').hidden = ok; $('f-phone').setAttribute('aria-invalid', !ok);
        const nameOk = !!$('f-name').value.trim(); $('f-name').setAttribute('aria-invalid', !nameOk); if ($('name-err')) $('name-err').hidden = nameOk;
        if (!nameOk) bad.push($('f-name')); if (!ok) bad.push($('f-phone'));
        if (!nameOk || !ok) { editing = true; $('me-fields').hidden = false; $('edit-me').hidden = true; }
      }
      $('addr-err').hidden = true; $('store-err').hidden = true;
      $(cold ? 'addr-err' : 'store-err').hidden = !!addr; if (!addr) bad.push($(cold ? 'f-addr' : 'f-store'));
      $('day-err').hidden = !!day; if (!day) bad.push(form.querySelector('[name=day]'));
      if (bad.length) { bad[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); bad[0].focus({ preventScroll: true }); return; }

      store(UKEY, { ...u, phone, ...(cold ? { addr } : { store711 }) });
      const now = new Date(), pad = (n) => String(n).padStart(2, '0');
      const id = `GV${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(now.getHours()).padStart(2, '0')}${pad(now.getMinutes())}${pad(now.getSeconds())}${Math.floor(Math.random() * 90 + 10)}`;
      const orders = load(OKEY, []);
      orders.unshift({ id, created: now.toISOString(), status: 'pending', items: items.map((x) => ({ ...x })),
        name: $('f-name').value.trim(), phone, addr: cold ? addr : `7-11 ${addr}`, day: day.value, ship: sh.cost, shipWay: sh.name,
        team: null,
        pay: form.querySelector('[name=pay]:checked').value, note: $('f-note').value.trim() });
      store(OKEY, orders);
      window.gvCart.clear();
      location.href = 'orders.html?new=' + encodeURIComponent(id);
    });
    return;
  }

  // ───────── 我的訂單 ─────────
  const list = $('od-list');
  if (!list) return;
  const STEPS = ['已成立', '備貨中', '出貨', '送達'];
  const STATUS = { pending: ['已成立', 0, 'wait'], ready: ['備貨中', 1, 'ok'], done: ['已送達', 3, 'done'], cancel: ['已取消', -1, 'off'] };

  // 第一次打開時放兩筆示意訂單（共用 site.js 的 gvSeedOrders）
  let orders = gvSeedOrders();

  let tab = 'open';
  const card = (o) => {
    const [label, at, cls] = STATUS[o.status] || ['處理中', 0, 'wait'];
    const day = new Date(o.day), t = sumOf(o.items);
    const steps = o.status === 'cancel' ? '' : `<ol class="od-steps">${STEPS.map((s, i) => `<li class="${i <= at ? 'is-on' : ''}${i === at ? ' is-now' : ''}">${s}</li>`).join('')}</ol>`;
    const acts = [];
    if (o.status === 'pending') acts.push(`<button type="button" class="btn-small" data-act="cancel">取消訂單</button>`, `<button type="button" class="link-btn mock-only" data-act="confirm">（示意）模擬開始備貨</button>`);
    if (o.status === 'ready') acts.push(`<button type="button" class="link-btn mock-only" data-act="pick">（示意）模擬送達</button>`);
    if (o.status === 'done' || o.status === 'cancel') acts.push(`<button type="button" class="btn-small" data-act="again">再買一次</button>`);
    const who = o.team ? `${esc(o.team.org)}${o.team.tax ? `（統編 ${esc(o.team.tax)}）` : ''}${o.team.split ? '・每份分開包裝' : ''}` : '個人';
    return `<article class="od-card st-${cls}" data-id="${esc(o.id)}">
      <header class="od-head"><div><h2>${esc(o.id)}${o.team ? '<span class="od-who">公司・團體</span>' : ''}</h2><small>${new Date(o.created).toLocaleDateString('zh-TW')} 下單${o.demo ? '' : ''}</small></div><span class="od-pill">${label}</span></header>
      ${steps}
      ${o.status === 'ready' ? `<p class="od-ready">正在備貨，菜會在 <b>${gvFmt(day)}</b> 早上採收後出貨，出貨時會傳 LINE 通知你。</p>` : ''}
      ${o.status === 'pending' ? `<p class="od-wait">訂單已成立，會在 <b>${gvFmt(day)}</b> 出貨。出貨前一天中午 12 點前可以自己取消，全額退款。</p>` : ''}
      <div class="od-body">
        <dl class="od-meta"><div><dt>出貨</dt><dd>${gvFmt(day)}</dd></div><div><dt>送到</dt><dd>${esc(o.addr)}</dd></div>${o.team ? `<div><dt>訂購</dt><dd>${who}</dd></div>` : ''}<div><dt>聯絡人</dt><dd>${esc(o.name)}</dd></div><div><dt>付款</dt><dd>${esc(o.pay)}</dd></div>${o.note ? `<div><dt>備註</dt><dd>${esc(o.note)}</dd></div>` : ''}</dl>
        <div class="od-items">${linesHtml(o.items)}<p class="co-line od-total"><span>合計</span><span>${money(t + (o.ship || 0))}${hasTbd(o.items) ? '＋待填' : ''}<small>${o.ship == null ? '＋運費' : o.ship ? `含運費 ${money(o.ship)}` : '免運'}</small></span></p></div>
      </div>
      <div class="od-acts">${acts.join('')}</div>
    </article>`;
  };
  const paint = () => {
    const open = orders.filter((o) => o.status === 'pending' || o.status === 'ready');
    const past = orders.filter((o) => !open.includes(o));
    $('n-open').textContent = open.length; $('n-past').textContent = past.length;
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
    const show = tab === 'open' ? open : past;
    list.innerHTML = show.length ? show.map(card).join('')
      : `<div class="od-empty"><p>${tab === 'open' ? '目前沒有進行中的訂單。' : '還沒有完成的訂單。'}</p><a class="btn" href="shop.html">去市集挑菜</a></div>`;
  };
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; paint(); }));

  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const el = b.closest('.od-card'), o = orders.find((x) => x.id === el.dataset.id);
    const act = b.dataset.act;
    if (act === 'again') { addManyToCart(o.items.map((x) => ({ ...x, qty: Math.min(x.qty, 10) }))); return; }
    if (act === 'cancel' && !confirm(`確定要取消訂單 ${o.id} 嗎？`)) return;
    o.status = { cancel: 'cancel', confirm: 'ready', pick: 'done' }[act];
    store(OKEY, orders); paint();
  });

  const nid = new URLSearchParams(location.search).get('new');
  if (nid && orders.some((o) => o.id === nid)) {
    $('od-done').hidden = false;
    $('od-done').innerHTML = `<b>訂單已成立</b><span>編號 ${esc(nid)}。出貨時會傳 LINE 通知你。</span>`;
  }
  paint();
})();
