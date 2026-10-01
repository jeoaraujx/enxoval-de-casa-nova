import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Reorder } from "motion/react";
import {
  Plus,
  Home,
  Sparkles,
  LogOut,
  Users,
  UserPlus,
  ListPlus,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  GripVertical,
  ExternalLink,
  Minus,
  SlidersHorizontal,
  LayoutDashboard,
  ListChecks,
  ArrowUpRight,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Menu,
} from "lucide-react";
import type {
  AuthUser,
  BootstrapData,
  EnxovalCategory,
  EnxovalItem,
  EnxovalMember,
  EnxovalSummary,
  EnxovalWorkspace,
} from "./types";
import {
  ApiError,
  createCategory as createCategoryRequest,
  createEnxoval as createEnxovalRequest,
  createItem as createItemRequest,
  deleteEnxoval as deleteEnxovalRequest,
  deleteItem as deleteItemRequest,
  fetchBootstrap,
  fetchEnxoval as fetchEnxovalRequest,
  inviteMember as inviteMemberRequest,
  logout as logoutRequest,
  reorderCategories as reorderCategoriesRequest,
  updateEnxoval as updateEnxovalRequest,
  updateItem as updateItemRequest,
} from "./api";
import { ItemRow } from "./components/ItemRow";
import { AddItemModal } from "./components/AddItemModal";
import { LandingPage } from "./components/LandingPage";
import { AuthPage } from "./components/AuthPage";
import { Brand } from "./components/Brand";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { RoomIcon, WorkspaceOverview } from "./components/WorkspaceOverview";
import { isDemoMode } from "./demo";
import { Dialog } from "./components/Dialog";

type DiscountOperation = "add" | "subtract";
type ItemSortMode = "name" | "updated";
type CategorySwipeDirection = "next" | "previous";

const APP_NAME = "Larume";

