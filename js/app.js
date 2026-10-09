/* Navegação entre telas e inicialização */
const App = {
  charts: [],
  parent: '',
  depoisDeAbrir: null,

  go(path) { location.hash = '#/' + path; },

  setTitle(t, voltar = true) {
    $('#pageTitle').textContent = t;
    $('#btnBack').style.visibility = voltar ? 'visible' : 'hidden';
    document.title = t === Store.config.nomeLoja ? t : `${t} · ${Store.config.nomeLoja}`;
  },

  chart(id, cfg) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return null;
    const c = new Chart(el, cfg);
    this.charts.push(c);
    return c;
  },
  destroyCharts() { this.charts.forEach(c => c.destroy()); this.charts = []; },

  routes: [
    [/^$/, () => Views.home()],
    [/^dashboard$/, () => Views.dashboard()],
    [/^produtos$/, () => Views.produtos()],
    [/^produtos\/cat\/(.+)$/, m => Views.categoria(m[1])],
    [/^produto\/([^?]+)$/, (m, q) => Views.produto(m[1], q)],
    [/^clientes$/, () => Views.clientes()],
    [/^cliente\/(.+)$/, m => Views.cliente(m[1])],
    [/^vendas$/, () => Views.vendas()],
    [/^venda\/nova$/, (m, q) => Views.novaVenda(q)],
    [/^carteira$/, () => Views.carteira()],
    [/^relatorios$/, () => Views.relatorios()],
    [/^config$/, () => Views.config()],
  ],

  route(manterModal = false) {
    const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
    App.destroyCharts();
    if (!manterModal) closeModal();
    const rota = App.routes.find(([re]) => re.test(path));
    if (!rota) return App.go('');
    if (!manterModal) window.scrollTo(0, 0);
    rota[1](path.match(rota[0]), new URLSearchParams(qs || ''));
    $$('#bottomnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === path));
    if (App.depoisDeAbrir) { const fn = App.depoisDeAbrir; App.depoisDeAbrir = null; fn(); }
  },
  rerender() { App.route(true); },

  async salvar(ops, msg = 'Salvo!') {
    loading(true);
    try {
      await Store.commit(ops);
      toast(msg, 'ok');
      return true;
    } catch (e) {
      console.error(e);
      toast('Não foi possível salvar: ' + e.message, 'error');
      return false;
    } finally {
      loading(false);
    }
  },

  async marcarParcela(vendaId, i, pago, reabrirDetalhe = false) {
    const v = structuredClone(Store.venda(vendaId));
    v.parcelas[i].pago = pago;
    v.parcelas[i].pagoEm = pago ? isoDate() : '';
    await App.salvar([{ op: 'save', table: 'vendas', item: v }], pago ? 'Parcela recebida! 💰' : 'Parcela marcada como pendente');
    App.rerender();
    if (reabrirDetalhe) Forms.vendaDetalhe(vendaId);
  },
};

$('#btnBack').onclick = () => App.go(App.parent);

(async function iniciar() {
  if (window.Chart) {
    Chart.defaults.font.family = "Poppins, system-ui, sans-serif";
    Chart.defaults.color = '#8c7f84';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.maintainAspectRatio = false;
  }
  if (Store.remoto()) {
    loading(true);
    try { await Store.init(); }
    catch (e) { console.error(e); toast('Sem conexão com o Google Drive. Mostrando os últimos dados salvos no aparelho.', 'error'); }
    loading(false);
  }
  window.addEventListener('hashchange', () => App.route());
  App.route();
})();
