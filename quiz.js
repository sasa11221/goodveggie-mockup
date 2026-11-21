// 市集左下角的小測驗：3 題，依喜好推薦 3 樣商品（示意：規則寫在這裡，正式版可由後台設定商品標籤）
(() => {
  const box = document.getElementById('quiz'); if (!box) return;
  const body = document.getElementById('quiz-body'), toggle = document.getElementById('quiz-toggle');
  const C = window.gvCatalog;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nt = (n) => Number(n).toLocaleString('zh-TW');

  const Q = [
    { k: 'how', q: '想怎麼吃？', opts: [['raw', '生菜沙拉', '洗一洗就能吃'], ['cook', '煮湯、快炒', '下廚用'], ['snack', '零嘴、飲品', '打開就能吃'], ['gift', '送禮', '包裝體面']] },
    { k: 'taste', q: '喜歡什麼口感？', opts: [['tender', '柔嫩不苦', ''], ['crisp', '清脆爽口', ''], ['bold', '有個性的風味', '芝麻香、菇香'], ['any', '都可以', '']] },
    { k: 'who', q: '誰要吃？', opts: [['solo', '自己', ''], ['family', '全家一起', ''], ['kid', '有小朋友', ''], ['team', '公司、團體', '量比較多']] },
  ];
  // 商品特性（原有商品）；後台新增的商品依品項推一個預設
  const TAGS = {
    'veg-red-butter': 'raw tender kid', 'veg-green-butter': 'raw tender kid', 'veg-sweet-romaine': 'raw tender crisp kid',
    'veg-romaine': 'raw crisp', 'veg-green-flame': 'raw crisp', 'veg-red-flame': 'raw crisp', 'veg-red-oak': 'raw tender', 'veg-green-oak': 'raw tender',
    'veg-frilly': 'raw crisp', 'veg-sweet-crisp': 'raw cook crisp kid', 'veg-kale': 'cook raw bold', 'veg-arugula': 'raw bold',
    'combo': 'raw tender crisp family team', 'item-mk-curly': 'raw crisp', 'item-mk-oak-mix': 'raw tender family', 'item-mk-frisee': 'raw bold',
    'item-td-shiitake': 'cook bold gift family', 'item-td-black-fungus': 'cook crisp family', 'item-td-lions-mane': 'cook gift', 'item-td-fungus-drink': 'snack gift kid',
    'item-td-crisps': 'snack crisp kid', 'item-td-xo': 'cook bold gift',
  };
  const WHY = { raw: '適合生吃做沙拉', cook: '煮湯、快炒都好用', snack: '打開就能吃', gift: '適合送禮', tender: '口感柔嫩不苦', crisp: '咬起來清脆', bold: '風味有個性', kid: '小朋友也容易接受', family: '一次吃到好幾種', team: '份量好安排' };
  const tagsOf = (p) => (TAGS[p.id] || { veg: 'raw tender', leafy: 'raw crisp', mushroom: 'cook bold', goods: 'snack gift' }[p.cat] || '').split(' ');

  let ans = {}, step = 0;
  const render = () => {
    if (step < Q.length) {
      const q = Q[step];
      body.innerHTML = `<p class="quiz-step">第 ${step + 1} 題，共 ${Q.length} 題</p><p class="quiz-q" id="quiz-q">${q.q}</p>
        <div class="quiz-opts" role="group" aria-labelledby="quiz-q">${q.opts.map(([v, t, s]) => `<button type="button" data-qa="${v}">${t}${s ? `<small>${s}</small>` : ''}</button>`).join('')}</div>
        ${step ? '<button type="button" class="quiz-back" data-qback>上一題</button>' : ''}`;
      return;
    }
    const want = [ans.how, ans.taste, ans.who].filter((x) => x && x !== 'any' && x !== 'solo');
    const list = (C ? C.products() : []).filter((p) => p.stock !== 'next');
    const scored = list.map((p, i) => {
      const t = tagsOf(p);
      let sc = 0;
      if (t.includes(ans.how)) sc += 5; else if (ans.how === 'raw' && p.cat === 'mushroom') sc -= 4; else if (ans.how === 'snack' && p.cat !== 'goods') sc -= 3;
      if (ans.taste !== 'any' && t.includes(ans.taste)) sc += 3;
      if (['family', 'kid', 'team'].includes(ans.who) && t.includes(ans.who)) sc += 2;
      if (p.stock === 'low') sc -= 0.5;
      return { p, sc: sc - i * 0.01, hit: want.filter((w) => t.includes(w)) };
    }).sort((a, b) => b.sc - a.sc).slice(0, 3);
    const label = (p) => (C && C.labelOf(p)) || '';
    body.innerHTML = `<div class="quiz-res" role="status"><h3>推薦你這 3 樣</h3><ul class="quiz-items">${scored.map(({ p, hit }) => `<li>
        <a href="${esc(p.url)}"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"></a>
        <div><b><a href="${esc(p.url)}">${esc(p.name)}</a></b><span class="why">${esc((hit.length ? hit : tagsOf(p).slice(0, 1)).map((w) => WHY[w]).filter(Boolean).slice(0, 2).join('・'))}</span>
          <span class="qp">NT$${nt(p.price)}<button class="btn-small" type="button" data-add="${esc(p.cart)}" data-unit="${esc(p.unit)}" data-price="${p.price}" data-src="${esc(label(p))}"${p.pack ? ' data-pack="1"' : ''}>加入</button></span></div></li>`).join('')}</ul>
      ${ans.who === 'team' ? '<p class="quiz-note">公司、團體訂購量比較多，可以看看<a href="enterprise.html">企業採購</a>或<a href="custom.html">特殊需求</a>。</p>' : ''}
      <button type="button" class="quiz-again" data-qagain>再測一次</button></div>`;
  };
  box.addEventListener('click', (e) => {
    const a = e.target.closest('[data-qa]');
    if (a) { ans[Q[step].k] = a.dataset.qa; step += 1; return render(); }
    if (e.target.closest('[data-qback]')) { step = Math.max(0, step - 1); return render(); }
    if (e.target.closest('[data-qagain]')) { ans = {}; step = 0; return render(); }
  });
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? '收起' : '不知道挑什麼？3 題幫你挑'; box.classList.toggle('is-open', open);
    if (open) { ans = {}; step = 0; render(); } else body.innerHTML = '';
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('is-open')) { toggle.click(); toggle.focus(); } });
})();
