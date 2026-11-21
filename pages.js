// 後台新增的商品頁（p.html?id=）與農場頁（farm.html?id=）：用同一套版型，從資料畫出來。
(() => {
  const C = window.gvCatalog; if (!C) return;
  const { esc, nt } = C;
  const main = document.getElementById('dyn'); if (!main) return;
  const id = new URLSearchParams(location.search).get('id');
  const kind = main.dataset.kind;
  const notFound = (what, back, backText) => {
    main.innerHTML = `<div class="container"><div class="page-intro"><h1>找不到這個${what}</h1><p class="lead">可能已經下架，或網址有誤。</p><a class="text-link" href="${back}">${backText}</a></div></div>`;
  };
  const crumbs = (items) => `<nav class="crumbs" aria-label="麵包屑"><ol>${items.map(([t, h]) => h ? `<li><a href="${esc(h)}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`).join('')}</ol></nav>`;
  const para = (t) => esc(t).replace(/\n+/g, '</p><p>');

  if (kind === 'product') {
    const p = C.product(id);
    if (!p || p.hidden) { notFound('商品', 'shop.html', '回市集'); return; }
    const f = C.farm(p.farm) || {};
    document.title = `${p.name}｜${f.name || ''}｜食在好蔬`;
    const imgs = (p.imgs && p.imgs.length ? p.imgs : [p.img]).filter(Boolean);
    const thumbs = imgs.length > 1 ? `<div class="thumbs">${imgs.map((s, i) => `<button type="button" aria-pressed="${i === 0}" data-img="${esc(s)}"><img src="${esc(s)}" alt="照片 ${i + 1}"></button>`).join('')}</div>` : '';
    const stock = C.STOCK[p.stock] || '充足';
    const more = C.products().filter((x) => x.farm === p.farm && x.id !== p.id).slice(0, 3);
    main.innerHTML = `<div class="container">
  ${crumbs([['首頁', 'index.html'], f.own ? ['我們的好蔬', 'veggies.html'] : ['合作農場', 'farms.html'], ...(f.own ? [] : [[f.name, f.url]]), [p.name]])}
  <div class="pdp">
    <div class="gallery"><img id="main-img" class="main" src="${esc(imgs[0] || '')}" alt="${esc(p.name)}">${thumbs}</div>
    <div class="buybox"><div class="buybox-top">
      <p class="origin"><a href="${esc(f.url)}">${esc(f.name)}${f.region && !f.own ? '・' + esc(f.region) : ''}</a></p>
      <h1>${esc(p.name)}</h1>
      ${p.desc ? `<p>${para(p.desc)}</p>` : ''}
      <p class="unit-price">NT$${nt(p.price)}<span>/ ${esc(p.unit)}</span></p>${p.note ? `<p class="unit-note">一${esc(p.unit)} ${esc(p.note)}</p>` : ''}
      </div><div class="buybox-bottom">
      <div class="buy"><div class="qty"><button type="button" id="minus" aria-label="減少">−</button><input id="qty" value="1" inputmode="numeric" aria-label="數量"><button type="button" id="plus" aria-label="增加">＋</button></div><button class="btn" type="button" id="buy" data-unit="${esc(p.unit)}" data-name="${esc(p.cart)}" data-price="${p.price}" data-src="${esc(C.labelOf(p))}"${p.pack ? ' data-pack="1"' : ''}>加入購物車</button></div>
      <dl class="facts"><div><dt>農場</dt><dd><a href="${esc(f.url)}">${esc(f.name)}</a>${f.region ? '，' + esc(f.region) : ''}</dd></div>
        <div><dt>這週狀態</dt><dd data-stock="${esc(p.stock || 'ok')}">${stock}</dd></div>
        ${p.grow || f.grow ? `<div><dt>種法</dt><dd>${esc(p.grow || f.grow)}</dd></div>` : ''}
        ${f.cert ? `<div><dt>認證</dt><dd>${esc(f.cert)}</dd></div>` : ''}
        <div><dt>出貨</dt><dd>和北投萵苣同一台購物車結帳</dd></div>
        <div><dt>付款</dt><dd>銀行轉帳</dd></div>
        ${p.keep ? `<div><dt>保存</dt><dd>${esc(p.keep)}</dd></div>` : ''}</dl>
    </div></div>
  </div>
  <div class="cols3">
    ${p.eat ? `<section><h2>怎麼吃</h2><p>${para(p.eat)}</p></section>` : ''}
    ${f.summary ? `<section><h2>關於農場</h2><p>${esc(f.summary)}<a href="${esc(f.url)}">看農場介紹</a></p></section>` : ''}
    <section><h2>一起買</h2><p>合作農場的商品和<a href="veggies.html">北投萵苣</a>放在同一台購物車，一次結帳。</p></section>
  </div>
  ${more.length ? `<section class="tight"><h2>同一家農場</h2><div class="vgrid">${more.map(C.vcard).join('')}</div></section>` : ''}
</div>`;
  }

  if (kind === 'farm') {
    const f = C.farm(id);
    if (!f || f.hidden) { notFound('農場', 'farms.html', '看其他合作農場'); return; }
    if (f.url && !f.url.startsWith('farm.html')) { location.replace(f.url); return; }
    document.title = `${f.name}｜${f.region || ''}｜食在好蔬合作農場`;
    const goods = C.products().filter((p) => p.farm === f.id);
    const gallery = (f.imgs || []).slice(1);
    main.innerHTML = `<div class="container">
  ${crumbs([['首頁', 'index.html'], ['合作農場', 'farms.html'], [f.name]])}
  <div class="hero farm-hero">
    <div><h1>${esc(f.name)}</h1>
      ${f.summary ? `<p class="lead">${esc(f.summary)}</p>` : ''}
      <dl class="facts">${f.region ? `<div><dt>地點</dt><dd>${esc(f.region)}</dd></div>` : ''}${f.crops ? `<div><dt>種什麼</dt><dd>${esc(f.crops)}</dd></div>` : ''}${f.grow ? `<div><dt>種法</dt><dd>${esc(f.grow)}</dd></div>` : ''}${f.cert ? `<div><dt>認證</dt><dd>${esc(f.cert)}</dd></div>` : ''}</dl>
      <a class="text-link" href="shop.html?src=${encodeURIComponent(f.id)}">買這家農場的商品</a></div>
    ${C.heroMedia(f) || (f.img ? `<span class="pic-wrap farm-hero-pic"><img src="${esc(f.img)}" alt="${esc(f.name)}"></span>` : '')}
  </div>
  ${f.story ? `<div class="prose"><h2>我們為什麼選這家農場</h2><p>${para(f.story)}</p></div>` : ''}
  ${gallery.length ? `<section class="tight"><h2>農場裡</h2><div class="farm-gallery">${gallery.map((s) => `<img src="${esc(s)}" alt="${esc(f.name)}的照片" loading="lazy">`).join('')}</div></section>` : ''}
  <section class="tight"><h2>在食在好蔬買得到的商品</h2>${goods.length ? `<ul class="pgrid">${goods.map(C.pcard).join('')}</ul>` : '<p class="lead">商品準備中。</p>'}</section>
</div>`;
  }
})();
