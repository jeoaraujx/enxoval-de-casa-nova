# Larumi

Seu lar começa com um plano. Aplicativo React + Express para planejar um enxoval por ambiente, organizar compras e compartilhar listas, com persistência em PostgreSQL.

## Visualizar localmente, sem banco

```sh
npm install
npm run dev:preview
```

Abra **http://localhost:3000**.

- `/`: landing page com recursos, exemplos de planos e perguntas frequentes.
- `/login` e `/signup`: entrada e cadastro com a nova identidade visual.
- `/demo`: aplicativo interativo com um enxoval de exemplo. Permite criar, editar, concluir e remover itens, criar enxovais e categorias, reordenar ambientes, registrar descontos e exportar CSV.
- `/app`: aplicativo conectado à conta.

O comando `dev:preview` **não conecta ao banco nem executa migrações**. A demonstração salva apenas os dados de exemplo em `localStorage`, na chave `larumi.demo.v1`, sem salvar senhas. Esses dados são independentes da conta real. Convites não são enviados pela demonstração. Login e cadastro precisam do servidor completo; na prévia, o formulário explica essa condição.

## Executar com contas e persistência real

1. Copie `.env.example` para `.env` e configure uma instância PostgreSQL de desenvolvimento.
2. Ajuste `DATABASE_URL` e, para localhost sem HTTPS, `COOKIE_SECURE=false`.
3. Execute `npm run dev`. O servidor aplica as migrações existentes antes de iniciar.

O fluxo de autenticação e a API PostgreSQL originais foram preservados. Compartilhar um enxoval adiciona como membro uma pessoa que já possui conta, usando seu e-mail; não há envio de e-mail implementado.

## Experiência do produto

- Identidade Larumi com a casa, os tecidos dobrados e o ramo da referência escolhida, versões para favicon e ícones de tela inicial.
- Paleta de areia, madeira, off-white e verde suave; tipografia DM Sans e Playfair Display, com Cormorant Garamond na assinatura Larumi.
- Landing page, login e cadastro adaptados para celular, tablet e computador.
- Navegação por ambientes e visão geral com progresso, total investido e estimativa dos itens pendentes.
- No celular: categorias horizontais, gesto de deslizar entre ambientes, puxar para atualizar, cabeçalho compacto ao rolar, botão de adição e navegação inferior.
- O cabeçalho mobile usa apenas o ícone do menu, com área de toque de 44 px. Na visão geral, as categorias e o total gasto ficam fora do cabeçalho; voltam na lista de itens.
- A navegação inferior destaca a opção ativa com um fundo verde suave e borda arredondada. Compartilhar recebe o destaque enquanto sua janela está aberta.
- O botão “Menu” abre um painel pela direita com troca e criação de enxovais, convites, descontos, categorias e atualização. Renomear e excluir aparecem apenas para o dono; excluir mantém a confirmação. O painel tem rolagem independente, bloqueia a interação com o fundo e devolve o foco ao botão ao fechar.
- No computador: menu lateral, painel financeiro e ações de edição, convite e exportação.
- Busca sem distinção de acentos, filtros e ordenação por nome ou alterações recentes.
- Exportação CSV em português, UTF-8 e separador `;`, com proteção de células que poderiam ser interpretadas como fórmulas.
- Diálogos com foco controlado, Escape para fechar e retorno ao botão de origem. Categorias podem ser reordenadas por arraste ou pelos botões de subir/descer.
- Adição, edição, filtros, convites e confirmações usam o mesmo componente de diálogo e a paleta da Larumi. As confirmações de exclusão começam com foco em Cancelar; formulários longos têm rolagem própria em telas pequenas.
- Respeito à preferência de movimento reduzido no CSS.

## Validação

```sh
npm run lint
npm run test:e2e
npm run build
```

A suíte Playwright verifica os fluxos principais, persistência e exportação da demonstração, formulários de autenticação com API simulada, gestos e navegação mobile, foco dos diálogos e verificações automatizadas de acessibilidade com axe. As quatro telas principais são verificadas nas larguras 320, 390, 768, 1024 e 1440 px.

No Windows, os testes usam o Microsoft Edge instalado. Em outros sistemas, instale o navegador de teste com `npx playwright install chromium`. Quando não há servidor local, os testes iniciam o modo de prévia, sem migração de banco; se já há um servidor na porta 3000, ele é reutilizado. As alterações dos testes ficam na demonstração ou em respostas de API simuladas. Os testes de login e cadastro verificam a integração do frontend com respostas simuladas, não a conexão real com PostgreSQL.

## Build e execução

```sh
npm run build
npm start
```

`npm start` serve o build de produção e a API. Configure a conexão do banco e cookies HTTPS para esse ambiente. Nada é publicado automaticamente.

## Escopo comercial desta versão

Os planos e preços da landing page são **ilustrativos**, conforme a proposta visual. Não existem cobrança, checkout, assinatura ou limites de plano aplicados. Recuperação de senha, confirmação de e-mail e pagamentos ainda precisam ser implementados antes de oferecer esses serviços comercialmente.

## Arquivos de identidade

- `src/components/Brand.tsx`: símbolo e assinatura da marca usados na interface, com versões horizontal, vertical e compacta.
- `public/brand/larumi-symbol.webp`: símbolo otimizado com transparência; o PNG original também está nessa pasta.
- `public/brand/larumi-symbol-white.webp`: versão branca com relevo suave, usada sobre a fotografia do login e cadastro, com o nome à direita.
- `public/brand/larumi-logo.png`: assinatura vertical com símbolo e nome Larumi, em PNG transparente.
- `public/larumi-*.png`: ícones para navegador, tela inicial e modo maskable. Os arquivos padrão `favicon.ico` e `apple-touch-icon.png` também usam a nova marca.
- `public/images/larumi-home.webp`: fotografia original criada para a landing page e otimizada em WebP.
- `src/product.css`: estilos da identidade, páginas públicas e aplicativo.

A logo foi adaptada da referência enviada usando a ferramenta integrada de geração de imagens e conferida visualmente na interface, em fundo claro e escuro. A assinatura é texto real na interface para manter a grafia Larumi e a legibilidade em diferentes telas. Detalhes de identidade e o prompt estão em `docs/larumi-brand.md`.

A fotografia foi criada para este projeto; o produto não depende de URLs externas de imagens. As fontes usam Google Fonts, com fontes locais de fallback. A demonstração lê os dados da chave anterior `morada.demo.v1` quando necessário e passa a persistir em `larumi.demo.v1`, preservando as listas já criadas no navegador.
