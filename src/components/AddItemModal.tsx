import React, { useEffect, useState } from "react";
import type { EnxovalCategory } from "../types";
import { Dialog } from "./Dialog";

const NEW_CATEGORY_VALUE = "__new_category__";

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    name: string,
    categoryId?: string,
    categoryName?: string,
  ) => Promise<void> | void;
  defaultCategoryId: string;
  categories: EnxovalCategory[];
}

export function AddItemModal({
  isOpen,
  onClose,
  onAdd,
  defaultCategoryId,
  categories,
}: AddItemModalProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setCategoryId(defaultCategoryId || categories[0]?.id || NEW_CATEGORY_VALUE);
    setNewCategoryName("");
    setError("");
  }, [categories, defaultCategoryId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedCategoryName = newCategoryName.trim();

    if (!trimmedName) return;
    if (categoryId === NEW_CATEGORY_VALUE && !trimmedCategoryName) {
      setError("Informe o nome da nova categoria.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onAdd(
        trimmedName,
        categoryId === NEW_CATEGORY_VALUE ? undefined : categoryId,
        categoryId === NEW_CATEGORY_VALUE ? trimmedCategoryName : undefined,
      );
      setName("");
      setNewCategoryName("");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível adicionar o item.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      title="Novo item"
      isOpen={isOpen}
      onClose={onClose}
      busy={isSubmitting}
    >
      <form
        onSubmit={handleSubmit}
        className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
      >
        <div>
          <label
            htmlFor="new-item-name"
            className="block text-sm font-medium text-stone-700 mb-1"
          >
            Nome do produto
          </label>
          <input
            type="text"
            id="new-item-name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Jogo de Taças"
            className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
          />
        </div>

        <div>
          <label
            htmlFor="new-item-category"
            className="block text-sm font-medium text-stone-700 mb-1"
          >
            Categoria
          </label>
          <select
            id="new-item-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood bg-white"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
            <option value={NEW_CATEGORY_VALUE}>+ Nova categoria</option>
          </select>
        </div>

        {categoryId === NEW_CATEGORY_VALUE && (
          <div>
            <label
              htmlFor="new-item-category-name"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              Nome da categoria
            </label>
            <input
              id="new-item-category-name"
              required
              maxLength={100}
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ex: Escritório"
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
            />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-medium text-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Salvando..." : "Adicionar à lista"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
