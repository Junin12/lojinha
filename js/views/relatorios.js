/* Relatórios semanal e mensal: prévia na tela, PDF e envio pelo WhatsApp */

const Relatorio = {
  opcoes(tipo) {
    const out = [], d = new Date();
    if (tipo === 'mensal') {
      for (let i = 0; i < 12; i++) {
        const a = new Date(d.getFullYear(), d.getMonth() - i, 1), b = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
        const pa = new Date(d.getFullYear(), d.getMonth() - i - 1, 1), pb = new Date(d.getFullYear(), d.getMonth() - i, 0);
        out.push({ from: isoDate(a), to: isoDate(b), label: `${MESES[a.getMonth()]}/${a.getFullYear()}`, prev: { from: isoDate(pa), to: isoDate(pb) } });
      }
    } else {
      const segunda = addDays(isoDate(d), -((d.getDay() + 6) % 7));
      for (let i = 0; i < 12; i++) {
        const from = addDays(segunda, -7 * i), to = addDays(from, 6);
        out.push({ from, to, label: `${fmtDateCurto(from)} a ${fmtDate(to)}`, prev: { from: addDays(from, -7), to: addDays(from, -1) } });
      }
    }
    return out;
  },

  dados(tipo, per) {
    const r = Analytics.analyze(per), a = Analytics.analyze(per.prev);
    const c = Analytics.carteira(per), ca = Analytics.carteira(per.prev), geral = Analytics.carteira();
    const novos = p => Store.data.clientes.filter(x => x.criadoEm && x.criadoEm.slice(0, 10) >= p.from && x.criadoEm.slice(0, 10) <= p.to).length;
    const variacao = (x, y, pp) => {
      if (pp) { const d = (x - y) * 100; return (d >= 0 ? '+' : '') + d.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' p.p.'; }
      if (!y) return x ? 'novo' : '—';
      const d = (x - y) / Math.abs(y);
      return (d >= 0 ? '+' : '−') + pct(Math.abs(d));
    };
    const linha = (nome, x, y, fmt, pp) => ({ nome, atual: fmt(x), anterior: fmt(y), variacao: variacao(x, y, pp), sobe: x >= y });
    const comparativo = [
      linha('Faturamento', r.faturamento, a.faturamento, brl),
      linha('Lucro líquido', r.lucro, a.lucro, brl),
      linha('Margem de lucro', r.margem, a.margem, pct, true),
      linha('Nº de vendas', r.nVendas, a.nVendas, String),
      linha('Itens vendidos', r.nItens, a.nItens, String),
      linha('Ticket médio', r.ticket, a.ticket, brl),
      linha('Valor recebido', c.recebido, ca.recebido, brl),
      linha('Novos clientes', novos(per), novos(per.prev), String),
    ];

    const insights = [];
    const mensal = tipo === 'mensal';
    if (!r.nVendas) insights.push(`Nenhuma venda registrada ${mensal ? 'neste mês' : 'nesta semana'}.`);
    else {
      if (a.faturamento) {
        const d = (r.faturamento - a.faturamento) / a.faturamento;
        insights.push(`O faturamento ${d >= 0 ? 'cresceu' : 'caiu'} ${pct(Math.abs(d))} em relação ${mensal ? 'ao mês anterior' : 'à semana anterior'}.`);
      }
      insights.push(`Produto mais vendido: ${r.topProdutos[0].nome} (${r.topProdutos[0].qtd} un.).`);
      insights.push(`Melhor cliente: ${r.topClientes[0].nome} (${brl(r.topClientes[0].valor)}).`);
      insights.push(`Categoria que mais vendeu: ${r.topCategorias[0].nome} (${pct(r.topCategorias[0].valor / r.faturamento)} do faturamento).`);
      insights.push(`Melhor dia: ${fmtDate(r.melhorDia.data)} (${DIAS_SEMANA[parseISO(r.melhorDia.data).getDay()]}), com ${brl(r.melhorDia.valor)} em vendas.`);
      if (mensal && r.melhorDiaSemana) insights.push(`No mês, o dia da semana que mais vendeu foi ${r.melhorDiaSemana}.`);
    }
    if (geral.atrasado) insights.push(`Atenção: ${brl(geral.atrasado)} em parcelas atrasadas (${geral.atrasadas.length}).`);
    const baixo = Analytics.estoque().baixo;
    if (baixo.length) insights.push(`Estoque acabando: ${baixo.slice(0, 5).map(p => p.nome).join(', ')}${baixo.length > 5 ? '…' : ''}.`);

    return { tipo, per, r, a, c, geral, comparativo, insights, serie: Analytics.serie(r, per.from, per.to) };
  },

  html(d) {
    const tabela = (cab, linhas) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cab.map((h, i) => `<th class="${i ? 'num' : ''}">${h}</th>`).join('')}</tr></thead>
      <tbody>${linhas.length ? linhas.map(l => `<tr>${l.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cab.length}" class="muted">Sem dados</td></tr>`}</tbody></table></div>`;
    const { r } = d;
    return `
      <div class="kpis">
        ${UI.kpi('Faturamento', brl(r.faturamento), r.faturamento, d.a.faturamento, { hl: true })}
        ${UI.kpi('Lucro líquido', brl(r.lucro), r.lucro, d.a.lucro)}
        ${UI.kpi('Vendas', r.nVendas, r.nVendas, d.a.nVendas)}
        ${UI.kpi('A receber (total)', brl(d.geral.aReceber))}
      </div>
      <div class="card"><h3>💡 Destaques</h3><ul class="insights">${d.insights.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>
      <div class="card"><h3>📊 Comparativo com ${d.tipo === 'mensal' ? 'o mês anterior' : 'a semana anterior'}</h3>
        ${tabela(['Indicador', 'Atual', 'Anterior', 'Variação'], d.comparativo.map(l => [l.nome, l.atual, l.anterior, `<span class="${l.variacao === '—' ? '' : l.sobe ? 'up' : 'down'}">${l.variacao}</span>`]))}</div>
      <div class="card"><h3>📈 Vendas por dia</h3><div class="chart-box"><canvas id="relChart"></canvas></div></div>
      <div class="charts">
        <div class="card"><h3>🏆 Itens mais vendidos</h3>${tabela(['Produto', 'Qtd', 'Valor'], r.topProdutos.slice(0, 10).map(p => [esc(p.nome), p.qtd, brl(p.valor)]))}</div>
        <div class="card"><h3>⭐ Top compradores</h3>${tabela(['Cliente', 'Compras', 'Total'], r.topClientes.slice(0, 10).map(c => [esc(c.nome), c.n, brl(c.valor)]))}</div>
        <div class="card"><h3>🏷️ Categorias</h3>${tabela(['Categoria', 'Itens', 'Valor', '%'], r.topCategorias.map(c => [esc(c.nome), c.qtd, brl(c.valor), pct(c.valor / r.faturamento)]))}</div>
        <div class="card"><h3>🗓️ Dias da semana</h3>${tabela(['Dia', 'Faturamento'], [1, 2, 3, 4, 5, 6, 0].map(i => [DIAS_SEMANA[i], brl(r.semana[i])]))}</div>
      </div>`;
  },

  pdf(d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const t = s => String(s).replace(/[  ]/g, ' ').replace(/−/g, '-');
    const W = 210, M = 14, ROSA = [185, 70, 110], TXT = [45, 34, 38];
    const { r } = d;

    doc.setFillColor(...ROSA); doc.rect(0, 0, W, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(t(Store.config.nomeLoja), M, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(t(`Relatório ${d.tipo} - ${d.per.label}`), M, 21);
    doc.setFontSize(8.5);
    doc.text(t(`Período: ${fmtDate(d.per.from)} a ${fmtDate(d.per.to)}  |  Comparado com ${fmtDate(d.per.prev.from)} a ${fmtDate(d.per.prev.to)}`), M, 27.5);

    const boxes = [['Faturamento', brl(r.faturamento)], ['Lucro líquido', brl(r.lucro)], ['Vendas', String(r.nVendas)], ['A receber', brl(d.geral.aReceber)]];
    const bw = (W - 2 * M - 9) / 4;
    boxes.forEach(([l, v], i) => {
      const x = M + i * (bw + 3);
      doc.setFillColor(251, 233, 240); doc.roundedRect(x, 38, bw, 19, 3, 3, 'F');
      doc.setFontSize(8); doc.setTextColor(140, 127, 132); doc.text(t(l), x + 4, 44.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...ROSA); doc.text(t(v), x + 4, 52.5);
      doc.setFont('helvetica', 'normal');
    });

    let y = 66;
    const secao = titulo => {
      if (y > 255) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...TXT);
      doc.text(t(titulo), M, y);
      doc.setFont('helvetica', 'normal');
      y += 3;
    };
    const tabela = (head, body, dir = []) => {
      doc.autoTable({
        startY: y, head: [head.map(t)], body: (body.length ? body : [['Sem dados']]).map(l => l.map(c => t(c))),
        margin: { left: M, right: M }, theme: 'striped',
        headStyles: { fillColor: ROSA, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.4, textColor: TXT },
        alternateRowStyles: { fillColor: [250, 246, 244] },
        columnStyles: Object.fromEntries(dir.map(i => [i, { halign: 'right' }])),
      });
      y = doc.lastAutoTable.finalY + 9;
    };

    secao('Destaques');
    doc.setFontSize(9.5); doc.setTextColor(...TXT);
    for (const i of d.insights) {
      const linhas = doc.splitTextToSize(t('•  ' + i), W - 2 * M);
      if (y + linhas.length * 5 > 285) { doc.addPage(); y = 18; }
      doc.text(linhas, M, y + 3);
      y += linhas.length * 5;
    }
    y += 6;

    secao(`Comparativo com ${d.tipo === 'mensal' ? 'o mês anterior' : 'a semana anterior'}`);
    tabela(['Indicador', 'Atual', 'Anterior', 'Variação'], d.comparativo.map(l => [l.nome, l.atual, l.anterior, l.variacao]), [1, 2, 3]);

    if (r.nVendas && window.Chart) {
      const w = W - 2 * M, h = w * 0.34;
      if (y + h + 8 > 285) { doc.addPage(); y = 18; }
      secao('Vendas por dia');
      doc.addImage(this.graficoImagem(d), 'JPEG', M, y + 2, w, h);
      y += h + 10;
    }

    secao('Itens mais vendidos');
    tabela(['#', 'Produto', 'Qtd', 'Faturamento', 'Lucro'], r.topProdutos.slice(0, 10).map((p, i) => [i + 1, p.nome, p.qtd, brl(p.valor), brl(p.lucro)]), [2, 3, 4]);
    secao('Top compradores');
    tabela(['#', 'Cliente', 'Compras', 'Total'], r.topClientes.slice(0, 10).map((c, i) => [i + 1, c.nome, c.n, brl(c.valor)]), [2, 3]);
    secao('Vendas por categoria');
    tabela(['Categoria', 'Itens', 'Faturamento', '% do total'], r.topCategorias.map(c => [c.nome, c.qtd, brl(c.valor), pct(c.valor / r.faturamento)]), [1, 2, 3]);
    secao('Vendas por dia da semana');
    tabela(['Dia', 'Faturamento'], [1, 2, 3, 4, 5, 6, 0].map(i => [DIAS_SEMANA[i], brl(r.semana[i])]), [1]);

    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(140, 127, 132);
      doc.text(t(`Gerado em ${fmtDate(isoDate())} - ${Store.config.nomeLoja}`), M, 291);
      doc.text(`${i}/${n}`, W - M, 291, { align: 'right' });
    }
    return doc;
  },

  // Gráfico em tamanho fixo (independe da tela) e em JPEG para o PDF ficar leve
  graficoImagem(d) {
    const cv = document.createElement('canvas');
    cv.width = 1000; cv.height = 340;
    const ch = new Chart(cv, {
      type: 'bar',
      data: {
        labels: d.serie.labels,
        datasets: [
          { label: 'Faturamento', data: d.serie.valor, backgroundColor: '#e8b9c9', borderRadius: 4 },
          { label: 'Lucro', data: d.serie.lucro, backgroundColor: '#b9466e', borderRadius: 4 },
        ],
      },
      options: {
        responsive: false, animation: false, devicePixelRatio: 2,
        plugins: { legend: { labels: { font: { size: 13 } } } },
        scales: { y: { ticks: { callback: v => brl(v), font: { size: 12 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } },
      },
    });
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(cv, 0, 0);
    ch.destroy();
    return out.toDataURL('image/jpeg', 0.9);
  },

  textoWhats(d) {
    const { r } = d;
    const v = d.comparativo[0].variacao;
    return [
      `📊 *Relatório ${d.tipo} — ${d.per.label}*`,
      `🏪 ${Store.config.nomeLoja}`,
      '',
      `💰 Faturamento: *${brl(r.faturamento)}*${v !== '—' ? ` (${v})` : ''}`,
      `📈 Lucro líquido: *${brl(r.lucro)}* (margem ${pct(r.margem)})`,
      `🧾 Vendas: ${r.nVendas} · Itens: ${r.nItens} · Ticket médio: ${brl(r.ticket)}`,
      `💵 Recebido no período: ${brl(d.c.recebido)}`,
      `⏳ Total a receber: ${brl(d.geral.aReceber)}`,
      r.nVendas ? `🏆 Mais vendido: ${r.topProdutos[0].nome} (${r.topProdutos[0].qtd} un.)` : '',
      r.nVendas ? `⭐ Top cliente: ${r.topClientes[0].nome}` : '',
      r.melhorDia ? `📅 Melhor dia: ${fmtDate(r.melhorDia.data)} (${brl(r.melhorDia.valor)})` : '',
    ].filter(x => x !== '').join('\n');
  },
};

Views.relatorios = () => {
  App.setTitle('Relatórios');
  App.parent = '';
  const st = (App.estadoRel ||= { tipo: 'mensal', idx: 0 });
  const ops = Relatorio.opcoes(st.tipo);
  const per = ops[st.idx] || ops[0];
  const d = Relatorio.dados(st.tipo, per);

  view.innerHTML = `
    <div class="card">
      <div class="seg" id="tipo">
        <button class="${st.tipo === 'semanal' ? 'active' : ''}" data-t="semanal">📅 Semanal</button>
        <button class="${st.tipo === 'mensal' ? 'active' : ''}" data-t="mensal">🗓️ Mensal</button>
      </div>
      <label class="field"><span>${st.tipo === 'mensal' ? 'Mês' : 'Semana'}</span>
        <select id="per">${ops.map((o, i) => `<option value="${i}" ${i === st.idx ? 'selected' : ''}>${o.label}${i === 0 ? (st.tipo === 'mensal' ? ' (mês atual)' : ' (semana atual)') : ''}</option>`).join('')}</select></label>
      <div class="actions" style="margin-top:0">
        <button class="btn btn-primary" id="pdf">📄 Baixar PDF</button>
        <button class="btn btn-wa" id="wa">💬 Enviar no WhatsApp</button>
      </div>
    </div>
    <h3 class="section-title">Prévia do relatório — ${esc(per.label)}</h3>
    ${Relatorio.html(d)}`;

  $$('#tipo button').forEach(b => b.onclick = () => { st.tipo = b.dataset.t; st.idx = 0; App.rerender(); });
  $('#per').onchange = e => { st.idx = +e.target.value; App.rerender(); };

  App.chart('relChart', {
    type: 'bar',
    data: {
      labels: d.serie.labels,
      datasets: [
        { label: 'Faturamento', data: d.serie.valor, backgroundColor: '#e8b9c9', borderRadius: 6 },
        { label: 'Lucro', data: d.serie.lucro, backgroundColor: '#b9466e', borderRadius: 6 },
      ],
    },
    options: {
      animation: false,
      plugins: { tooltip: { callbacks: { label: x => `${x.dataset.label}: ${brl(x.raw)}` } } },
      scales: { y: { ticks: { callback: v => brl(v) } }, x: { grid: { display: false } } },
    },
  });

  const nomeArq = `relatorio-${st.tipo}-${per.from}.pdf`;
  const gerar = () => {
    if (!window.jspdf) { toast('Não foi possível carregar o gerador de PDF. Verifique a internet.', 'error'); return null; }
    return Relatorio.pdf(d);
  };
  $('#pdf').onclick = () => { const doc = gerar(); if (doc) { doc.save(nomeArq); toast('PDF baixado!', 'ok'); } };
  $('#wa').onclick = async () => {
    const doc = gerar();
    if (!doc) return;
    const texto = Relatorio.textoWhats(d);
    const arquivo = new File([doc.output('blob')], nomeArq, { type: 'application/pdf' });
    // No celular: abre o menu de compartilhar com o PDF anexado (escolha o WhatsApp)
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo], title: `Relatório ${st.tipo}`, text: texto }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    // No computador: baixa o PDF e abre o WhatsApp com o resumo para anexar
    doc.save(nomeArq);
    abrirWhats('', texto);
    toast('PDF baixado. Anexe o arquivo na conversa do WhatsApp 📎');
  };
};
