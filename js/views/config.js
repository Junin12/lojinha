/* Configurações: dados da loja, conexão com o Google Drive e backup */

Views.config = () => {
  App.setTitle('Configurações');
  App.parent = '';
  const c = Store.config, rem = Store.remoto();
  const link = Store.lojaUrl();
  const temDados = Store.TABELAS.some(t => Store.data[t].length);

  view.innerHTML = `
    <div class="narrow">
      <div class="card"><h3>🏪 Sua loja</h3>
        <label class="field"><span>Nome da loja</span><input id="cNome" value="${esc(c.nomeLoja)}"></label>
        <label class="field"><span>WhatsApp da loja</span><input id="cWa" type="tel" inputmode="tel" placeholder="(11) 99999-9999" value="${esc(c.whatsapp)}"></label>
        <p class="muted small">Esse número recebe as mensagens de quem tocar em "Quero este" na loja virtual.</p>
        <button class="btn btn-primary btn-block" id="salvarLoja">Salvar</button>
      </div>

      <div class="card"><h3>☁️ Banco de dados no Google Drive</h3>
        <div class="notice ${rem ? 'ok' : ''}" style="margin:0 0 14px">${rem ? '✅ Conectado — os dados estão salvos na planilha do seu Google Drive.' : '📱 Modo local — os dados estão salvos só neste aparelho.'}</div>
        <label class="field"><span>URL do Web App (Apps Script)</span><input id="cUrl" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(c.apiUrl || window.LOJA_API_URL || '')}"></label>
        <label class="field"><span>Chave de acesso</span><input id="cTok" type="password" autocomplete="off" value="${esc(c.token)}"></label>
        <div class="actions" style="margin-top:0">
          <button class="btn btn-primary" id="conectar">${rem ? '🔄 Reconectar' : '🔗 Conectar'}</button>
          ${rem ? '<button class="btn btn-ghost" id="desconectar">Desconectar</button>' : ''}
        </div>
        <p class="muted small">O passo a passo para criar a planilha está no arquivo <b>README.md</b> do projeto.</p>
      </div>

      <div class="card"><h3>🔗 Loja virtual</h3>
        <p class="muted small" style="margin-top:0">Link para os clientes verem fotos, preços e todos os itens:</p>
        <div class="copy"><input class="input" readonly value="${esc(link)}"><button class="btn" id="copiar">Copiar</button></div>
        ${!rem && !window.LOJA_API_URL ? '<p class="muted small">⚠️ Em modo local a loja virtual só funciona neste aparelho. Conecte ao Google Drive para os clientes verem.</p>' : ''}
        <div class="actions">
          <a class="btn btn-ghost" href="loja.html" target="_blank">👀 Abrir loja</a>
          <button class="btn btn-wa" id="waLoja">💬 Enviar no WhatsApp</button>
        </div>
      </div>

      <div class="card"><h3>💾 Backup</h3>
        <p class="muted small" style="margin-top:0">Guarde uma cópia de segurança de todos os dados (arquivo .json).</p>
        <div class="actions" style="margin-top:0">
          <button class="btn btn-ghost" id="exportar">⬇️ Exportar</button>
          <button class="btn btn-ghost" id="importar">⬆️ Importar</button>
        </div>
        <input type="file" id="arqImport" accept=".json,application/json" hidden>
        ${!rem ? `<button class="btn btn-block" id="demo" style="margin-top:10px">✨ ${temDados ? 'Adicionar' : 'Carregar'} dados de exemplo para testar</button>` : ''}
      </div>
    </div>`;

  $('#salvarLoja').onclick = async () => {
    c.nomeLoja = $('#cNome').value.trim() || 'Minha Lojinha';
    c.whatsapp = $('#cWa').value.trim();
    loading(true);
    try { await Store.salvarConfigLoja(); toast('Dados da loja salvos!', 'ok'); }
    catch (e) { toast('Salvo no aparelho, mas não no Drive: ' + e.message, 'error'); }
    finally { loading(false); }
  };

  $('#conectar').onclick = async () => {
    const url = $('#cUrl').value.trim(), tok = $('#cTok').value.trim();
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) return toast('A URL deve começar com https://script.google.com e terminar com /exec', 'error');
    if (!tok) return toast('Informe a chave de acesso', 'error');
    loading(true);
    try {
      const j = await Store.api({ action: 'getAll' }, url, tok);
      const remotoVazio = Store.TABELAS.every(t => !(j.data[t] || []).length);
      c.apiUrl = url; c.token = tok;
      Store.salvarConfig();
      if (remotoVazio && temDados && confirm('A planilha do Google Drive está vazia. Enviar os dados deste aparelho para lá?')) {
        await Store.substituirRemoto();
      }
      await Store.init();
      toast('Conectado ao Google Drive! ✅', 'ok');
      App.rerender();
    } catch (e) {
      toast('Não foi possível conectar: ' + e.message, 'error');
    } finally {
      loading(false);
    }
  };

  const desc = $('#desconectar');
  if (desc) desc.onclick = () => {
    if (!confirm('Desconectar do Google Drive? Uma cópia dos dados fica neste aparelho, mas novas alterações não irão para a planilha.')) return;
    c.token = '';
    c.apiUrl = '';
    Store.salvarConfig();
    App.rerender();
  };

  $('#copiar').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copiado!', 'ok'); }
    catch { toast('Não foi possível copiar. Selecione o link e copie manualmente.'); }
  };
  $('#waLoja').onclick = () => abrirWhats('', `🛍️ Conheça a *${c.nomeLoja}*!\nVeja nossos produtos, fotos e preços:\n${link}`);

  $('#exportar').onclick = () => {
    baixarArquivo(`backup-lojinha-${isoDate()}.json`, JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), config: { nomeLoja: c.nomeLoja, whatsapp: c.whatsapp }, data: Store.data }, null, 2));
    toast('Backup baixado!', 'ok');
  };
  $('#importar').onclick = () => $('#arqImport').click();
  $('#arqImport').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      const dados = obj.data || obj;
      if (!Store.TABELAS.every(t => Array.isArray(dados[t]))) throw new Error('arquivo não é um backup da Lojinha');
      if (!confirm('Importar este backup? Os dados atuais serão SUBSTITUÍDOS.')) return;
      loading(true);
      await Store.importar(dados);
      if (obj.config) { Object.assign(c, obj.config); await Store.salvarConfigLoja(); }
      toast('Backup importado!', 'ok');
      App.go('');
    } catch (err) {
      toast('Erro ao importar: ' + err.message, 'error');
    } finally {
      loading(false);
    }
  };

  const demo = $('#demo');
  if (demo) demo.onclick = () => {
    if (temDados && !confirm('Adicionar dados de exemplo aos dados que já existem?')) return;
    Demo.carregar();
    toast('Dados de exemplo carregados! ✨', 'ok');
    App.go('dashboard');
  };
};
