import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MAX_ENVIRONMENT_NAME_LENGTH } from "../src/data";
import {
  emptyAnswers,
  generatePlan,
  phaseOf,
  STATES,
  weeksUntil,
} from "../src/onboarding/plan";
import { stateFromCoords } from "../src/onboarding/location";
import type { Answers } from "../src/onboarding/types";

const base: Answers = {
  ...emptyAnswers,
  name: "Jeoston Araujo",
  moment: "casal",
  housing: "apartamento",
  people: 2,
  state: "SP",
  style: "full",
  budget: "unknown",
};
const names = (a: Answers) =>
  generatePlan(a).categories.flatMap((c) => c.items.map((i) => i.name));

test("o plano segue clima, região, moradia e estilo", () => {
  // Clima: quente deixa cobertor pesado de fora; frio o torna essencial.
  const hot = generatePlan({ ...base, state: "BA" });
  const cold = generatePlan({ ...base, state: "RS" });
  expect(names({ ...base, state: "BA" })).not.toContain("Edredom ou cobertor");
  expect(names({ ...base, state: "RS" })).toContain("Edredom ou cobertor");
  const essentialOf = (plan: typeof hot, item: string) =>
    plan.categories.flatMap((c) => c.items).find((i) => i.name === item)?.essential;
  expect(essentialOf(cold, "Edredom ou cobertor")).toBe(true);
  expect(essentialOf(hot, "Ventilador")).toBe(true);
  expect(essentialOf(cold, "Ventilador")).toBe(false);

  // Itens regionais.
  expect(names({ ...base, state: "CE" })).toContain("Cuscuzeira");
  expect(names({ ...base, state: "SP" })).not.toContain("Cuscuzeira");
  expect(names({ ...base, state: "RS" })).toContain(
    "Kit chimarrão (cuia, bomba e térmica)",
  );

  // Moradia: casa tem área externa; apartamento tem varanda; studio funde sala e quarto.
  const house = generatePlan({ ...base, housing: "casa", rooms: ["sala", "quarto", "externa"] });
  expect(house.categories.map((c) => c.name)).toContain("Área Externa");
  expect(names({ ...base, housing: "casa", rooms: ["externa"] })).toContain("Kit churrasco");
  const flat = generatePlan({ ...base, rooms: ["sala", "quarto", "externa"] });
  expect(flat.categories.map((c) => c.name)).toContain("Varanda");
  const studio = generatePlan({ ...base, housing: "studio" });
  expect(studio.categories[0].name).toBe("Sala e Quarto");
  expect(studio.categories.map((c) => c.name)).not.toContain("Quarto");
  expect(names({ ...base, housing: "studio" })).not.toContain("Mesa de jantar com cadeiras");

  // Estilo: minimalista é subconjunto do completo.
  const full = names({ ...base, style: "full" });
  const min = names({ ...base, style: "min" });
  expect(min.length).toBeLessThan(full.length);
  expect(min.every((n) => full.includes(n))).toBe(true);
  const stats = generatePlan(base).stats;
  expect(stats.complete).toBe(full.length);
  expect(stats.essentials).toBe(min.length);

  // Quantidades seguem o número de moradores.
  const dishes = (people: number) =>
    generatePlan({ ...base, people, style: "min" })
      .categories.flatMap((c) => c.items)
      .find((i) => i.name === "Pratos rasos")?.description;
  expect(dishes(1)).toContain("1 un.");
  expect(dishes(4)).toContain("4 un.");
});

test("com orçamento curto, compras grandes de ambientes não urgentes ficam para depois", () => {
  const plan = generatePlan({ ...base, budget: "lt10", style: "full" });
  expect(plan.stats.budgetFit).toBe("over");
  expect(plan.stats.bigTicketDeferred).toBeGreaterThan(0);
  expect(plan.stats.estimateNowMaxCents).toBeLessThan(plan.stats.estimateMaxCents);
  const sofa = plan.categories.flatMap((c) => c.items).find((i) => i.name === "Sofá");
  expect(sofa?.description).toContain("pode ficar para depois");
  const bed = plan.categories.flatMap((c) => c.items).find((i) => i.name === "Colchão");
  expect(bed?.description).not.toContain("pode ficar para depois");
  expect(generatePlan({ ...base, budget: "gt50" }).stats.budgetFit).toBe("within");
});

