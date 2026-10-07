# Funil de onboarding da Larume (`/comecar`)

Antes do cadastro, a pessoa responde a perguntas curtas e recebe um **plano de enxoval de casa nova já montado**. A conta só é pedida no fim, para *salvar* o plano.

**Regra de produto: o funil é exclusivo para criar conta nova.**

- Só existe fora da área logada: quem já tem sessão é redirecionado de `/comecar` para `/app`.
- Não oferece login em nenhuma tela. Quem já tem conta entra por `/login`, e entrar nunca usa nem cria o plano do funil.
- É a **única porta de cadastro**: `/signup` redireciona para cá e `/login` não cria conta. Assim toda conta nova nasce com as informações do enxoval.
- O cadastro cria a conta **já com o primeiro enxoval pronto** (ambientes e itens gerados das respostas), em um único pedido e uma única transação no servidor. Se algo falhar, nada fica criado pela metade e as respostas continuam guardadas no aparelho.
- O servidor só aceita `plan` em `POST /api/auth/register`. `POST /api/enxovais` não aceita plano.

A referência foi um app de enxoval de bebê (29 telas, 12 perguntas, ~3 minutos). Mantivemos a estrutura (boas-vindas → perguntas curtas → telas de respiro → "montando seu plano" → plano pronto → comparação → salvar) e mudamos o que não se sustentava (ver "O que não copiamos").

## Princípios

1. **Cada pergunta tem de mudar o resultado.** Toda resposta alimenta o gerador (`src/onboarding/plan.ts`). A que não alimenta, não entra.
2. **Valor antes da conta.** O cadastro vem depois do plano pronto (princípio de reciprocidade do NN/g; ver pesquisa anterior).
3. **Esforço que devolve algo visível.** O efeito IKEA só funciona quando o esforço termina em um resultado concluído. Por isso a tela "montando" e o plano são feitos com as respostas, e não são genéricos.
4. **Uma decisão por tela, um botão primário.** Botão "Continuar" fixo no rodapé, na área do polegar. Todas as telas têm "Voltar" (botão e botão voltar do navegador/Android). Nenhuma tela do funil leva a login.
5. **Nada de prova social inventada.** Sem avaliação "5,0", sem "20.858 famílias", sem depoimentos. Só entram números que o próprio plano calcula.
6. **Respostas guardadas no aparelho** (`localStorage`, `larume.onboarding.v1`). Fechar e voltar retoma de onde parou. Nada é enviado ao servidor até a pessoa criar conta.

## Sequência (21 telas, 12 perguntas)

Barra de progresso entre "nome" e "plano pronto". O número de passos muda: "semanas até a mudança" só aparece se a pessoa informou a data.

| # | Tela | Tipo | Pergunta / mensagem | Resposta | O que muda no plano |
|---|------|------|---------------------|----------|---------------------|
| 1 | `welcome` | abertura | "Seu enxoval de casa nova, personalizado e sem exageros" + prévia animada de checklist | — | — |
| 2 | `name` | texto | "Como podemos te chamar?" | nome (2–40 car.) | Personaliza o plano ("Casa de …") |
| 3 | `greet` | respiro | "Prazer em te conhecer, {nome}!" | — | Reduz a sensação de formulário |
| 4 | `moment` | única | Qual é o momento da sua casa nova? Casal / Sozinho(a) / Dividir / Trocando de casa | `moment` | Tamanho da cama, quantidades, tom dos textos |
| 5 | `date` | data | "Quando você vai se mudar?" atalhos (1, 3, 6 meses, ainda não sei) + calendário | `moveDate` ou "não sei" | Prioridades e fase do cronograma |
| 6 | `timeline` | respiro | Semanas até a mudança (número animado) + fase (Planejar / Comprar / Reta final) | — | Texto dos primeiros passos |
| 7 | `state` | roleta | "Em qual estado fica a sua casa nova?" | UF | Clima (quente, ameno, frio) e itens regionais |
| 8 | `climate` | respiro | "Sua casa nova vai ser quente" + as 4 estações | — | Mostra o que foi ajustado |
| 9 | `housing` | única | Apartamento / Casa / Studio ou kitnet | `housing` | Ambientes padrão, varanda × quintal, studio funde sala e quarto |
| 10 | `people` | única | Quantas pessoas vão morar? 1, 2, 3, 4, 5+ | `people` | Quantidade de pratos, copos, toalhas, etc. |
| 11 | `rooms` | múltipla | Quais espaços quer equipar? (cozinha e banheiro sempre incluídos) | `rooms[]` | Quais ambientes existem |
| 12 | `owned` | única | Você já tem alguma coisa? Nada / Algumas / Boa parte | `owned` | Primeiro passo: "marque o que você já tem" |
| 13 | `style` | única | Completo ou minimalista (com a contagem de itens de cada um, ao vivo) | `style` | Lista só com essenciais ou lista completa |
| 14 | `budget` | única | Quanto pretende investir? | `budget` | Faixa de referência e "compras para depois" |
| 15 | `worries` | múltipla, opcional | O que mais te preocupa? | `worries[]` | Texto da tela de comparação |
| 16 | `usage` | múltipla, opcional | Como quer usar a Larume? | `usage[]` | Primeiros passos sugeridos |
| 17 | `thanks` | respiro | Frase por momento + "Um plano só seu" | — | — |
| 18 | `building` | espera | % animado, checklist que vai marcando (≈ 4 s) | — | — |
| 19 | `ready` | resultado | Essenciais × plano completo, ambientes com contagem, estimativa de referência, 3 primeiros passos | — | — |
| 20 | `compare` | persuasão | "A diferença de ter um plano" (sem plano × com o plano de {nome}) | — | — |
| 21 | `save` | conta | "Salve o plano de {nome}": e-mail e senha. Alternativa: explorar na demonstração (sem conta) | e-mail, senha | Cria a conta com o primeiro enxoval já montado |

