/* Dashboard: indicadores e gráficos com filtros de período, cliente, categoria e produto */

Views.dashboard = () => {
  App.setTitle('Dashboard');
  App.parent = '';
  const st = (App.filtroDash ||= { periodo: '30d', de: '', ate: '', clienteId: '', categoriaId: '', produtoId: '' });

  const render = () => {
    App.destroyCharts();
    const produtos = Store.data.produtos.filter(p => !st.categoriaId || p.categoriaId === st.categoriaId).sort((a, b) => a.nome.localeCompare(b.nome));
    view.innerHTML = `
      <div class="card filters">
        <div class="chips" id="fPer">${Analytics.PERIODOS.map(([k, l]) => `<button class="chip ${st.periodo === k ? 'active' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
        <div class="row-f">
          ${st.periodo === 'custom' ? `
            <label class="field"><span>De</span><input type="date" id="fDe" value="${st.de}"></label>
            <label class="field"><span>Até</span><input type="date" id="fAte" value="${st.ate}"></label>` : ''}
          <label class="field"><span>Cliente</span><select id="fCli"><option value="">Todos os clientes</option>${UI.options(UI.clientesOrdenados(), st.clienteId, c => `${c.nome} ${c.sobrenome || ''}`)}</select></label>
          <label class="field"><span>Categoria</span><select id="fCat"><option value="">Todas as categorias</option>${UI.options(UI.categoriasOrdenadas(), st.categoriaId)}</select></label>
          <label class="field"><span>Produto</span><select id="fProd"><option value="">Todos os produtos</option>${UI.options(produtos, st.produtoId)}</select></label>
        </div>
        ${st.clienteId || st.categoriaId || st.produtoId ? '<button class="btn btn-sm btn-ghost" id="limpar" style="margin-top:10px">✕ Limpar filtros</button>' : ''}
      </div>
      <div id="corpo"></div>`;

    $$('#fPer .chip').forEach(b => b.onclick = () => { st.periodo = b.dataset.k; render(); });
    const bindSel = (id, k, extra) => { const el = $(id); if (el) el.onchange = () => { st[k] = el.value; if (extra) extra(); render(); }; };
    bindSel('#fDe', 'de'); bindSel('#fAte', 'ate');
    bindSel('#fCli', 'clienteId');
    bindSel('#fCat', 'categoriaId', () => { st.produtoId = ''; });
    bindSel('#fProd', 'produtoId');
    const limpar = $('#limpar');
    if (limpar) limpar.onclick = () => { st.clienteId = st.categoriaId = st.produtoId = ''; render(); };
    desenhar();
  };

  const desenhar = () => {
    const per = Analytics.periodo(st.periodo, st.de, st.ate);
    const f = { from: per.from, to: per.to, clienteId: st.clienteId, categoriaId: st.categoriaId, produtoId: st.produtoId };
    const r = Analytics.analyze(f);
    const a = per.prev ? Analytics.analyze({ ...f, from: per.prev.from, to: per.prev.to }) : null;
    const cart = Analytics.carteira(per);
    const ant = k => a ? a[k] : null;
    const topP = r.topProdutos[0], topC = r.topClientes[0], topCat = r.topCategorias[0];
    const dest = (ico, label, valor, sub) => `<div class="dest"><i>${ico}</i><div class="grow"><span>${label}</span><b>${esc(valor)}</b><small>${sub}</small></div></div>`;

    $('#corpo').innerHTML = `
      <p class="muted small periodo-label">📅 ${per.from ? `${fmtDate(per.from)} a ${fmtDate(per.to)}` : 'Todo o período'}${a ? ' · setas comparam com o período anterior' : ''}</p>
      <div class="kpis">
        ${UI.kpi('Faturamento', brl(r.faturamento), r.faturamento, ant('faturamento'), { hl: true })}
        ${UI.kpi('Lucro líquido', brl(r.lucro), r.lucro, ant('lucro'), { sub: 'Margem ' + pct(r.margem) })}
        ${UI.kpi('Vendas', r.nVendas, r.nVendas, ant('nVendas'))}
        ${UI.kpi('Itens vendidos', r.nItens, r.nItens, ant('nItens'))}
        ${UI.kpi('Ticket médio', brl(r.ticket), r.ticket, ant('ticket'))}
        ${UI.kpi('Recebido no período', brl(cart.recebido), null, null, { sub: 'Líquido ' + brl(cart.lucroRecebido) })}
        ${UI.kpi('Saldo a receber', brl(cart.aReceber), null, null, { sub: 'Total em aberto' })}
        ${UI.kpi('Em atraso', brl(cart.atrasado), null, null, { sub: plural(cart.atrasadas.length, 'parcela', 'parcelas') })}
      </div>
      ${r.nVendas ? `
        <div class="destaques">
          ${dest('🏆', 'Produto mais vendido', topP.nome, `${topP.qtd} un. · ${brl(topP.valor)}`)}
          ${dest('⭐', 'Melhor cliente', topC.nome, `${plural(topC.n, 'compra', 'compras')} · ${brl(topC.valor)}`)}
          ${dest('🏷️', 'Categoria campeã', topCat.nome, `${topCat.qtd} un. · ${brl(topCat.valor)}`)}
          ${dest('📅', 'Melhor dia de vendas', fmtDate(r.melhorDia.data), `${DIAS_SEMANA[parseISO(r.melhorDia.data).getDay()]} · ${brl(r.melhorDia.valor)}`)}
          ${dest('🗓️', 'Melhor dia da semana', r.melhorDiaSemana, 'maior faturamento somado')}
        </div>
        <div class="charts">
          <div class="card wide"><h3>Faturamento e lucro</h3><div class="chart-box"><canvas id="chSerie"></canvas></div></div>
          <div class="card"><h3>Vendas por categoria</h3><p class="muted small">Toque numa fatia para filtrar</p><div class="chart-box"><canvas id="chCat"></canvas></div></div>
          <div class="card"><h3>Vendas por dia da semana</h3><div class="chart-box"><canvas id="chSem"></canvas></div></div>
          <div class="card"><h3>Itens mais vendidos</h3><p class="muted small">Toque numa barra para filtrar</p><div class="chart-box"><canvas id="chProd"></canvas></div></div>
          <div class="card"><h3>Top compradores</h3><p class="muted small">Toque numa barra para filtrar</p><div class="chart-box"><canvas id="chCli"></canvas></div></div>
        </div>
        <div class="card"><h3>Ranking de produtos</h3><div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>#</th><th>Produto</th><th class="num">Qtd</th><th class="num">Faturamento</th><th class="num">Lucro</th></tr></thead>
          <tbody>${r.topProdutos.slice(0, 10).map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nome)}</td><td class="num">${p.qtd}</td><td class="num">${brl(p.valor)}</td><td class="num ok-txt">${brl(p.lucro)}</td></tr>`).join('')}</tbody>
        </table></div></div>`
      : UI.empty('📊', 'Nenhuma venda encontrada com esses filtros.')}`;

    if (!r.nVendas) return;
    const money = { callbacks: { label: x => `${x.dataset.label || x.label}: ${brl(x.raw)}` } };
    const filtrarPor = (k, ids) => (e, els) => { if (els.length) { st[k] = ids[els[0].index]; if (k === 'categoriaId') st.produtoId = ''; render(); } };

    const s = Analytics.serie(r, per.from, per.to);
    App.chart('chSerie', {
      type: 'bar',
      data: {
        labels: s.labels,
        datasets: [
          { type: 'line', label: 'Lucro', data: s.lucro, borderColor: '#c99a4b', backgroundColor: '#c99a4b', tension: .35, pointRadius: 2 },
          { label: 'Faturamento', data: s.valor, backgroundColor: '#e8b9c9', hoverBackgroundColor: '#b9466e', borderRadius: 6 },
        ],
      },
      options: { plugins: { tooltip: money }, scales: { y: { ticks: { callback: v => brl(v) } }, x: { grid: { display: false } } } },
    });

    const cats = r.topCategorias;
    App.chart('chCat', {
      type: 'doughnut',
      data: { labels: cats.map(c => c.nome), datasets: [{ data: cats.map(c => round2(c.valor)), backgroundColor: CORES, borderWidth: 2, borderColor: '#fff' }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: x => `${x.label}: ${brl(x.raw)} (${pct(x.raw / r.faturamento)})` } } }, onClick: filtrarPor('categoriaId', cats.map(c => c.id)) },
    });

    const ordemSemana = [1, 2, 3, 4, 5, 6, 0];
    const maxSem = Math.max(...r.semana);
    App.chart('chSem', {
      type: 'bar',
      data: {
        labels: ordemSemana.map(i => DIAS_SEMANA[i].slice(0, 3)),
        datasets: [{ label: 'Faturamento', data: ordemSemana.map(i => round2(r.semana[i])), backgroundColor: ordemSemana.map(i => r.semana[i] === maxSem ? '#b9466e' : '#e8b9c9'), borderRadius: 8 }],
      },
      options: { plugins: { legend: { display: false }, tooltip: money }, scales: { y: { ticks: { callback: v => brl(v) } }, x: { grid: { display: false } } } },
    });

    const tp = r.topProdutos.slice(0, 7);
    App.chart('chProd', {
      type: 'bar',
      data: { labels: tp.map(p => p.nome.length > 22 ? p.nome.slice(0, 21) + '…' : p.nome), datasets: [{ label: 'Unidades', data: tp.map(p => p.qtd), backgroundColor: '#c99a4b', borderRadius: 6 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } }, y: { grid: { display: false } } }, onClick: filtrarPor('produtoId', tp.map(p => p.id)) },
    });

    const tc = r.topClientes.slice(0, 7);
    App.chart('chCli', {
      type: 'bar',
      data: { labels: tc.map(c => c.nome), datasets: [{ label: 'Comprou', data: tc.map(c => round2(c.valor)), backgroundColor: '#3f8f8a', borderRadius: 6 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: money }, scales: { x: { ticks: { callback: v => brl(v) } }, y: { grid: { display: false } } }, onClick: filtrarPor('clienteId', tc.map(c => c.id)) },
    });
  };

  render();
};
