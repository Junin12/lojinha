/* Clientes: lista e ficha do cliente */

function resumoClientes() {
  const r = {};
  for (const v of Store.data.vendas) {
    const s = (r[v.clienteId] ||= { total: 0, pend: 0, n: 0 });
    s.total += v.total;
    s.n++;
    s.pend += sum(v.parcelas.filter(p => !p.pago), p => p.valor);
  }
  return r;
}

Views.clientes = () => {
  App.setTitle('Clientes');
  App.parent = '';
  view.innerHTML = `
    <div class="toolbar">
      <input id="busca" class="search" type="search" placeholder="🔎 Buscar por nome ou referência...">
      <button class="btn btn-primary" id="novo">＋ Novo cliente</button>
    </div>
    <div id="lista"></div>`;
  const stats = resumoClientes();

  const render = () => {
    const q = norm($('#busca').value.trim());
    const lista = UI.clientesOrdenados().filter(c => norm(`${c.nome} ${c.sobrenome} ${c.referencia} ${c.telefone}`).includes(q));
    $('#lista').innerHTML = lista.length ? `<div class="list">${lista.map(c => {
      const s = stats[c.id] || { total: 0, pend: 0, n: 0 }, nome = `${c.nome} ${c.sobrenome || ''}`.trim();
      return `<a class="item" href="#/cliente/${c.id}">
        <div class="avatar">${esc(initials(nome))}</div>
        <div class="grow"><div class="t">${esc(nome)}</div><div class="s">${esc(c.referencia || c.telefone || 'Sem referência')}</div></div>
        <div class="r">${brl(s.total)}<br>${s.pend > 0 ? `<span class="badge warn">${brl(s.pend)} a receber</span>` : `<span class="muted small">${plural(s.n, 'compra', 'compras')}</span>`}</div>
      </a>`;
    }).join('')}</div>` : UI.empty('👥', q ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.');
  };
  $('#busca').oninput = render;
  $('#novo').onclick = () => Forms.cliente();
  render();
};

Views.cliente = id => {
  const c = Store.cliente(id);
  if (!c) return App.go('clientes');
  const nome = `${c.nome} ${c.sobrenome || ''}`.trim();
  App.setTitle(nome);
  App.parent = 'clientes';
  const vendas = Store.data.vendas.filter(v => v.clienteId === id).sort((a, b) => b.data.localeCompare(a.data));
  const s = resumoClientes()[id] || { total: 0, pend: 0, n: 0 };
  const lucro = sum(vendas, v => v.total - v.custoTotal);

  view.innerHTML = `
    <div class="narrow">
      <div class="card" style="text-align:center">
        <div class="avatar lg" style="margin:0 auto 10px">${esc(initials(nome))}</div>
        <h2 style="font-size:20px">${esc(nome)}</h2>
        ${c.referencia ? `<p class="muted pre" style="margin:8px 0 0">${esc(c.referencia)}</p>` : ''}
        ${c.telefone || c.endereco || c.email ? `<p class="small" style="margin:10px 0 0">${[c.telefone && '📞 ' + esc(c.telefone), c.endereco && '📍 ' + esc(c.endereco), c.email && '✉️ ' + esc(c.email)].filter(Boolean).join('<br>')}</p>` : ''}
        <div class="actions">
          <a class="btn btn-primary" href="#/venda/nova?cliente=${id}">🧾 Nova venda</a>
          ${c.telefone ? '<button class="btn btn-wa" id="wa">💬 WhatsApp</button>' : ''}
          <button class="btn btn-ghost" id="editar">✏️ Editar</button>
        </div>
      </div>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
        ${UI.kpi('Total comprado', brl(s.total))}
        ${UI.kpi('Compras', s.n, null, null, { sub: 'Lucro ' + brl(lucro) })}
        ${UI.kpi('A receber', brl(s.pend))}
      </div>
      <h3 class="section-title">Histórico de compras</h3>
      <div class="list" id="hist">${vendas.length ? vendas.map(UI.vendaItem).join('') : UI.empty('🧾', 'Nenhuma compra registrada.')}</div>
      <button class="btn btn-danger btn-block" id="excluir" style="margin-top:20px">🗑️ Excluir cliente</button>
    </div>`;

  UI.bindLista($('#hist'));
  $('#editar').onclick = () => Forms.cliente(c);
  if (c.telefone) $('#wa').onclick = () => abrirWhats(c.telefone, `Olá, ${c.nome}! 😊`);
  $('#excluir').onclick = async () => {
    const msg = vendas.length ? `Excluir ${nome}? As ${vendas.length} venda(s) continuam registradas como "Cliente removido".` : `Excluir ${nome}?`;
    if (!confirm(msg)) return;
    if (await App.salvar([{ op: 'remove', table: 'clientes', id }], 'Cliente excluído')) App.go('clientes');
  };
};