**A origem do visitante** ("onde você ouviu falar da gente?") não vira pergunta: é lida de `utm_source` ou do `referrer`. Pergunta sem retorno para quem responde é só atrito.

## Como o plano é gerado

- `src/onboarding/catalog.ts`: ~200 itens, cada um com ambiente, faixa de preço (1–4) e marcas (essencial, clima, quantidade, casal/solo, casa/apartamento, regional).
- `src/onboarding/plan.ts`: aplica as respostas e devolve ambientes → itens, mais as contagens e a estimativa.
  - **Ordem dos ambientes = "primeira noite"**: quarto, banheiro, cozinha, eletros, serviço, sala, extras.
  - **Clima por UF**: quente (AC, AL, AP, AM, BA, CE, ES, MA, MT, PA, PB, PE, PI, RJ, RN, RO, RR, SE, TO), ameno (DF, GO, MG, MS, SP), frio (PR, RS, SC). Quente → ventilação e roupa de cama leve; frio → edredom, cobertor, tapete.
  - **Quantidades** vão na descrição do item ("Essencial · 4 un."). A descrição é editável pela pessoa.
  - **Estudio** funde sala e quarto no ambiente "Sala e Quarto".
- **Estimativa de referência** (faixas por categoria de preço): é só uma ordem de grandeza, rotulada como tal, e **nunca é gravada no preço dos itens** (o preço do item alimenta o total gasto e os descontos, então deve ser sempre do usuário).

## Design

- **Paleta Larume**: papel `#faf8f4`, tinta `#343b32`, madeira `#866344`, areia `#efe7da`, sálvia `#e9eee5`. Títulos em Playfair Display; texto em DM Sans.
- **Guia visual**: o símbolo da casa Larume faz o papel do mascote da referência (flutua, "acena", aparece na fala de abertura).
- **Mobile (padrão)**: tela cheia `100dvh`; cabeçalho com voltar + barra de progresso; conteúdo rolável; botão fixo no rodapé com `env(safe-area-inset-bottom)`; alvos de toque ≥ 52 px.
- **Tablet**: coluna única centralizada (máx. 560 px).
- **Desktop (≥ 1000 px)**: duas colunas. À esquerda a fotografia da marca e uma frase; à direita o funil (máx. 480 px), com o botão no fluxo, logo abaixo do conteúdo.

## Animações (motion)

| Onde | Animação | Função |
|------|----------|--------|
| Troca de tela | Saída 160 ms, entrada 320 ms com deslocamento horizontal na direção da navegação (avançar → vem da direita; voltar → vem da esquerda) | Dá noção de caminho; "voltar" parece voltar |
| Opções | Entram em cascata (45 ms); selecionada ganha borda e selo com mola; pressionar encolhe 2% | Retorno imediato ao toque |
| Barra de progresso | Largura com mola | Sensação de avanço contínuo |
| Botão Continuar | Ao habilitar, "pulsa" uma vez | Mostra que já dá para seguir |
| Boas-vindas | Símbolo flutua; fala surge; checklist marca itens em sequência; confete curto | Mostra o produto em 3 s |
| Semanas | Número sobe de 0 até o valor; marcador "Você está aqui" desliza na régua | Torna a data concreta |
| Roleta de estados | `scroll-snap`, linha central destacada, bordas esmaecidas | Escolha em um gesto |
| Montando o plano | % animado, itens marcados por limiar, avanço automático | Percepção de trabalho real, sem passar de 5 s |
| Plano pronto | Números sobem; cartões de ambiente entram em cascata | Recompensa |
| Comparação | Dois cartões entram dos lados | Contraste |

