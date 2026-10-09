# 🛍️ Lojinha — gestão de loja (relógios, semijoias e roupas)

Aplicativo simples para celular e computador com:

| Tela | O que faz |
|---|---|
| 📊 **Dashboard** | Faturamento, lucro, vendas, ticket médio, a receber, gráficos e destaques, com filtros de período, cliente, categoria e produto. Toque nos gráficos para filtrar. |
| 🛍️ **Produtos** | Categorias → itens com fotos, descrição, estoque, preço, valor investido e lucro calculado na hora. Envio do item pelo WhatsApp com link da loja virtual. |
| 👥 **Clientes** | Nome, sobrenome e referência livre. Telefone, endereço e e-mail opcionais. Histórico de compras de cada cliente. |
| 🧾 **Vendas** | Escolhe o cliente, a categoria e os itens (com quantidade), o desconto e em quantas parcelas foi feito, com as datas. O estoque baixa sozinho. |
| 👛 **Carteira** | Recebido bruto e líquido (descontando o valor investido), saldo a receber, parcelas atrasadas, próximos vencimentos e botão "Recebi". |
| 📄 **Relatórios** | Semanal e mensal, com comparação com o período anterior, itens mais vendidos, top compradores, melhor dia e categorias. Gera PDF e envia pelo WhatsApp. |

Também tem a **loja virtual** (`loja.html`), uma página pública onde o cliente vê fotos, preços e os outros itens, e fala com a loja pelo WhatsApp. Ela **nunca mostra** custos, clientes ou vendas.

---

## 1. Testar agora (sem configurar nada)

Abra o `index.html` no navegador. O app funciona em **modo local**, ou seja, os dados ficam salvos só naquele navegador.
Em ⚙️ **Configurações** → **Carregar dados de exemplo**, você vê o dashboard e os relatórios preenchidos.

> Para começar do zero depois do teste: na barra de endereço abra as ferramentas do navegador (F12) → Application → Local Storage → apague `lojinha_dados`. Ou use outro navegador.

## 2. Criar o banco de dados no Google Drive

1. Acesse **https://script.google.com** com a sua conta Google e clique em **Novo projeto**.
2. Apague o conteúdo e cole todo o arquivo [`apps-script/Code.gs`](apps-script/Code.gs). Salve (💾) com o nome *Lojinha API*.
3. No topo, escolha a função **`setup`** e clique em **Executar**. Autorize o acesso (Avançado → Acessar Lojinha API).
   No **Registro de execução** aparecem:
   - o link da planilha **"Lojinha - Banco de Dados"** (criada no seu Drive);
   - a **CHAVE DE ACESSO** → copie e guarde.
   A pasta **"Lojinha - Fotos"** também é criada no seu Drive.
4. Clique em **Implantar → Nova implantação** → engrenagem ⚙️ → **App da Web**:
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
   → **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
5. No app, vá em ⚙️ **Configurações → Banco de dados no Google Drive**, cole a **URL** e a **chave** e toque em **Conectar**.
   Se já houver dados no aparelho, o app pergunta se você quer enviá-los para a planilha.

Repita o passo 5 em cada celular que for usar o app (os dados ficam todos na mesma planilha).

> **Se alterar o `Code.gs` depois:** Implantar → Gerenciar implantações → ✏️ → Versão: *Nova versão* → Implantar (a URL continua a mesma).

## 3. Publicar no GitHub (GitHub Pages)

1. Edite `js/config.js` e cole a URL do passo 2.4 em `window.LOJA_API_URL = '...'`.
   Assim a loja virtual funciona para qualquer cliente. **Nunca coloque a chave de acesso nesse arquivo.**
2. Crie um repositório no GitHub e envie o conteúdo desta pasta:
   ```bash
   git init
   git add .
   git commit -m "Lojinha"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/lojinha.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Branch: `main` / `(root)` → Save**.
   Em 1 ou 2 minutos o app estará em `https://SEU-USUARIO.github.io/lojinha/`.
   A loja virtual fica em `https://SEU-USUARIO.github.io/lojinha/loja.html`.

## 4. Instalar no celular

Abra o endereço do GitHub Pages no celular:
- **Android (Chrome):** menu ⋮ → *Adicionar à tela inicial* / *Instalar app*.
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

## Como os cálculos funcionam

- **Lucro do produto** = preço de venda − valor investido (por unidade), sem impostos.
- Na venda, o app guarda o preço e o custo **daquele momento**. Se o preço mudar depois, as vendas antigas não mudam.
- **Desconto** é dividido proporcionalmente entre os itens da venda.
- **Carteira:** cada parcela recebida conta como recebido bruto. O líquido é a parte de lucro da parcela (parcela × margem da venda). O **saldo a receber** é a soma das parcelas ainda não pagas.
- **Excluir uma venda** devolve os itens ao estoque.

## Segurança e privacidade

- Os dados ficam na **sua** planilha do Google Drive. Só quem tem a **chave de acesso** consegue ler ou alterar.
- A loja virtual só recebe nome, descrição, fotos, preço e estoque dos produtos.
- As fotos ficam na pasta "Lojinha - Fotos", compartilhadas como "qualquer pessoa com o link" para aparecer na loja.
- Faça backups de vez em quando em ⚙️ Configurações → **Exportar**.

## Estrutura

```
index.html          app principal
loja.html           loja virtual pública
css/style.css       visual
js/config.js        URL da API (preencher)
js/store.js         dados (local ou Google Drive)
js/analytics.js     cálculos (vendas, lucro, carteira)
js/ui.js            componentes e formulários
js/views/*.js       telas
js/loja.js          loja virtual
apps-script/Code.gs backend no Google Apps Script
```
