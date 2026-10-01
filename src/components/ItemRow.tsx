import {
  Check,
  ExternalLink,
  AlignLeft,
  Trash2,
  Pencil,
  Clock3,
} from "lucide-react";
import type { EnxovalItem } from "../types";

interface ItemRowProps {
  item: EnxovalItem;
  categoryName?: string;
  showUpdatedAt?: boolean;
  updatedAtLabel?: string;
  onUpdate: (id: string, updates: Partial<EnxovalItem>) => Promise<void> | void;
  onDelete: (item: EnxovalItem) => void;
  onEdit: (item: EnxovalItem) => void;
}
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
function safeLink(value: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
export function ItemRow({
  item,
  categoryName,
  showUpdatedAt,
  updatedAtLabel,
  onUpdate,
  onDelete,
  onEdit,
}: ItemRowProps) {
  const price = Number(item.priceCents);
  const formattedPrice =
    Number.isFinite(price) && price > 0 ? money.format(price / 100) : "";
  const link = safeLink(item.link);
  return (
    <div className={`item-row ${item.checked ? "checked" : ""}`}>
      <div className="item-row-inner">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          aria-label={`${item.checked ? "Desmarcar" : "Marcar como comprado"}: ${item.name}`}
          className="item-check"
          onClick={() =>
            void Promise.resolve(
              onUpdate(item.id, { checked: !item.checked }),
            ).catch(() => undefined)
          }
        >
          <Check size={13} strokeWidth={2.5} />
        </button>
        <div className="item-content">
          <span className="item-name" title={item.name}>
            {item.name}
          </span>
          <div className="item-meta">
            {categoryName && <span>{categoryName}</span>}
            {formattedPrice && (
              <span className="item-meta-price" style={{ display: "none" }}>
                {formattedPrice}
              </span>
            )}
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ExternalLink size={10} /> Ver na loja
              </a>
            )}
            {item.description && (
              <span title={item.description}>
                <AlignLeft size={11} />
              </span>
            )}
            {showUpdatedAt && updatedAtLabel && (
              <span className="inline-flex items-center gap-1">
                <Clock3 size={10} />
                {updatedAtLabel}
              </span>
            )}
          </div>
        </div>
        <span className="item-price">{formattedPrice || "Sem preço"}</span>
        <span className="item-status">
          {item.checked ? "Conquistado" : "Na lista"}
        </span>
        <div className="item-actions">
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={`Editar ${item.name}`}
            title="Editar item"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            aria-label={`Remover ${item.name}`}
            title="Remover item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
