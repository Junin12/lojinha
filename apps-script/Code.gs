/**
 * LOJINHA — Banco de dados no Google Drive (Google Apps Script)
 *
 * Como usar (detalhes no README.md):
 *  1. Em script.google.com crie um projeto novo e cole este arquivo.
 *  2. Execute a função "setup" uma vez e autorize o acesso.
 *     No "Registro de execução" aparecem o link da planilha e a CHAVE DE ACESSO.
 *  3. Implantar > Nova implantação > App da Web
 *     Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 *  4. Copie a URL terminada em /exec e cole no app (Configurações) junto com a chave.
 */

const NOME_PLANILHA = 'Lojinha - Banco de Dados';
const NOME_PASTA = 'Lojinha - Fotos';

const TABELAS = {
  categorias: ['id', 'nome', 'criadoEm'],
  produtos: ['id', 'categoriaId', 'nome', 'descricao', 'fotos', 'estoque', 'preco', 'custo', 'criadoEm', 'atualizadoEm'],
  clientes: ['id', 'nome', 'sobrenome', 'referencia', 'telefone', 'endereco', 'email', 'criadoEm'],
  vendas: ['id', 'data', 'clienteId', 'itens', 'subtotal', 'desconto', 'total', 'custoTotal', 'parcelas', 'obs', 'criadoEm'],
};
const NUMEROS = ['estoque', 'preco', 'custo', 'subtotal', 'desconto', 'total', 'custoTotal'];
const JSONS = ['fotos', 'itens', 'parcelas'];

/* ---------- Configuração inicial (rodar uma vez) ---------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');
  if (!ssId) {
    ssId = SpreadsheetApp.create(NOME_PLANILHA).getId();
    props.setProperty('SPREADSHEET_ID', ssId);
  }
  const ss = SpreadsheetApp.openById(ssId);
  Object.keys(TABELAS).forEach(t => aba_(ss, t));
  aba_(ss, 'config');
  ss.getSheets().forEach(sh => {
    if (!TABELAS[sh.getName()] && sh.getName() !== 'config' && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  if (!props.getProperty('FOLDER_ID')) props.setProperty('FOLDER_ID', DriveApp.createFolder(NOME_PASTA).getId());
  let token = props.getProperty('TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('TOKEN', token);
  }
  Logger.log('Planilha: ' + ss.getUrl());
  Logger.log('CHAVE DE ACESSO (cole no app): ' + token);
}

/* ---------- Entradas HTTP ---------- */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action !== 'catalogo') return saida_({ ok: true, msg: 'API da Lojinha funcionando.' });
  try {
    const ss = planilha_();
    // Catálogo público: nunca envia custo, clientes ou vendas
    const produtos = ler_(ss, 'produtos').map(p => ({
      id: p.id, categoriaId: p.categoriaId, nome: p.nome, descricao: p.descricao, fotos: p.fotos, estoque: p.estoque, preco: p.preco,
    }));
    return saida_({ ok: true, produtos: produtos, categorias: ler_(ss, 'categorias'), config: lerConfig_(ss) });
  } catch (err) {
    return saida_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (!req.token || req.token !== PropertiesService.getScriptProperties().getProperty('TOKEN')) {
      return saida_({ ok: false, error: 'chave de acesso inválida' });
    }
    const ss = planilha_();
    switch (req.action) {
      case 'ping':
        return saida_({ ok: true });
      case 'getAll':
        return saida_({ ok: true, data: todos_(ss), config: lerConfig_(ss) });
      case 'batch':
        return comTrava_(() => { batch_(ss, req.ops || []); return saida_({ ok: true }); });
      case 'upload':
        return saida_({ ok: true, url: upload_(req.dataUrl) });
      case 'saveConfig':
        return comTrava_(() => { salvarConfig_(ss, req.config || {}); return saida_({ ok: true }); });
      case 'replaceAll':
        return comTrava_(() => { substituir_(ss, req.data || {}); if (req.config) salvarConfig_(ss, req.config); return saida_({ ok: true }); });
      default:
        return saida_({ ok: false, error: 'ação desconhecida' });
    }
  } catch (err) {
    return saida_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- Auxiliares ---------- */
function saida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function comTrava_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function planilha_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('execute a função setup() no Apps Script primeiro');
  return SpreadsheetApp.openById(id);
}

