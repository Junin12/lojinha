/*
 * Camada de dados.
 * - Modo local: tudo fica no localStorage do aparelho.
 * - Modo Google Drive: lê/grava na planilha via Web App do Apps Script,
 *   mantendo uma cópia local para abrir rápido.
 */
const Store = (() => {
  const CFG_KEY = 'lojinha_config';
  const DATA_KEY = 'lojinha_dados';
  const TABELAS = ['categorias', 'produtos', 'clientes', 'vendas'];
  const vazio = () => ({ categorias: [], produtos: [], clientes: [], vendas: [] });
  const ler = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

  const config = Object.assign({ nomeLoja: 'Minha Lojinha', whatsapp: '', apiUrl: '', token: '' }, ler(CFG_KEY) || {});
  let data = Object.assign(vazio(), ler(DATA_KEY) || {});

  const apiUrl = () => (config.apiUrl || window.LOJA_API_URL || '').trim();
  const remoto = () => !!(apiUrl() && config.token);

  function salvarLocal() {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
    catch (e) { console.error(e); toast('Memória do aparelho cheia. Conecte ao Google Drive para guardar as fotos.', 'error'); }
  }
  const salvarConfig = () => localStorage.setItem(CFG_KEY, JSON.stringify(config));

  async function api(payload, url = apiUrl(), token = config.token) {
    // text/plain evita a requisição "preflight" de CORS, que o Apps Script não aceita
    const r = await fetch(url, { method: 'POST', body: JSON.stringify({ ...payload, token }) });
    if (!r.ok) throw new Error('falha de conexão (' + r.status + ')');
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'erro no servidor');
    return j;
  }

  async function init() {
    if (!remoto()) return;
    const j = await api({ action: 'getAll' });
    data = Object.assign(vazio(), j.data);
    if (j.config) {
      if (j.config.nomeLoja) config.nomeLoja = j.config.nomeLoja;
      if (j.config.whatsapp) config.whatsapp = j.config.whatsapp;
      salvarConfig();
    }
    salvarLocal();
  }

  function aplicar(op) {
    const arr = data[op.table];
    if (op.op === 'save') {
      const i = arr.findIndex(x => x.id === op.item.id);
      if (i >= 0) arr[i] = op.item; else arr.push(op.item);
    } else if (op.op === 'remove') {
      const i = arr.findIndex(x => x.id === op.id);
      if (i >= 0) arr.splice(i, 1);
    }
  }

  // ops: [{ op: 'save', table, item } | { op: 'remove', table, id }]
  async function commit(ops) {
    if (remoto()) await api({ action: 'batch', ops });
    ops.forEach(aplicar);
    salvarLocal();
  }

  async function uploadFoto(dataUrl) {
    if (!remoto()) return dataUrl;
    return (await api({ action: 'upload', dataUrl })).url;
  }

  async function salvarConfigLoja() {
    salvarConfig();
    if (remoto()) await api({ action: 'saveConfig', config: { nomeLoja: config.nomeLoja, whatsapp: config.whatsapp } });
  }

  // Envia todos os dados deste aparelho para a planilha (substitui o que houver lá)
  async function substituirRemoto() {
    for (const p of data.produtos) {
      p.fotos = await Promise.all((p.fotos || []).map(f => f.startsWith('data:') ? uploadFoto(f) : f));
    }
    await api({ action: 'replaceAll', data, config: { nomeLoja: config.nomeLoja, whatsapp: config.whatsapp } });
    salvarLocal();
  }

  async function importar(obj) {
    data = Object.assign(vazio(), obj);
    if (remoto()) await substituirRemoto(); else salvarLocal();
  }

  const porId = (t, id) => data[t].find(x => x.id === id);

  return {
    TABELAS, config, apiUrl, remoto, api, init, commit, uploadFoto,
    salvarConfig, salvarConfigLoja, substituirRemoto, importar,
    get data() { return data; },
    categoria: id => porId('categorias', id),
    produto: id => porId('produtos', id),
    cliente: id => porId('clientes', id),
    venda: id => porId('vendas', id),
    nomeCliente(id) {
      const c = porId('clientes', id);
      return c ? `${c.nome} ${c.sobrenome || ''}`.trim() : 'Cliente removido';
    },
    lojaUrl: (q = '') => new URL('loja.html' + q, location.href).href,
  };
})();
