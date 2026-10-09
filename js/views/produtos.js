/* Produtos: categorias, lista de itens e cadastro de cada item */

Views.produtos = () => {
  App.setTitle('Produtos');
  App.parent = '';
  view.innerHTML = `
    <div class="toolbar">
      <input id="busca" class="search" type="search" placeholder="🔎 Buscar produto em todas as categorias...">
    </div>
    <div id="resultado"></div>
    <div class="actions">
      <button class="btn btn-wa" id="compLoja">💬 Enviar loja virtual no WhatsApp</button>
      <a class="btn btn-ghost" href="loja.html" target="_blank">👀 Ver loja virtual</a>
    </div>`;

  const res = $('#resultado');
  const render = () => {
    const q = norm($('#busca').value.trim());
    if (q) {
      const ps = Store.data.produtos.filter(p => norm(p.nome + ' ' + p.descricao).includes(q));
      res.innerHTML = ps.length ? `<div class="prod-grid">${ps.map(UI.produtoCard).join('')}</div>` : UI.empty('🔎', 'Nenhum produto encontrado.');
      return;
    }
    const cats = UI.categoriasOrdenadas();
    res.innerHTML = `
      <h3 class="section-title">Categorias</h3>
      <div class="cat-grid">
        ${cats.map(c => {
          const ps = Store.data.produtos.filter(p => p.categoriaId === c.id);
          const foto = ps.find(p => p.fotos?.length)?.fotos[0];
          return `<a class="cat-card" href="#/produtos/cat/${c.id}">
            <div class="cat-img" ${bgImg(foto)}>${foto ? '' : '🏷️'}</div>
            <div class="cat-info"><b>${esc(c.nome)}</b><span>${plural(ps.length, 'produto', 'produtos')} · ${sum(ps, p => p.estoque || 0)} un.</span></div></a>`;
        }).join('')}
        <button class="cat-card cat-new" id="novaCat">
          <div class="cat-img">＋</div>
          <div class="cat-info"><b>Nova categoria</b><span>Ex.: Relógios, Semijoias</span></div>
        </button>
      </div>
      ${!cats.length ? '<p class="muted small" style="margin-top:12px">👆 Comece criando as categorias da loja. Depois, toque nela para cadastrar os produtos.</p>' : ''}`;
    $('#novaCat').onclick = () => Forms.categoria();
  };
  $('#busca').oninput = render;
  $('#compLoja').onclick = () => abrirWhats('', `🛍️ Conheça a *${Store.config.nomeLoja}*!\nVeja nossos produtos, fotos e preços:\n${Store.lojaUrl()}`);
  render();
};

Views.categoria = id => {
  const c = Store.categoria(id);
  if (!c) return App.go('produtos');
  App.setTitle(c.nome);
  App.parent = 'produtos';
  const ps = Store.data.produtos.filter(p => p.categoriaId === id).sort((a, b) => a.nome.localeCompare(b.nome));
  view.innerHTML = `
    <div class="toolbar">
      <a class="btn btn-primary" style="flex:1" href="#/produto/novo?cat=${id}">＋ Novo produto</a>
      <button class="btn btn-ghost" id="edCat">✏️ Editar categoria</button>
    </div>
    ${ps.length ? `<div class="prod-grid">${ps.map(UI.produtoCard).join('')}</div>` : UI.empty('📦', 'Nenhum produto nesta categoria ainda.<br>Toque em <b>＋ Novo produto</b> para cadastrar.')}`;
  $('#edCat').onclick = () => Forms.categoria(c);
};