test("nenhum ambiente gerado passa do limite de nome do aplicativo", () => {
  for (const housing of ["apartamento", "casa", "studio"] as const) {
    for (const state of STATES.map((s) => s.uf)) {
      const plan = generatePlan({
        ...base,
        housing,
        state,
        rooms: ["sala", "quarto", "quartoExtra", "servico", "externa", "escritorio"],
      });
      for (const category of plan.categories) {
        expect(category.name.length).toBeLessThanOrEqual(MAX_ENVIRONMENT_NAME_LENGTH);
        expect(new Set(category.items.map((i) => i.name)).size).toBe(category.items.length);
      }
    }
  }
});

test("a localização vira estado só com cidades de referência e ignora quem está fora do Brasil", () => {
  const cases: [string, number, number, string | null][] = [
    ["Salvador", -12.97, -38.51, "BA"],
    ["São Paulo", -23.55, -46.63, "SP"],
    ["Ribeirão Preto", -21.18, -47.81, "SP"],
    ["Uberlândia", -18.92, -48.28, "MG"],
    ["Manaus", -3.12, -60.02, "AM"],
    ["Porto Alegre", -30.03, -51.23, "RS"],
    ["Foz do Iguaçu", -25.55, -54.59, "PR"],
    ["Campos dos Goytacazes", -21.75, -41.32, "RJ"],
    ["Brasília", -15.79, -47.88, "DF"],
    ["Lisboa", 38.72, -9.14, null],
    ["Buenos Aires", -34.6, -58.38, null],
    ["Nova York", 40.71, -74.0, null],
  ];
  for (const [city, lat, lon, expected] of cases) {
    expect(stateFromCoords(lat, lon), city).toBe(expected);
  }
});

test("semanas e fase da mudança", () => {
  const now = new Date(2026, 9, 6);
  expect(weeksUntil("2026-10-06", now)).toBe(0);
  expect(weeksUntil("2026-10-07", now)).toBe(1);
  expect(weeksUntil("2027-01-12", now)).toBe(14);
  expect(weeksUntil("2026-09-01", now)).toBe(0);
  expect(phaseOf(14)).toBe("plan");
  expect(phaseOf(6)).toBe("buy");
  expect(phaseOf(2)).toBe("final");
  expect(phaseOf(0)).toBe("now");
});

/* ------------------------------------------------------------------ fluxo */

