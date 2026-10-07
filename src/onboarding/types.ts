export type Moment = "casal" | "solo" | "amigos" | "troca";
export type Housing = "apartamento" | "casa" | "studio";
export type Owned = "nada" | "algumas" | "boa";
export type PlanStyle = "full" | "min";
export type Budget = "lt10" | "10-25" | "25-50" | "gt50" | "unknown";
export type Climate = "hot" | "mild" | "cold";
export type Worry = "start" | "waste" | "forget" | "budget" | "time";
export type Usage = "buy" | "spend" | "links" | "share";

/** Espaços que a pessoa pode escolher. Cozinha e banheiro estão sempre no plano. */
export type RoomKey =
  | "cozinha"
  | "eletro"
  | "sala"
  | "quarto"
  | "quartoExtra"
  | "banheiro"
  | "servico"
  | "externa"
  | "escritorio";

export type OptionalRoom = Exclude<
  RoomKey,
  "cozinha" | "eletro" | "banheiro"
>;

export interface Answers {
  name: string;
  moment: Moment | null;
  /** AAAA-MM-DD, ou null quando a pessoa ainda não sabe. */
  moveDate: string | null;
  /** Verdadeiro depois que a pessoa respondeu a pergunta da data (inclusive "ainda não sei"). */
  moveDateAnswered: boolean;
  state: string | null;
  housing: Housing | null;
  people: number | null;
  rooms: OptionalRoom[] | null;
  owned: Owned | null;
  style: PlanStyle | null;
  budget: Budget | null;
  worries: Worry[];
  usage: Usage[];
  source: string;
}

export interface PlanItem {
  name: string;
  description: string;
  essential: boolean;
  tier: 1 | 2 | 3 | 4;
  /** Ambiente de origem no catálogo (no studio, sala e quarto dividem a mesma lista). */
  room: RoomKey;
}

export interface PlanCategory {
  key: string;
  name: string;
  items: PlanItem[];
}

export interface PlanStats {
  total: number;
  essentials: number;
  complete: number;
  rooms: number;
  estimateMinCents: number;
  estimateMaxCents: number;
  /** Estimativa sem as compras grandes que ficaram para depois. */
  estimateNowMinCents: number;
  estimateNowMaxCents: number;
  bigTicketDeferred: number;
  budgetFit: "within" | "tight" | "over" | "unknown";
}

export interface GeneratedPlan {
  enxovalName: string;
  categories: PlanCategory[];
  stats: PlanStats;
}

/** Formato enviado ao servidor e ao demo. */
export interface PlanPayload {
  categories: { name: string; items: { name: string; description: string }[] }[];
}