Views.produto = (id, params) => {
  const novo = id === 'novo';
  const orig = novo ? null : Store.produto(id);
  if (!novo && !orig) return App.go('produtos');

  if (!Store.data.categorias.length) {
    App.setTitle('Novo produto');
    App.parent = 'produtos';
    view.innerHTML = UI.empty('🏷️', 'Crie uma categoria antes de cadastrar produtos.', '<button class="btn btn-primary" id="nc">＋ Nova categoria</button>');
    $('#nc').onclick = () => Forms.categoria(null, c => App.go('produto/novo?cat=' + c.id));
    return;
  }

  const p = novo
    ? { id: uid(), categoriaId: params.get('cat') || '', nome: '', descricao: '', fotos: [], estoque: 1, preco: '', custo: '', criadoEm: new Date().toISOString() }
    : structuredClone(orig);
  App.setTitle(novo ? 'Novo produto' : p.nome);
  App.parent = p.categoriaId ? 'produtos/cat/' + p.categoriaId : 'produtos';

  view.innerHTML = `
    <form id="fProd" class="narrow" novalidate>
      <div class="card">
        <h3>📸 Fotos do item</h3>
        <div class="photos" id="fotos"></div>
        <input type="file" id="arqFotos" accept="image/*" multiple hidden>
        <p class="muted small">A primeira foto é a capa. Toque numa foto para torná-la a capa.</p>
      </div>
      <div class="card">
        <label class="field"><span>Nome do produto *</span>
          <input name="nome" value="${esc(p.nome)}" placeholder="Ex.: Relógio dourado feminino" autocomplete="off"></label>
        <label class="field"><span>Categoria *</span>
          <select name="categoria"><option value="">Selecione...</option>${UI.options(UI.categoriasOrdenadas(), p.categoriaId)}</select></label>
        <label class="field"><span>Descrição do item</span>
          <textarea name="descricao" placeholder="Detalhes, material, tamanho, cor, garantia...">${esc(p.descricao)}</textarea></label>
      </div>
      <div class="card">
        <h3>💰 Estoque e valores</h3>
        <label class="field"><span>Unidades em estoque</span>
          <div class="stepper big">
            <button type="button" data-st="-1" aria-label="Diminuir">−</button>
            <input name="estoque" class="input" type="number" min="0" inputmode="numeric" value="${p.estoque}">
            <button type="button" data-st="1" aria-label="Aumentar">+</button>
          </div></label>
        <div class="row2">
          <label class="field"><span>Preço de venda (R$) *</span>
            <input name="preco" type="number" min="0" step="0.01" inputmode="decimal" value="${p.preco}" placeholder="0,00"></label>
          <label class="field"><span>Valor investido (R$ por unidade)</span>
            <input name="custo" type="number" min="0" step="0.01" inputmode="decimal" value="${p.custo}" placeholder="0,00"></label>
        </div>
        <div class="profit" id="lucro"></div>
        <p class="muted small" style="margin-bottom:0">Lucro líquido = preço de venda − valor investido (sem impostos).</p>
      </div>
      <div class="actions">
        <button type="submit" class="btn btn-primary">💾 Salvar produto</button>
        ${novo ? '' : '<button type="button" class="btn btn-wa" id="btnWa">💬 Enviar no WhatsApp</button>'}
      </div>
      ${novo ? '' : '<button type="button" class="btn btn-danger btn-block" id="btnDel" style="margin-top:10px">🗑️ Excluir produto</button>'}
    </form>`;

  const f = $('#fProd');
  const campo = n => f.elements[n];

  const renderFotos = () => {
    $('#fotos').innerHTML = p.fotos.map((u, i) => `
      <div class="photo" ${bgImg(u)} data-i="${i}">${i === 0 ? '<span class="capa">Capa</span>' : ''}
        <button type="button" class="x" data-x="${i}" aria-label="Remover foto">✕</button></div>`).join('')
      + (p.fotos.length < 8 ? '<button type="button" class="photo photo-add" id="addFoto">📷<br>Adicionar<br>fotos</button>' : '');
    $$('[data-x]').forEach(b => b.onclick = e => { e.stopPropagation(); p.fotos.splice(+b.dataset.x, 1); renderFotos(); });
    $$('.photo[data-i]').forEach(el => el.onclick = () => { const [x] = p.fotos.splice(+el.dataset.i, 1); p.fotos.unshift(x); renderFotos(); });
    const add = $('#addFoto');
    if (add) add.onclick = () => $('#arqFotos').click();
  };
  $('#arqFotos').onchange = async e => {
    const files = [...e.target.files].slice(0, 8 - p.fotos.length);
    loading(true);
    try {
      for (const file of files) p.fotos.push(await Store.uploadFoto(await compressImage(file)));
    } catch (err) {
      toast('Erro ao enviar a foto: ' + err.message, 'error');
    } finally {
      loading(false);
      e.target.value = '';
      renderFotos();
    }
  };

  const calcular = () => {
    const preco = num(campo('preco').value), custo = num(campo('custo').value), est = parseInt(campo('estoque').value) || 0;
    const lucro = preco - custo;
    const box = $('#lucro');
    box.className = 'profit' + (lucro < 0 ? ' neg' : '');
    box.innerHTML = `<div><span>Lucro por unidade</span><b>${brl(lucro)}</b></div>
      <div><span>Margem</span><b>${preco ? pct(lucro / preco) : '—'}</b></div>
      <div><span>Lucro do estoque (${est} un.)</span><b>${brl(lucro * est)}</b></div>`;
  };
  ['preco', 'custo', 'estoque'].forEach(n => campo(n).addEventListener('input', calcular));
  $$('[data-st]').forEach(b => b.onclick = () => {
    campo('estoque').value = Math.max(0, (parseInt(campo('estoque').value) || 0) + +b.dataset.st);
    calcular();
  });

  f.onsubmit = async e => {
    e.preventDefault();
    const item = {
      ...p,
      nome: campo('nome').value.trim(),
      categoriaId: campo('categoria').value,
      descricao: campo('descricao').value.trim(),
      estoque: Math.max(0, parseInt(campo('estoque').value) || 0),
      preco: round2(num(campo('preco').value)),
      custo: round2(num(campo('custo').value)),
      atualizadoEm: new Date().toISOString(),
    };
    if (!item.nome) return toast('Digite o nome do produto', 'error');
    if (!item.categoriaId) return toast('Escolha a categoria', 'error');
    if (!item.preco) return toast('Informe o preço de venda', 'error');
    if (await App.salvar([{ op: 'save', table: 'produtos', item }], novo ? 'Produto cadastrado! 🎉' : 'Produto atualizado!')) {
      App.go('produtos/cat/' + item.categoriaId);
    }
  };

  if (!novo) {
    $('#btnWa').onclick = () => {
      const txt = `✨ *${orig.nome}*\n💰 ${brl(orig.preco)}${orig.descricao ? '\n\n' + orig.descricao : ''}\n\n📸 Veja as fotos e outros itens da loja:\n${Store.lojaUrl('?p=' + orig.id)}`;
      abrirWhats('', txt);
    };
    $('#btnDel').onclick = async () => {
      if (!confirm(`Excluir "${orig.nome}"? As vendas já registradas continuam no histórico.`)) return;
      if (await App.salvar([{ op: 'remove', table: 'produtos', id: orig.id }], 'Produto excluído')) App.go(App.parent);
    };
  }

  renderFotos();
  calcular();
};
