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
  const group = (items) => items.reduce((g, x) => ((g[x.src] = g[x.src] || []).push(x), g), {});
  const linesHtml = (items) => Object.entries(group(items)).sort((a, b) => ((a[0].includes('食在好蔬') ? '0' : '1') + a[0]).localeCompare((b[0].includes('食在好蔬') ? '0' : '1') + b[0], 'zh-Hant')).map(([src, xs]) =>
    `<div class="co-group"><h3>${esc(src)}</h3>${xs.map((x) =>
      `<p class="co-line"><span>${window.gvPhotoOf && gvPhotoOf(x) ? `<img class="co-thumb" src="${esc(gvPhotoOf(x))}" alt="">` : ''}${esc(x.name)} <small>× ${x.qty}</small></span><span>${x.price ? money(x.qty * x.price) : ''}</span></p>`).join('')}</div>`).join('');

  // ───────── 結帳頁 ─────────
  const form = $('co');
  if (form) {
    const items = window.gvCart.items;
    const emptyCheck = () => { const e = !items.length; form.hidden = e; $('co-empty').hidden = !e; return e; };
    if (emptyCheck()) { window.addEventListener('gv-cart', () => { if (items.length) location.reload(); }); return; }

    // 登入（示意）
    const showUser = () => {
      const u = load(UKEY, null);
      $('co-login').hidden = !!u; $('co-who').hidden = !u;
      if (u) {
        $('me-name').textContent = u.name; $('ava').textContent = u.name[0];
        if (!$('f-name').value) $('f-name').value = u.name;
        if (!$('f-phone').value) $('f-phone').value = u.phone || '';
        // 會員中心存過的資料，結帳時自動帶入
        if (!$('f-addr').value && u.addr) $('f-addr').value = u.addr;
        if (u.buyer === 'team' && !$('f-org').value) {
          form.querySelector('[name=buyer][value=team]').checked = true;
          $('f-org').value = u.org || ''; $('f-tax').value = u.tax || '';
        }
      }
    };
    $('line-login').onclick = () => { store(UKEY, { ...(load(UKEY, null) || {}), name: '王小明' }); $('login-err').hidden = true; showUser(); window.dispatchEvent(new Event('gv-user')); $('f-phone').focus(); };
    $('logout').onclick = () => { try { localStorage.removeItem(UKEY); } catch (e) {} $('f-name').value = ''; $('f-phone').value = ''; showUser(); window.dispatchEvent(new Event('gv-user')); };
    // 標題列登入／登出時，結帳頁跟著更新
    window.addEventListener('gv-user', () => { if (!load(UKEY, null)) { $('f-name').value = ''; $('f-phone').value = ''; } else $('login-err').hidden = true; showUser(); paint(); });
    showUser();

    // 出貨日：接下來三批採收
    $('days').innerHTML = gvHarvests(3).map((d, i) =>
      `<label class="co-opt"><input type="radio" name="day" value="${d.toISOString()}"${i ? '' : ' required'}><span><b>${gvFmt(d)}</b><small>${i === 0 ? '最近一批・' : ''}早上採收，當天出貨</small></span></label>`).join('');
    $('farm-note').hidden = !items.some((x) => !String(x.src).includes('食在好蔬'));

    const isTeam = () => form.querySelector('[name=buyer]:checked').value === 'team';
    const paint = () => {
      const team = isTeam();
      $('team-box').hidden = !team;
      $('split-box').hidden = !$('f-split').checked;
      $('pay-invoice').hidden = !team;
      if (!team && $('pay-invoice').querySelector('input').checked) form.querySelector('[name=pay][value=銀行轉帳]').checked = true;
      $('sum-lines').innerHTML = linesHtml(items);
      const t = money(sumOf(items)) + (hasTbd(items) ? '＋待填' : '');
      $('sum-sub').textContent = t; $('sum-total').textContent = t + '＋運費';
      const d = form.querySelector('[name=day]:checked'), a = $('f-addr').value.trim();
      $('sum-pick').innerHTML = d && a ? `<b>${gvFmt(new Date(d.value))}</b> 採收出貨<br>送到 ${esc(a)}` : '還沒填送達地址和出貨日';
    };
    form.addEventListener('change', () => { paint(); if (form.querySelector('[name=day]:checked')) $('day-err').hidden = true; });
    form.addEventListener('input', (e) => {
      if (e.target.id === 'f-addr') { paint(); if (e.target.value.trim()) $('addr-err').hidden = true; }
      if (e.target.id === 'f-org' && e.target.value.trim()) $('org-err').hidden = true;
    });
    paint();
    window.addEventListener('gv-cart', () => { if (!emptyCheck()) paint(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (emptyCheck()) return;
      const u = load(UKEY, null);
      const phone = $('f-phone').value.replace(/\D/g, ''), addr = $('f-addr').value.trim(), team = isTeam(), org = $('f-org').value.trim();
      const day = form.querySelector('[name=day]:checked');
      const bad = [];
      $('login-err').hidden = !!u; if (!u) bad.push($('line-login'));
      if (u) {
        const ok = /^09\d{8}$/.test(phone); $('phone-err').hidden = ok; $('f-phone').setAttribute('aria-invalid', !ok);
        const nameOk = !!$('f-name').value.trim(); $('f-name').setAttribute('aria-invalid', !nameOk); if ($('name-err')) $('name-err').hidden = nameOk;
        if (!nameOk) bad.push($('f-name')); if (!ok) bad.push($('f-phone'));
        $('org-err').hidden = !team || !!org; if (team && !org) bad.push($('f-org'));
      }
      $('addr-err').hidden = !!addr; if (!addr) bad.push($('f-addr'));
      $('day-err').hidden = !!day; if (!day) bad.push(form.querySelector('[name=day]'));
      if (bad.length) { bad[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); bad[0].focus({ preventScroll: true }); return; }

      store(UKEY, { ...u, phone, addr, buyer: team ? 'team' : 'personal', org: team ? org : '', tax: team ? $('f-tax').value.trim() : '' });
      const now = new Date(), pad = (n) => String(n).padStart(2, '0');
      const id = `GV${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(now.getHours()).padStart(2, '0')}${pad(now.getMinutes())}${pad(now.getSeconds())}${Math.floor(Math.random() * 90 + 10)}`;
      const orders = load(OKEY, []);
      orders.unshift({ id, created: now.toISOString(), status: 'pending', items: items.map((x) => ({ ...x })),
        name: $('f-name').value.trim(), phone, addr, day: day.value,
        team: team ? { org, tax: $('f-tax').value.trim(), split: $('f-split').checked, list: $('f-list').value.trim() } : null,
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
  const STEPS = ['已送出', '確認訂單', '出貨', '送達'];
  const STATUS = { pending: ['待確認', 0, 'wait'], ready: ['準備出貨', 2, 'ok'], done: ['已送達', 3, 'done'], cancel: ['已取消', -1, 'off'] };

  // 第一次打開時放兩筆示意訂單（共用 site.js 的 gvSeedOrders）
  let orders = gvSeedOrders();

  let tab = 'open';
  const card = (o) => {
    const [label, at, cls] = STATUS[o.status] || ['處理中', 0, 'wait'];
    const day = new Date(o.day), t = sumOf(o.items);
    const steps = o.status === 'cancel' ? '' : `<ol class="od-steps">${STEPS.map((s, i) => `<li class="${i <= at ? 'is-on' : ''}${i === at ? ' is-now' : ''}">${s}</li>`).join('')}</ol>`;
    const acts = [];
    if (o.status === 'pending') acts.push(`<button type="button" class="btn-small" data-act="cancel">取消訂單</button>`, `<button type="button" class="link-btn mock-only" data-act="confirm">（示意）模擬店家確認訂單</button>`);
    if (o.status === 'ready') acts.push(`<button type="button" class="link-btn mock-only" data-act="pick">（示意）模擬送達</button>`);
    if (o.status === 'done' || o.status === 'cancel') acts.push(`<button type="button" class="btn-small" data-act="again">再買一次</button>`);
    const who = o.team ? `${esc(o.team.org)}${o.team.tax ? `（統編 ${esc(o.team.tax)}）` : ''}${o.team.split ? '・每份分開包裝' : ''}` : '個人';
    return `<article class="od-card st-${cls}" data-id="${esc(o.id)}">
      <header class="od-head"><div><h2>${esc(o.id)}${o.team ? '<span class="od-who">公司・團體</span>' : ''}</h2><small>${new Date(o.created).toLocaleDateString('zh-TW')} 下單${o.demo ? '' : ''}</small></div><span class="od-pill">${label}</span></header>
      ${steps}
      ${o.status === 'ready' ? `<p class="od-ready">訂單已確認，菜會在 <b>${gvFmt(day)}</b> 早上採收後出貨，出貨時會傳 LINE 通知你。</p>` : ''}
      ${o.status === 'pending' ? `<p class="od-wait">我們正在確認庫存，好了會傳 LINE 給你。這段時間可以自己取消。</p>` : ''}
      <div class="od-body">
        <dl class="od-meta"><div><dt>出貨</dt><dd>${gvFmt(day)}</dd></div><div><dt>送到</dt><dd>${esc(o.addr)}</dd></div><div><dt>訂購</dt><dd>${who}</dd></div><div><dt>聯絡人</dt><dd>${esc(o.name)}</dd></div><div><dt>付款</dt><dd>${esc(o.pay)}</dd></div>${o.note ? `<div><dt>備註</dt><dd>${esc(o.note)}</dd></div>` : ''}</dl>
        <div class="od-items">${linesHtml(o.items)}<p class="co-line od-total"><span>合計</span><span>${money(t)}${hasTbd(o.items) ? '＋待填' : ''}<small>＋運費</small></span></p></div>
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
    $('od-done').innerHTML = `<b>訂單已送出</b><span>編號 ${esc(nid)}。我們確認庫存後會傳 LINE 通知你，請留意訊息。</span>`;
  }
  paint();
})();
