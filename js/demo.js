/* Dados de exemplo para testar o app (somente no modo local) */
const Demo = {
  carregar() {
    const d = Store.data, agora = new Date().toISOString();
    const cat = nome => { const c = { id: uid(), nome, criadoEm: agora }; d.categorias.push(c); return c.id; };
    const rel = cat('Relógios'), sj = cat('Semijoias'), rp = cat('Roupas');
    const prods = [
      [rel, 'Relógio dourado feminino', 'Pulseira em aço, caixa 32mm, resistente à água.', 189.9, 95],
      [rel, 'Relógio prata clássico', 'Mostrador branco, pulseira de elos.', 159.9, 80],
      [rel, 'Smartwatch rosé', 'Monitor cardíaco, notificações do celular.', 249.9, 130],
      [sj, 'Colar ponto de luz', 'Banhado a ouro 18k, zircônia.', 59.9, 22],
      [sj, 'Brinco argola média', 'Banho de ouro, 3cm.', 39.9, 14],
      [sj, 'Pulseira riviera', 'Zircônias cravejadas, ródio branco.', 89.9, 38],
      [sj, 'Anel solitário', 'Banho de ouro 18k, ajustável.', 49.9, 18],
      [rp, 'Vestido midi floral', 'Viscose, tamanhos P ao G.', 139.9, 65],
      [rp, 'Blusa de tricô', 'Tricô leve, várias cores.', 89.9, 42],
      [rp, 'Calça pantalona', 'Alfaiataria, cintura alta.', 119.9, 55],
    ].map(([categoriaId, nome, descricao, preco, custo]) => {
      const p = { id: uid(), categoriaId, nome, descricao, fotos: [], estoque: 4 + Math.floor(Math.random() * 10), preco, custo, criadoEm: agora };
      d.produtos.push(p);
      return p;
    });
    const clientes = [
      ['Ana', 'Souza', 'Comprou pelo Instagram'], ['Beatriz', 'Lima', 'Amiga da família'],
      ['Carla', 'Mendes', 'Trabalha no centro'], ['Daniela', 'Rocha', 'Indicação da Ana'],
      ['Fernanda', 'Alves', 'Cliente da feira'], ['Juliana', 'Castro', 'WhatsApp'], ['Marina', 'Pereira', 'Vizinha da loja'],
    ].map(([nome, sobrenome, referencia]) => {
      const c = { id: uid(), nome, sobrenome, referencia, telefone: '', endereco: '', email: '', criadoEm: agora };
      d.clientes.push(c);
      return c;
    });

    const hoje = isoDate(), rnd = arr => arr[Math.floor(Math.random() * arr.length)];
    for (let i = 0; i < 55; i++) {
      const data = addDays(hoje, -Math.floor(Math.random() * 100));
      const itens = [];
      for (let k = 0, n = 1 + Math.floor(Math.random() * 3); k < n; k++) {
        const p = rnd(prods);
        if (!itens.find(x => x.produtoId === p.id)) itens.push({ produtoId: p.id, nome: p.nome, categoriaId: p.categoriaId, qtd: 1 + (Math.random() < .2 ? 1 : 0), preco: p.preco, custo: p.custo });
      }
      const total = round2(sum(itens, x => x.qtd * x.preco));
      const np = rnd([1, 1, 1, 2, 3, 4]);
      const base = Math.floor((total * 100) / np) / 100;
      const parcelas = Array.from({ length: np }, (_, k) => {
        const venc = addMonths(data, k);
        const pago = k === 0 || (venc < hoje && Math.random() < .85);
        return { valor: k === np - 1 ? round2(total - base * (np - 1)) : base, vencimento: venc, pago, pagoEm: pago ? venc : '' };
      });
      d.vendas.push({ id: uid(), data, clienteId: rnd(clientes).id, itens, subtotal: total, desconto: 0, total, custoTotal: round2(sum(itens, x => x.qtd * x.custo)), parcelas, obs: '', criadoEm: agora });
    }
    if (Store.config.nomeLoja === 'Minha Lojinha') { Store.config.nomeLoja = 'Lojinha Mãe & Filha'; Store.salvarConfig(); }
    localStorage.setItem('lojinha_dados', JSON.stringify(d));
  },
};
