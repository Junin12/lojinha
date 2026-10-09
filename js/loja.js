/* Loja virtual pública: catálogo com fotos e preços (sem custos e sem dados de clientes) */
(async function () {
  const main = $('#conteudo');
  let loja = { nome: 'Loja virtual', whatsapp: '' }, produtos = [], categorias = [], catAtual = '';

  try {
    const cfgLocal = JSON.parse(localStorage.getItem('lojinha_config') || '{}');
    const api = (window.LOJA_API_URL || cfgLocal.apiUrl || '').trim();
    if (api) {
      const j = await (await fetch(api + '?action=catalogo')).json();
      if (!j.ok) throw new Error(j.error);
      produtos = j.produtos; categorias = j.categorias;
      loja = { nome: j.config.nomeLoja || loja.nome, whatsapp: j.config.whatsapp || '' };
    } else {
      // Modo local (teste): lê os dados salvos neste aparelho
      const d = JSON.parse(localStorage.getItem('lojinha_dados') || '{}');
      produtos = d.produtos || []; categorias = d.categorias || [];
      loja = { nome: cfgLocal.nomeLoja || loja.nome, whatsapp: cfgLocal.whatsapp || '' };
    }
  } catch (e) {
    main.innerHTML = '<div class="empty"><div class="big">😕</div><p>Não foi possível carregar a loja agora. Tente novamente em instantes.</p></div>';
    return;
  }

  produtos.sort((a, b) => (b.estoque > 0) - (a.estoque > 0) || a.nome.localeCompare(b.nome));
  categorias.sort((a, b) => a.nome.localeCompare(b.nome));
  $('#nomeLoja').textContent = loja.nome;
  document.title = loja.nome;
  const wa = $('#waFloat');
  wa.href = waLink(loja.whatsapp, `Olá! Vim pela loja virtual da ${loja.nome} 😊`);
  wa.classList.remove('hidden');

  const card = p => `<a class="prod-card" href="?p=${p.id}" data-p="${p.id}">
    <div class="prod-img" ${bgImg(p.fotos?.[0])}>${p.fotos?.length ? '' : '🛍️'}${p.estoque <= 0 ? '<span class="tag">Esgotado</span>' : ''}</div>
    <div class="prod-info"><b>${esc(p.nome)}</b><span class="price">${brl(p.preco)}</span></div></a>`;

  const grade = lista => lista.length ? `<div class="prod-grid">${lista.map(card).join('')}</div>` : '<div class="empty">Nenhum produto por aqui ainda.</div>';

  function render() {
    const id = new URLSearchParams(location.search).get('p');
    const p = id && produtos.find(x => x.id === id);
    let html = '';
    if (p) {
      const fotos = p.fotos?.length ? p.fotos : [];
      const msg = `Olá! Tenho interesse no produto *${p.nome}* (${brl(p.preco)}). Vi na loja virtual: ${location.href}`;
      html += `<button class="voltar" id="voltar">← Ver todos os produtos</button>
        <section class="detalhe">
          <div>
            <div class="carousel" id="car">${fotos.length ? fotos.map(f => `<img src="${esc(f)}" alt="${esc(p.nome)}" loading="lazy">`).join('') : '<div class="sem-foto">🛍️</div>'}</div>
            ${fotos.length > 1 ? `<div class="dots">${fotos.map((_, i) => `<span class="${i ? '' : 'on'}"></span>`).join('')}</div>` : ''}
          </div>
          <div class="card" style="margin:0">
            <h2>${esc(p.nome)}</h2>
            <span class="price">${brl(p.preco)}</span>
            <span class="badge ${p.estoque > 0 ? 'ok' : 'danger'}">${p.estoque > 0 ? 'Disponível' : 'Esgotado'}</span>
            ${p.descricao ? `<p class="pre">${esc(p.descricao)}</p>` : ''}
            <a class="btn btn-wa btn-block" style="margin-top:14px" target="_blank" href="${waLink(loja.whatsapp, p.estoque > 0 ? msg : msg.replace('Tenho interesse', 'Vai chegar mais'))}">
              💬 ${p.estoque > 0 ? 'Quero este!' : 'Avise-me quando chegar'}</a>
          </div>
        </section>
        <h3 class="section-title">Veja também</h3>`;
      html += grade(produtos.filter(x => x.id !== p.id && x.categoriaId === p.categoriaId).concat(produtos.filter(x => x.categoriaId !== p.categoriaId)).slice(0, 12));
    } else {
      const usadas = categorias.filter(c => produtos.some(x => x.categoriaId === c.id));
      html += `<div class="chips" id="cats">${[{ id: '', nome: 'Todos' }, ...usadas].map(c => `<button class="chip ${catAtual === c.id ? 'active' : ''}" data-c="${c.id}">${esc(c.nome)}</button>`).join('')}</div>`;
      html += grade(produtos.filter(x => !catAtual || x.categoriaId === catAtual));
    }
    main.innerHTML = html;
    wa.classList.toggle('hidden', !!p); // na página do produto já existe o botão "Quero este"
    window.scrollTo(0, 0);

    $$('[data-p]').forEach(a => a.onclick = e => { e.preventDefault(); history.pushState(null, '', '?p=' + a.dataset.p); render(); });
    $$('#cats .chip').forEach(b => b.onclick = () => { catAtual = b.dataset.c; render(); });
    const v = $('#voltar');
    if (v) v.onclick = () => { history.pushState(null, '', location.pathname); render(); };
    const car = $('#car');
    if (car) car.onscroll = () => {
      const i = Math.round(car.scrollLeft / car.clientWidth);
      $$('.dots span').forEach((d, k) => d.classList.toggle('on', k === i));
    };
  }

  window.onpopstate = render;
  render();
})();
