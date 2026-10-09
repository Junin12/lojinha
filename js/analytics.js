/* Cálculos: períodos, vendas, lucro, carteira e estoque */
const Analytics = {
  PERIODOS: [
    ['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'],
    ['mesPassado', 'Mês passado'], ['ano', 'Este ano'], ['tudo', 'Tudo'], ['custom', 'Personalizado'],
  ],

  // Retorna { from, to, prev: { from, to } } — datas vazias = sem limite
  periodo(key, de, ate) {
    const hoje = isoDate(), d = new Date();
    const mes = (y, m) => ({ from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) });
    const anterior = (from, to) => { const n = diffDays(from, to) + 1; return { from: addDays(from, -n), to: addDays(from, -1) }; };
    const y = d.getFullYear(), m = d.getMonth();
    let p;
    switch (key) {
      case 'hoje': p = { from: hoje, to: hoje }; break;
      case '7d': p = { from: addDays(hoje, -6), to: hoje }; break;
      case '30d': p = { from: addDays(hoje, -29), to: hoje }; break;
      // Mês e ano atuais comparam com os mesmos dias do período anterior (ex.: 1 a 8 de cada mês)
      case 'mes': {
        const ant = mes(y, m - 1);
        return { ...mes(y, m), prev: { from: ant.from, to: [addMonths(hoje, -1), ant.to].sort()[0] } };
      }
      case 'mesPassado': return { ...mes(y, m - 1), prev: mes(y, m - 2) };
      case 'ano': return { from: `${y}-01-01`, to: `${y}-12-31`, prev: { from: `${y - 1}-01-01`, to: `${y - 1}${hoje.slice(4)}` } };
      case 'custom':
        if (de && ate && de <= ate) { p = { from: de, to: ate }; break; }
        return { from: de || '', to: ate || '', prev: null };
      default: return { from: '', to: '', prev: null };
    }
    p.prev = anterior(p.from, p.to);
    return p;
  },

  // Itens da venda com o valor real (desconto rateado) e o custo registrado na venda
  linhas(v) {
    const sub = sum(v.itens, i => i.qtd * i.preco);
    const fator = sub > 0 ? (sub - (v.desconto || 0)) / sub : 1;
    return v.itens.map(i => {
      const p = Store.produto(i.produtoId);
      return {
        produtoId: i.produtoId,
        nome: i.nome || p?.nome || 'Produto removido',
        categoriaId: i.categoriaId || p?.categoriaId || '',
        qtd: i.qtd,
        valor: i.qtd * i.preco * fator,
        custo: i.qtd * (i.custo || 0),
      };
    });
  },

  margem: v => v.total > 0 ? (v.total - v.custoTotal) / v.total : 0,

  analyze({ from = '', to = '', clienteId = '', categoriaId = '', produtoId = '' } = {}) {
    const r = {
      faturamento: 0, custo: 0, lucro: 0, nVendas: 0, nItens: 0, ticket: 0, margem: 0,
      dias: {}, categorias: {}, produtos: {}, clientes: {}, semana: [0, 0, 0, 0, 0, 0, 0],
    };
    for (const v of Store.data.vendas) {
      if ((from && v.data < from) || (to && v.data > to) || (clienteId && v.clienteId !== clienteId)) continue;
      let valorVenda = 0, achou = false;
      for (const l of this.linhas(v)) {
        if ((categoriaId && l.categoriaId !== categoriaId) || (produtoId && l.produtoId !== produtoId)) continue;
        achou = true;
        valorVenda += l.valor;
        r.custo += l.custo;
        r.nItens += l.qtd;
        const dia = (r.dias[v.data] ||= { valor: 0, lucro: 0 });
        dia.valor += l.valor; dia.lucro += l.valor - l.custo;
        const c = (r.categorias[l.categoriaId] ||= { id: l.categoriaId, nome: Store.categoria(l.categoriaId)?.nome || 'Sem categoria', valor: 0, qtd: 0 });
        c.valor += l.valor; c.qtd += l.qtd;
        const p = (r.produtos[l.produtoId] ||= { id: l.produtoId, nome: l.nome, valor: 0, qtd: 0, lucro: 0 });
        p.valor += l.valor; p.qtd += l.qtd; p.lucro += l.valor - l.custo;
      }
      if (!achou) continue;
      r.nVendas++;
      r.faturamento += valorVenda;
      const cl = (r.clientes[v.clienteId] ||= { id: v.clienteId, nome: Store.nomeCliente(v.clienteId), valor: 0, n: 0 });
      cl.valor += valorVenda; cl.n++;
      r.semana[parseISO(v.data).getDay()] += valorVenda;
    }
    r.lucro = r.faturamento - r.custo;
    r.ticket = r.nVendas ? r.faturamento / r.nVendas : 0;
    r.margem = r.faturamento ? r.lucro / r.faturamento : 0;
    r.topProdutos = Object.values(r.produtos).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
    r.topClientes = Object.values(r.clientes).sort((a, b) => b.valor - a.valor);
    r.topCategorias = Object.values(r.categorias).sort((a, b) => b.valor - a.valor);
    const melhor = Object.entries(r.dias).sort((a, b) => b[1].valor - a[1].valor)[0];
    r.melhorDia = melhor ? { data: melhor[0], valor: melhor[1].valor } : null;
    const maxSem = Math.max(...r.semana);
    r.melhorDiaSemana = maxSem > 0 ? DIAS_SEMANA[r.semana.indexOf(maxSem)] : null;
    return r;
  },

  // Série para gráfico: por dia (até ~2 meses) ou por mês
  serie(r, from, to) {
    const datas = Object.keys(r.dias).sort();
    const ini = from || datas[0], fim = to || isoDate();
    const out = { labels: [], valor: [], lucro: [] };
    if (!ini) return out;
    if (diffDays(ini, fim) <= 62) {
      for (let s = ini; s <= fim; s = addDays(s, 1)) {
        const x = r.dias[s];
        out.labels.push(fmtDateCurto(s));
        out.valor.push(round2(x?.valor || 0));
        out.lucro.push(round2(x?.lucro || 0));
      }
    } else {
      const meses = {};
      for (const [s, x] of Object.entries(r.dias)) {
        const k = (meses[s.slice(0, 7)] ||= { valor: 0, lucro: 0 });
        k.valor += x.valor; k.lucro += x.lucro;
      }
      for (let k = ini.slice(0, 7); k <= fim.slice(0, 7); k = addMonths(k + '-01', 1).slice(0, 7)) {
        out.labels.push(MESES[+k.slice(5) - 1].slice(0, 3) + '/' + k.slice(2, 4));
        out.valor.push(round2(meses[k]?.valor || 0));
        out.lucro.push(round2(meses[k]?.lucro || 0));
      }
    }
    return out;
  },

  parcelas() {
    return Store.data.vendas.flatMap(v => (v.parcelas || []).map((p, i) => ({ ...p, idx: i, qtdParcelas: v.parcelas.length, venda: v })));
  },

  // Recebido no período (pela data do pagamento) + saldo a receber (sempre o total em aberto)
  carteira({ from = '', to = '' } = {}) {
    const hoje = isoDate(), limite = addDays(hoje, 30);
    const r = { recebido: 0, lucroRecebido: 0, custoRecebido: 0, aReceber: 0, atrasado: 0, atrasadas: [], proximas: [], pendentes: [] };
    for (const p of this.parcelas()) {
      if (p.pago) {
        const d = p.pagoEm || p.vencimento;
        if ((from && d < from) || (to && d > to)) continue;
        const lucro = p.valor * this.margem(p.venda);
        r.recebido += p.valor;
        r.lucroRecebido += lucro;
        r.custoRecebido += p.valor - lucro;
      } else {
        r.aReceber += p.valor;
        r.pendentes.push(p);
        if (p.vencimento < hoje) { r.atrasado += p.valor; r.atrasadas.push(p); }
        else if (p.vencimento <= limite) r.proximas.push(p);
      }
    }
    const porVenc = (a, b) => a.vencimento.localeCompare(b.vencimento);
    r.atrasadas.sort(porVenc); r.proximas.sort(porVenc); r.pendentes.sort(porVenc);
    return r;
  },

  recebidoPorMes(n = 6) {
    const out = { labels: [], bruto: [], liquido: [] }, d = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const a = new Date(d.getFullYear(), d.getMonth() - i, 1), b = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
      const c = this.carteira({ from: isoDate(a), to: isoDate(b) });
      out.labels.push(MESES[a.getMonth()].slice(0, 3));
      out.bruto.push(round2(c.recebido));
      out.liquido.push(round2(c.lucroRecebido));
    }
    return out;
  },

  estoque() {
    const r = { investido: 0, valorVenda: 0, unidades: 0, baixo: [] };
    for (const p of Store.data.produtos) {
      const e = Math.max(0, p.estoque || 0);
      r.investido += e * (p.custo || 0);
      r.valorVenda += e * (p.preco || 0);
      r.unidades += e;
      if (e <= 1) r.baixo.push(p);
    }
    r.lucroPotencial = r.valorVenda - r.investido;
    return r;
  },
};
