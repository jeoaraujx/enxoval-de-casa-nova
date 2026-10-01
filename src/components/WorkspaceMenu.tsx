import type { RefObject } from "react";
import {
  Home,
  Plus,
  UserPlus,
  Percent,
  Pencil,
  Trash2,
  RefreshCw,
  GripVertical,
  LogOut,
  X,
  ChevronRight,
  Users,
} from "lucide-react";
import type { AuthUser, EnxovalSummary } from "../types";
import { useDialogAccessibility } from "../hooks/useDialogAccessibility";

interface WorkspaceMenuProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  user: AuthUser;
  enxovais: EnxovalSummary[];
  activeEnxoval: EnxovalSummary | null;
  memberCount: number;
  categoryCount: number;
  busy: boolean;
  refreshing: boolean;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onInvite: () => void;
  onDiscounts: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAddCategory: () => void;
  onReorder: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export function WorkspaceMenu(props: WorkspaceMenuProps) {
  const ref = useDialogAccessibility(
    props.open,
    props.onClose,
    props.triggerRef,
  );
  if (!props.open) return null;
  const hasEnxoval = Boolean(props.activeEnxoval);
  const run = (action: () => void) => {
    props.onClose();
    action();
  };
  const actions = [
    { label: "Convidar pessoas", icon: UserPlus, action: props.onInvite },
    { label: "Descontos e cashback", icon: Percent, action: props.onDiscounts },
    { label: "Adicionar categoria", icon: Plus, action: props.onAddCategory },
    {
      label: "Reordenar categorias",
      icon: GripVertical,
      action: props.onReorder,
      disabled: props.categoryCount < 2,
    },
    ...(props.activeEnxoval?.role === "owner"
      ? [
          {
            label: "Editar nome do enxoval",
            icon: Pencil,
            action: props.onRename,
          },
        ]
      : []),
    {
      label: "Atualizar enxoval",
      icon: RefreshCw,
      action: props.onRefresh,
      disabled: props.refreshing,
      spinning: props.refreshing,
    },
  ];
  return (
    <div className="workspace-menu-layer">
      <div
        className="workspace-menu-backdrop"
        onClick={props.onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        id="workspace-menu"
        className="workspace-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-menu-title"
        tabIndex={-1}
      >
        <div className="workspace-menu-heading">
          <div>
            <span className="workspace-menu-eyebrow">SEU CANTINHO</span>
            <h2 id="workspace-menu-title">Menu do enxoval</h2>
          </div>
          <button
            type="button"
            className="workspace-menu-close"
            aria-label="Fechar menu do enxoval"
            onClick={props.onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-menu-content">
          <section
            className="workspace-menu-switcher"
            aria-label="Seus enxovais"
          >
            <label htmlFor="menu-enxoval">
              <Home size={17} /> Seus enxovais
            </label>
            {props.enxovais.length > 0 ? (
              <select
                id="menu-enxoval"
                value={props.activeEnxoval?.id ?? ""}
                disabled={props.busy}
                onChange={(event) =>
                  run(() => props.onSwitch(event.target.value))
                }
              >
                {props.enxovais.map((enxoval) => (
                  <option key={enxoval.id} value={enxoval.id}>
                    {enxoval.name}
                  </option>
                ))}
              </select>
            ) : (
              <p>Vamos começar seu primeiro enxoval?</p>
            )}
            {hasEnxoval && (
              <p>
                <Users size={14} /> {props.memberCount}{" "}
                {props.memberCount === 1
                  ? "pessoa organizando"
                  : "pessoas organizando"}
              </p>
            )}
            <button
              type="button"
              className="workspace-menu-create"
              disabled={props.busy}
              onClick={() => run(props.onCreate)}
            >
              <Plus size={17} /> Criar novo enxoval
            </button>
          </section>
          {hasEnxoval && (
            <section
              className="workspace-menu-actions"
              aria-label="Organizar enxoval"
            >
              <h3>Organizar enxoval</h3>
              {actions.map(
                ({ label, icon: Icon, action, disabled, spinning }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={props.busy || disabled}
                    onClick={() => run(action)}
                  >
                    <Icon
                      size={19}
                      className={spinning ? "animate-spin" : ""}
                    />
                    <span>{label}</span>
                    <ChevronRight size={16} />
                  </button>
                ),
              )}
            </section>
          )}
          {props.activeEnxoval?.role === "owner" && (
            <div className="workspace-menu-danger">
              <button
                type="button"
                disabled={props.busy}
                onClick={() => run(props.onDelete)}
              >
                <Trash2 size={18} /> Excluir enxoval
              </button>
              <p>Você confirma antes de excluir.</p>
            </div>
          )}
        </div>
        <div className="workspace-menu-account">
          <span className="workspace-menu-avatar">
            {props.user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{props.user.name}</strong>
            <span>{props.user.email}</span>
          </div>
          <button type="button" onClick={() => run(props.onLogout)}>
            <LogOut size={17} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
