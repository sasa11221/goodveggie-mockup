// 後台（示意）：首頁顯示規則、商品上架、合作農場。改動存在這台瀏覽器，前台各頁讀同一份資料。
(() => {
  const C = window.gvCatalog, { esc, nt, CATS, STOCK } = C;
  const main = document.getElementById('adm-main');
  const note = document.querySelector('.adm-note');
  if (note) note.textContent = C.shared
    ? '區網版：改動存在這台電腦，同一個網路的人重新整理就看得到同一份。正式版會用現有的後台登入（含兩步驟驗證）。'
    : '示意版：改動只存在這台瀏覽器，前台馬上看得到。正式版會用現有的後台登入（含兩步驟驗證）。';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  let S = C.state();
  const persist = (msg = C.shared ? '已儲存，大家重新整理就看得到' : '已儲存，前台已更新') => {
    if (!C.save(S)) { toast(C.shared ? '存不進去：資料太大或伺服器沒開，請少放幾張照片再試' : '瀏覽器的儲存空間不夠，請少放幾張照片再試一次', true); return false; }
    S = C.state(); toast(msg); return true;
  };
  let tt = null;
  const toast = (m, bad) => { const t = $('#adm-toast'); t.textContent = m; t.className = 'adm-toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); };
  const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e3);
  const isSeedP = (id) => C.SEED.products.some((p) => p.id === id);
  const isSeedF = (id) => C.SEED.farms.some((f) => f.id === id);
  const thumb = (src, alt = '') => src ? `<img class="adm-thumb" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : '<span class="adm-thumb adm-thumb-none"></span>';
  const move = (arr, id, d) => { const i = arr.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= arr.length) return arr; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; };

  // 照片：縮到最長邊 1200px、轉 JPEG，避免撐爆瀏覽器空間（正式版改成上傳到伺服器）
  const shrink = (file) => new Promise((ok, no) => {
    const r = new FileReader();
    r.onerror = no;
    r.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, 1200 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .82)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
  // 照片欄位：選多張、預覽、調順序（第一張是主圖）、移除
  const photoField = (box, initial, max) => {
    let list = [...(initial || [])];
    const paint = () => {
      $('.adm-photos', box).innerHTML = list.map((s, i) => `<figure>${thumb(s)}<figcaption>${i === 0 ? '主圖' : `第 ${i + 1} 張`}</figcaption>
        <div><button type="button" data-ph="up" data-i="${i}" aria-label="往前"${i ? '' : ' disabled'}>←</button><button type="button" data-ph="del" data-i="${i}" aria-label="移除這張">✕</button></div></figure>`).join('')
        + (list.length < max ? `<label class="adm-add-photo"><input type="file" accept="image/*" multiple hidden><span>＋ 加照片</span><small>最多 ${max} 張</small></label>` : '');
      const inp = $('input[type=file]', box);
      if (inp) inp.onchange = async () => {
        const files = [...inp.files].slice(0, max - list.length);
        try { for (const f of files) list.push(await shrink(f)); } catch (e) { toast('有照片讀不了，換一張試試', true); }
        paint();
      };
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ph]'); if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.ph === 'del') list.splice(i, 1);
      if (b.dataset.ph === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      paint();
    });
    paint();
    return () => list;
  };

  // ───────── 首頁顯示 ─────────
  const SECS = {
    harvest: { title: '這週採收', hint: '首頁第一排。只放這週有的新鮮蔬菜，預設排除「下週採收」。' },
    hot: { title: '熱門商品', hint: '首頁第二排，平台主推。可以混合各農場的商品。' },
  };
  const homeTab = () => {
    const vis = C.products();
    const usedFarms = C.farms().filter((f) => !f.hidden && vis.some((p) => p.farm === f.id));
    main.innerHTML = `<header class="adm-head"><h1>首頁顯示</h1><p>決定首頁兩排要放哪些商品、順序和數量。每次改動都會自動儲存。</p></header>` +
      Object.entries(SECS).map(([key, sec]) => {
        const cfg = S.home[key] || C.SEED.home[key];
        const chosen = (cfg.ids || []).map((id) => vis.find((p) => p.id === id)).filter(Boolean);
        const pool = vis.filter((p) => !(cfg.ids || []).includes(p.id) && (key !== 'harvest' || p.cat === 'veg' || p.cat === 'leafy'));
        const shown = C.homeList(key);
        return `<section class="adm-card" data-sec="${key}">
          <div class="adm-card-head"><h2>${sec.title}</h2><p>${sec.hint}</p></div>
          <fieldset class="adm-seg"><legend>怎麼挑商品</legend>
            <label><input type="radio" name="mode-${key}" value="manual"${cfg.mode !== 'auto' ? ' checked' : ''}> 手動挑選</label>
            <label><input type="radio" name="mode-${key}" value="auto"${cfg.mode === 'auto' ? ' checked' : ''}> 自動（依規則）</label></fieldset>
          ${cfg.mode === 'auto' ? `<div class="adm-rule">
              <fieldset><legend>放哪些農場的商品</legend>${usedFarms.map((f) => `<label><input type="checkbox" data-farm="${esc(f.id)}"${(cfg.farms || []).includes(f.id) ? ' checked' : ''}> ${esc(f.name)}</label>`).join('')}</fieldset>
              <p class="adm-small">${key === 'harvest' ? '只會放萵苣和其他葉菜；' : ''}順序跟「商品」頁的排序一樣。</p></div>`
            : `<ol class="adm-pick">${chosen.map((p, i) => `<li data-id="${esc(p.id)}">${thumb(p.img, p.name)}<span class="adm-pname">${esc(p.name)}<small>${esc(C.labelOf(p))}・NT$${nt(p.price)}${p.stock !== 'ok' ? `・<em class="st-${p.stock}">${STOCK[p.stock]}</em>` : ''}</small></span>
                <span class="adm-acts"><button type="button" data-act="up" aria-label="往前"${i ? '' : ' disabled'}>↑</button><button type="button" data-act="down" aria-label="往後"${i < chosen.length - 1 ? '' : ' disabled'}>↓</button><button type="button" data-act="rm">移除</button></span></li>`).join('') || '<li class="adm-empty">還沒有挑商品</li>'}</ol>
              <div class="adm-addline"><label class="sr-only" for="add-${key}">加入商品</label><select id="add-${key}"><option value="">選一個商品加進來…</option>${pool.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}（${esc(C.labelOf(p))}）</option>`).join('')}</select><button type="button" class="btn-small" data-act="add">加入</button></div>`}
          <div class="adm-row2">
            <label class="adm-check"><input type="checkbox" data-opt="skipNext"${cfg.skipNext ? ' checked' : ''}> 不放「下週採收」的商品</label>
            <label class="adm-num">最多顯示 <input type="number" min="1" max="24" value="${cfg.limit || 12}" data-opt="limit"> 個</label></div>
          <div class="adm-preview"><h3>首頁現在會顯示（${shown.length} 個）</h3><div class="adm-strip">${shown.map((p) => `<span>${thumb(p.img2 || p.img, p.name)}<small>${esc(p.name)}</small></span>`).join('') || '<p class="adm-small">沒有符合的商品</p>'}</div></div>
        </section>`;
      }).join('') + `<p class="adm-foot"><a class="text-link" href="index.html" target="_blank" rel="noopener">開首頁看看</a></p>`;
  };
  main.addEventListener('change', (e) => {
    const sec = e.target.closest('[data-sec]'); if (!sec) return;
    const key = sec.dataset.sec, cfg = S.home[key] = { ...(S.home[key] || C.SEED.home[key]) };
    if (e.target.name === `mode-${key}`) {
      cfg.mode = e.target.value;
      if (cfg.mode === 'manual' && !(cfg.ids || []).length) cfg.ids = C.homeList(key).map((p) => p.id);
    }
    if (e.target.dataset.farm) cfg.farms = $$('[data-farm]', sec).filter((i) => i.checked).map((i) => i.dataset.farm);
    if (e.target.dataset.opt === 'skipNext') cfg.skipNext = e.target.checked;
    if (e.target.dataset.opt === 'limit') cfg.limit = Math.max(1, Math.min(24, Number(e.target.value) || 1));
    if (e.target.tagName === 'SELECT') return;
    persist(); homeTab();
  });
  main.addEventListener('click', (e) => {
    const sec = e.target.closest('[data-sec]'); const b = e.target.closest('[data-act]');
    if (!sec || !b) return;
    const key = sec.dataset.sec, cfg = S.home[key] = { ...(S.home[key] || C.SEED.home[key]) };
    cfg.ids = [...(cfg.ids || [])];
    const id = b.closest('li')?.dataset.id;
    if (b.dataset.act === 'up') move(cfg.ids, id, -1);
    if (b.dataset.act === 'down') move(cfg.ids, id, 1);
    if (b.dataset.act === 'rm') cfg.ids = cfg.ids.filter((x) => x !== id);
    if (b.dataset.act === 'add') { const v = $(`#add-${key}`).value; if (!v) return; cfg.ids.push(v); }
    persist(); homeTab();
    const again = $(`[data-sec="${key}"] li[data-id="${id}"] [data-act="${b.dataset.act}"]`); if (again && !again.disabled) again.focus();
  });

  // ───────── 共用：管理清單（篩選、排序、分頁、批次、卡片／列表） ─────────
  const UIKEY = 'gv-adm-ui';
  const ui = (() => { try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { return {}; } })();
  const saveUi = () => { try { localStorage.setItem(UIKEY, JSON.stringify(ui)); } catch (e) {} };
  const view = (k) => ui[k + 'View'] || 'card';
  const pager = (total, page, per, key) => {
    const pages = Math.max(1, Math.ceil(total / per)); if (pages === 1) return '';
    const nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 2) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
    return `<nav class="adm-pager" aria-label="分頁"><button type="button" data-${key}page="${page - 1}"${page > 1 ? '' : ' disabled'}>上一頁</button>${nums.map((n) => n === '…' ? '<span>…</span>' : `<button type="button" data-${key}page="${n}"${n === page ? ' aria-current="page"' : ''}>${n}</button>`).join('')}<button type="button" data-${key}page="${page + 1}"${page < pages ? '' : ' disabled'}>下一頁</button></nav>`;
  };
  const viewToggle = (key) => `<div class="adm-view" role="group" aria-label="顯示方式"><button type="button" data-view="${key}:card" aria-pressed="${view(key) === 'card'}">卡片</button><button type="button" data-view="${key}:list" aria-pressed="${view(key) === 'list'}">列表</button></div>`;
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    const [key, v] = b.dataset.view.split(':'); ui[key + 'View'] = v; saveUi();
    (key === 'p' ? productsTab : farmsTab)();
  });

  // ───────── 商品 ─────────
  const pf = ui.pf = { q: '', farm: '', cat: '', status: '', sort: 'custom', page: 1, per: 24, ...(ui.pf || {}) };
  const pSel = new Set();
  const setP = (id, patch) => {
    if (isSeedP(id)) S.edits[id] = { ...(S.edits[id] || {}), ...patch };
    else S.products = S.products.map((p) => p.id === id ? { ...p, ...patch } : p);
  };
  const pMatch = (p) => {
    const q = pf.q.toLowerCase(), fm = C.farm(p.farm) || {};
    if (q && !(`${p.name} ${fm.name} ${fm.region || ''}`).toLowerCase().includes(q)) return false;
    if (pf.farm && p.farm !== pf.farm) return false;
    if (pf.cat && p.cat !== pf.cat) return false;
    if (pf.status === 'live' && p.hidden) return false;
    if (pf.status === 'off' && !p.hidden) return false;
    if ((pf.status === 'low' || pf.status === 'next') && p.stock !== pf.status) return false;
    return true;
  };
  const pSorted = (list) => {
    const s = [...list];
    if (pf.sort === 'name') s.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    if (pf.sort === 'price-asc') s.sort((a, b) => a.price - b.price);
    if (pf.sort === 'price-desc') s.sort((a, b) => b.price - a.price);
    if (pf.sort === 'new') s.reverse();
    return s;
  };
  const productsTab = () => {
    const all = C.products(true), farms = C.farms();
    const cnt = (fn) => all.filter(fn).length;
    const chips = [['', '全部', all.length], ['live', '上架中', cnt((p) => !p.hidden)], ['off', '已下架', cnt((p) => p.hidden)], ['low', '剩少量', cnt((p) => p.stock === 'low')], ['next', '下週採收', cnt((p) => p.stock === 'next')]];
    const farmName = pf.farm ? (C.farm(pf.farm) || {}).name || '' : '';
    main.innerHTML = `<header class="adm-head"><h1>商品</h1><p>商品多的時候，用上面的狀態、搜尋和篩選找；勾選後可以一次上下架或改庫存。</p>
      <button type="button" class="btn" data-pact="new">＋ 新增商品</button></header>
      <div class="adm-chips" role="group" aria-label="狀態">${chips.map(([k, t, n]) => `<button type="button" data-pchip="${k}" aria-pressed="${pf.status === k}">${t}<b>${n}</b></button>`).join('')}</div>
      <div class="adm-tools">
        <label class="adm-search"><span class="sr-only">搜尋商品</span><input id="p-q" type="search" value="${esc(pf.q)}" placeholder="搜尋商品名稱、農場或地區"></label>
        <label>農場<input id="p-farm" list="farm-names" value="${esc(farmName)}" placeholder="全部農場"><datalist id="farm-names">${farms.map((f) => `<option value="${esc(f.name)}">${esc(f.region || '')}</option>`).join('')}</datalist></label>
        <label>種類<select id="p-cat"><option value="">全部</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}"${pf.cat === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>排序<select id="p-sort">${[['custom', '自訂順序（市集順序）'], ['name', '名稱'], ['price-asc', '價格低到高'], ['price-desc', '價格高到低'], ['new', '最新加入']].map(([k, v]) => `<option value="${k}"${pf.sort === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        ${viewToggle('p')}
      </div>
      <div id="p-results"></div>`;
    pResults();
    let tq = null;
    $('#p-q').oninput = (e) => { clearTimeout(tq); tq = setTimeout(() => { pf.q = e.target.value.trim(); pf.page = 1; saveUi(); pResults(); }, 180); };
    $('#p-farm').onchange = (e) => { const f = farms.find((x) => x.name === e.target.value.trim()); pf.farm = f ? f.id : ''; if (!f) e.target.value = ''; pf.page = 1; saveUi(); pResults(); };
    $('#p-cat').onchange = (e) => { pf.cat = e.target.value; pf.page = 1; saveUi(); pResults(); };
    $('#p-sort').onchange = (e) => { pf.sort = e.target.value; saveUi(); pResults(); };
  };
  const pResults = () => {
    const box = $('#p-results'); if (!box) return;
    const list = pSorted(C.products(true).filter(pMatch));
    const pages = Math.max(1, Math.ceil(list.length / pf.per)); pf.page = Math.min(pf.page, pages);
    const from = (pf.page - 1) * pf.per, shown = list.slice(from, from + pf.per);
    const canMove = pf.sort === 'custom' && !pf.q && !pf.farm && !pf.cat && !pf.status;
    [...pSel].forEach((id) => { if (!list.some((p) => p.id === id)) pSel.delete(id); });
    const allOnPage = shown.length && shown.every((p) => pSel.has(p.id));
    const stockSel = (p) => `<select data-pf="stock" aria-label="${esc(p.name)} 庫存">${Object.entries(STOCK).map(([k, v]) => `<option value="${k}"${(p.stock || 'ok') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    const sw = (p) => `<label class="adm-switch"><input type="checkbox" data-pf="live"${p.hidden ? '' : ' checked'}><span>${p.hidden ? '已下架' : '上架中'}</span></label>`;
    const acts = (p) => `${canMove ? `<button type="button" data-pact="up" aria-label="${esc(p.name)} 往前">↑</button><button type="button" data-pact="down" aria-label="${esc(p.name)} 往後">↓</button>` : ''}<button type="button" data-pact="edit">編輯</button>${isSeedP(p.id) ? '' : '<button type="button" data-pact="del">刪除</button>'}`;
    const chk = (p) => `<input type="checkbox" class="adm-sel" data-psel="${esc(p.id)}" aria-label="選取 ${esc(p.name)}"${pSel.has(p.id) ? ' checked' : ''}>`;
    const items = view('p') === 'card'
      ? `<ul class="adm-cards">${shown.map((p) => `<li data-id="${esc(p.id)}" class="${p.hidden ? 'is-off' : ''}${pSel.has(p.id) ? ' is-sel' : ''}">
          <div class="adm-card-pic">${chk(p)}${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}${p.stock !== 'ok' ? `<span class="adm-pill st-${p.stock}">${STOCK[p.stock]}</span>` : ''}</div>
          <div class="adm-card-body"><a class="adm-card-name" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>${isSeedP(p.id) ? '' : '<b class="adm-new">新增</b>'}
            <small>${esc((C.farm(p.farm) || {}).name || '')}・${CATS[p.cat] || ''}</small>
            <p class="adm-card-price">NT$${nt(p.price)} <span>/ ${esc(p.unit)}</span></p>
            <div class="adm-card-ctrl">${stockSel(p)}${sw(p)}</div>
            <div class="adm-acts">${acts(p)}</div></div></li>`).join('')}</ul>`
      : `<div class="adm-table" role="table" aria-label="商品列表"><div class="adm-tr adm-th" role="row"><span role="columnheader"><input type="checkbox" data-psel="__page" aria-label="選取這頁全部"${allOnPage ? ' checked' : ''}></span><span role="columnheader">商品</span><span role="columnheader">種類</span><span role="columnheader">價格</span><span role="columnheader">庫存</span><span role="columnheader">狀態</span><span role="columnheader">操作</span></div>
          ${shown.map((p) => `<div class="adm-tr${p.hidden ? ' is-off' : ''}${pSel.has(p.id) ? ' is-sel' : ''}" role="row" data-id="${esc(p.id)}"><span role="cell">${chk(p)}</span>
            <span role="cell" class="adm-tname">${thumb(p.img, '')}<span><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>${isSeedP(p.id) ? '' : '<b class="adm-new">新增</b>'}<small>${esc((C.farm(p.farm) || {}).name || '')}</small></span></span>
            <span role="cell">${CATS[p.cat] || ''}</span><span role="cell" class="adm-num-c">NT$${nt(p.price)}<small>/ ${esc(p.unit)}</small></span>
            <span role="cell">${stockSel(p)}</span><span role="cell">${sw(p)}</span><span role="cell" class="adm-acts">${acts(p)}</span></div>`).join('')}</div>`;
    box.innerHTML = `<div class="adm-bulk"${pSel.size ? '' : ' hidden'}><b>已選 ${pSel.size} 項</b>
        <button type="button" data-pbulk="live">上架</button><button type="button" data-pbulk="off">下架</button>
        <label>庫存改成<select data-pbulk-stock><option value="">選擇…</option>${Object.entries(STOCK).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <button type="button" data-pbulk="clear" class="adm-link">取消選取</button></div>
      <div class="adm-sum"><span>${list.length ? `第 ${from + 1}–${from + shown.length} 項，共 ${list.length} 項` : ''}</span>
        ${view('p') === 'card' && shown.length ? `<label class="adm-check"><input type="checkbox" data-psel="__page"${allOnPage ? ' checked' : ''}> 選取這頁全部</label>` : ''}
        ${!canMove && pf.sort === 'custom' ? '<span class="adm-small">清掉搜尋和篩選後，才能用 ↑↓ 調順序</span>' : ''}</div>
      ${shown.length ? items : '<p class="adm-empty-big">沒有符合的商品。換個關鍵字或清掉篩選試試。</p>'}
      ${pager(list.length, pf.page, pf.per, 'p')}`;
  };
  main.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-pchip]'); if (chip) { pf.status = chip.dataset.pchip; pf.page = 1; saveUi(); return productsTab(); }
    const pg = e.target.closest('[data-ppage]'); if (pg) { pf.page = Number(pg.dataset.ppage); saveUi(); pResults(); $('#p-results').scrollIntoView({ block: 'start' }); return; }
    const bk = e.target.closest('[data-pbulk]');
    if (bk) {
      if (bk.dataset.pbulk === 'clear') { pSel.clear(); return pResults(); }
      const n = pSel.size; pSel.forEach((id) => setP(id, { hidden: bk.dataset.pbulk === 'off' }));
      persist(`已${bk.dataset.pbulk === 'off' ? '下架' : '上架'} ${n} 項`); pSel.clear(); return productsTab();
    }
    const b = e.target.closest('[data-pact]'); if (!b) return;
    const id = b.closest('[data-id]')?.dataset.id;
    if (b.dataset.pact === 'new') return productForm();
    if (b.dataset.pact === 'edit') return productForm(C.product(id));
    if (b.dataset.pact === 'del') {
      const p = S.products.find((x) => x.id === id);
      if (!confirm(`確定刪除「${p.name}」？刪除後前台就看不到了。`)) return;
      S.products = S.products.filter((x) => x.id !== id);
      Object.values(S.home).forEach((c) => { if (c.ids) c.ids = c.ids.filter((x) => x !== id); });
      persist('已刪除'); return productsTab();
    }
    if (b.dataset.pact === 'up' || b.dataset.pact === 'down') {
      S.order = S.order || C.products(true).map((p) => p.id);
      C.products(true).forEach((p) => { if (!S.order.includes(p.id)) S.order.push(p.id); });
      move(S.order, id, b.dataset.pact === 'up' ? -1 : 1);
      persist(); pResults();
      const again = $(`[data-id="${CSS.escape(id)}"] [data-pact="${b.dataset.pact}"]`); if (again) again.focus();
    }
  });
  main.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.psel) {
      if (t.dataset.psel === '__page') $$('[data-psel]:not([data-psel="__page"])').forEach((c) => { if (t.checked) pSel.add(c.dataset.psel); else pSel.delete(c.dataset.psel); });
      else if (t.checked) pSel.add(t.dataset.psel); else pSel.delete(t.dataset.psel);
      return pResults();
    }
    if (t.matches('[data-pbulk-stock]') && t.value) { const n = pSel.size; pSel.forEach((id) => setP(id, { stock: t.value })); persist(`已把 ${n} 項改成「${STOCK[t.value]}」`); pSel.clear(); return productsTab(); }
    const row = t.closest('[data-id]'); if (!row || !t.dataset.pf) return;
    if (t.dataset.pf === 'stock') setP(row.dataset.id, { stock: t.value });
    if (t.dataset.pf === 'live') setP(row.dataset.id, { hidden: !t.checked });
    persist(); pResults();
  });

  const productForm = (p) => {
    const editing = !!p; p = p || { farm: 'own', cat: 'veg', unit: '包', stock: 'ok' };
    const farms = C.farms();
    main.innerHTML = `<header class="adm-head"><h1>${editing ? '編輯商品' : '新增商品'}</h1><p>存檔後馬上出現在市集，也有自己的商品頁。</p></header>
    <form class="adm-form" id="pform" novalidate>
      <div class="adm-grid">
        <label>商品名稱 *<input name="name" required value="${esc(p.name || '')}" placeholder="例如：有機乾燥白雪菇"></label>
        <label>農場 *<select name="farm"${editing && isSeedP(p.id) ? ' disabled title="原有商品不能換農場"' : ''}>${farms.map((f) => `<option value="${esc(f.id)}"${p.farm === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
        <label>種類<select name="cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}"${p.cat === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>價格（NT$）*<input name="price" type="number" min="1" inputmode="numeric" required value="${esc(p.price || '')}"></label>
        <label>單位<input name="unit" value="${esc(p.unit || '包')}" list="units"><datalist id="units"><option>包</option><option>瓶</option><option>罐</option><option>盒</option><option>份</option></datalist></label>
        <label>規格<input name="note" value="${esc(p.note || '')}" placeholder="例如：400g、250ml"></label>
        <label>庫存<select name="stock">${Object.entries(STOCK).map(([k, v]) => `<option value="${k}"${p.stock === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>標籤（選填）<input name="badge" value="${esc(p.badge || '')}" placeholder="例如：新品、最划算"></label>
      </div>
      <label class="adm-check"><input type="checkbox" name="pack"${p.pack ? ' checked' : ''}> 算進「每天最多 10 包萵苣」的上限（只有萵苣類要勾）</label>
      <label>簡介<textarea name="desc" rows="3" placeholder="一兩句話介紹這個商品">${esc(p.desc || '')}</textarea></label>
      <div class="adm-grid">
        <label>種法／原料<input name="grow" value="${esc(p.grow || '')}" placeholder="例如：有機栽培，不用化學農藥"></label>
        <label>保存方式<input name="keep" value="${esc(p.keep || '')}" placeholder="例如：冷藏、陰涼乾燥處"></label>
      </div>
      <label>怎麼吃<textarea name="eat" rows="2">${esc(p.eat || '')}</textarea></label>
      <div class="adm-photo-field"><p class="adm-label">商品照片（第一張是主圖）</p><div class="adm-photos"></div></div>
      ${editing ? '' : '<label class="adm-check"><input type="checkbox" name="toHot"> 同時放到首頁「熱門商品」</label>'}
      <p class="adm-err" id="pform-err" hidden></p>
      <div class="adm-formacts"><button type="submit" class="btn">${editing ? '儲存' : '上架'}</button><button type="button" class="btn-small" data-back>取消</button></div>
    </form>`;
    const photos = photoField($('.adm-photo-field'), p.imgs || (p.img ? [p.img] : []), 4);
    $('[data-back]').onclick = () => { go('products'); };
    $('#pform').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target, v = (n) => f.elements[n].value.trim();
      const errs = [];
      if (!v('name')) errs.push('商品名稱'); if (!(Number(v('price')) > 0)) errs.push('價格');
      const imgs = photos(); if (!imgs.length) errs.push('至少一張照片');
      if (errs.length) { const er = $('#pform-err'); er.hidden = false; er.textContent = '還沒填：' + errs.join('、'); er.scrollIntoView({ block: 'center' }); return; }
      const data = { name: v('name'), cart: editing && isSeedP(p.id) ? p.cart : v('name'), farm: editing && isSeedP(p.id) ? p.farm : v('farm'), cat: v('cat'), price: Number(v('price')), unit: v('unit') || '包', note: v('note'),
        stock: v('stock'), badge: v('badge'), pack: f.elements.pack.checked, desc: v('desc'), grow: v('grow'), keep: v('keep'), eat: v('eat'), imgs, img: imgs[0] };
      if (editing && isSeedP(p.id)) {
        // 原有商品：只記下有改的欄位；介紹類欄位留空就沿用商品頁原文
        const seed = C.SEED.products.find((x) => x.id === p.id), patch = {};
        ['name', 'price', 'unit', 'note', 'stock', 'badge', 'pack', 'cat'].forEach((k) => { if (data[k] !== seed[k]) patch[k] = data[k]; });
        ['desc', 'grow', 'keep', 'eat'].forEach((k) => { if (data[k]) patch[k] = data[k]; });
        if (JSON.stringify(imgs) !== JSON.stringify([seed.img])) { patch.imgs = imgs; patch.img = imgs[0]; }
        delete patch.cart;
        S.edits[p.id] = { ...(S.edits[p.id] || {}), ...patch };
        ['desc', 'grow', 'keep', 'eat'].forEach((k) => { if (!data[k]) delete S.edits[p.id][k]; });
      } else if (editing) S.products = S.products.map((x) => x.id === p.id ? { ...x, ...data } : x);
      else {
        const id = uid('p-'); S.products.push({ id, ...data });
        if (f.elements.toHot.checked) { const h = S.home.hot = { ...(S.home.hot || C.SEED.home.hot) }; if (h.mode === 'auto') { if (!h.farms.includes(data.farm)) h.farms = [...h.farms, data.farm]; } else h.ids = [id, ...(h.ids || [])]; }
      }
      if (persist(editing ? '已儲存' : '已上架，市集和商品頁都看得到了')) go('products');
    };
  };

  // ───────── 合作農場 ─────────
  const ff = ui.ff = { q: '', region: '', status: '', sort: 'custom', page: 1, per: 24, ...(ui.ff || {}) };
  const fSel = new Set();
  const setF = (id, patch) => {
    if (isSeedF(id)) S.farmEdits[id] = { ...(S.farmEdits[id] || {}), ...patch };
    else S.farms = S.farms.map((f) => f.id === id ? { ...f, ...patch } : f);
  };
  const regionOf = (f) => (f.region || '').slice(0, 2);   // 縣市（前兩個字）
  const farmsTab = () => {
    const all = C.farms().filter((f) => !f.own);
    const regions = [...new Set(all.map(regionOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const chips = [['', '全部', all.length], ['live', '上架中', all.filter((f) => !f.hidden).length], ['off', '暫停', all.filter((f) => f.hidden).length], ['empty', '還沒有商品', all.filter((f) => !C.products(true).some((p) => p.farm === f.id)).length]];
    main.innerHTML = `<header class="adm-head"><h1>合作農場</h1><p>LINE 談好合作之後，在這裡建農場資料和照片，再到「商品」幫它上架。農場多的時候用縣市、搜尋和狀態找。</p>
      <button type="button" class="btn" data-fact="new">＋ 新增合作農場</button></header>
      <div class="adm-chips" role="group" aria-label="狀態">${chips.map(([k, t, n]) => `<button type="button" data-fchip="${k}" aria-pressed="${ff.status === k}">${t}<b>${n}</b></button>`).join('')}</div>
      <div class="adm-tools">
        <label class="adm-search"><span class="sr-only">搜尋農場</span><input id="f-q" type="search" value="${esc(ff.q)}" placeholder="搜尋農場名稱、地區或種什麼"></label>
        <label>縣市<select id="f-region"><option value="">全部</option>${regions.map((r) => `<option${ff.region === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <label>排序<select id="f-sort">${[['custom', '自訂順序（合作農場頁順序）'], ['name', '名稱'], ['goods', '商品數多到少'], ['new', '最新加入']].map(([k, v]) => `<option value="${k}"${ff.sort === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        ${viewToggle('f')}
      </div>
      <div id="f-results"></div>`;
    fResults();
    let tq = null;
    $('#f-q').oninput = (e) => { clearTimeout(tq); tq = setTimeout(() => { ff.q = e.target.value.trim(); ff.page = 1; saveUi(); fResults(); }, 180); };
    $('#f-region').onchange = (e) => { ff.region = e.target.value; ff.page = 1; saveUi(); fResults(); };
    $('#f-sort').onchange = (e) => { ff.sort = e.target.value; saveUi(); fResults(); };
  };
  const fResults = () => {
    const box = $('#f-results'); if (!box) return;
    const prods = C.products(true), count = (f) => prods.filter((p) => p.farm === f.id).length;
    let list = C.farms().filter((f) => !f.own).filter((f) => {
      const q = ff.q.toLowerCase();
      if (q && !(`${f.name} ${f.region || ''} ${f.crops || ''}`).toLowerCase().includes(q)) return false;
      if (ff.region && regionOf(f) !== ff.region) return false;
      if (ff.status === 'live' && f.hidden) return false;
      if (ff.status === 'off' && !f.hidden) return false;
      if (ff.status === 'empty' && count(f)) return false;
      return true;
    });
    if (ff.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    if (ff.sort === 'goods') list.sort((a, b) => count(b) - count(a));
    if (ff.sort === 'new') list.reverse();
    const pages = Math.max(1, Math.ceil(list.length / ff.per)); ff.page = Math.min(ff.page, pages);
    const from = (ff.page - 1) * ff.per, shown = list.slice(from, from + ff.per);
    const canMove = ff.sort === 'custom' && !ff.q && !ff.region && !ff.status;
    [...fSel].forEach((id) => { if (!list.some((f) => f.id === id)) fSel.delete(id); });
    const allOnPage = shown.length && shown.every((f) => fSel.has(f.id));
    const chk = (f) => `<input type="checkbox" class="adm-sel" data-fsel="${esc(f.id)}" aria-label="選取 ${esc(f.name)}"${fSel.has(f.id) ? ' checked' : ''}>`;
    const sw = (f) => `<label class="adm-switch"><input type="checkbox" data-ff="live"${f.hidden ? '' : ' checked'}><span>${f.hidden ? '暫停' : '上架中'}</span></label>`;
    const acts = (f) => `${canMove ? `<button type="button" data-fact="up" aria-label="${esc(f.name)} 往前">↑</button><button type="button" data-fact="down" aria-label="${esc(f.name)} 往後">↓</button>` : ''}<button type="button" data-fact="goods">看商品</button><button type="button" data-fact="edit">編輯</button>${isSeedF(f.id) ? '' : '<button type="button" data-fact="del">刪除</button>'}`;
    const items = view('f') === 'card'
      ? `<ul class="adm-cards adm-cards-farm">${shown.map((f) => `<li data-id="${esc(f.id)}" class="${f.hidden ? 'is-off' : ''}${fSel.has(f.id) ? ' is-sel' : ''}">
          <div class="adm-card-pic">${chk(f)}${f.img ? `<img src="${esc(f.img)}" alt="" loading="lazy">` : ''}</div>
          <div class="adm-card-body"><a class="adm-card-name" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>${isSeedF(f.id) ? '' : '<b class="adm-new">新增</b>'}
            <small>${esc(f.region || '')}・${count(f)} 項商品</small>
            ${f.crops ? `<p class="adm-card-crops">${esc(f.crops)}</p>` : ''}
            <div class="adm-card-ctrl">${sw(f)}</div><div class="adm-acts">${acts(f)}</div></div></li>`).join('')}</ul>`
      : `<div class="adm-table adm-table-farm" role="table" aria-label="農場列表"><div class="adm-tr adm-th" role="row"><span role="columnheader"><input type="checkbox" data-fsel="__page" aria-label="選取這頁全部"${allOnPage ? ' checked' : ''}></span><span role="columnheader">農場</span><span role="columnheader">地區</span><span role="columnheader">商品</span><span role="columnheader">狀態</span><span role="columnheader">操作</span></div>
          ${shown.map((f) => `<div class="adm-tr${f.hidden ? ' is-off' : ''}${fSel.has(f.id) ? ' is-sel' : ''}" role="row" data-id="${esc(f.id)}"><span role="cell">${chk(f)}</span>
            <span role="cell" class="adm-tname">${thumb(f.img, '')}<span><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>${isSeedF(f.id) ? '' : '<b class="adm-new">新增</b>'}<small>${esc(f.crops || '')}</small></span></span>
            <span role="cell">${esc(f.region || '')}</span><span role="cell" class="adm-num-c">${count(f)} 項</span><span role="cell">${sw(f)}</span><span role="cell" class="adm-acts">${acts(f)}</span></div>`).join('')}</div>`;
    box.innerHTML = `<div class="adm-bulk"${fSel.size ? '' : ' hidden'}><b>已選 ${fSel.size} 家</b><button type="button" data-fbulk="live">上架</button><button type="button" data-fbulk="off">暫停</button><button type="button" data-fbulk="clear" class="adm-link">取消選取</button></div>
      <div class="adm-sum"><span>${list.length ? `第 ${from + 1}–${from + shown.length} 家，共 ${list.length} 家` : ''}</span>
        ${view('f') === 'card' && shown.length ? `<label class="adm-check"><input type="checkbox" data-fsel="__page"${allOnPage ? ' checked' : ''}> 選取這頁全部</label>` : ''}
        ${!canMove && ff.sort === 'custom' ? '<span class="adm-small">清掉搜尋和篩選後，才能用 ↑↓ 調順序</span>' : ''}</div>
      ${shown.length ? items : '<p class="adm-empty-big">沒有符合的農場。</p>'}
      ${pager(list.length, ff.page, ff.per, 'f')}
      <p class="adm-small">暫停的農場，它的商品也會一起從前台消失。</p>`;
  };
  main.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-fchip]'); if (chip) { ff.status = chip.dataset.fchip; ff.page = 1; saveUi(); return farmsTab(); }
    const pg = e.target.closest('[data-fpage]'); if (pg) { ff.page = Number(pg.dataset.fpage); saveUi(); fResults(); $('#f-results').scrollIntoView({ block: 'start' }); return; }
    const bk = e.target.closest('[data-fbulk]');
    if (bk) {
      if (bk.dataset.fbulk === 'clear') { fSel.clear(); return fResults(); }
      const n = fSel.size; fSel.forEach((id) => setF(id, { hidden: bk.dataset.fbulk === 'off' }));
      persist(`已${bk.dataset.fbulk === 'off' ? '暫停' : '上架'} ${n} 家`); fSel.clear(); return farmsTab();
    }
    const b = e.target.closest('[data-fact]'); if (!b) return;
    const id = b.closest('[data-id]')?.dataset.id;
    if (b.dataset.fact === 'new') return farmForm();
    if (b.dataset.fact === 'goods') { Object.assign(pf, { farm: id, q: '', cat: '', status: '', page: 1 }); saveUi(); return go('products'); }
    if (b.dataset.fact === 'edit') return farmForm(C.farm(id));
    if (b.dataset.fact === 'del') {
      const f = S.farms.find((x) => x.id === id), n = S.products.filter((p) => p.farm === id).length;
      if (!confirm(`確定刪除「${f.name}」？${n ? `它的 ${n} 項商品也會一起刪除。` : ''}`)) return;
      S.farms = S.farms.filter((x) => x.id !== id); S.products = S.products.filter((p) => p.farm !== id);
      persist('已刪除'); return farmsTab();
    }
    if (b.dataset.fact === 'up' || b.dataset.fact === 'down') {
      S.farmOrder = C.farms().map((f) => f.id);
      move(S.farmOrder, id, b.dataset.fact === 'up' ? -1 : 1);
      persist(); fResults();
      const again = $(`[data-id="${CSS.escape(id)}"] [data-fact="${b.dataset.fact}"]`); if (again) again.focus();
    }
  });
  main.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.fsel) {
      if (t.dataset.fsel === '__page') $$('[data-fsel]:not([data-fsel="__page"])').forEach((c) => { if (t.checked) fSel.add(c.dataset.fsel); else fSel.delete(c.dataset.fsel); });
      else if (t.checked) fSel.add(t.dataset.fsel); else fSel.delete(t.dataset.fsel);
      return fResults();
    }
    const row = t.closest('[data-id]'); if (!row || !t.dataset.ff) return;
    setF(row.dataset.id, { hidden: !t.checked }); persist(); fResults();
  });

  const farmForm = (f) => {
    const editing = !!f; f = f || {};
    main.innerHTML = `<header class="adm-head"><h1>${editing ? '編輯合作農場' : '新增合作農場'}</h1><p>存檔後會出現在「合作農場」頁、市集的篩選，也有自己的農場頁。</p></header>
    <form class="adm-form" id="fform" novalidate>
      <div class="adm-grid">
        <label>農場名稱 *<input name="name" required value="${esc(f.name || '')}" placeholder="例如：山邊小農"></label>
        <label>地區 *<input name="region" required value="${esc(f.region || '')}" placeholder="例如：宜蘭三星"></label>
        <label>種什麼<input name="crops" value="${esc(f.crops || '')}" placeholder="例如：青蔥、蒜苗"></label>
        <label>種法<input name="grow" value="${esc(f.grow || '')}" placeholder="例如：友善耕作，不用除草劑"></label>
        <label>認證（選填）<input name="cert" value="${esc(f.cert || '')}" placeholder="例如：有機驗證，證號 …"></label>
      </div>
      <label>YouTube 影片（選填，一行貼一個網址；也可以在網址後面空一格寫標題）<textarea name="videos" rows="3" placeholder="https://www.youtube.com/watch?v=… 農場介紹">${esc((f.videos || []).map((v) => (v.url || v) + (v.title ? ' ' + v.title : '')).join('\n'))}</textarea></label>
      <label>一句話介紹 *<textarea name="summary" rows="2" required placeholder="出現在合作農場列表和商品頁">${esc(f.summary || '')}</textarea></label>
      <label>我們為什麼選這家農場（選填）<textarea name="story" rows="4" placeholder="去農場看到的事、和農夫聊了什麼">${esc(f.story || '')}</textarea></label>
      <div class="adm-photo-field"><p class="adm-label">農場照片（第一張是主圖，其他放「農場裡」相簿）</p><div class="adm-photos"></div></div>
      <p class="adm-err" id="fform-err" hidden></p>
      <div class="adm-formacts"><button type="submit" class="btn">${editing ? '儲存' : '建立農場'}</button><button type="button" class="btn-small" data-back>取消</button></div>
    </form>`;
    const photos = photoField($('.adm-photo-field'), f.imgs || (f.img ? [f.img] : []), 6);
    $('[data-back]').onclick = () => { go('farms'); };
    $('#fform').onsubmit = (e) => {
      e.preventDefault();
      const el = e.target, v = (n) => el.elements[n].value.trim();
      const errs = []; if (!v('name')) errs.push('農場名稱'); if (!v('region')) errs.push('地區'); if (!v('summary')) errs.push('一句話介紹');
      const imgs = photos(); if (!imgs.length) errs.push('至少一張照片');
      const vids = el.elements.videos.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [url, ...t] = l.split(/\s+/); return { url, title: t.join(' ') }; });
      const badV = vids.filter((x) => !C.ytId(x.url));
      if (errs.length || badV.length) {
        const er = $('#fform-err'); er.hidden = false;
        er.textContent = [errs.length ? '還沒填：' + errs.join('、') : '', badV.length ? '這些影片網址看不懂，請貼 YouTube 網址：' + badV.map((x) => x.url).join('、') : ''].filter(Boolean).join('　');
        er.scrollIntoView({ block: 'center' }); return;
      }
      const data = { videos: vids.filter((x) => C.ytId(x.url)), name: v('name'), region: v('region'), crops: v('crops'), grow: v('grow'), cert: v('cert'), summary: v('summary'), story: v('story'), imgs, img: imgs[0], label: `${v('name')}（${v('region')}）` };
      if (editing && isSeedF(f.id)) S.farmEdits[f.id] = { ...(S.farmEdits[f.id] || {}), ...data };
      else if (editing) S.farms = S.farms.map((x) => x.id === f.id ? { ...x, ...data } : x);
      else S.farms.push({ id: uid('f-'), ...data });
      if (persist(editing ? '已儲存' : '農場已建立，接著到「商品」幫它上架商品')) go('farms');
    };
  };

  // ───────── 切換分頁 ─────────
  const go = (tab) => {
    if (tab === 'reset') {
      if (!confirm('還原成網站原本的示意資料？後台做過的改動都會清掉。')) return go(cur);
      C.reset();
      S = C.state(); toast('已還原'); tab = 'home';
    }
    cur = tab;
    $$('.adm-nav [data-tab]').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    ({ home: homeTab, products: productsTab, farms: farmsTab })[tab]();
    history.replaceState(null, '', '#' + tab);
    main.focus({ preventScroll: true }); window.scrollTo(0, 0);
  };
  let cur = 'home';
  // 匯出／匯入：把後台資料搬到另一個網址或另一台電腦
  document.querySelector('[data-io="export"]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(C.state(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `食在好蔬後台資料-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  document.querySelector('[data-io="import"]').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !('products' in data || 'home' in data)) throw new Error();
      if (!confirm('用這個檔案的資料取代目前後台的內容？')) return;
      S = { ...C.state(), ...data };
      if (persist(C.shared ? '已匯入，大家重新整理就看得到' : '已匯入')) go(cur);
    } catch (err) { toast('這個檔案不是後台匯出的資料', true); }
  });

  // 大量測試資料（示意用）：40 家農場、200 項商品，照片沿用現有的，可以一鍵清掉
  const testData = () => {
    const regions = ['宜蘭三星', '宜蘭員山', '花蓮壽豐', '花蓮瑞穗', '台東池上', '台東鹿野', '雲林西螺', '雲林古坑', '嘉義梅山', '南投埔里', '南投魚池', '屏東高樹', '苗栗大湖', '彰化溪州', '台南官田', '台中新社', '桃園復興', '新竹尖石', '高雄美濃', '新北坪林'];
    const words = ['山邊', '溪畔', '晨光', '青禾', '好田', '小樹', '土香', '雲上', '綠野', '果香', '稻穗', '友善', '阿嬤', '石頭', '竹林', '日出', '老家', '微風', '暖陽', '清泉'];
    const crops = ['青蔥、蒜苗', '高麗菜、花椰菜', '番茄、小黃瓜', '地瓜、芋頭', '香菇、木耳', '柑橘、檸檬', '茶葉', '米、糙米', '蜂蜜', '梅子、梅醋', '咖啡', '芭樂、蓮霧'];
    const goods = [['青蔥', 'leafy', '把'], ['高麗菜', 'leafy', '顆'], ['小番茄', 'goods', '盒'], ['地瓜', 'goods', '包'], ['乾香菇', 'mushroom', '包'], ['木耳露', 'goods', '瓶'], ['檸檬', 'goods', '袋'], ['高山茶', 'goods', '罐'], ['糙米', 'goods', '包'], ['龍眼蜜', 'goods', '瓶'], ['脆梅', 'goods', '罐'], ['咖啡豆', 'goods', '包'], ['綜合萵苣', 'veg', '包'], ['紅橡木萵苣', 'veg', '包']];
    const fimgs = [...new Set(C.SEED.farms.map((f) => f.img).concat(C.SEED.products.map((p) => p.img)))];
    const pimgs = C.SEED.products.map((p) => p.img);
    const rnd = (n, k) => (n * 9301 + k * 49297) % 233280 / 233280;
    const farms = Array.from({ length: 40 }, (_, i) => {
      const region = regions[i % regions.length], name = `${words[(i * 7) % words.length]}${['農場', '小農', '農園', '有機農場'][i % 4]}`;
      return { id: `t-f${i}`, test: true, name: `${name}${i >= 20 ? '二號' : ''}`, region, crops: crops[i % crops.length], summary: `${region}的${name}，示意用的測試農場。`, img: fimgs[i % fimgs.length], imgs: [fimgs[i % fimgs.length]], label: `${name}（${region}）` };
    });
    const products = Array.from({ length: 200 }, (_, i) => {
      const f = farms[i % farms.length], g = goods[(i * 5) % goods.length], r = rnd(i, 3);
      return { id: `t-p${i}`, test: true, name: `${f.name.slice(0, 2)}${g[0]}`, cart: `${g[0]}（${f.name}）`, farm: f.id, cat: g[1], unit: g[2], note: '', price: 60 + Math.round(rnd(i, 7) * 42) * 10,
        stock: r < .12 ? 'low' : r < .2 ? 'next' : 'ok', hidden: rnd(i, 11) < .08, img: pimgs[i % pimgs.length], imgs: [pimgs[i % pimgs.length]], desc: '示意用的測試商品。' };
    });
    return { farms, products };
  };
  const navTest = document.querySelector('[data-io="test"]');
  if (navTest) navTest.addEventListener('click', () => {
    const has = S.products.some((p) => p.test) || S.farms.some((f) => f.test);
    if (has) {
      if (!confirm('清掉測試用的 40 家農場和 200 項商品？你自己新增的不會動。')) return;
      S.farms = S.farms.filter((f) => !f.test); S.products = S.products.filter((p) => !p.test);
      Object.values(S.home).forEach((c) => { if (c.ids) c.ids = c.ids.filter((x) => !x.startsWith('t-')); });
      persist('已清掉測試資料');
    } else {
      if (!confirm('加入 40 家測試農場、200 項測試商品，看看量大時後台怎麼管理？前台也會出現，之後可以一鍵清掉。')) return;
      const t = testData(); S.farms = [...S.farms, ...t.farms]; S.products = [...S.products, ...t.products];
      persist('已加入測試資料：40 家農場、200 項商品');
    }
    navTest.textContent = (S.products.some((p) => p.test)) ? '清除測試資料' : '載入大量測試資料';
    go(cur);
  });
  if (navTest) navTest.textContent = (S.products.some((p) => p.test)) ? '清除測試資料' : '載入大量測試資料';
  if (C.moved()) setTimeout(() => toast('已把你之前在這台瀏覽器改的資料搬到區網，大家都看得到了'), 300);
  $$('.adm-nav [data-tab]').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
  go(['products', 'farms'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home');
})();
