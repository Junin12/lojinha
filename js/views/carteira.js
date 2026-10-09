/* Carteira: recebido bruto e líquido, saldo a receber e estoque */

Views.carteira = () => {
  App.setTitle('Carteira');
  App.parent = '';
  const key = (App.periodoCarteira ||= 'mes');
  const per = Analytics.periodo(key);
  const c = Analytics.carteira(per);
  const ant = per.prev ? Analytics.carteira(per.prev) : null;
  const vend = Analytics.analyze(per);
  const est = Analytics.estoque();
  const serie = Analytics.recebidoPorMes(6);
  const delta = ant && ant.recebido ? (c.recebido - ant.recebido) / ant.recebido : null;

  view.innerHTML = `
    <div class="chips" id="per">
      ${[['mes', 'Este mês'], ['mesPassado', 'Mês passado'], ['ano', 'Este ano'], ['tudo', 'Tudo']]
        .map(([k, l]) => `<button class="chip ${key === k ? 'active' : ''}" data-k="${k}">${l}</button>`).join('')}
    </div>
    <section class="wallet">
      <span>💰 Recebido (bruto) ${per.from ? `de ${fmtDate(per.from)} a ${fmtDate(per.to)}` : 'desde o início'}</span>
      <b class="big">${brl(c.recebido)}</b>
      ${delta !== null ? `<span>${delta >= 0 ? '▲' : '▼'} ${pct(Math.abs(delta))} em relação ao período anterior</span><br><br>` : ''}
      <div class="split">
        <div><span>Lucro líquido recebido</span><b>${brl(c.lucroRecebido)}</b></div>
        <div><span>Custo dos produtos</span><b>${brl(c.custoRecebido)}</b></div>
      </div>
    </section>
    <div class="kpis">
      ${UI.kpi('⏳ Saldo a receber', brl(c.aReceber), null, null, { sub: plural(c.pendentes.length, 'parcela em aberto', 'parcelas em aberto') })}
      ${UI.kpi('⚠️ Em atraso', brl(c.atrasado), null, null, { sub: plural(c.atrasadas.length, 'parcela', 'parcelas') })}
      ${UI.kpi('🧾 Vendido no período', brl(vend.faturamento), null, null, { sub: plural(vend.nVendas, 'venda', 'vendas') })}
      ${UI.kpi('📈 Lucro das vendas', brl(vend.lucro), null, null, { sub: 'Margem ' + pct(vend.margem) })}
    </div>

    ${c.atrasadas.length ? `<div class="card"><h3>⚠️ Parcelas em atraso</h3><div class="list" id="lAtr">${c.atrasadas.map(UI.parcelaItem).join('')}</div></div>` : ''}
    <div class="card"><h3>📅 A receber nos próximos 30 dias</h3>
      <div class="list" id="lProx">${c.proximas.length ? c.proximas.map(UI.parcelaItem).join('') : '<p class="muted small">Nenhuma parcela para os próximos 30 dias.</p>'}</div>
    </div>
    <div class="card"><h3>📈 Recebimentos nos últimos 6 meses</h3><div class="chart-box"><canvas id="chRec"></canvas></div></div>
    <div class="card"><h3>📦 Seu estoque hoje</h3>
      <div class="kpis" style="margin:0">
        ${UI.kpi('Investido em estoque', brl(est.investido), null, null, { sub: est.unidades + ' unidades' })}
        ${UI.kpi('Valor de venda', brl(est.valorVenda))}
        ${UI.kpi('Lucro se vender tudo', brl(est.lucroPotencial))}
        ${UI.kpi('Acabando (≤ 1 un.)', est.baixo.length, null, null, { sub: est.baixo.slice(0, 2).map(p => esc(p.nome)).join(', ') })}
      </div>
    </div>
    ${c.pendentes.length > c.proximas.length + c.atrasadas.length ? `<div class="card"><details><summary>Ver todas as ${c.pendentes.length} parcelas em aberto</summary>
      <div class="list" id="lTodas">${c.pendentes.map(UI.parcelaItem).join('')}</div></details></div>` : ''}
  `;

  $$('#per .chip').forEach(b => b.onclick = () => { App.periodoCarteira = b.dataset.k; App.rerender(); });
  UI.bindLista(view);

  App.chart('chRec', {
    type: 'bar',
    data: {
      labels: serie.labels,
      datasets: [
        { label: 'Recebido (bruto)', data: serie.bruto, backgroundColor: '#e8b9c9', borderRadius: 8 },
        { label: 'Lucro líquido', data: serie.liquido, backgroundColor: '#b9466e', borderRadius: 8 },
      ],
    },
    options: { plugins: { tooltip: { callbacks: { label: x => `${x.dataset.label}: ${brl(x.raw)}` } } }, scales: { y: { ticks: { callback: v => brl(v) } } } },
  });
};