`prefers-reduced-motion`: sem deslocamentos nem animações em laço; transições viram fades curtos; a tela "montando" dura ≈ 1,2 s.

## Acessibilidade

- Cada tela é uma `<section>` com título; o foco vai ao título a cada mudança de tela e um aviso de região (`aria-live`) anuncia "Pergunta X de Y".
- Opções são `input[type=radio|checkbox]` nativos dentro de `<label>`: teclado, leitor de tela e agrupamento corretos. Nenhuma avança sozinha (WCAG 3.2.2); o avanço é sempre pelo botão.
- A roleta é `listbox` com setas, Home e End; o calendário é uma grade de botões com `aria-pressed`.
- Barra de progresso com `role="progressbar"`. Contraste conferido com axe nos testes.

## Medição

`src/onboarding/analytics.ts` dispara `CustomEvent("larume:onboarding")` com `{ event, step, index, ... }` em: `onboarding_start`, `step_view`, `step_complete`, `onboarding_back`, `plan_ready`, `signup_submit`, `signup_success`, `demo_open`. Basta ligar um provedor de analytics ao evento. Métricas a acompanhar:

1. Início → nome (a abertura convence?).
2. Taxa de conclusão por pergunta (a que mais perde gente é candidata a sair).
3. Chegada ao plano pronto → cadastro concluído.
4. Ativação: pessoas que marcam ≥ 1 item nos 7 dias seguintes.

**Hipótese a testar (A/B):** funil completo × funil enxuto (só `moment`, `state`, `housing`, `people`, `rooms`, `style`). Com pouco tráfego, comparar por ativação, não só por cadastro.

## O que não copiamos da referência

- **Avaliação 5,0, "20.858 mães como você" e depoimentos:** não temos esses dados; inventá-los seria enganar quem usa.
- **"Economiza pelo menos R$ 1.500":** alegação sem base. Trocamos pela estimativa calculada a partir das respostas, rotulada como referência.
- **Tela de notificações e paywall:** o app não tem push nem cobrança nesta versão (ver README). O fim do funil é a conta grátis.
- **"Onde ouviu falar":** vira leitura silenciosa de `utm_source`/`referrer`.
- **"Entrar com meu convite":** convite por e-mail exige conta; não há link de convite.

## Integração

- **Demonstração:** "Explorar meu plano agora" cria o enxoval gerado no demo (`applyPlanToDemo`) e abre `/demo`, com o nome da pessoa no lugar de "Ana".
- **Cadastro:** o passo final chama `POST /api/auth/register` com `enxovalName` e `plan`. O servidor valida o plano antes de criar qualquer coisa (até 15 ambientes, 400 itens, nomes de ambiente no limite do app) e cria usuário, enxoval, membro, ambientes e itens numa única transação. A resposta já traz o enxoval ativo.
- **Falha no cadastro** (e-mail repetido, rede, validação): a mensagem aparece na própria tela e as respostas continuam no aparelho. Só são apagadas depois que a conta foi criada.
- **Login:** não usa o plano. As respostas só são lidas pelo funil.
- **`/signup`:** não existe mais como tela. O endereço antigo redireciona para `/comecar`. `/login` é só entrada: a tela não cria conta.
- **Landing:** os CTAs "Começar meu enxoval" levam a `/comecar` (ou a `/app` para quem já está logado).
- **Perfil completo no banco** (data da mudança, estado, orçamento): hoje só o plano resultante é gravado. Guardar as respostas exigiria uma coluna nova em `enxovais`; fica como próximo passo.

## Arquivos

- `src/onboarding/`: `types.ts`, `catalog.ts`, `plan.ts`, `storage.ts`, `analytics.ts`
- `src/components/onboarding/`: `OnboardingFlow.tsx`, `controls.tsx`
- `src/onboarding.css`
- `tests/onboarding.spec.ts`