function makeTitle(context?: string) {
  return context ? `${context} | ${APP_NAME}` : APP_NAME;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function normalizePriceCents(priceCents: number | string | null | undefined) {
  if (typeof priceCents === "number" && Number.isFinite(priceCents))
    return Math.round(priceCents);
  if (typeof priceCents === "string" && priceCents.trim()) {
    const parsed = Number(priceCents);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

function formatCurrency(priceCents: number | string | null | undefined) {
  const normalizedPriceCents = normalizePriceCents(priceCents);
  return normalizedPriceCents !== null
    ? currencyFormatter.format(normalizedPriceCents / 100)
    : currencyFormatter.format(0);
}

function formatOptionalCurrency(
  priceCents: number | string | null | undefined,
) {
  const normalizedPriceCents = normalizePriceCents(priceCents);
  return normalizedPriceCents !== null && normalizedPriceCents > 0
    ? currencyFormatter.format(normalizedPriceCents / 100)
    : "";
}

function priceTextToCents(value: string) {
  const digits = value.replace(/\D/g, "");
  const cents = digits ? Number(digits) : 0;
  return cents > 0 ? cents : null;
}

function formatPriceInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  return digits ? currencyFormatter.format(Number(digits) / 100) : "";
}

function getUpdatedAtTime(item: Pick<EnxovalItem, "updatedAt">) {
  const time = new Date(item.updatedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return dateTimeFormatter.format(date);
}

function getProductUrl(link: string) {
  const trimmedLink = link.trim();
  if (!trimmedLink) return "";
  return trimmedLink.startsWith("http")
    ? trimmedLink
    : `https://${trimmedLink}`;
}

export default function App() {
  const [workspaceView, setWorkspaceView] = useState<"list" | "overview">(
    "list",
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [enxovais, setEnxovais] = useState<EnxovalSummary[]>([]);
  const [activeEnxoval, setActiveEnxoval] = useState<EnxovalSummary | null>(
    null,
  );
  const [members, setMembers] = useState<EnxovalMember[]>([]);
  const [items, setItems] = useState<EnxovalItem[]>([]);
  const [categories, setCategories] = useState<EnxovalCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showOnlyPricedItems, setShowOnlyPricedItems] = useState(false);
  const [showOnlyCheckedItems, setShowOnlyCheckedItems] = useState(false);
  const [itemSortMode, setItemSortMode] = useState<ItemSortMode>("name");
  const [categorySwipeOffset, setCategorySwipeOffset] = useState(0);
  const [categorySwipeDirection, setCategorySwipeDirection] =
    useState<CategorySwipeDirection | null>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openWorkspaceMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    menuTriggerRef.current = event.currentTarget;
    setIsWorkspaceMenuOpen(true);
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isReorderCategoriesOpen, setIsReorderCategoriesOpen] = useState(false);
  const [isCreateEnxovalOpen, setIsCreateEnxovalOpen] = useState(false);
  const [isRenameEnxovalOpen, setIsRenameEnxovalOpen] = useState(false);
  const [isDeleteEnxovalOpen, setIsDeleteEnxovalOpen] = useState(false);
  const [isDiscountsOpen, setIsDiscountsOpen] = useState(false);
  const [discountOperation, setDiscountOperation] =
    useState<DiscountOperation>("add");
  const [discountAdjustmentText, setDiscountAdjustmentText] = useState("");
  const [discountWorkingCents, setDiscountWorkingCents] = useState(0);
  const [itemToDelete, setItemToDelete] = useState<EnxovalItem | null>(null);
  const [itemToEdit, setItemToEdit] = useState<EnxovalItem | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemLink, setEditItemLink] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemPriceText, setEditItemPriceText] = useState("");
  const [editItemCategoryId, setEditItemCategoryId] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newEnxovalName, setNewEnxovalName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryOrder, setCategoryOrder] = useState<EnxovalCategory[]>([]);
  const [newEnxovalUseDefaultTemplate, setNewEnxovalUseDefaultTemplate] =
    useState(true);
  const [renameEnxovalName, setRenameEnxovalName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [headerProgress, setHeaderProgress] = useState(0);
  const [isHeaderMobile, setIsHeaderMobile] = useState(false);
  const [error, setError] = useState("");
  const pullStartYRef = useRef<number | null>(null);
  const pullLastDistanceRef = useRef(0);
  const discountAdjustmentInputRef = useRef<HTMLInputElement | null>(null);
  const categorySwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    isSwiping: boolean;
    isCanceled: boolean;
  } | null>(null);
  const categorySwipeAnimationTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (categorySwipeAnimationTimerRef.current !== null) {
        window.clearTimeout(categorySwipeAnimationTimerRef.current);
      }
    },
    [],
  );
  const applyWorkspace = (workspace: EnxovalWorkspace) => {
    setActiveEnxoval(workspace.enxoval);
    setMembers(workspace.members);
    setCategories(workspace.categories);
    setItems(workspace.items);
    setActiveCategoryId(workspace.categories[0]?.id || "");
  };

  const applyBootstrap = (
    data: BootstrapData,
    options?: { promptCreateEnxoval?: boolean },
  ) => {
    setUser(data.user);
    setEnxovais(data.enxovais);
    setActiveEnxoval(data.activeEnxoval);
    setMembers(data.members);
    setCategories(data.categories);
    setItems(data.items);
    setActiveCategoryId(data.categories[0]?.id || "");

    if (options?.promptCreateEnxoval) {
      setDialogError("");
      setNewEnxovalName("");
      setNewEnxovalUseDefaultTemplate(true);
      setIsCreateEnxovalOpen(true);
    }
  };

  useEffect(() => {
    let isMounted = true;

    fetchBootstrap()
      .then((data) => {
        if (isMounted) applyBootstrap(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar seus dados.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/") {
      document.title = "Larume — seu lar começa com um plano";
      return;
    }
    if (isLoading) {
      document.title = makeTitle("Carregando");
      return;
    }

    if (!user) {
      return;
    }

    if (isCreateEnxovalOpen) {
      document.title = makeTitle("Novo enxoval");
      return;
    }

    if (isCreateCategoryOpen) {
      document.title = makeTitle("Nova categoria");
      return;
    }

    if (isReorderCategoriesOpen) {
      document.title = makeTitle("Reordenar categorias");
      return;
    }

    if (isRenameEnxovalOpen) {
      document.title = makeTitle(
        activeEnxoval ? "Editar " + activeEnxoval.name : "Editar enxoval",
      );
      return;
    }

    if (isDeleteEnxovalOpen) {
      document.title = makeTitle(
        activeEnxoval ? "Excluir " + activeEnxoval.name : "Excluir enxoval",
      );
      return;
    }

    if (isDiscountsOpen) {
      document.title = makeTitle("Descontos e cashback");
      return;
    }

    if (itemToDelete) {
      document.title = makeTitle("Excluir " + itemToDelete.name);
      return;
    }

    if (itemToEdit) {
      document.title = makeTitle("Editar " + itemToEdit.name);
      return;
    }

    if (isInviteOpen) {
      document.title = makeTitle(
        activeEnxoval
          ? "Convidar para " + activeEnxoval.name
          : "Convidar pessoa",
      );
      return;
    }

    if (activeEnxoval) {
      document.title = makeTitle(
        isWorkspaceLoading
          ? "Carregando " + activeEnxoval.name
          : activeEnxoval.name,
      );
      return;
    }

    document.title = makeTitle("Meus enxovais");
  }, [
    activeEnxoval,
    isCreateCategoryOpen,
    isCreateEnxovalOpen,
    isDeleteEnxovalOpen,
    isDiscountsOpen,
    isInviteOpen,
    isLoading,
    isRenameEnxovalOpen,
    isReorderCategoriesOpen,
    isWorkspaceLoading,
    itemToDelete,
    itemToEdit,
    user,
  ]);

  useEffect(() => {
    let animationFrame = 0;

    const updateHeaderSize = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const isMobile = window.innerWidth < 640;
        setIsHeaderMobile(isMobile);
        setHeaderProgress(
          isMobile ? Math.min(Math.max(window.scrollY / 140, 0), 1) : 0,
        );
      });
    };

    updateHeaderSize();
    window.addEventListener("scroll", updateHeaderSize, { passive: true });
    window.addEventListener("resize", updateHeaderSize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateHeaderSize);
      window.removeEventListener("resize", updateHeaderSize);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setError("");

    try {
      const currentCategoryId = activeCategoryId;
      const data = await fetchBootstrap(activeEnxoval?.id);
      applyBootstrap(data);

      if (
        currentCategoryId &&
        data.categories.some((category) => category.id === currentCategoryId)
      ) {
        setActiveCategoryId(currentCategoryId);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o enxoval.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [activeCategoryId, activeEnxoval?.id, isRefreshing]);

  useEffect(() => {
    if (
      !user ||
      !isHeaderMobile ||
      isReorderCategoriesOpen ||
      isWorkspaceMenuOpen
    ) {
      pullStartYRef.current = null;
      pullLastDistanceRef.current = 0;
      setPullDistance(0);
      return;
    }

    const pullThreshold = 72;
    let resetTimer: number | undefined;

    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest('button, input, textarea, select, a, [role="button"]'),
      );

    const resetPull = () => {
      pullStartYRef.current = null;
      pullLastDistanceRef.current = 0;
      setPullDistance(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (
        isRefreshing ||
        window.scrollY > 0 ||
        event.touches.length !== 1 ||
        isInteractiveTarget(event.target)
      ) {
        resetPull();
        return;
      }

      pullStartYRef.current = event.touches[0].clientY;
      pullLastDistanceRef.current = 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const startY = pullStartYRef.current;
      if (startY === null || event.touches.length !== 1) return;

      const delta = event.touches[0].clientY - startY;
      if (delta <= 0 || window.scrollY > 0) {
        resetPull();
        return;
      }

      const distance = Math.min(Math.round(delta * 0.55), 96);
      pullLastDistanceRef.current = distance;
      setPullDistance(distance);

      if (distance > 4 && event.cancelable) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (pullStartYRef.current === null) return;

      const shouldRefresh = pullLastDistanceRef.current >= pullThreshold;
      pullStartYRef.current = null;
      pullLastDistanceRef.current = 0;

      if (!shouldRefresh) {
        setPullDistance(0);
        return;
      }

      setPullDistance(pullThreshold);
      void handleRefresh().finally(() => {
        resetTimer = window.setTimeout(() => setPullDistance(0), 180);
      });
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", resetPull);

    return () => {
      if (resetTimer) window.clearTimeout(resetTimer);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", resetPull);
    };
  }, [
    handleRefresh,
    isWorkspaceMenuOpen,
    isHeaderMobile,
    isRefreshing,
    isReorderCategoriesOpen,
    user,
  ]);

  const activeCategory =
    categories.find((category) => category.id === activeCategoryId) ??
    categories[0];
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const isSearching = normalizedSearchQuery.length > 0;
  const isShowingLatestChanges = itemSortMode === "updated";
  const hasItemFilters = showOnlyPricedItems || showOnlyCheckedItems;
  const activeFilterCount =
    (showOnlyPricedItems ? 1 : 0) +
    (showOnlyCheckedItems ? 1 : 0) +
    (itemSortMode !== "name" ? 1 : 0);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const filteredItems = useMemo(() => {
    const baseItems =
      isSearching || isShowingLatestChanges
        ? items
        : activeCategory
          ? items.filter((item) => item.categoryId === activeCategory.id)
          : [];

    const searchedItems = isSearching
      ? baseItems.filter((item) => {
          const categoryName =
            categoryById.get(item.categoryId)?.name ?? item.category;
          const searchableText = normalizeSearchText(
            [
              item.name,
              item.description,
              item.link,
              item.priceCents === null ? "" : String(item.priceCents / 100),
              categoryName,
            ].join(" "),
          );

          return searchableText.includes(normalizedSearchQuery);
        })
      : baseItems;

    const narrowedItems = searchedItems.filter((item) => {
      if (showOnlyPricedItems) {
        const priceCents = normalizePriceCents(item.priceCents);
        if (priceCents === null || priceCents <= 0) return false;
      }

      if (showOnlyCheckedItems && !item.checked) return false;
      return true;
    });

    return [...narrowedItems].sort((firstItem, secondItem) => {
      if (itemSortMode === "updated") {
        const updatedDifference =
          getUpdatedAtTime(secondItem) - getUpdatedAtTime(firstItem);
        if (updatedDifference !== 0) return updatedDifference;
      }

      return (
        firstItem.name.localeCompare(secondItem.name, "pt-BR", {
          sensitivity: "base",
        }) ||
        firstItem.category.localeCompare(secondItem.category, "pt-BR", {
          sensitivity: "base",
        })
      );
    });
  }, [
    activeCategory,
    categoryById,
    isSearching,
    isShowingLatestChanges,
    itemSortMode,
    items,
    normalizedSearchQuery,
    showOnlyCheckedItems,
    showOnlyPricedItems,
  ]);
  const filteredCheckedCount = filteredItems.filter(
    (item) => item.checked,
  ).length;
  const itemCountText = `${filteredItems.length} ${filteredItems.length === 1 ? "item" : "itens"}`;
  const listTitle = isSearching
    ? "Resultados da busca"
    : isShowingLatestChanges
      ? "Últimas alterações"
      : hasItemFilters
        ? `Itens filtrados em ${activeCategory?.name ?? "categoria"}`
        : `Progresso de ${activeCategory?.name ?? "categoria"}`;
  const listCounterText =
    !isSearching && !isShowingLatestChanges && !hasItemFilters
      ? `${filteredCheckedCount} de ${filteredItems.length} itens`
      : itemCountText;
  const showItemCategory = isSearching || isShowingLatestChanges;
  const canSwipeCategories =
    categories.length > 1 && !isSearching && !isShowingLatestChanges;
  const categorySwipeAnimationClass =
    categorySwipeDirection === "next"
      ? "category-list-enter-next"
      : categorySwipeDirection === "previous"
        ? "category-list-enter-previous"
        : "";
  const categorySwipeStyle: React.CSSProperties | undefined =
    categorySwipeOffset !== 0
      ? {
          opacity: 1 - Math.min(Math.abs(categorySwipeOffset) / 360, 0.16),
          transform: `translateX(${categorySwipeOffset}px)`,
          transition: "none",
        }
      : undefined;

  const progressStats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.checked).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }, [items]);
  const checkedSubtotalSpentCents = useMemo(
    () =>
      items.reduce((total, item) => {
        if (!item.checked) return total;

        const priceCents = normalizePriceCents(item.priceCents);
        return priceCents && priceCents > 0 ? total + priceCents : total;
      }, 0),
    [items],
  );
  const enxovalDiscountCents =
    normalizePriceCents(activeEnxoval?.discountCents) ?? 0;
  const discountAdjustmentCents = priceTextToCents(discountAdjustmentText) ?? 0;
  const checkedTotalSpentCents = Math.max(
    0,
    checkedSubtotalSpentCents - enxovalDiscountCents,
  );
  const discountPreviewTotalCents = Math.max(
    0,
    checkedSubtotalSpentCents - discountWorkingCents,
  );
  const checkedSubtotalSpentText = formatCurrency(checkedSubtotalSpentCents);
  const savedDiscountText = formatCurrency(enxovalDiscountCents);
  const discountsButtonTitle =
    enxovalDiscountCents > 0
      ? "Descontos e cashback: - " + savedDiscountText
      : "Descontos e cashback";
  const discountAdjustmentPreviewText = formatCurrency(discountAdjustmentCents);
  const workingDiscountText = formatCurrency(discountWorkingCents);
  const checkedTotalSpentText = formatCurrency(checkedTotalSpentCents);
  const discountPreviewTotalText = formatCurrency(discountPreviewTotalCents);
  const hasEnxoval = enxovais.length > 0 && Boolean(activeEnxoval);
  const isOwner = activeEnxoval?.role === "owner";
  const visibleProgress = isHeaderMobile ? headerProgress : 0;
  const headerStyle = isHeaderMobile
    ? {
        paddingTop: `${16 - 4 * visibleProgress}px`,
        paddingBottom: `${16 - 4 * visibleProgress}px`,
      }
    : undefined;
  const eyebrowStyle: React.CSSProperties = {
    maxHeight: `${24 * (1 - visibleProgress)}px`,
    opacity: 1 - visibleProgress,
    transform: `translateY(${-4 * visibleProgress}px)`,
    pointerEvents: visibleProgress > 0.9 ? "none" : "auto",
  };
  const metaStyle: React.CSSProperties = {
    marginTop: `${12 * (1 - visibleProgress)}px`,
    maxHeight: `${24 * (1 - visibleProgress)}px`,
    opacity: 1 - visibleProgress,
    transform: `translateY(${-4 * visibleProgress}px)`,
    pointerEvents: visibleProgress > 0.9 ? "none" : "auto",
  };
  const titleStyle = isHeaderMobile
    ? {
        fontSize: `${25 - 5 * visibleProgress}px`,
      }
    : undefined;
  const totalSpentTitleStyle: React.CSSProperties = isHeaderMobile
    ? {
        marginTop: `${4 * visibleProgress}px`,
        maxHeight: `${24 * visibleProgress}px`,
        opacity: visibleProgress,
        paddingTop: `${4 * visibleProgress}px`,
        paddingBottom: `${4 * visibleProgress}px`,
        transform: `translateY(${-4 * (1 - visibleProgress)}px)`,
        pointerEvents: visibleProgress > 0.45 ? "auto" : "none",
      }
    : { display: "none" };
  const categoryBarStyle = isHeaderMobile
    ? {
        marginTop: `${18 - 6 * visibleProgress}px`,
      }
    : undefined;
  const categoryButtonStyle = isHeaderMobile
    ? {
        paddingTop: `${8 - 2 * visibleProgress}px`,
        paddingBottom: `${8 - 2 * visibleProgress}px`,
      }
    : undefined;
  const editItemProductUrl = getProductUrl(editItemLink);

  const startCategorySwipeAnimation = useCallback(
    (direction: CategorySwipeDirection) => {
      if (categorySwipeAnimationTimerRef.current !== null) {
        window.clearTimeout(categorySwipeAnimationTimerRef.current);
      }

      setCategorySwipeDirection(direction);
      categorySwipeAnimationTimerRef.current = window.setTimeout(() => {
        setCategorySwipeDirection(null);
        categorySwipeAnimationTimerRef.current = null;
      }, 220);
    },
    [],
  );

  const changeCategoryBySwipe = useCallback(
    (direction: CategorySwipeDirection) => {
      if (!canSwipeCategories || !activeCategory) return false;

      const currentCategoryIndex = categories.findIndex(
        (category) => category.id === activeCategory.id,
      );
      if (currentCategoryIndex < 0) return false;

      const nextCategoryIndex =
        direction === "next"
          ? currentCategoryIndex + 1
          : currentCategoryIndex - 1;
      const nextCategory = categories[nextCategoryIndex];
      if (!nextCategory) return false;

      startCategorySwipeAnimation(direction);
      setActiveCategoryId(nextCategory.id);
      return true;
    },
    [
      activeCategory,
      canSwipeCategories,
      categories,
      startCategorySwipeAnimation,
    ],
  );

  const resetCategorySwipe = useCallback(() => {
    categorySwipeRef.current = null;
    setCategorySwipeOffset(0);
  }, []);

  const handleCategoryListPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        !canSwipeCategories ||
        (event.pointerType === "mouse" && event.button !== 0)
      )
        return;

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('button, input, textarea, select, a, [role="button"]')
      )
        return;

      categorySwipeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        isSwiping: false,
        isCanceled: false,
      };
      setCategorySwipeOffset(0);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canSwipeCategories],
  );

  const handleCategoryListPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const swipe = categorySwipeRef.current;
      if (!swipe || swipe.pointerId !== event.pointerId || swipe.isCanceled)
        return;

      const deltaX = event.clientX - swipe.startX;
      const deltaY = event.clientY - swipe.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (!swipe.isSwiping) {
        if (absY > 12 && absY > absX) {
          swipe.isCanceled = true;
          setCategorySwipeOffset(0);
          return;
        }

        if (absX < 16 || absX < absY * 1.2) return;
        swipe.isSwiping = true;
      }

      event.preventDefault();
      setCategorySwipeOffset(Math.max(-72, Math.min(72, deltaX * 0.45)));
    },
    [],
  );

  const handleCategoryListPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const swipe = categorySwipeRef.current;
      if (!swipe || swipe.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const deltaX = event.clientX - swipe.startX;
      const deltaY = event.clientY - swipe.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (
        !swipe.isCanceled &&
        swipe.isSwiping &&
        absX >= 56 &&
        absX > absY * 1.1
      ) {
        void changeCategoryBySwipe(deltaX < 0 ? "next" : "previous");
      }

      resetCategorySwipe();
    },
    [changeCategoryBySwipe, resetCategorySwipe],
  );

  const handleCategoryListPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      resetCategorySwipe();
    },
    [resetCategorySwipe],
  );

  const handleEnxovalChange = async (enxovalId: string) => {
    if (!enxovalId || enxovalId === activeEnxoval?.id) return;

    setIsWorkspaceLoading(true);
    setError("");

    try {
      const workspace = await fetchEnxovalRequest(enxovalId);
      applyWorkspace(workspace);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível abrir o enxoval.",
      );
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  const updateItem = async (id: string, updates: Partial<EnxovalItem>) => {
    const shouldOptimisticallyUpdate =
      Object.keys(updates).length === 1 && typeof updates.checked === "boolean";
    const previousItem = shouldOptimisticallyUpdate
      ? items.find((item) => item.id === id)
      : undefined;

    if (shouldOptimisticallyUpdate) {
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        ),
      );
    }

    const payload: Parameters<typeof updateItemRequest>[1] = {};
    if (typeof updates.name === "string") payload.name = updates.name;
    if (typeof updates.checked === "boolean") payload.checked = updates.checked;
    if (typeof updates.link === "string") payload.link = updates.link;
    if (typeof updates.description === "string")
      payload.description = updates.description;
    if (typeof updates.priceCents === "number" || updates.priceCents === null)
      payload.priceCents = updates.priceCents;
    if (typeof updates.categoryId === "string")
      payload.categoryId = updates.categoryId;

    if (Object.keys(payload).length === 0) return;

    try {
      const savedItem = await updateItemRequest(id, payload);
      setItems((current) =>
        current.map((item) => (item.id === id ? savedItem : item)),
      );
    } catch (err) {
      if (previousItem) {
        setItems((current) =>
          current.map((item) => (item.id === id ? previousItem : item)),
        );
      }
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar a alteração.",
      );
      throw err;
    }
  };

  const addItem = async (
    name: string,
    categoryId?: string,
    categoryName?: string,
  ) => {
    if (!activeEnxoval)
      throw new Error("Selecione um enxoval antes de adicionar itens.");

    const result = await createItemRequest({
      enxovalId: activeEnxoval.id,
      name,
      categoryId,
      categoryName,
    });

    setCategories((current) => {
      if (current.some((category) => category.id === result.category.id))
        return current;
      return [...current, result.category].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
    });

    setItems((current) => [...current, result.item]);
    setActiveCategoryId(result.category.id);
  };

  const openDeleteItem = (item: EnxovalItem) => {
    setDialogError("");
    setItemToDelete(item);
  };

  const openEditItem = (item: EnxovalItem) => {
    const nextCategoryId = categories.some(
      (category) => category.id === item.categoryId,
    )
      ? item.categoryId
      : categories[0]?.id || "";

    setDialogError("");
    setItemToEdit(item);
    setEditItemName(item.name);
    setEditItemLink(item.link);
    setEditItemDescription(item.description);
    setEditItemPriceText(formatOptionalCurrency(item.priceCents));
    setEditItemCategoryId(nextCategoryId);
  };

  const closeEditItem = () => {
    setDialogError("");
    setItemToEdit(null);
    setEditItemName("");
    setEditItemLink("");
    setEditItemDescription("");
    setEditItemPriceText("");
    setEditItemCategoryId("");
  };

  const handleEditItemPriceChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setEditItemPriceText(formatPriceInput(event.target.value));
  };

  const handleSaveItemDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemToEdit) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const nextName = editItemName.trim();
      if (!nextName) return;

      const nextLink = editItemLink.trim();
      const nextDescription = editItemDescription.trim();
      const nextPriceCents = priceTextToCents(editItemPriceText);
      const nextCategoryId = editItemCategoryId || itemToEdit.categoryId;

      await updateItem(itemToEdit.id, {
        name: nextName,
        link: nextLink,
        description: nextDescription,
        priceCents: nextPriceCents,
        categoryId: nextCategoryId,
      });

      closeEditItem();
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar os detalhes.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const deletedId = itemToDelete.id;
      await deleteItemRequest(deletedId);
      setItems((current) => current.filter((item) => item.id !== deletedId));
      setItemToDelete(null);
    } catch (err) {
      setDialogError(
        err instanceof Error ? err.message : "Não foi possível remover o item.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const handleSaveCategoryOrder = async () => {
    if (!activeEnxoval) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const reorderedCategories = await reorderCategoriesRequest(
        activeEnxoval.id,
        categoryOrder.map((category) => category.id),
      );
      setCategories(reorderedCategories);
      setCategoryOrder(reorderedCategories);

      if (
        !reorderedCategories.some(
          (category) => category.id === activeCategoryId,
        )
      ) {
        setActiveCategoryId(reorderedCategories[0]?.id || "");
      }

      setIsReorderCategoriesOpen(false);
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível reordenar as categorias.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const handleCreateCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeEnxoval) return;

    const name = newCategoryName.trim();
    if (!name) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const category = await createCategoryRequest(activeEnxoval.id, name);
      setCategories((current) => {
        const alreadyExists = current.some(
          (existing) => existing.id === category.id,
        );
        const nextCategories = alreadyExists
          ? current.map((existing) =>
              existing.id === category.id ? category : existing,
            )
          : [...current, category];

        return nextCategories.sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
      });
      setActiveCategoryId(category.id);
      setSearchQuery("");
      setNewCategoryName("");
      setIsCreateCategoryOpen(false);
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar a categoria.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const handleCreateEnxoval = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newEnxovalName.trim();
    if (!name) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const workspace = await createEnxovalRequest(
        name,
        newEnxovalUseDefaultTemplate,
      );
      setEnxovais((current) => [...current, workspace.enxoval]);
      applyWorkspace(workspace);
      setNewEnxovalName("");
      setNewEnxovalUseDefaultTemplate(true);
      setIsCreateEnxovalOpen(false);
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar o enxoval.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const handleRenameEnxoval = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeEnxoval) return;

    const name = renameEnxovalName.trim();
    if (!name) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const updatedEnxoval = await updateEnxovalRequest(activeEnxoval.id, name);
      setActiveEnxoval(updatedEnxoval);
      setEnxovais((current) =>
        current.map((enxoval) =>
          enxoval.id === updatedEnxoval.id ? updatedEnxoval : enxoval,
        ),
      );
      setRenameEnxovalName("");
      setIsRenameEnxovalOpen(false);
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível renomear o enxoval.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const handleDeleteEnxoval = async () => {
    if (!activeEnxoval) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const deletedId = activeEnxoval.id;
      await deleteEnxovalRequest(deletedId);

      const remainingEnxovais = enxovais.filter(
        (enxoval) => enxoval.id !== deletedId,
      );
      setEnxovais(remainingEnxovais);
      setIsDeleteEnxovalOpen(false);

      const nextEnxoval = remainingEnxovais[0];
      if (nextEnxoval) {
        const workspace = await fetchEnxovalRequest(nextEnxoval.id);
        applyWorkspace(workspace);
      } else {
        setActiveEnxoval(null);
        setMembers([]);
        setCategories([]);
        setItems([]);
        setActiveCategoryId("");
      }
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível excluir o enxoval.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };
  const handleInviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeEnxoval) return;

    const email = inviteEmail.trim();
    if (!email) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const member = await inviteMemberRequest(activeEnxoval.id, email);
      setMembers((current) =>
        current.some((existing) => existing.id === member.id)
          ? current
          : [...current, member],
      );
      setInviteEmail("");
      setIsInviteOpen(false);
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível convidar essa pessoa.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const openCreateEnxoval = () => {
    setDialogError("");
    setNewEnxovalName("");
    setNewEnxovalUseDefaultTemplate(true);
    setIsCreateEnxovalOpen(true);
  };

  const openCreateCategory = () => {
    setDialogError("");
    setNewCategoryName("");
    setIsCreateCategoryOpen(true);
  };

  const openReorderCategories = () => {
    setDialogError("");
    setCategoryOrder(categories);
    setIsReorderCategoriesOpen(true);
  };

  const openRenameEnxoval = () => {
    if (!activeEnxoval) return;
    setDialogError("");
    setRenameEnxovalName(activeEnxoval.name);
    setIsRenameEnxovalOpen(true);
  };

  const openDiscounts = () => {
    if (!activeEnxoval) return;
    setDialogError("");
    setDiscountOperation("add");
    setDiscountAdjustmentText("");
    setDiscountWorkingCents(
      normalizePriceCents(activeEnxoval.discountCents) ?? 0,
    );
    setIsDiscountsOpen(true);
  };

  const handleDiscountAdjustmentChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setDiscountAdjustmentText(formatPriceInput(event.target.value));
  };

  const handleApplyDiscountAdjustment = () => {
    if (discountAdjustmentCents <= 0) return;

    setDiscountWorkingCents((current) =>
      discountOperation === "add"
        ? current + discountAdjustmentCents
        : Math.max(0, current - discountAdjustmentCents),
    );
    setDiscountAdjustmentText("");
    discountAdjustmentInputRef.current?.focus({ preventScroll: true });
  };

  const handleSaveDiscounts = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeEnxoval) return;

    setIsDialogSubmitting(true);
    setDialogError("");

    try {
      const updatedEnxoval = await updateEnxovalRequest(activeEnxoval.id, {
        discountCents: discountWorkingCents,
      });
      setActiveEnxoval(updatedEnxoval);
      setEnxovais((current) =>
        current.map((enxoval) =>
          enxoval.id === updatedEnxoval.id ? updatedEnxoval : enxoval,
        ),
      );
      setDiscountAdjustmentText("");
      setIsDiscountsOpen(false);
    } catch (err) {
      setDialogError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar os descontos.",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const openDeleteEnxoval = () => {
    if (!activeEnxoval) return;
    setDialogError("");
    setIsDeleteEnxovalOpen(true);
  };

  const openInvite = () => {
    setDialogError("");
    setInviteEmail("");
    setIsInviteOpen(true);
  };

  const handleLogout = async () => {
    await logoutRequest().catch(() => undefined);
    window.history.replaceState({}, "", "/");
    setUser(null);
    setEnxovais([]);
    setActiveEnxoval(null);
    setIsRenameEnxovalOpen(false);
    setIsDeleteEnxovalOpen(false);
    setIsDiscountsOpen(false);
    setItemToDelete(null);
    closeEditItem();
    setMembers([]);
    setItems([]);
    setCategories([]);
    setActiveCategoryId("");
  };

  if (window.location.pathname === "/")
    return <LandingPage signedIn={Boolean(user)} />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans text-brand-dark flex items-center justify-center">
        <div className="text-center">
          <Brand />
          <p className="text-sm text-stone-500 font-medium">
            Carregando lista...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuthenticated={applyBootstrap}
        initialMode={
          window.location.pathname === "/signup" ? "register" : "login"
        }
      />
    );
  }

  return (
    <div
      className={`workspace-app workspace-view-${workspaceView} min-h-screen pb-24 font-sans text-brand-dark overscroll-y-contain`}
    >
      <a className="skip-link" href="#workspace-main">
        Pular para a lista
      </a>
      <div inert={isWorkspaceMenuOpen}>
        <aside className="workspace-sidebar">
          <a href="/" className="brand-link">
            <Brand />
          </a>
          <div className="workspace-picker">
            <span>MEU CANTINHO</span>
            <select
              aria-label="Selecionar enxoval"
              value={activeEnxoval?.id ?? ""}
              onChange={(e) => void handleEnxovalChange(e.target.value)}
              disabled={isWorkspaceLoading}
            >
              {!hasEnxoval && <option value="">Seu próximo começo</option>}
              {enxovais.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <nav
            className="workspace-navigation"
            aria-label="Navegação do enxoval"
          >
            <button
              className={workspaceView === "overview" ? "active" : ""}
              onClick={() => setWorkspaceView("overview")}
            >
              <LayoutDashboard size={18} /> Visão geral
            </button>
            <button
              className={workspaceView === "list" ? "active" : ""}
              onClick={() => setWorkspaceView("list")}
            >
              <ListChecks size={18} /> Meu enxoval <span>{items.length}</span>
            </button>
          </nav>
          <div className="sidebar-section-title">
            AMBIENTES{" "}
            <button
              aria-label="Adicionar categoria"
              onClick={openCreateCategory}
              disabled={!hasEnxoval}
            >
              <Plus size={16} />
            </button>
          </div>
          <nav className="sidebar-rooms" aria-label="Ambientes">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={
                  activeCategoryId === cat.id && workspaceView === "list"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setActiveCategoryId(cat.id);
                  setWorkspaceView("list");
                  setSearchQuery("");
                  setItemSortMode("name");
                }}
              >
                <RoomIcon name={cat.name} />
                <span>{cat.name}</span>
                <small>
                  {items.filter((i) => i.categoryId === cat.id).length}
                </small>
              </button>
            ))}
          </nav>
          <button
            className="sidebar-reorder"
            disabled={categories.length < 2}
            onClick={openReorderCategories}
          >
            <GripVertical size={14} /> Organizar ambientes
          </button>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <Sparkles size={20} />
              <strong>
                O próximo capítulo
                <br />
                tem a sua cara.
              </strong>
              <p>Uma conquista de cada vez.</p>
              <button onClick={openCreateEnxoval}>
                Criar outro enxoval <Plus size={15} />
              </button>
            </div>
            <div className="sidebar-profile">
              <span className="user-avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>
                  {isDemoMode() ? "Explorando a Larume" : user.email}
                </small>
              </span>
              <button onClick={handleLogout} aria-label="Sair">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        <div className="desktop-app-header">
          <span>
            Meu cantinho <ChevronRight size={14} />{" "}
            <h1>{activeEnxoval?.name ?? "Bem-vindo à Larume"}</h1>
          </span>
          <div>
            {hasEnxoval && (
              <>
                <span className="member-avatars">
                  {members.slice(0, 3).map((m) => (
                    <span title={m.name} key={m.id}>
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </span>
                <button
                  className="button button-outline button-small"
                  onClick={openInvite}
                >
                  <UserPlus size={16} /> Convidar
                </button>
              </>
            )}
            <button
              type="button"
              className="workspace-menu-trigger"
              aria-label="Abrir menu do enxoval"
              aria-expanded={isWorkspaceMenuOpen}
              aria-controls="workspace-menu"
              onClick={openWorkspaceMenu}
            >
              <Menu size={18} /> Menu
            </button>
          </div>
        </div>
        <div className="mobile-app-brand">
          <a href="/" className="brand-link">
            <Brand />
          </a>
          <span>Seu lar, tomando forma.</span>
        </div>
        {isDemoMode() && (
          <div className="demo-banner">
            <span>
              <Sparkles size={14} />
              <strong>Você está na demonstração.</strong>{" "}
              <span>Explore à vontade. Os dados ficam neste navegador.</span>
            </span>
            <a href="/signup">
              Criar minha conta <ArrowUpRight size={14} />
            </a>
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-1/2 top-3 z-50 sm:hidden transition-opacity duration-150"
          style={{
            opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
            transform: `translate(-50%, ${Math.max(0, pullDistance - 34)}px)`,
          }}
        >
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-wood shadow-md ring-1 ring-stone-200">
            <RefreshCw
              size={17}
              className={isRefreshing ? "animate-spin" : ""}
              style={
                isRefreshing
                  ? undefined
                  : { transform: `rotate(${pullDistance * 3}deg)` }
              }
            />
          </div>
        </div>
        <header
          className="mobile-workspace-header mobile-header-clean sticky top-0 z-20"
          style={headerStyle}
        >
          <div className="mobile-header-title-row">
            <div className="mobile-header-title">
              <div className="mobile-header-eyebrow" style={eyebrowStyle}>
                ENXOVAL COMPARTILHADO
              </div>
              <h1 style={titleStyle}>{activeEnxoval?.name ?? "Meu enxoval"}</h1>
              {hasEnxoval && workspaceView === "list" && (
                <div
                  className="mobile-header-collapsed-spent"
                  style={totalSpentTitleStyle}
                >
                  Total gasto <strong>{checkedTotalSpentText}</strong>
                </div>
              )}
            </div>
            <button
              type="button"
              className="workspace-menu-trigger workspace-menu-trigger-icon"
              aria-label="Abrir menu do enxoval"
              aria-expanded={isWorkspaceMenuOpen}
              aria-controls="workspace-menu"
              onClick={openWorkspaceMenu}
            >
              <Menu size={26} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          {hasEnxoval && (
            <div className="mobile-header-summary" style={metaStyle}>
              <span>
                <strong>{progressStats.percentage}%</strong> conquistado
              </span>
              {workspaceView === "list" && (
                <span>
                  Total gasto <strong>{checkedTotalSpentText}</strong>
                </span>
              )}
            </div>
          )}
          {hasEnxoval && workspaceView === "list" && (
            <>
              <div
                className="max-w-2xl mx-auto mt-5 sm:mt-6 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto no-scrollbar transition-[margin] duration-300 ease-out"
                style={categoryBarStyle}
              >
                <div className="flex w-max min-w-full items-center gap-2 pb-2">
                  {categories.map((cat) => {
                    const catItems = items.filter(
                      (i) => i.categoryId === cat.id,
                    );
                    const catCompleted = catItems.filter(
                      (i) => i.checked,
                    ).length;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategoryId(cat.id);
                          setWorkspaceView("list");
                        }}
                        style={categoryButtonStyle}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out flex items-center gap-2 ${
                          activeCategory?.id === cat.id
                            ? "bg-brand-wood text-white shadow-md"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {cat.name}
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${activeCategory?.id === cat.id ? "bg-white/20" : "bg-stone-200"}`}
                        >
                          {catCompleted}/{catItems.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </header>

        <main id="workspace-main" className="workspace-main">
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {isWorkspaceLoading && (
            <div className="mb-4 text-sm text-stone-500 bg-white border border-stone-200 rounded-lg px-3 py-2">
              Carregando enxoval...
            </div>
          )}

          {hasEnxoval && (
            <WorkspaceOverview
              items={items}
              categories={categories}
              name={activeEnxoval!.name}
              discountCents={enxovalDiscountCents}
              view={workspaceView}
              onCategory={(id) => {
                setActiveCategoryId(id);
                setWorkspaceView("list");
                setSearchQuery("");
                setItemSortMode("name");
              }}
              onInvite={openInvite}
              onAdd={() => setIsAddModalOpen(true)}
            />
          )}
          {hasEnxoval && workspaceView === "list" ? (
            <>
              <div className="list-section-heading">
                <div>
                  <RoomIcon name={activeCategory?.name ?? ""} size={24} />
                  <h2>
                    {isSearching
                      ? "Sua busca"
                      : isShowingLatestChanges
                        ? "Últimas alterações"
                        : (activeCategory?.name ?? "Meu enxoval")}
                  </h2>
                  <span>{filteredItems.length} itens</span>
                </div>
                <button
                  className="button button-dark button-small desktop-add-item"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <Plus size={17} /> Adicionar item
                </button>
              </div>
              <div className="list-search mb-4 flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    type="search"
                    aria-label="Buscar em todas as categorias"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar em todas as categorias"
                    className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-11 text-base text-stone-800 shadow-sm outline-none transition focus:border-brand-wood focus:ring-2 focus:ring-brand-wood/30"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Limpar busca"
                      title="Limpar busca"
                      className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(true)}
                  aria-label="Abrir filtros"
                  title="Filtros"
                  className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-stone-600 shadow-sm transition-colors ${activeFilterCount > 0 ? "border-brand-beige bg-brand-beige/20 text-brand-dark" : "border-stone-200 bg-white hover:bg-stone-50"}`}
                >
                  <SlidersHorizontal size={18} />
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-wood px-1 text-[11px] font-bold leading-none text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              <div
                onPointerDown={handleCategoryListPointerDown}
                onPointerMove={handleCategoryListPointerMove}
                onPointerUp={handleCategoryListPointerEnd}
                onPointerCancel={handleCategoryListPointerCancel}
                className={
                  canSwipeCategories
                    ? "cursor-grab active:cursor-grabbing"
                    : undefined
                }
                style={{
                  touchAction: canSwipeCategories ? "pan-y" : undefined,
                }}
              >
                <div
                  className={`category-list-swipe ${categorySwipeAnimationClass}`}
                  style={categorySwipeStyle}
                >
                  <div className="mb-4 flex items-center justify-between gap-3 text-sm text-stone-500 font-medium px-1">
                    <span className="min-w-0 truncate">{listTitle}</span>
                    <span className="shrink-0">{listCounterText}</span>
                  </div>

                  <div className="space-y-1">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          categoryName={
                            showItemCategory
                              ? (categoryById.get(item.categoryId)?.name ??
                                item.category)
                              : undefined
                          }
                          showUpdatedAt={isShowingLatestChanges}
                          updatedAtLabel={formatUpdatedAt(item.updatedAt)}
                          onUpdate={updateItem}
                          onDelete={openDeleteItem}
                          onEdit={openEditItem}
                        />
                      ))
                    ) : (
                      <div className="text-center py-12 px-4">
                        <Sparkles className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                        <h3 className="text-lg font-serif text-stone-600 mb-2">
                          {isSearching
                            ? "Nenhum resultado"
                            : activeFilterCount > 0
                              ? "Nenhum item encontrado"
                              : "Nenhum item aqui"}
                        </h3>
                        <p className="text-sm text-stone-400">
                          {isSearching
                            ? "Tente buscar por outro nome, detalhe ou categoria."
                            : activeFilterCount > 0
                              ? "Ajuste os filtros para ver mais itens."
                              : `Toque no botão abaixo para adicionar itens à categoria ${activeCategory?.name ?? "selecionada"}.`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : !hasEnxoval ? (
            <div className="min-h-[45vh] flex items-center justify-center px-2">
              <div className="text-center max-w-sm">
                <Home className="w-12 h-12 text-brand-wood mx-auto mb-4" />
                <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">
                  Crie seu primeiro enxoval
                </h2>
                <p className="text-sm text-stone-500 mb-6">
                  Comece com a lista sugerida ou monte uma lista vazia.
                </p>
                <button
                  type="button"
                  onClick={openCreateEnxoval}
                  className="inline-flex items-center justify-center gap-2 bg-brand-dark text-white rounded-xl px-5 py-3 text-base font-medium hover:bg-black transition-colors"
                >
                  <ListPlus size={18} />
                  Criar enxoval
                </button>
              </div>
            </div>
          ) : null}
        </main>

        {hasEnxoval && (
          <div className="mobile-add-item fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-brand-dark text-white rounded-full pl-4 pr-5 py-3 shadow-lg shadow-brand-dark/30 flex items-center gap-2 hover:bg-black transition-transform hover:scale-105 active:scale-95"
            >
              <div className="bg-white/20 rounded-full p-1">
                <Plus size={20} strokeWidth={2.5} />
              </div>
              <span className="font-medium">Adicionar item</span>
            </button>
          </div>
        )}

        <nav className="mobile-bottom-nav" aria-label="Navegação do aplicativo">
          <button
            className={
              !isInviteOpen && workspaceView === "overview" ? "active" : ""
            }
            aria-current={
              !isInviteOpen && workspaceView === "overview" ? "page" : undefined
            }
            onClick={() => {
              setWorkspaceView("overview");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <LayoutDashboard size={19} />
            Visão geral
          </button>
          <button
            className={
              !isInviteOpen && workspaceView === "list" ? "active" : ""
            }
            aria-current={
              !isInviteOpen && workspaceView === "list" ? "page" : undefined
            }
            onClick={() => setWorkspaceView("list")}
          >
            <ListChecks size={19} />
            Meu enxoval
          </button>
          <button
            className={isInviteOpen ? "active" : ""}
            aria-haspopup="dialog"
            aria-expanded={isInviteOpen}
            onClick={openInvite}
            disabled={!hasEnxoval}
          >
            <Users size={19} />
            Compartilhar
          </button>
        </nav>
      </div>
      <WorkspaceMenu
        open={isWorkspaceMenuOpen}
        onClose={() => setIsWorkspaceMenuOpen(false)}
        triggerRef={menuTriggerRef}
        user={user}
        enxovais={enxovais}
        activeEnxoval={activeEnxoval}
        memberCount={members.length}
        categoryCount={categories.length}
        busy={isWorkspaceLoading}
        refreshing={isRefreshing}
        onSwitch={(id) => void handleEnxovalChange(id)}
        onCreate={openCreateEnxoval}
        onInvite={openInvite}
        onDiscounts={openDiscounts}
        onRename={openRenameEnxoval}
        onDelete={openDeleteEnxoval}
        onAddCategory={openCreateCategory}
        onReorder={openReorderCategories}
        onRefresh={() => void handleRefresh()}
        onLogout={() => void handleLogout()}
      />
      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addItem}
        defaultCategoryId={activeCategory?.id ?? ""}
        categories={categories}
      />

      <Dialog
        title="Filtros da lista"
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      >
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-stone-700">
              Mostrar
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setShowOnlyPricedItems(false);
                  setShowOnlyCheckedItems(false);
                }}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${!hasItemFilters ? "border-brand-wood bg-brand-beige/20 text-brand-dark" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyPricedItems((current) => !current)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${showOnlyPricedItems ? "border-brand-wood bg-brand-beige/20 text-brand-dark" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Com preço
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyCheckedItems((current) => !current)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${showOnlyCheckedItems ? "border-brand-wood bg-brand-beige/20 text-brand-dark" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Checados
              </button>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-stone-700">
              Ordenar
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setItemSortMode("name")}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${itemSortMode === "name" ? "border-brand-wood bg-brand-beige/20 text-brand-dark" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Nome A-Z
              </button>
              <button
                type="button"
                onClick={() => setItemSortMode("updated")}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${itemSortMode === "updated" ? "border-brand-wood bg-brand-beige/20 text-brand-dark" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                Últimas alterações
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowOnlyPricedItems(false);
                setShowOnlyCheckedItems(false);
                setItemSortMode("name");
              }}
              disabled={activeFilterCount === 0}
              className="rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="rounded-xl bg-brand-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              Concluir
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        title="Reordenar categorias"
        busy={isDialogSubmitting}
        isOpen={isReorderCategoriesOpen}
        onClose={() => setIsReorderCategoriesOpen(false)}
      >
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
          <Reorder.Group
            axis="y"
            values={categoryOrder}
            onReorder={setCategoryOrder}
            className="space-y-2"
          >
            {categoryOrder.map((category, categoryIndex) => {
              const categoryItems = items.filter(
                (item) => item.categoryId === category.id,
              );

              return (
                <Reorder.Item
                  key={category.id}
                  value={category}
                  className="flex cursor-grab items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-3 text-stone-800 shadow-sm active:cursor-grabbing"
                  style={{ touchAction: "none" }}
                >
                  <GripVertical size={18} className="shrink-0 text-stone-400" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {category.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-500">
                    {categoryItems.length}
                  </span>
                  <button
                    type="button"
                    aria-label={`Mover ${category.name} para cima`}
                    disabled={categoryIndex === 0}
                    className="icon-button"
                    onClick={() =>
                      setCategoryOrder((current) => {
                        const next = [...current];
                        [next[categoryIndex - 1], next[categoryIndex]] = [
                          next[categoryIndex],
                          next[categoryIndex - 1],
                        ];
                        return next;
                      })
                    }
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover ${category.name} para baixo`}
                    disabled={categoryIndex === categoryOrder.length - 1}
                    className="icon-button"
                    onClick={() =>
                      setCategoryOrder((current) => {
                        const next = [...current];
                        [next[categoryIndex + 1], next[categoryIndex]] = [
                          next[categoryIndex],
                          next[categoryIndex + 1],
                        ];
                        return next;
                      })
                    }
                  >
                    <ArrowDown size={15} />
                  </button>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsReorderCategoriesOpen(false)}
              disabled={isDialogSubmitting}
              className="py-4 bg-stone-100 text-stone-700 rounded-xl font-medium text-base hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSaveCategoryOrder()}
              disabled={isDialogSubmitting || !activeEnxoval}
              className="py-4 bg-brand-dark text-white rounded-xl font-medium text-base hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDialogSubmitting ? "Salvando..." : "Salvar ordem"}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        title="Nova categoria"
        busy={isDialogSubmitting}
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
      >
        <form
          onSubmit={handleCreateCategory}
          className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nome da categoria
            </label>
            <input
              type="text"
              aria-label="Nome da categoria"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Ex: Escritório"
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
            />
          </div>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <button
            type="submit"
            disabled={
              !newCategoryName.trim() || isDialogSubmitting || !activeEnxoval
            }
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-medium text-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDialogSubmitting ? "Criando..." : "Criar categoria"}
          </button>
        </form>
      </Dialog>

      <Dialog
        title="Novo enxoval"
        busy={isDialogSubmitting}
        isOpen={isCreateEnxovalOpen}
        onClose={() => setIsCreateEnxovalOpen(false)}
      >
        <form
          onSubmit={handleCreateEnxoval}
          className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nome do enxoval
            </label>
            <input
              type="text"
              aria-label="Nome do enxoval"
              value={newEnxovalName}
              onChange={(event) => setNewEnxovalName(event.target.value)}
              placeholder="Ex: Apartamento novo"
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Modelo inicial
            </label>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setNewEnxovalUseDefaultTemplate(true)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${newEnxovalUseDefaultTemplate ? "bg-white text-brand-dark shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
              >
                Lista sugerida
              </button>
              <button
                type="button"
                onClick={() => setNewEnxovalUseDefaultTemplate(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${!newEnxovalUseDefaultTemplate ? "bg-white text-brand-dark shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
              >
                Vazio
              </button>
            </div>
          </div>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <button
            type="submit"
            disabled={!newEnxovalName.trim() || isDialogSubmitting}
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-medium text-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDialogSubmitting ? "Criando..." : "Criar enxoval"}
          </button>
        </form>
      </Dialog>

      <Dialog
        title="Descontos e cashback"
        busy={isDialogSubmitting}
        isOpen={isDiscountsOpen}
        onClose={() => setIsDiscountsOpen(false)}
      >
        <form
          onSubmit={handleSaveDiscounts}
          className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Operação
            </label>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setDiscountOperation("add")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${discountOperation === "add" ? "bg-white text-brand-dark shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
              >
                Somar
              </button>
              <button
                type="button"
                onClick={() => setDiscountOperation("subtract")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${discountOperation === "subtract" ? "bg-white text-brand-dark shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
              >
                Subtrair
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Valor do ajuste
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={discountAdjustmentInputRef}
                type="text"
                inputMode="numeric"
                aria-label="Valor do ajuste"
                value={discountAdjustmentText}
                onChange={handleDiscountAdjustmentChange}
                placeholder="R$ 0,00"
                className="min-w-0 flex-1 px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
              />
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleApplyDiscountAdjustment}
                disabled={discountAdjustmentCents <= 0}
                aria-label={
                  discountOperation === "add"
                    ? "Somar ajuste na prévia"
                    : "Subtrair ajuste da prévia"
                }
                title={
                  discountOperation === "add"
                    ? "Somar ajuste na prévia"
                    : "Subtrair ajuste da prévia"
                }
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${discountOperation === "add" ? "bg-brand-wood hover:bg-brand-wood/90" : "bg-stone-700 hover:bg-stone-800"}`}
              >
                {discountOperation === "add" ? (
                  <Plus size={20} />
                ) : (
                  <Minus size={20} />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span>Subtotal marcado</span>
              <strong className="text-stone-800">
                {checkedSubtotalSpentText}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Desconto atual</span>
              <strong className="text-brand-wood">- {savedDiscountText}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>
                {discountOperation === "add"
                  ? "Ajuste para somar"
                  : "Ajuste para subtrair"}
              </span>
              <strong
                className={
                  discountOperation === "add"
                    ? "text-brand-wood"
                    : "text-stone-700"
                }
              >
                {discountOperation === "add" ? "+ " : "- "}
                {discountAdjustmentPreviewText}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-2">
              <span>Novo desconto total</span>
              <strong className="text-brand-wood">
                - {workingDiscountText}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-2">
              <span>Total gasto</span>
              <strong className="text-stone-900">
                {discountPreviewTotalText}
              </strong>
            </div>
          </div>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <button
            type="submit"
            disabled={
              isDialogSubmitting ||
              !activeEnxoval ||
              discountWorkingCents === enxovalDiscountCents
            }
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-medium text-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDialogSubmitting ? "Salvando..." : "Salvar ajuste"}
          </button>
        </form>
      </Dialog>
      <Dialog
        title="Editar enxoval"
        busy={isDialogSubmitting}
        isOpen={isRenameEnxovalOpen}
        onClose={() => setIsRenameEnxovalOpen(false)}
      >
        <form
          onSubmit={handleRenameEnxoval}
          className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nome do enxoval
            </label>
            <input
              type="text"
              aria-label="Nome do enxoval"
              value={renameEnxovalName}
              onChange={(event) => setRenameEnxovalName(event.target.value)}
              placeholder="Ex: Apartamento novo"
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
            />
          </div>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <button
            type="submit"
            disabled={!renameEnxovalName.trim() || isDialogSubmitting}
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-medium text-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDialogSubmitting ? "Salvando..." : "Salvar nome"}
          </button>
        </form>
      </Dialog>

      <Dialog
        title="Excluir enxoval"
        busy={isDialogSubmitting}
        tone="danger"
        isOpen={isDeleteEnxovalOpen}
        onClose={() => setIsDeleteEnxovalOpen(false)}
      >
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
          <p className="text-sm text-stone-600">
            Esta ação vai excluir o enxoval{" "}
            {activeEnxoval ? `"${activeEnxoval.name}"` : ""}, incluindo
            categorias, itens e colaboradores.
          </p>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsDeleteEnxovalOpen(false)}
              data-dialog-autofocus
              disabled={isDialogSubmitting}
              className="py-4 bg-stone-100 text-stone-700 rounded-xl font-medium text-base hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteEnxoval()}
              disabled={isDialogSubmitting || !activeEnxoval}
              className="py-4 bg-red-600 text-white rounded-xl font-medium text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDialogSubmitting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        title="Editar item"
        busy={isDialogSubmitting}
        isOpen={Boolean(itemToEdit)}
        onClose={closeEditItem}
      >
        <form
          onSubmit={handleSaveItemDetails}
          className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nome do item
            </label>
            <input
              type="text"
              aria-label="Nome do item"
              value={editItemName}
              onChange={(event) => setEditItemName(event.target.value)}
              placeholder="Ex: Jogo de Taças"
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Categoria
            </label>
            <select
              aria-label="Categoria"
              value={editItemCategoryId}
              onChange={(event) => setEditItemCategoryId(event.target.value)}
              disabled={categories.length === 0}
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood bg-white disabled:bg-stone-100 disabled:text-stone-400"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Link do produto
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                aria-label="Link do produto"
                value={editItemLink}
                onChange={(event) => setEditItemLink(event.target.value)}
                placeholder="https://..."
                className="flex-1 min-w-0 px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
              />
              {editItemProductUrl && (
                <a
                  href={editItemProductUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-wood text-white transition-colors hover:bg-brand-wood/90"
                  aria-label="Abrir link do produto"
                  title="Abrir link do produto"
                >
                  <ExternalLink size={18} />
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Preço
            </label>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Preço"
              value={editItemPriceText}
              onChange={handleEditItemPriceChange}
              placeholder="R$ 0,00"
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Detalhes / Descrição
            </label>
            <textarea
              aria-label="Detalhes / Descrição"
              value={editItemDescription}
              onChange={(event) => setEditItemDescription(event.target.value)}
              placeholder="Ex: Comprar na cor branca, voltagem 110 V..."
              rows={3}
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood resize-none"
            />
          </div>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <button
            type="submit"
            disabled={
              isDialogSubmitting ||
              !itemToEdit ||
              !editItemName.trim() ||
              !editItemCategoryId
            }
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-medium text-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDialogSubmitting ? "Salvando..." : "Salvar detalhes"}
          </button>
        </form>
      </Dialog>
      <Dialog
        title="Excluir item"
        busy={isDialogSubmitting}
        tone="danger"
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
      >
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
          <p className="text-sm text-stone-600">
            Esta ação vai remover o item{" "}
            {itemToDelete ? `"${itemToDelete.name}"` : ""} da lista.
          </p>

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setItemToDelete(null)}
              data-dialog-autofocus
              disabled={isDialogSubmitting}
              className="py-4 bg-stone-100 text-stone-700 rounded-xl font-medium text-base hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteItem()}
              disabled={isDialogSubmitting || !itemToDelete}
              className="py-4 bg-red-600 text-white rounded-xl font-medium text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDialogSubmitting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        title="Convidar pessoa"
        busy={isDialogSubmitting}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      >
        <form
          onSubmit={handleInviteMember}
          className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              E-mail da pessoa
            </label>
            <input
              type="email"
              aria-label="E-mail da pessoa"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="pessoa@email.com"
              className="w-full px-4 py-3 text-base border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-wood/50 focus:border-brand-wood"
            />
          </div>

          {members.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm border-b border-stone-100 last:border-0"
                >
                  <span className="truncate text-stone-700">
                    {member.email}
                  </span>
                  <span className="text-xs font-medium text-stone-400">
                    {member.role === "owner" ? "dono" : "editor"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {dialogError && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {dialogError}
            </p>
          )}

          <button
            type="submit"
            disabled={
              !inviteEmail.trim() || isDialogSubmitting || !activeEnxoval
            }
            className="w-full py-4 bg-brand-dark text-white rounded-xl font-medium text-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDialogSubmitting ? "Convidando..." : "Convidar"}
          </button>
        </form>
      </Dialog>
    </div>
  );
}
