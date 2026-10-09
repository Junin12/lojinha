/* Vendas: histórico e registro de nova venda com parcelas */

Views.vendas = () => {
  App.setTitle('Vendas');
  App.parent = '';
  const filtro = (App.filtroVendas ||= 'todas');
  const mes = Analytics.analyze(Analytics.periodo('mes'));
  view.innerHTML = `
    <a class="btn btn-primary btn-block big-cta" href="#/venda/nova">＋ Registrar nova venda</a>
    <div class="kpis">
      ${UI.kpi('Vendido no mês', brl(mes.faturamento), null, null, { hl: true })}
      ${UI.kpi('Vendas no mês', mes.nVendas)}
      ${UI.kpi('Lucro no mês', brl(mes.lucro))}
      ${UI.kpi('Ticket médio', brl(mes.ticket))}
    </div>
    <div class="toolbar"><input id="busca" class="search" type="search" placeholder="🔎 Buscar por cliente ou produto..."></div>
    <div class="chips" id="filtros">
      ${[['todas', 'Todas'], ['pendentes', 'A receber'], ['atrasadas', 'Atrasadas'], ['quitadas', 'Quitadas']]
        .map(([k, l]) => `<button class="chip ${filtro === k ? 'active' : ''}" data-k="${k}">${l}</button>`).join('')}
    </div>
    <div id="lista"></div>`;

  const render = () => {
    const q = norm($('#busca').value.trim());
    const vendas = Store.data.vendas
      .filter(v => {
        const st = UI.statusVenda(v).key;
        if (App.filtroVendas === 'pendentes' && st === 'quitadas') return false;
        if (App.filtroVendas === 'atrasadas' && st !== 'atrasadas') return false;
        if (App.filtroVendas === 'quitadas' && st !== 'quitadas') return false;
        return !q || norm(Store.nomeCliente(v.clienteId) + ' ' + v.itens.map(i => i.nome).join(' ')).includes(q);
      })
      .sort((a, b) => b.data.localeCompare(a.data) || String(b.criadoEm).localeCompare(String(a.criadoEm)));
    if (!vendas.length) { $('#lista').innerHTML = UI.empty('🧾', 'Nenhuma venda encontrada.'); return; }
    let html = '', mesAtual = '';
    for (const v of vendas) {
      const m = v.data.slice(0, 7);
      if (m !== mesAtual) { mesAtual = m; html += `<div class="month-head">${MESES[+m.slice(5) - 1]} ${m.slice(0, 4)}</div>`; }
      html += UI.vendaItem(v);
    }
    $('#lista').innerHTML = `<div class="list">${html}</div>`;
    UI.bindLista($('#lista'));
  };
  $('#busca').oninput = render;
  $$('#filtros .chip').forEach(b => b.onclick = () => {
    App.filtroVendas = b.dataset.k;
    $$('#filtros .chip').forEach(x => x.classList.toggle('active', x === b));
    render();
  });
  render();
};

