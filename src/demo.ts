import type { BootstrapData, EnxovalWorkspace } from "./types";
import { DEFAULT_TEMPLATE_CATEGORIES, DEFAULT_TEMPLATE_ITEMS } from "./data";

const STORAGE_KEY = "larume.demo.v1";
const PREVIOUS_STORAGE_KEY = "larumi.demo.v1";
const LEGACY_STORAGE_KEY = "morada.demo.v1";
const demoUser = { id: "demo-user", name: "Ana", email: "ana@exemplo.com" };
export const isDemoMode = () => window.location.pathname === "/demo";
type DemoStore = { workspaces: EnxovalWorkspace[]; activeId: string };
const id = () => crypto.randomUUID();
function seed(): DemoStore {
  const categories = [
    "Cozinha",
    "Quarto",
    "Banheiro",
    "Sala de Estar",
    "Área de Serviço",
  ].map((name, i) => ({ id: `demo-category-${i}`, name, sortOrder: i }));
  const products: [string, number, number, boolean][] = [
    ["Jogo de pratos de cerâmica", 0, 24990, true],
    ["Conjunto de talheres", 0, 18900, true],
    ["Jogo de panelas", 0, 62990, false],
    ["Taças para os primeiros brindes", 0, 15990, false],
    ["Cafeteira", 0, 34900, true],
    ["Potes herméticos", 0, 8990, false],
    ["Tábua de madeira", 0, 7990, false],
    ["Panos de prato", 0, 3990, true],
    ["Jogo de cama de algodão", 1, 28990, true],
    ["Travesseiros", 1, 15980, false],
    ["Abajur de cabeceira", 1, 12990, false],
    ["Manta de linho", 1, 21900, false],
    ["Jogo de toalhas", 2, 18990, true],
    ["Tapete de banho", 2, 5990, false],
    ["Kit para bancada", 2, 7990, false],
    ["Sofá de linho", 3, 249900, false],
    ["Mesa de centro", 3, 59900, false],
    ["Almofadas", 3, 12990, true],
    ["Luminária de piso", 3, 24990, false],
    ["Cesto de roupas", 4, 8990, true],
    ["Varal de chão", 4, 11990, false],
    ["Kit de limpeza", 4, 7990, true],
  ];
  const enxoval = {
    id: "demo-home",
    name: "Nosso primeiro apê",
    ownerId: demoUser.id,
    role: "owner" as const,
    discountCents: 5000,
  };
  return {
    activeId: enxoval.id,
    workspaces: [
      {
        enxoval,
        categories,
        members: [
          { ...demoUser, role: "owner" },
          {
            id: "demo-partner",
            name: "Lucas",
            email: "lucas@exemplo.com",
            role: "editor",
          },
        ],
        items: products.map(([name, cat, priceCents, checked], i) => ({
          id: `demo-item-${i}`,
          name,
          categoryId: categories[cat].id,
          category: categories[cat].name,
          checked,
          priceCents,
          link: "",
          description:
            i === 0 ? "Cerâmica off-white, conjunto de 6 peças." : "",
          sortOrder: i,
          updatedAt: "2026-09-30T12:00:00.000Z",
        })),
      },
    ],
  };
}
let memoryStore: DemoStore | undefined;
function read(): DemoStore {
  if (memoryStore) return memoryStore;
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(PREVIOUS_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (
        Array.isArray(data.workspaces) &&
        data.workspaces.every(
          (w: EnxovalWorkspace) =>
            w.enxoval &&
            Array.isArray(w.items) &&
            Array.isArray(w.categories) &&
            Array.isArray(w.members),
        )
      )
        return (memoryStore = data);
    }
  } catch {
    /* A private browser may not allow persistence. */
  }
  return (memoryStore = seed());
}
function persist(data: DemoStore) {
  memoryStore = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* Keep the demo usable in memory. */
  }
}
function bootstrap(data: DemoStore): BootstrapData {
  const workspace =
    data.workspaces.find((w) => w.enxoval.id === data.activeId) ??
    data.workspaces[0];
  return {
    user: demoUser,
    enxovais: data.workspaces.map((w) => w.enxoval),
    activeEnxoval: workspace?.enxoval ?? null,
    categories: workspace?.categories ?? [],
    items: workspace?.items ?? [],
    members: workspace?.members ?? [],
  };
}
export async function demoRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const data = structuredClone(read());
  const url = new URL(path, window.location.origin);
  const method = options.method ?? "GET";
  const body = typeof options.body === "string" ? JSON.parse(options.body) : {};
  let result: unknown;
  if (url.pathname === "/api/bootstrap") {
    data.activeId = url.searchParams.get("enxovalId") ?? data.activeId;
    result = bootstrap(data);
  } else if (url.pathname === "/api/auth/logout") {
    result = undefined;
  } else if (url.pathname.endsWith("/members")) {
    throw new Error(
      "Na demonstração, Ana e Lucas são membros ilustrativos. Crie uma conta para compartilhar um enxoval de verdade.",
    );
  } else if (url.pathname === "/api/enxovais" && method === "POST") {
    const categories = body.useDefaultTemplate
      ? DEFAULT_TEMPLATE_CATEGORIES.map((name, sortOrder) => ({
          id: id(),
          name,
          sortOrder,
        }))
      : [];
    const workspace: EnxovalWorkspace = {
      enxoval: {
        id: id(),
        name: body.name,
        ownerId: demoUser.id,
        role: "owner",
        discountCents: 0,
      },
      categories,
      members: [{ ...demoUser, role: "owner" }],
      items: body.useDefaultTemplate
        ? DEFAULT_TEMPLATE_ITEMS.map((item, sortOrder) => ({
            id: id(),
            name: item.name,
            category: item.category,
            categoryId: categories.find((c) => c.name === item.category)!.id,
            checked: false,
            priceCents: null,
            link: "",
            description: "",
            sortOrder,
            updatedAt: new Date().toISOString(),
          }))
        : [],
    };
    data.workspaces.push(workspace);
    data.activeId = workspace.enxoval.id;
    result = workspace;
  } else if (url.pathname.startsWith("/api/enxovais/")) {
    const workspaceId = url.pathname.split("/")[3];
    const workspace = data.workspaces.find((w) => w.enxoval.id === workspaceId);
    if (!workspace) throw new Error("Enxoval não encontrado.");
    if (method === "DELETE") {
      data.workspaces = data.workspaces.filter((w) => w !== workspace);
      data.activeId = data.workspaces[0]?.enxoval.id ?? "";
    } else if (method === "PATCH") {
      Object.assign(workspace.enxoval, body);
      result = workspace.enxoval;
    } else {
      data.activeId = workspaceId;
      result = workspace;
    }
  } else if (url.pathname.startsWith("/api/categories")) {
    const workspace = data.workspaces.find(
      (w) => w.enxoval.id === body.enxovalId,
    );
    if (!workspace) throw new Error("Enxoval não encontrado.");
    if (method === "PATCH") {
      workspace.categories = body.categoryIds.map(
        (categoryId: string, sortOrder: number) => ({
          ...workspace.categories.find((c) => c.id === categoryId),
          sortOrder,
        }),
      );
      result = workspace.categories;
    } else {
      const category = {
        id: id(),
        name: body.name,
        sortOrder: workspace.categories.length,
      };
      workspace.categories.push(category);
      result = category;
    }
  } else if (url.pathname === "/api/items" && method === "POST") {
    const workspace = data.workspaces.find(
      (w) => w.enxoval.id === body.enxovalId,
    );
    if (!workspace) throw new Error("Enxoval não encontrado.");
    let category = workspace.categories.find((c) => c.id === body.categoryId);
    if (!category && body.categoryName) {
      category = {
        id: id(),
        name: body.categoryName,
        sortOrder: workspace.categories.length,
      };
      workspace.categories.push(category);
    }
    if (!category) throw new Error("Escolha uma categoria.");
    const item = {
      id: id(),
      name: body.name,
      categoryId: category.id,
      category: category.name,
      checked: false,
      priceCents: null,
      link: "",
      description: "",
      sortOrder: workspace.items.length,
      updatedAt: new Date().toISOString(),
    };
    workspace.items.push(item);
    result = { item, category };
  } else if (url.pathname.startsWith("/api/items/")) {
    const itemId = url.pathname.split("/")[3];
    const workspace = data.workspaces.find((w) =>
      w.items.some((i) => i.id === itemId),
    );
    if (!workspace) throw new Error("Item não encontrado.");
    if (method === "DELETE")
      workspace.items = workspace.items.filter((i) => i.id !== itemId);
    else {
      const item = workspace.items.find((i) => i.id === itemId)!;
      Object.assign(item, body, { updatedAt: new Date().toISOString() });
      item.category =
        workspace.categories.find((c) => c.id === item.categoryId)?.name ??
        item.category;
      result = item;
    }
  } else {
    throw new Error("Esta ação não está disponível na demonstração.");
  }
  persist(data);
  return structuredClone(result) as T;
}