const cta = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}`) });

async function openFunnel(page: Page) {
  await page.goto("/comecar");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function toQuestions(page: Page, name = "Jeoston Araujo") {
  await cta(page, "Vamos começar").click();
  await page.getByRole("textbox", { name: /Como podemos te chamar/ }).fill(name);
  await cta(page, "Continuar").click();
  await cta(page, "Continuar").click();
}

/** Responde tudo e para na tela do plano pronto. */
async function reachReady(
  page: Page,
  options: { state?: string; housing?: string; people?: string; budget?: string } = {},
) {
  await toQuestions(page);
  await page.getByLabel(/Vou morar com meu par/).check();
  await cta(page, "Continuar").click();
  await page.getByRole("button", { name: "Em 3 meses" }).click();
  await cta(page, "Continuar").click();
  await expect(page.getByText("Boa notícia, Jeoston!")).toBeVisible();
  await cta(page, "Continuar").click();
  await page.getByRole("option", { name: options.state ?? "Bahia" }).click();
  await cta(page, "Continuar").click();
  await cta(page, "Continuar").click();
  await page.getByLabel(new RegExp(options.housing ?? "Apartamento")).check();
  await cta(page, "Continuar").click();
  if (options.people) await page.getByLabel(options.people).check();
  await cta(page, "Continuar").click();
  await cta(page, "Continuar").click();
  await page.getByLabel(/Ainda nada/).check();
  await cta(page, "Continuar").click();
  await page.getByLabel(/Completo, sem faltar nada/).check();
  await cta(page, "Continuar").click();
  await page.getByLabel(options.budget ?? "De R$ 10 a 25 mil").check();
  await cta(page, "Continuar").click();
  await cta(page, "Pular").click();
  await page.getByLabel(/Dividir com quem mora comigo/).check();
  await cta(page, "Continuar").click();
  await cta(page, "Montar meu plano").click();
  await expect(
    page.getByRole("heading", { name: /O plano de Jeoston está pronto/ }),
  ).toBeVisible({ timeout: 12_000 });
}

test.describe("funil /comecar", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("monta um plano personalizado do começo ao fim", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openFunnel(page);
    await expect(page).toHaveTitle(/Monte o plano da sua casa nova/);
    await expect(
      page.getByRole("heading", { name: /Seu enxoval de casa nova/ }),
    ).toBeVisible();
    await expect(cta(page, "Vamos começar")).toBeVisible();

    await reachReady(page);
    const expected = generatePlan({
      ...base,
      state: "BA",
      rooms: ["sala", "quarto", "servico", "externa"],
    });
    await expect(page.getByText(`${expected.stats.total} itens`).first()).toBeVisible();
    await expect(page.getByText("essenciais", { exact: true })).toBeVisible();
    await expect(page.getByText("primeira noite").first()).toBeVisible();
    await expect(page.getByText("Referência de investimento")).toBeVisible();
    await expect(page.getByText("Comece pelo quarto e pelo banheiro")).toBeVisible();

    await cta(page, "Continuar").click();
    await expect(page.getByRole("heading", { name: "A diferença de ter um plano" })).toBeVisible();
    await expect(page.getByText("clima na Bahia")).toBeVisible();
    await cta(page, "Salvar meu plano").click();
    await expect(page.getByRole("heading", { name: "Salve o plano de Jeoston" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("voltar (botão e navegador) retorna uma tela e mantém as respostas", async ({ page }) => {
    await openFunnel(page);
    await toQuestions(page);
    await page.getByLabel(/Vou dividir a casa/).check();
    await cta(page, "Continuar").click();
    await expect(page.getByRole("heading", { name: "Quando você vai se mudar?" })).toBeVisible();

    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Qual é o momento/ })).toBeVisible();
    await expect(page.getByLabel(/Vou dividir a casa/)).toBeChecked();

    await cta(page, "Continuar").click();
    await page.goBack();
    await expect(page.getByRole("heading", { name: /Qual é o momento/ })).toBeVisible();
    await expect(page).toHaveURL(/\/comecar$/);
  });

  test("continuar fica desligado até a resposta e o foco acompanha a tela", async ({ page }) => {
    await openFunnel(page);
    await cta(page, "Vamos começar").click();
    const name = page.getByRole("textbox", { name: /Como podemos te chamar/ });
    await expect(name).toBeFocused();
    await expect(cta(page, "Continuar")).toBeDisabled();
    await name.fill("J");
    await expect(cta(page, "Continuar")).toBeDisabled();
    await name.fill("Jo");
    await expect(cta(page, "Continuar")).toBeEnabled();
    await name.press("Enter");
    await expect(page.getByRole("heading", { name: /Prazer em te conhecer, Jo!/ })).toBeFocused();
  });

  test("recarregar retoma de onde parou e permite recomeçar", async ({ page }) => {
    await openFunnel(page);
    await toQuestions(page);
    await page.getByLabel(/Vou morar sozinho/).check();
    await cta(page, "Continuar").click();
    await page.reload();
    await expect(cta(page, "Continuar de onde parei")).toBeVisible();
    await cta(page, "Continuar de onde parei").click();
    await expect(page.getByRole("heading", { name: "Quando você vai se mudar?" })).toBeVisible();
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByLabel(/Vou morar sozinho/)).toBeChecked();

    await page.reload();
    await page.getByRole("button", { name: "Começar de novo" }).click();
    await expect(cta(page, "Vamos começar")).toBeVisible();
    await cta(page, "Vamos começar").click();
    await expect(page.getByRole("textbox", { name: /Como podemos te chamar/ })).toHaveValue("");
  });

  test("a data aceita atalho, calendário e 'ainda não sei' (sem a tela de semanas)", async ({ page }) => {
    await openFunnel(page);
    await toQuestions(page);
    await page.getByLabel(/Vou morar com meu par/).check();
    await cta(page, "Continuar").click();
    await expect(cta(page, "Continuar")).toBeDisabled();
    await page.getByRole("button", { name: "Ainda não sei" }).click();
    await expect(page.getByText("Sem data por enquanto")).toBeVisible();
    await cta(page, "Continuar").click();
    // Sem data, a próxima tela é a da roleta de estados.
    await expect(page.getByRole("heading", { name: /Em qual estado/ })).toBeVisible();
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    // Dias passados não podem ser escolhidos.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.getMonth() === new Date().getMonth()) {
      await expect(
        page.getByRole("button", {
          name: new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(yesterday),
          exact: true,
        }),
      ).toBeDisabled();
    }
  });

  test("a roleta de estados responde ao teclado", async ({ page }) => {
    await openFunnel(page);
    await toQuestions(page);
    await page.getByLabel(/Vou morar com meu par/).check();
    await cta(page, "Continuar").click();
    await page.getByRole("button", { name: "Ainda não sei" }).click();
    await cta(page, "Continuar").click();
    const wheel = page.getByRole("listbox", { name: "Estado" });
    await wheel.focus();
    await page.keyboard.press("Home");
    await expect(page.getByRole("option", { name: "Acre" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("p");
    await expect(page.getByRole("option", { name: "Pará" })).toHaveAttribute("aria-selected", "true");
    await cta(page, "Continuar").click();
    await expect(page.getByRole("heading", { name: "Sua casa nova vai ser quente" })).toBeVisible();
    await expect(page.getByText("no Pará")).toBeVisible();
  });

  test("clima frio muda o texto e o plano", async ({ page }) => {
    await openFunnel(page);
    await toQuestions(page);
    await page.getByLabel(/Vou morar com meu par/).check();
    await cta(page, "Continuar").click();
    await page.getByRole("button", { name: "Ainda não sei" }).click();
    await cta(page, "Continuar").click();
    await page.getByRole("option", { name: "Rio Grande do Sul" }).click();
    await cta(page, "Continuar").click();
    await expect(page.getByRole("heading", { name: "O inverno pede cobertor" })).toBeVisible();
    await expect(page.getByText("frio", { exact: true })).toBeVisible();
  });

  test("'Explorar meu plano agora' leva o plano gerado para a demonstração", async ({ page }) => {
    await openFunnel(page);
    await reachReady(page, { people: "3 pessoas" });
    await cta(page, "Continuar").click();
    await cta(page, "Salvar meu plano").click();
    await page.getByRole("button", { name: "Explorar meu plano agora" }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("Você está na demonstração.")).toBeVisible();
    const active = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("larume.demo.v1")!);
      const workspace = data.workspaces.find((w: { enxoval: { id: string } }) => w.enxoval.id === data.activeId);
      return { name: workspace.enxoval.name, owner: workspace.members[0].name, first: workspace.categories[0].name };
    });
    expect(active).toEqual({ name: "Nossa casa nova", owner: "Jeoston", first: "Quarto" });
    const firstItem = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("larume.demo.v1")!);
      return data.workspaces.find((w: { enxoval: { id: string } }) => w.enxoval.id === data.activeId).items[0];
    });
    expect(firstItem.description).toMatch(/^Essencial/);
    expect(firstItem.priceCents).toBeNull();
    // O primeiro ambiente é o do primeiro dia.
    await expect(page.getByText("Colchão").first()).toBeVisible();
    // O plano substitui, e não duplica, ao repetir.
    const stored = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("larume.demo.v1")!);
      return data.workspaces.map((w: { enxoval: { id: string } }) => w.enxoval.id);
    });
    expect(stored.filter((id: string) => id.startsWith("demo-plan-"))).toHaveLength(1);
    expect(stored).toContain("demo-home");
  });

  test("criar conta cria a conta já com o enxoval e o plano, em um único pedido", async ({ page }) => {
    let body: {
      name: string;
      email: string;
      enxovalName: string;
      plan: { categories: { name: string; items: { name: string; description: string }[] }[] };
    } | null = null;
    let enxovalCalls = 0;
    await page.route("**/api/auth/register", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        json: {
          user: { id: "u1", name: "Jeoston Araujo", email: "jeo@exemplo.com" },
          enxovais: [], activeEnxoval: null, members: [], categories: [], items: [],
        },
      });
    });
    await page.route("**/api/enxovais", (route) => {
      enxovalCalls += 1;
      return route.fulfill({ status: 500, json: { error: "não deveria ser chamado" } });
    });
    await openFunnel(page);
    await reachReady(page);
    await cta(page, "Continuar").click();
    await cta(page, "Salvar meu plano").click();

    await page.getByLabel("Seu e-mail").fill("jeo@exemplo.com");
    await page.getByLabel("Crie uma senha").fill("senha-segura");
    await page.getByRole("button", { name: /Criar conta e salvar plano/ }).click();
    await expect(page).toHaveURL(/\/app$/);

    expect(body).not.toBeNull();
    expect(body!.name).toBe("Jeoston Araujo");
    expect(body!.email).toBe("jeo@exemplo.com");
    expect(body!.enxovalName).toBe("Nossa casa nova");
    const categories = body!.plan.categories;
    expect(categories[0].name).toBe("Quarto");
    expect(categories.map((c) => c.name)).toContain("Varanda");
    expect(categories.flatMap((c) => c.items).length).toBeGreaterThan(100);
    expect(categories[0].items[0].description).toContain("Essencial");
    expect(enxovalCalls).toBe(0);
    // As respostas só saem do aparelho depois que a conta foi criada.
    expect(await page.evaluate(() => localStorage.getItem("larume.onboarding.v1"))).toBeNull();
  });

  test("se o cadastro falhar, nada é perdido e a mensagem aparece", async ({ page }) => {
    await page.route("**/api/auth/register", (route) =>
      route.fulfill({ status: 409, json: { error: "Já existe uma conta com esse e-mail." } }),
    );
    await openFunnel(page);
    await reachReady(page);
    await cta(page, "Continuar").click();
    await cta(page, "Salvar meu plano").click();
    await page.getByLabel("Seu e-mail").fill("jeo@exemplo.com");
    await page.getByLabel("Crie uma senha").fill("senha-segura");
    await page.getByRole("button", { name: /Criar conta e salvar plano/ }).click();
    await expect(page.getByRole("alert")).toHaveText("Já existe uma conta com esse e-mail.");
    await expect(page).toHaveURL(/\/comecar$/);
    await expect(page.getByLabel("Seu e-mail")).toHaveValue("jeo@exemplo.com");
    expect(await page.evaluate(() => localStorage.getItem("larume.onboarding.v1"))).not.toBeNull();
  });

  test("o funil é só cadastro: não oferece login em nenhuma tela", async ({ page }) => {
    await openFunnel(page);
    await expect(page.getByRole("link", { name: /Entrar/ })).toHaveCount(0);
    await reachReady(page);
    await expect(page.getByRole("link", { name: /Entrar/ })).toHaveCount(0);
    await cta(page, "Continuar").click();
    await cta(page, "Salvar meu plano").click();
    await expect(page.getByRole("heading", { name: "Salve o plano de Jeoston" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Entrar|Já tenho conta/ })).toHaveCount(0);
    await expect(page.getByText(/Já tenho conta/)).toHaveCount(0);
  });

  test("quem já está logado não vê o funil e vai para a área logada", async ({ page }) => {
    const session = {
      user: { id: "u1", name: "Jeoston", email: "j@e.com" },
      enxovais: [], activeEnxoval: null, members: [], categories: [], items: [],
    };
    await page.route("**/api/bootstrap**", (route) => route.fulfill({ status: 200, json: session }));
    await page.goto("/comecar");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("button", { name: "Vamos começar" })).toHaveCount(0);
  });

  test("o plano só vai ao cadastro: entrar em uma conta existente não o usa", async ({ page }) => {
    let enxovalCalls = 0;
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        json: { user: { id: "u1", name: "Jeoston", email: "j@e.com" }, enxovais: [], activeEnxoval: null, members: [], categories: [], items: [] },
      }),
    );
    await page.route("**/api/enxovais", (route) => {
      enxovalCalls += 1;
      return route.fulfill({ status: 500, json: { error: "não deveria ser chamado" } });
    });
    await openFunnel(page);
    await reachReady(page);
    await page.goto("/login");
    await expect(page.getByText("Seu plano de casa nova está pronto")).toHaveCount(0);
    await page.getByLabel("Seu e-mail").fill("j@e.com");
    await page.getByLabel("Sua senha").fill("qualquer-senha");
    await page.getByRole("button", { name: /Entrar no meu enxoval/ }).click();
    await page.waitForTimeout(500);
    expect(enxovalCalls).toBe(0);
    // O plano continua guardado para quando a pessoa criar uma conta nova.
    expect(await page.evaluate(() => localStorage.getItem("larume.onboarding.v1"))).not.toBeNull();
  });

  test("o login não oferece criar conta; /signup e o link levam ao funil", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Criar conta", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Como podemos te chamar?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Entrar no meu enxoval" })).toBeVisible();
    await page.getByRole("link", { name: /Monte seu plano de casa nova/ }).click();
    await expect(page).toHaveURL(/\/comecar$/);
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/comecar$/);
    await expect(page.getByRole("button", { name: "Entrar no meu enxoval" })).toHaveCount(0);
  });

  test.describe("roleta de estados", () => {
    test.use({ timezoneId: "America/Sao_Paulo" });

    const toState = async (page: Page) => {
      await openFunnel(page);
      await toQuestions(page);
      await page.getByLabel(/Vou morar com meu par/).check();
      await cta(page, "Continuar").click();
      await page.getByRole("button", { name: "Ainda não sei" }).click();
      await cta(page, "Continuar").click();
      await expect(page.getByRole("heading", { name: /Em qual estado/ })).toBeVisible();
    };
    const selected = (page: Page) => page.locator('[role="option"][aria-selected="true"]');

    test("dá para clicar e puxar com o mouse, e o gesto não dispara clique no item", async ({ page }) => {
      await toState(page);
      await expect(selected(page)).toHaveText("São Paulo");
      const box = (await page.getByRole("listbox", { name: "Estado" }).boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;

      // Puxa para cima uma linha (56 px) e segura: vai para o próximo estado.
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 56, { steps: 8 });
      await page.waitForTimeout(250);
      await page.mouse.up();
      await expect(selected(page)).toHaveText("Sergipe");

      // Puxa para baixo duas linhas: volta dois estados.
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 112, { steps: 10 });
      await page.waitForTimeout(250);
      await page.mouse.up();
      await expect(selected(page)).toHaveText("Santa Catarina");

      // Um toque simples ainda seleciona o item clicado.
      await page.getByRole("option", { name: "Bahia" }).click();
      await expect(selected(page)).toHaveText("Bahia");
      await cta(page, "Continuar").click();
      await expect(page.getByRole("heading", { name: "Sua casa nova vai ser quente" })).toBeVisible();
    });

    test("soltar durante o movimento rápido continua no encaixe de um item", async ({ page }) => {
      await toState(page);
      const box = (await page.getByRole("listbox", { name: "Estado" }).boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 90, { steps: 3 });
      await page.mouse.up();
      await page.waitForTimeout(900);
      const top = await page.getByRole("listbox", { name: "Estado" }).evaluate((el) => el.scrollTop);
      expect(top % 56).toBeLessThan(1);
      await expect(selected(page)).toHaveCount(1);
    });

    test.describe("com permissão de localização (Salvador)", () => {
      test.use({ permissions: ["geolocation"], geolocation: { latitude: -12.97, longitude: -38.51 } });
      test("'Usar minha localização' escolhe o estado e a roleta acompanha", async ({ page }) => {
        await toState(page);
        await expect(page.getByText("Não guardamos a sua posição")).toBeVisible();
        await page.getByRole("button", { name: "Usar minha localização" }).click();
        await expect(selected(page)).toHaveText("Bahia");
        await expect(page.getByText("Detectamos Bahia pela sua localização")).toBeVisible();
        await cta(page, "Continuar").click();
        await expect(page.getByText("Faz calor quase o ano todo na Bahia")).toBeVisible();
      });
      test("mudar a roleta depois some com o aviso de detecção", async ({ page }) => {
        await toState(page);
        await page.getByRole("button", { name: "Usar minha localização" }).click();
        await expect(page.getByText("Detectamos Bahia")).toBeVisible();
        await page.getByRole("option", { name: "Ceará" }).click();
        await expect(page.getByText("Detectamos Bahia")).toHaveCount(0);
      });
    });

    test.describe("fora do Brasil (Lisboa)", () => {
      test.use({ permissions: ["geolocation"], geolocation: { latitude: 38.72, longitude: -9.14 } });
      test("não sugere estado nenhum", async ({ page }) => {
        await toState(page);
        await page.getByRole("button", { name: "Usar minha localização" }).click();
        await expect(page.getByText("fora do Brasil")).toBeVisible();
        await expect(selected(page)).toHaveText("São Paulo");
      });
    });

    test("se a localização for negada, a lista continua funcionando", async ({ page }) => {
      await page.addInitScript(() => {
        navigator.geolocation.getCurrentPosition = (_ok, fail) =>
          fail?.({ code: 1, PERMISSION_DENIED: 1, message: "negado" } as GeolocationPositionError);
      });
      await toState(page);
      await page.getByRole("button", { name: "Usar minha localização" }).click();
      await expect(page.getByText("Sem acesso à localização")).toBeVisible();
      await page.getByRole("option", { name: "Pará" }).click();
      await expect(selected(page)).toHaveText("Pará");
      await expect(cta(page, "Continuar")).toBeEnabled();
    });
  });

  test("a landing leva ao funil", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Começar meu enxoval/ }).first().click();
    await expect(page).toHaveURL(/\/comecar$/);
  });
});

/* ------------------------------------------------------- responsividade/a11y */

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`o funil cabe em ${width}px e passa na checagem de acessibilidade`, async ({ page }) => {
    // São ~22 telas auditadas com o axe; o limite padrão de 30 s não basta.
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: width < 700 ? 760 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openFunnel(page);
    await page.waitForTimeout(500);

    const audit = async (label: string) => {
      // Espera as entradas em cascata terminarem: axe leria contraste no meio do fade.
      await page.waitForTimeout(1000);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${label}: sem rolagem horizontal`,
      ).toBeLessThanOrEqual(width);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map((v) => `${label}: ${v.id} ${v.nodes[0]?.target}`),
      ).toEqual([]);
    };

    await expect(page.getByRole("main")).toBeVisible();
    await audit("boas-vindas");
    await cta(page, "Vamos começar").click();
    await audit("nome");
    await page.getByRole("textbox").fill("Jeoston");
    await cta(page, "Continuar").click();
    await cta(page, "Continuar").click();
    await audit("momento");
    await page.getByLabel(/Vou morar com meu par/).check();
    await cta(page, "Continuar").click();
    await audit("data");
    await page.getByRole("button", { name: "Em 3 meses" }).click();
    await cta(page, "Continuar").click();
    await audit("semanas");
    await cta(page, "Continuar").click();
    await audit("estado");
    await cta(page, "Continuar").click();
    await audit("clima");
    await cta(page, "Continuar").click();
    await page.getByLabel(/Apartamento/).check();
    await cta(page, "Continuar").click();
    await audit("pessoas");
    await cta(page, "Continuar").click();
    await audit("ambientes");
    await cta(page, "Continuar").click();
    await page.getByLabel(/Ainda nada/).check();
    await cta(page, "Continuar").click();
    await page.getByLabel(/Completo, sem faltar nada/).check();
    await audit("estilo");
    await cta(page, "Continuar").click();
    await page.getByLabel("Ainda não sei").check();
    await cta(page, "Continuar").click();
    await audit("preocupações");
    await cta(page, "Pular").click();
    await audit("uso");
    await cta(page, "Pular").click();
    await audit("obrigado");
    await cta(page, "Montar meu plano").click();
    await expect(page.getByRole("heading", { name: /está pronto/ })).toBeVisible({ timeout: 12_000 });
    await audit("plano pronto");
    await cta(page, "Continuar").click();
    await audit("comparação");
    await cta(page, "Salvar meu plano").click();
    await audit("salvar");
    expect(errors).toEqual([]);
  });
}

test("com movimento reduzido o funil continua completo e rápido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openFunnel(page);
  const started = Date.now();
  await reachReady(page);
  expect(Date.now() - started).toBeLessThan(25_000);
});
