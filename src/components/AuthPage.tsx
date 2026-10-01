import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Heart,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { login, register } from "../api";
import type { BootstrapData } from "../types";
import { Brand } from "./Brand";

export function AuthPage({
  onAuthenticated,
  initialMode = "login",
}: {
  onAuthenticated: (
    data: BootstrapData,
    options?: { promptCreateEnxoval?: boolean },
  ) => void;
  initialMode?: "login" | "register";
}) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    document.title = `${mode === "login" ? "Entre, a casa é sua" : "Seu novo começo"} | Larumi`;
  }, [mode]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const data =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(name.trim(), email.trim(), password);
      window.history.replaceState({}, "", "/app");
      onAuthenticated(data, {
        promptCreateEnxoval: mode === "register" && data.enxovais.length === 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <img
          src="/images/larumi-home.webp"
          alt="Seu próximo lar, acolhedor e cheio de possibilidades"
        />
        <div className="auth-story-top">
          <a href="/" className="brand-link">
            <Brand light />
          </a>
          <span>SEU LAR COMEÇA AQUI</span>
        </div>
        <div className="auth-story-copy">
          <Heart size={28} strokeWidth={1.2} />
          <h2>
            O melhor de uma
            <br />
            casa é o que você
            <br />
            <em>vai viver nela.</em>
          </h2>
          <p>
            Organize os detalhes.
            <br />
            Abra espaço para as histórias.
          </p>
          <div className="auth-story-tags">
            <span>
              <Check size={14} /> Planeje com calma
            </span>
            <span>
              <Check size={14} /> Conquiste junto
            </span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <a href="/" className="auth-back">
          <ArrowLeft size={16} /> Voltar ao início
        </a>
        <div className="auth-form-wrap">
          <a href="/" className="brand-link auth-mobile-brand">
            <Brand />
          </a>
          <span className="eyebrow">UM CANTINHO PARA OS SEUS PLANOS</span>
          <h1>
            {mode === "login"
              ? "Entre, a casa é sua."
              : "Todo lar tem um começo."}
          </h1>
          <p>
            {mode === "login"
              ? "Seu próximo capítulo está esperando por você."
              : "Crie sua conta e comece a dar forma ao seu novo lar."}
          </p>
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Entrar
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Criar conta
            </button>
          </div>
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && (
              <label htmlFor="auth-name">
                Como podemos te chamar?
                <input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            <label htmlFor="auth-email">
              Seu e-mail
              <input
                type="email"
                id="auth-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
                required
              />
            </label>
            <label htmlFor="auth-password">
              Sua senha
              <span className="password-field">
                <input
                  type={visible ? "text" : "password"}
                  id="auth-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "register"
                      ? "Crie uma senha com 6 ou mais caracteres"
                      : "Digite sua senha"
                  }
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "register" ? 6 : undefined}
                  required
                />
                <button
                  type="button"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="button button-dark"
            >
              {submitting ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : mode === "login" ? (
                "Entrar no meu enxoval"
              ) : (
                "Criar minha conta"
              )}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>
          <div className="auth-divider">
            <span>ou conheça antes de começar</span>
          </div>
          <a href="/demo" className="button button-outline">
            Explorar a demonstração <ArrowUpIcon />
          </a>
          <p className="auth-note">
            <ShieldCheck size={15} /> Sem cartão de crédito. No seu tempo.
          </p>
        </div>
        <span className="auth-bottom">
          Pequenos planos. Grandes começos. <Heart size={12} />
        </span>
      </section>
    </main>
  );
}
function ArrowUpIcon() {
  return <ArrowRight size={16} />;
}