function aba_(ss, nome) {
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    const cols = TABELAS[nome] || ['chave', 'valor'];
    sh.getRange('A:Z').setNumberFormat('@'); // tudo como texto: preserva telefones, datas e zeros
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#fbe9f0');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ler_(ss, t) {
  const valores = aba_(ss, t).getDataRange().getValues();
  const cab = valores.shift() || [];
  const tz = ss.getSpreadsheetTimeZone();
  return valores.filter(l => l[0] !== '').map(l => {
    const o = {};
    cab.forEach((h, i) => {
      let v = l[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      if (JSONS.indexOf(h) >= 0) { try { v = v ? JSON.parse(v) : []; } catch (e) { v = []; } }
      else if (NUMEROS.indexOf(h) >= 0) v = Number(v) || 0;
      else v = v === '' || v === null ? '' : String(v);
      o[h] = v;
    });
    return o;
  });
}

function todos_(ss) {
  const d = {};
  Object.keys(TABELAS).forEach(t => { d[t] = ler_(ss, t); });
  return d;
}

function linha_(t, item) {
  return TABELAS[t].map(c => {
    const v = item[c];
    if (JSONS.indexOf(c) >= 0) return JSON.stringify(v || []);
    return v === undefined || v === null ? '' : String(v);
  });
}

function batch_(ss, ops) {
  const ids = {};
  ops.forEach(op => {
    const t = op.table;
    if (!TABELAS[t]) throw new Error('tabela inválida: ' + t);
    const sh = aba_(ss, t);
    if (!ids[t]) {
      const n = sh.getLastRow() - 1;
      ids[t] = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0])) : [];
    }
    const lista = ids[t];
    if (op.op === 'save') {
      const row = linha_(t, op.item);
      const i = lista.indexOf(String(op.item.id));
      if (i >= 0) {
        sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
      } else {
        const r = lista.length + 2;
        if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
        sh.getRange(r, 1, 1, row.length).setValues([row]);
        lista.push(String(op.item.id));
      }
    } else if (op.op === 'remove') {
      const i = lista.indexOf(String(op.id));
      if (i >= 0) { sh.deleteRow(i + 2); lista.splice(i, 1); }
    }
  });
}

function substituir_(ss, data) {
  Object.keys(TABELAS).forEach(t => {
    const sh = aba_(ss, t);
    const n = sh.getLastRow() - 1;
    if (n > 0) sh.getRange(2, 1, n, sh.getLastColumn()).clearContent();
    const linhas = (data[t] || []).map(item => linha_(t, item));
    if (!linhas.length) return;
    if (linhas.length + 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), linhas.length + 50);
    sh.getRange(2, 1, linhas.length, TABELAS[t].length).setValues(linhas);
  });
}

function lerConfig_(ss) {
  const o = {};
  aba_(ss, 'config').getDataRange().getValues().slice(1).forEach(l => { if (l[0]) o[l[0]] = String(l[1]); });
  return o;
}

function salvarConfig_(ss, cfg) {
  const sh = aba_(ss, 'config');
  const atual = Object.assign(lerConfig_(ss), { nomeLoja: cfg.nomeLoja || '', whatsapp: cfg.whatsapp || '' });
  const linhas = Object.keys(atual).map(k => [k, String(atual[k])]);
  const n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 2).clearContent();
  sh.getRange(2, 1, linhas.length, 2).setValues(linhas);
}

function upload_(dataUrl) {
  const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('imagem inválida');
  const pasta = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'foto_' + Date.now() + '.jpg');
  const arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // para aparecer na loja virtual
  return 'https://lh3.googleusercontent.com/d/' + arquivo.getId();
}
