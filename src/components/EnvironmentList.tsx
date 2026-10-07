import { Pencil, Trash2 } from "lucide-react";
import type { EnxovalCategory, EnxovalItem } from "../types";
import { SortableList } from "./SortableList";
import { RoomIcon } from "./WorkspaceOverview";

export function EnvironmentList({
  categories,
  items,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onReorder,
  disabled = false,
  horizontal = false,
}: {
  categories: EnxovalCategory[];
  items: EnxovalItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onRename: (category: EnxovalCategory) => void;
  onDelete?: (category: EnxovalCategory) => void;
  onReorder: (ids: string[]) => Promise<void>;
  disabled?: boolean;
  horizontal?: boolean;
}) {
  return (
    <SortableList
      items={categories}
      axis={horizontal ? "x" : "y"}
      onCommit={onReorder}
      disabled={disabled}
      label="Ambientes"
      className={horizontal ? "environment-chips" : "environment-list"}
      render={(category, handle) => (
        <div
          className={`environment-row ${activeId === category.id ? "active" : ""}`}
        >
          {handle}
          <button
            type="button"
            className="environment-select"
            disabled={disabled}
            onClick={() => onSelect(category.id)}
            aria-current={activeId === category.id ? "true" : undefined}
          >
            {!horizontal && <RoomIcon name={category.name} />}
            <span>{category.name}</span>
            <small>
              {horizontal
                ? `${items.filter((item) => item.categoryId === category.id && item.checked).length}/`
                : ""}
              {items.filter((item) => item.categoryId === category.id).length}
            </small>
          </button>
          {!horizontal && (
            <button
              type="button"
              className="environment-rename"
              aria-label={`Editar ambiente ${category.name}`}
              onClick={() => onRename(category)}
              disabled={disabled}
            >
              <Pencil size={14} />
            </button>
          )}
          {!horizontal && onDelete && (
            <button
              type="button"
              className="environment-rename environment-delete"
              aria-label={`Excluir ambiente ${category.name}`}
              onClick={() => onDelete(category)}
              disabled={disabled}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    />
  );
}
