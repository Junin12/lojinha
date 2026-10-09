/* Componentes visuais e formulários reutilizados em várias telas */
const Views = {};
const CORES = ['#b9466e', '#c99a4b', '#3f8f8a', '#7a5ea8', '#e07a5f', '#5b7db1', '#9aa36b', '#d4869c'];

const UI = {
  produtoCard(p) {
    const foto = p.fotos?.[0];
    const tag = p.estoque <= 0 ? '<span class="tag">Esgotado</span>' : p.estoque <= 2 ? '<span class="tag warn">Últimas unidades</span>' : '';
    return `<a class="prod-card" href="#/produto/${p.id}">
      <div class="prod-img" ${bgImg(foto)}>${foto ? '' : '📦'}${tag}</div>
      <div class="prod-info"><b>${esc(p.nome)}</b><span class="price">${brl(p.preco)}</span>
      <span class="muted small">${plural(p.estoque, 'unidade', 'unidades')}</span></div></a>`;
  },

  kpi(label, valor, atual = null, anterior = null, opts = {}) {
    let delta = '';
    if (anterior !== null && atual !== null) {
      if (!anterior && !atual) delta = '<span class="delta muted">— igual</span>';
      else if (!anterior) delta = '<span class="delta up">▲ novo</span>';
      else {
        const d = (atual - anterior) / Math.abs(anterior);
        delta = `<span class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span> <small class="muted" style="display:inline">vs anterior</small>`;
      }
    }
    return `<div class="kpi ${opts.hl ? 'hl' : ''}"><span>${label}</span><b>${valor}</b>${delta}${opts.sub ? `<small class="muted">${opts.sub}</small>` : ''}</div>`;
  },

  empty: (ico, txt, extra = '') => `<div class="empty"><div class="big">${ico}</div><p>${txt}</p>${extra}</div>`,

  statusVenda(v) {
    const pagas = v.parcelas.filter(p => p.pago).length;
    if (pagas === v.parcelas.length) return { cls: 'ok', txt: 'Quitada', key: 'quitadas' };
    if (v.parcelas.some(p => !p.pago && p.vencimento < isoDate())) return { cls: 'danger', txt: 'Atrasada', key: 'atrasadas' };
    return { cls: 'warn', txt: `${pagas}/${v.parcelas.length} pagas`, key: 'pendentes' };
  },

  vendaItem(v) {
    const st = UI.statusVenda(v), n = sum(v.itens, i => i.qtd), nome = Store.nomeCliente(v.clienteId);
    return `<div class="item" data-venda="${v.id}">
      <div class="avatar">${esc(initials(nome))}</div>
      <div class="grow"><div class="t">${esc(nome)}</div>
      <div class="s">${fmtDate(v.data)} · ${plural(n, 'item', 'itens')} · ${v.parcelas.length}x</div></div>
      <div class="r">${brl(v.total)}<br><span class="badge ${st.cls}">${st.txt}</span></div></div>`;
  },

  parcelaItem(p) {
    const nome = Store.nomeCliente(p.venda.clienteId), atrasada = p.vencimento < isoDate();
    return `<div class="item static">
      <div class="avatar">${esc(initials(nome))}</div>
      <div class="grow" data-venda="${p.venda.id}" style="cursor:pointer">
        <div class="t">${esc(nome)}</div>
        <div class="s">Parcela ${p.idx + 1}/${p.qtdParcelas} · ${atrasada ? '<b class="danger-txt">venceu</b>' : 'vence'} ${fmtDate(p.vencimento)}</div>
      </div>
      <div class="r">${brl(p.valor)}<br>
        <button class="btn btn-sm" data-lembrar="${p.venda.id}:${p.idx}" title="Lembrar pelo WhatsApp">💬</button>
        <button class="btn btn-sm" data-receber="${p.venda.id}:${p.idx}">✓ Recebi</button>
      </div></div>`;
  },

  // Liga os cliques de vendas e parcelas dentro de um container
  bindLista(el) {
    $$('[data-venda]', el).forEach(x => x.onclick = () => Forms.vendaDetalhe(x.dataset.venda));
    $$('[data-receber]', el).forEach(b => b.onclick = async e => {
      e.stopPropagation();
      const [id, i] = b.dataset.receber.split(':');
      await App.marcarParcela(id, +i, true);
    });
    $$('[data-lembrar]', el).forEach(b => b.onclick = e => {
      e.stopPropagation();
      const [id, i] = b.dataset.lembrar.split(':');
      const v = Store.venda(id), p = v.parcelas[i], c = Store.cliente(v.clienteId);
      const atrasada = p.vencimento < isoDate();
      abrirWhats(c?.telefone, `Olá, ${c?.nome || ''}! Tudo bem? 😊\nPassando para lembrar da parcela ${+i + 1}/${v.parcelas.length} no valor de ${brl(p.valor)}, ${atrasada ? 'que venceu' : 'com vencimento'} em ${fmtDate(p.vencimento)}, referente à sua compra de ${fmtDate(v.data)} na ${Store.config.nomeLoja}.\nQualquer dúvida, estou à disposição! 💖`);
    });
  },

  options: (items, sel, label = x => x.nome) =>
    items.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(label(x))}</option>`).join(''),

  clientesOrdenados: () => [...Store.data.clientes].sort((a, b) => norm(a.nome + a.sobrenome).localeCompare(norm(b.nome + b.sobrenome))),
  categoriasOrdenadas: () => [...Store.data.categorias].sort((a, b) => a.nome.localeCompare(b.nome)),
};

const Forms = {
  categoria(cat, onSave) {
    const novo = !cat;
    const c = cat ? { ...cat } : { id: uid(), nome: '', criadoEm: new Date().toISOString() };
    const qtd = Store.data.produtos.filter(p => p.categoriaId === c.id).length;
    openModal(novo ? 'Nova categoria' : 'Editar categoria', `
      <form id="fCat">
        <label class="field"><span>Nome da categoria</span>
          <input name="nome" required maxlength="40" value="${esc(c.nome)}" placeholder="Ex.: Relógios, Semijoias, Roupas" autocomplete="off"></label>
        <div class="actions"><button class="btn btn-primary" type="submit">Salvar</button>
        ${!novo ? `<button class="btn btn-danger" type="button" id="delCat" ${qtd ? 'disabled title="Mova ou exclua os produtos antes"' : ''}>Excluir</button>` : ''}</div>
        ${!novo && qtd ? `<p class="muted small">Para excluir, a categoria precisa estar vazia (${plural(qtd, 'produto', 'produtos')}).</p>` : ''}
      </form>`, card => {
      const f = $('#fCat', card);
      f.nome.focus();
      f.onsubmit = async e => {
        e.preventDefault();
        const item = { ...c, nome: f.nome.value.trim() };
        if (!item.nome) return toast('Digite o nome da categoria', 'error');
        if (await App.salvar([{ op: 'save', table: 'categorias', item }], 'Categoria salva!')) {
          closeModal();
          onSave ? onSave(item) : App.rerender();
        }
      };
      const del = $('#delCat', card);
      if (del) del.onclick = async () => {
        if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
        if (await App.salvar([{ op: 'remove', table: 'categorias', id: c.id }], 'Categoria excluída')) { closeModal(); App.go('produtos'); }
      };
    });
  },

  cliente(cli, onSave) {
    const novo = !cli;
    const c = cli ? { ...cli } : { id: uid(), nome: '', sobrenome: '', referencia: '', telefone: '', endereco: '', email: '', criadoEm: new Date().toISOString() };
    openModal(novo ? 'Novo cliente' : 'Editar cliente', `
      <form id="fCli">
        <div class="row2">
          <label class="field"><span>Nome *</span><input name="nome" required value="${esc(c.nome)}" autocomplete="off"></label>
          <label class="field"><span>Sobrenome</span><input name="sobrenome" value="${esc(c.sobrenome)}" autocomplete="off"></label>
        </div>
        <label class="field"><span>Referência</span>
          <textarea name="referencia" placeholder="Escreva qualquer informação sobre a pessoa. Ex.: por onde fez a compra (Instagram, indicação, loja), telefone, endereço, e-mail...">${esc(c.referencia)}</textarea></label>
        <details ${c.telefone || c.endereco || c.email ? 'open' : ''}>
          <summary>＋ Telefone, endereço e e-mail (opcional)</summary>
          <label class="field"><span>Telefone / WhatsApp</span><input name="telefone" type="tel" inputmode="tel" placeholder="(11) 99999-9999" value="${esc(c.telefone)}"></label>
          <label class="field"><span>Endereço</span><input name="endereco" value="${esc(c.endereco)}"></label>
          <label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(c.email)}"></label>
        </details>
        <div class="actions"><button class="btn btn-primary" type="submit">💾 Salvar cliente</button></div>
      </form>`, card => {
      const f = $('#fCli', card);
      f.onsubmit = async e => {
        e.preventDefault();
        const val = n => f.elements[n].value.trim();
        const item = { ...c, nome: val('nome'), sobrenome: val('sobrenome'), referencia: val('referencia'), telefone: val('telefone'), endereco: val('endereco'), email: val('email') };
        if (!item.nome) return toast('Digite o nome do cliente', 'error');
        if (await App.salvar([{ op: 'save', table: 'clientes', item }], 'Cliente salvo!')) {
          closeModal();
          onSave ? onSave(item) : App.rerender();
        }
      };
    });
  },

  vendaDetalhe(id) {
    const v = Store.venda(id);
    if (!v) return;
    const cli = Store.cliente(v.clienteId), nome = Store.nomeCliente(v.clienteId);
    const hoje = isoDate();
    openModal(`Venda de ${fmtDate(v.data)}`, `
      <div class="item static" style="margin-bottom:12px">
        <div class="avatar">${esc(initials(nome))}</div>
        <div class="grow"><div class="t">${esc(nome)}</div><div class="s">${esc(cli?.telefone || cli?.referencia || '')}</div></div>
        <span class="badge ${UI.statusVenda(v).cls}">${UI.statusVenda(v).txt}</span>
      </div>
      <table class="tbl">
        <thead><tr><th>Item</th><th>Qtd</th><th class="num">Valor</th></tr></thead>
        <tbody>${v.itens.map(i => `<tr><td>${esc(i.nome)}</td><td>${i.qtd}</td><td class="num">${brl(i.qtd * i.preco)}</td></tr>`).join('')}</tbody>
        <tfoot>
          ${v.desconto ? `<tr><td colspan="2">Desconto</td><td class="num">− ${brl(v.desconto)}</td></tr>` : ''}
          <tr class="total"><td colspan="2">Total</td><td class="num">${brl(v.total)}</td></tr>
          <tr><td colspan="2" class="muted">Lucro líquido da venda</td><td class="num ok-txt">${brl(v.total - v.custoTotal)}</td></tr>
        </tfoot>
      </table>
      <h4>Parcelas — toque para marcar como paga</h4>
      <div class="list">${v.parcelas.map((p, i) => `
        <label class="item parcela ${p.pago ? 'paga' : ''}">
          <input type="checkbox" data-i="${i}" ${p.pago ? 'checked' : ''}>
          <div class="grow"><div class="t">${i + 1}ª parcela · ${brl(p.valor)}</div>
          <div class="s">${p.pago ? '✅ Paga em ' + fmtDate(p.pagoEm) : (p.vencimento < hoje ? '<b class="danger-txt">Atrasada</b> · venceu ' : 'Vence ') + fmtDate(p.vencimento)}</div></div>
        </label>`).join('')}</div>
      ${v.obs ? `<p class="muted small">Obs.: ${esc(v.obs)}</p>` : ''}
      <div class="actions">
        <button class="btn btn-wa" id="vWa">💬 Enviar resumo ao cliente</button>
        <button class="btn btn-danger" id="vDel">🗑️ Excluir venda</button>
      </div>`, card => {
      $$('input[data-i]', card).forEach(cb => cb.onchange = () => App.marcarParcela(id, +cb.dataset.i, cb.checked, true));
      $('#vWa', card).onclick = () => {
        const linhas = v.itens.map(i => `• ${i.qtd}x ${i.nome} — ${brl(i.qtd * i.preco)}`).join('\n');
        const parc = v.parcelas.map((p, i) => `${i + 1}ª ${brl(p.valor)} — ${p.pago ? 'paga ✅' : 'vence ' + fmtDate(p.vencimento)}`).join('\n');
        abrirWhats(cli?.telefone, `Olá, ${cli?.nome || ''}! 😊\nResumo da sua compra na *${Store.config.nomeLoja}* (${fmtDate(v.data)}):\n\n${linhas}\n${v.desconto ? `Desconto: − ${brl(v.desconto)}\n` : ''}*Total: ${brl(v.total)}*\n\nPagamento:\n${parc}\n\nObrigada pela preferência! 💖`);
      };
      $('#vDel', card).onclick = async () => {
        if (!confirm('Excluir esta venda? Os produtos voltam para o estoque.')) return;
        const ops = [{ op: 'remove', table: 'vendas', id }];
        for (const i of v.itens) {
          const p = Store.produto(i.produtoId);
          if (p) ops.push({ op: 'save', table: 'produtos', item: { ...p, estoque: (p.estoque || 0) + i.qtd } });
        }
        if (await App.salvar(ops, 'Venda excluída e estoque devolvido')) { closeModal(); App.rerender(); }
      };
    });
  },
};