Views.novaVenda = params => {
  App.setTitle('Nova venda');
  App.parent = 'vendas';
  if (!Store.data.produtos.length) {
    view.innerHTML = UI.empty('🛍️', 'Cadastre produtos antes de registrar uma venda.', '<a class="btn btn-primary" href="#/produtos">Ir para Produtos</a>');
    return;
  }

  const hoje = isoDate();
  const s = { clienteId: params.get('cliente') || '', carrinho: {}, cat: '', desconto: 0, data: hoje, n: 1, primeiro: hoje, primeiraPaga: true, parcelas: [] };

  view.innerHTML = `
    <div class="narrow">
      <div class="card">
        <h3><span class="step">1</span> Para quem foi a venda?</h3>
        <div class="toolbar" style="margin:0">
          <select id="cli" class="input"></select>
          <button class="btn" id="novoCli" type="button">＋ Novo</button>
        </div>
      </div>
      <div class="card">
        <h3><span class="step">2</span> O que foi vendido?</h3>
        <div class="chips" id="cats"></div>
        <input id="buscaP" class="search" type="search" placeholder="🔎 Buscar produto..." style="margin-bottom:10px">
        <div class="list" id="prods"></div>
      </div>
      <div class="card">
        <h3><span class="step">3</span> Pagamento</h3>
        <div id="resumo"></div>
        <div class="row2" style="margin-top:14px">
          <label class="field"><span>Data da venda</span><input type="date" id="dataV" value="${hoje}"></label>
          <label class="field"><span>Desconto (R$)</span><input type="number" id="desc" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
        </div>
        <div class="row2 stack">
          <label class="field"><span>Em quantas vezes?</span>
            <div class="stepper big">
              <button type="button" id="nMenos" aria-label="Menos parcelas">−</button>
              <input id="nParc" class="input" type="number" min="1" max="24" value="1" inputmode="numeric">
              <button type="button" id="nMais" aria-label="Mais parcelas">+</button>
            </div></label>
          <label class="field"><span id="lblPrim">Data do pagamento</span><input type="date" id="prim" value="${hoje}"></label>
        </div>
        <label class="check"><input type="checkbox" id="pp" checked> <span id="lblPP">Pagamento já recebido</span></label>
        <div id="parcelas"></div>
        <label class="field"><span>Observação</span><input id="obs" placeholder="Opcional — ex.: pagou no Pix"></label>
      </div>
      <div class="sticky-bottom">
        <div class="grow"><span class="muted small" id="sbItens">Nenhum item</span><b id="sbTotal">${brl(0)}</b></div>
        <button class="btn btn-primary" id="finalizar">✓ Finalizar venda</button>
      </div>
    </div>`;

  const renderClientes = () => {
    $('#cli').innerHTML = `<option value="">Selecione o cliente...</option>${UI.options(UI.clientesOrdenados(), s.clienteId, c => `${c.nome} ${c.sobrenome || ''}`.trim())}`;
  };

  const renderCats = () => {
    $('#cats').innerHTML = [{ id: '', nome: 'Todas' }, ...UI.categoriasOrdenadas()]
      .map(c => `<button class="chip ${s.cat === c.id ? 'active' : ''}" data-c="${c.id}">${esc(c.nome)}</button>`).join('');
    $$('#cats .chip').forEach(b => b.onclick = () => { s.cat = b.dataset.c; renderCats(); renderProds(); });
  };

  const renderProds = () => {
    const q = norm($('#buscaP').value.trim());
    const ps = Store.data.produtos
      .filter(p => (!s.cat || p.categoriaId === s.cat) && norm(p.nome).includes(q))
      .sort((a, b) => (s.carrinho[b.id] ? 1 : 0) - (s.carrinho[a.id] ? 1 : 0) || a.nome.localeCompare(b.nome));
    $('#prods').innerHTML = ps.length ? ps.map(p => {
      const qtd = s.carrinho[p.id] || 0;
      return `<div class="item ${qtd ? 'sel' : ''}" data-p="${p.id}">
        <div class="thumb" ${bgImg(p.fotos?.[0])}>${p.fotos?.length ? '' : '📦'}</div>
        <div class="grow"><div class="t wrap">${esc(p.nome)}</div>
          <div class="s">${brl(p.preco)} · ${p.estoque > 0 ? p.estoque + ' em estoque' : '<b class="danger-txt">sem estoque</b>'}</div></div>
        <div class="stepper">
          <button type="button" data-d="-1" ${qtd ? '' : 'disabled'} aria-label="Remover um">−</button>
          <b>${qtd}</b>
          <button type="button" data-d="1" ${qtd >= p.estoque ? 'disabled' : ''} aria-label="Adicionar um">+</button>
        </div></div>`;
    }).join('') : UI.empty('🔎', 'Nenhum produto encontrado.');
    $$('#prods [data-p]').forEach(row => {
      const p = Store.produto(row.dataset.p);
      const mudar = d => {
        const q = Math.min(p.estoque, Math.max(0, (s.carrinho[p.id] || 0) + d));
        if (d > 0 && q === (s.carrinho[p.id] || 0)) return toast('Não há mais unidades em estoque', 'error');
        if (q) s.carrinho[p.id] = q; else delete s.carrinho[p.id];
        renderProdsMantendoOrdem(row, q);
        atualizar();
      };
      row.onclick = e => {
        const b = e.target.closest('button[data-d]');
        if (b) { if (!b.disabled) mudar(+b.dataset.d); }
        else mudar(1);
      };
    });
  };
  // Atualiza só a linha tocada, sem reordenar a lista enquanto a pessoa escolhe
  const renderProdsMantendoOrdem = (row, qtd) => {
    const p = Store.produto(row.dataset.p);
    row.classList.toggle('sel', qtd > 0);
    $('.stepper b', row).textContent = qtd;
    $('[data-d="-1"]', row).disabled = !qtd;
    $('[data-d="1"]', row).disabled = qtd >= p.estoque;
  };

  const itens = () => Object.entries(s.carrinho).map(([pid, qtd]) => ({ p: Store.produto(pid), qtd })).filter(x => x.p && x.qtd > 0);
  const totais = () => {
    const its = itens();
    const subtotal = round2(sum(its, x => x.qtd * x.p.preco));
    const desconto = Math.min(subtotal, Math.max(0, s.desconto));
    const custo = round2(sum(its, x => x.qtd * (x.p.custo || 0)));
    return { its, subtotal, desconto, total: round2(subtotal - desconto), custo };
  };

  const gerarParcelas = total => {
    const base = Math.floor((total * 100) / s.n) / 100;
    s.parcelas = Array.from({ length: s.n }, (_, i) => ({
      valor: i === s.n - 1 ? round2(total - base * (s.n - 1)) : base,
      vencimento: addMonths(s.primeiro, i),
      pago: i === 0 && s.primeiraPaga,
    }));
  };

  const renderParcelas = () => {
    if (s.n === 1) { $('#parcelas').innerHTML = ''; return; }
    $('#parcelas').innerHTML = `<p class="muted small" style="margin:0 0 8px">Confira as datas e valores (pode alterar):</p>` +
      s.parcelas.map((p, i) => `<div class="parcela-edit">
        <span class="n">${i + 1}ª</span>
        <input type="date" data-i="${i}" data-f="vencimento" value="${p.vencimento}" aria-label="Vencimento da parcela ${i + 1}">
        <input type="number" step="0.01" min="0" inputmode="decimal" data-i="${i}" data-f="valor" value="${p.valor.toFixed(2)}" aria-label="Valor da parcela ${i + 1}">
        <span title="${p.pago ? 'Já paga' : 'A receber'}">${p.pago ? '✅' : '⏳'}</span>
      </div>`).join('') + '<p class="small" id="somaParc"></p>';
    $$('#parcelas input').forEach(inp => inp.oninput = () => {
      const p = s.parcelas[inp.dataset.i];
      p[inp.dataset.f] = inp.dataset.f === 'valor' ? num(inp.value) : inp.value;
      conferirSoma();
    });
    conferirSoma();
  };
  const conferirSoma = () => {
    const el = $('#somaParc');
    if (!el) return;
    const soma = round2(sum(s.parcelas, p => p.valor)), { total } = totais();
    el.innerHTML = Math.abs(soma - total) > 0.01
      ? `<span class="danger-txt">⚠️ A soma das parcelas (${brl(soma)}) está diferente do total (${brl(total)}).</span>`
      : `<span class="ok-txt">✓ Soma das parcelas confere com o total.</span>`;
  };

  const atualizar = () => {
    const t = totais();
    const n = sum(t.its, x => x.qtd);
    $('#resumo').innerHTML = t.its.length ? `
      ${t.its.map(x => `<div class="resumo-linha"><span>${x.qtd}x ${esc(x.p.nome)}</span><span>${brl(x.qtd * x.p.preco)}</span></div>`).join('')}
      ${t.desconto ? `<div class="resumo-linha"><span>Desconto</span><span>− ${brl(t.desconto)}</span></div>` : ''}
      <div class="resumo-linha total"><span>Total</span><span>${brl(t.total)}</span></div>
      <div class="resumo-linha small ok-txt"><span>Lucro líquido desta venda</span><span>${brl(t.total - t.custo)}</span></div>`
      : '<p class="muted small" style="margin:0">Escolha os produtos no passo 2.</p>';
    $('#sbItens').textContent = n ? `${plural(n, 'item', 'itens')}${s.n > 1 ? ` · ${s.n}x de ${brl(t.total / s.n)}` : ''}` : 'Nenhum item';
    $('#sbTotal').textContent = brl(t.total);
    $('#lblPrim').textContent = s.n === 1 ? 'Data do pagamento' : 'Data da 1ª parcela';
    $('#lblPP').textContent = s.n === 1 ? 'Pagamento já recebido' : '1ª parcela já foi paga (entrada)';
    gerarParcelas(t.total);
    renderParcelas();
  };

  const setN = n => { s.n = Math.min(24, Math.max(1, n || 1)); $('#nParc').value = s.n; atualizar(); };
  $('#nMenos').onclick = () => setN(s.n - 1);
  $('#nMais').onclick = () => setN(s.n + 1);
  $('#nParc').onchange = e => setN(parseInt(e.target.value));
  $('#desc').oninput = e => { s.desconto = num(e.target.value); atualizar(); };
  $('#dataV').onchange = e => {
    const nova = e.target.value || hoje;
    if (s.primeiro === s.data) { s.primeiro = nova; $('#prim').value = nova; }
    s.data = nova;
    atualizar();
  };
  $('#prim').onchange = e => { s.primeiro = e.target.value || s.data; atualizar(); };
  $('#pp').onchange = e => { s.primeiraPaga = e.target.checked; atualizar(); };
  $('#cli').onchange = e => { s.clienteId = e.target.value; };
  $('#buscaP').oninput = renderProds;
  $('#novoCli').onclick = () => Forms.cliente(null, c => { s.clienteId = c.id; renderClientes(); });

  $('#finalizar').onclick = async () => {
    const t = totais();
    if (!s.clienteId) { $('#cli').focus(); return toast('Escolha o cliente da venda', 'error'); }
    if (!t.its.length) return toast('Adicione pelo menos um produto', 'error');
    const falta = t.its.find(x => x.qtd > x.p.estoque);
    if (falta) return toast(`Estoque insuficiente de ${falta.p.nome}`, 'error');
    if (s.parcelas.some(p => !p.vencimento)) return toast('Preencha a data de todas as parcelas', 'error');
    const soma = round2(sum(s.parcelas, p => p.valor));
    if (Math.abs(soma - t.total) > 0.01) return toast(`A soma das parcelas (${brl(soma)}) precisa ser igual ao total (${brl(t.total)})`, 'error');

    const venda = {
      id: uid(),
      data: s.data,
      clienteId: s.clienteId,
      itens: t.its.map(x => ({ produtoId: x.p.id, nome: x.p.nome, categoriaId: x.p.categoriaId, qtd: x.qtd, preco: x.p.preco, custo: x.p.custo || 0 })),
      subtotal: t.subtotal,
      desconto: t.desconto,
      total: t.total,
      custoTotal: t.custo,
      parcelas: s.parcelas.map(p => ({ valor: round2(p.valor), vencimento: p.vencimento, pago: !!p.pago, pagoEm: p.pago ? s.data : '' })),
      obs: $('#obs').value.trim(),
      criadoEm: new Date().toISOString(),
    };
    const ops = [{ op: 'save', table: 'vendas', item: venda },
      ...t.its.map(x => ({ op: 'save', table: 'produtos', item: { ...x.p, estoque: Math.max(0, x.p.estoque - x.qtd) } }))];
    if (await App.salvar(ops, 'Venda registrada! 🎉')) {
      App.depoisDeAbrir = () => Forms.vendaDetalhe(venda.id);
      App.go('vendas');
    }
  };

  renderClientes();
  renderCats();
  renderProds();
  atualizar();
};
