import type { EnxovalItem } from "../types";

export function createCsv(items: EnxovalItem[]) {
  const cell = (value: string) =>
    `"${(/^[\s]*[=+@-]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
  return (
    "\uFEFF" +
    [
      ["Item", "Ambiente", "Status", "Preço (R$)", "Link", "Observações"],
      ...items.map((i) => [
        i.name,
        i.category,
        i.checked ? "Comprado" : "Pendente",
        i.priceCents === null
          ? ""
          : (i.priceCents / 100).toFixed(2).replace(".", ","),
        i.link,
        i.description,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
export function exportItems(items: EnxovalItem[], name: string) {
  const url = URL.createObjectURL(
    new Blob([createCsv(items)], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `larumi-${
    name
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "enxoval"
  }.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
