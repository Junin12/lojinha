Views.home = () => {
  App.setTitle(Store.config.nomeLoja || 'Minha Lojinha', false);
  App.parent = '';
  const mes = Analytics.analyze(Analytics.periodo('mes'));
  const cart = Analytics.carteira();
  const h = new Date().getHours();
  const saudacao = h < 12 ? 'Bom dia ☀️' : h < 18 ? 'Boa tarde 🌸' : 'Boa noite 🌙';
  const d = Store.data;

  const tiles = [
    ['dashboard', '📊', 'Dashboard', 'Visão geral da loja', '#fbe9f0'],
    ['produtos', '🛍️', 'Produtos', plural(d.produtos.length, 'item cadastrado', 'itens cadastrados'), '#fdf1de'],
    ['clientes', '👥', 'Clientes', plural(d.clientes.length, 'cliente', 'clientes'), '#e3f2f1'],
    ['vendas', '🧾', 'Vendas', plural(mes.nVendas, 'venda no mês', 'vendas no mês'), '#ece6f6'],
    ['carteira', '👛', 'Carteira', `${brl(cart.aReceber)} a receber`, '#e3f6ee'],
    ['relatorios', '📄', 'Relatórios', 'Semanal e mensal em PDF', '#e6edf7'],
  ];

  view.innerHTML = `
    <section class="hello">
      <p>${saudacao}</p>
      <h2>${esc(Store.config.nomeLoja)}</h2>
      <div class="hello-stats">
        <div><span>Vendido este mês</span><b>${brl(mes.faturamento)}</b></div>
        <div><span>Lucro este mês</span><b>${brl(mes.lucro)}</b></div>
      </div>
    </section>
    <div class="tiles">
      ${tiles.map(([r, ico, t, s, c]) => `<a class="tile" href="#/${r}"><div class="ico" style="--c:${c}">${ico}</div><b>${t}</b><span>${s}</span></a>`).join('')}
    </div>
    ${cart.atrasadas.length ? `<div class="notice danger">⚠️ ${plural(cart.atrasadas.length, 'parcela atrasada', 'parcelas atrasadas')} somando <b>${brl(cart.atrasado)}</b>. <a href="#/carteira">Ver na carteira</a></div>` : ''}
    ${!Store.remoto() ? `<div class="notice">📱 <b>Modo local:</b> os dados estão salvos só neste aparelho. Para guardar no Google Drive, vá em <a href="#/config">Configurações</a>.</div>` : ''}
  `;
};
