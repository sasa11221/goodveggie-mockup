// 會員中心（前端示意：資料存在這台瀏覽器，之後改接 LINE Login 與後台）
(() => {
  const $ = (id) => document.getElementById(id);
  const UKEY = 'gv-user-v1', OKEY = 'gv-orders-v2';
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const save = (u) => { try { localStorage.setItem(UKEY, JSON.stringify(u)); } catch (e) {} };
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STATUS = { pending: ['待確認', 'wait'], ready: ['準備出貨', 'ok'], done: ['已送達', 'done'], cancel: ['已取消', 'off'] };
  const form = $('acc-form'); if (!form) return;
  let savedTimer = null;
  const flash = (msg) => { $('acc-saved').textContent = msg; clearTimeout(savedTimer); savedTimer = setTimeout(() => { $('acc-saved').textContent = ''; }, 2500); };
  const buyer = () => form.querySelector('[name=a-buyer]:checked').value;
  const syncTeam = () => { $('a-team').hidden = buyer() !== 'team'; };

  const render = () => {
    const u = load(UKEY);
    $('acc-guest').hidden = !!u; $('acc').hidden = !u;
    if (!u) return;
    $('acc-ava').textContent = u.name[0]; $('acc-name').textContent = u.name;
    $('a-name').value = u.name || ''; $('a-phone').value = u.phone || ''; $('a-addr').value = u.addr || '';
    form.querySelector(`[name=a-buyer][value=${u.buyer === 'team' ? 'team' : 'personal'}]`).checked = true;
    $('a-org').value = u.org || ''; $('a-tax').value = u.tax || ''; syncTeam();
    const n = u.notify || { order: true, harvest: true, farm: false };
    document.querySelectorAll('[data-notify]').forEach((c) => { c.checked = !!n[c.dataset.notify]; });
    const orders = load(OKEY) || [];
    $('acc-olist').innerHTML = orders.length ? orders.slice(0, 3).map((o) => {
      const [label, cls] = STATUS[o.status] || ['—', 'wait'];
      const total = o.items.reduce((s, x) => s + x.qty * x.price, 0);
      const names = o.items.map((x) => x.name).join('、');
      return `<li><a href="orders.html"><span><b>${esc(o.id)}</b><small>${esc(names.length > 26 ? names.slice(0, 26) + '…' : names)}</small></span>
        <span class="amt">NT$${total.toLocaleString()}</span><span class="st-${cls}"><span class="od-pill">${label}</span></span></a></li>`;
    }).join('') : '<li class="empty">還沒有訂單。<a href="shop.html">去市集挑菜</a></li>';
  };

  $('acc-login').addEventListener('click', () => { const h = $('line-login-h'); if (h) h.click(); });
  $('acc-logout').addEventListener('click', () => { try { localStorage.removeItem(UKEY); } catch (e) {} window.dispatchEvent(new Event('gv-user')); });
  form.addEventListener('change', (e) => { if (e.target.name === 'a-buyer') syncTeam(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = load(UKEY); if (!u) return;
    const phone = $('a-phone').value.replace(/\D/g, '');
    const ok = !phone || /^09\d{8}$/.test(phone);
    $('a-phone-err').hidden = ok; $('a-phone').setAttribute('aria-invalid', String(!ok));
    if (!ok) { $('a-phone').focus(); return; }
    save({ ...u, name: $('a-name').value.trim() || u.name, phone, addr: $('a-addr').value.trim(),
           buyer: buyer(), org: $('a-org').value.trim(), tax: $('a-tax').value.trim() });
    window.dispatchEvent(new Event('gv-user'));
    flash('已儲存，下次結帳會自動帶入');
  });
  document.querySelectorAll('[data-notify]').forEach((c) => c.addEventListener('change', () => {
    const u = load(UKEY); if (!u) return;
    save({ ...u, notify: { ...(u.notify || { order: true, harvest: true, farm: false }), [c.dataset.notify]: c.checked } });
    flash(c.checked ? '已開啟通知' : '已關閉通知');
  }));
  window.addEventListener('gv-user', render);
  render();
})();
