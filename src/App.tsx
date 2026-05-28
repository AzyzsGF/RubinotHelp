import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlarmClock,
  Bell,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gavel,
  Home,
  LogIn,
  LogOut,
  MessageCircle,
  PackageOpen,
  Pencil,
  Pickaxe,
  Play,
  Plus,
  Save,
  Search,
  Shield,
  Skull,
  Sparkles,
  ScrollText,
  Swords,
  TimerReset,
  Trash2,
  Trophy,
  Upload,
  UserRound,
  X
} from "lucide-react";
import clsx from "clsx";
import {
  BossCheckin,
  BossDraft,
  BossRecord,
  Profile,
  ToastMessage,
  ViewKey
} from "./types";
import {
  cancelCheckin,
  createBossCheckin,
  deactivateBoss,
  getAuthState,
  listBosses,
  listUserCheckins,
  markBrowserNotified,
  saveBoss,
  signIn,
  signOut,
  signUp,
  updateProfile,
  uploadBossImage,
  usingDemoBackend
} from "./lib/dataClient";
import { HERO_IMAGE } from "./lib/demoData";
import {
  calculateStaminaProjection,
  formatStamina,
  getStaminaBand,
  REGEN_RATES,
  RegenMode,
  STAMINA_TARGETS,
  StaminaTarget,
  toStaminaMinutes
} from "./lib/stamina";
import { createId, formatDateTime, formatDuration, minutesUntil } from "./lib/time";

const emptyBossDraft: BossDraft = {
  name: "",
  type: "boss",
  image_url: HERO_IMAGE,
  hp: 0,
  mana: 0,
  weaknesses: [],
  damage_types: [],
  mechanics: "",
  access_notes: "",
  recommended_equipment: "",
  cooldown_minutes: 20 * 60,
  youtube_url: "",
  is_active: true
};

type SidebarItem = {
  key?: ViewKey;
  label: string;
  icon: typeof Activity;
  badge?: string;
  href?: string;
  disabled?: boolean;
};

const viewTitles: Record<ViewKey, string> = {
  home: "Início",
  stamina: "Stamina",
  bestiary: "Boss Tracker",
  cooldowns: "Task Delivery",
  profile: "Perfil",
  admin: "Admin"
};

const sidebarSections: Array<{ title: string; items: SidebarItem[] }> = [
  {
    title: "Principal",
    items: [
      { key: "home", label: "Início", icon: Home },
      { key: "bestiary", label: "Boss Tracker", icon: Skull, badge: "NEW" },
      { key: "cooldowns", label: "Task Delivery", icon: ScrollText },
      { label: "Rubinot Ring", icon: Swords, disabled: true },
      { label: "Leilões de Personagens", icon: Gavel, disabled: true },
      { label: "Hall da Fama", icon: Trophy, disabled: true }
    ]
  },
  {
    title: "Ferramentas",
    items: [
      { key: "stamina", label: "Stamina", icon: Clock3 },
      { label: "Calculadora de Skills", icon: Calculator, disabled: true },
      { label: "Otimizador de Charms", icon: Sparkles, disabled: true },
      { label: "Forja de Exaltação", icon: Pickaxe, disabled: true },
      { label: "Divisor de Loot", icon: PackageOpen, disabled: true },
      { label: "Cronômetro", icon: AlarmClock, disabled: true }
    ]
  },
  {
    title: "Comunidade",
    items: [
      { label: "Rubinot Wiki", icon: BookOpen, href: "https://rubinot.com.br/news" },
      { key: "profile", label: "Entre em contato", icon: MessageCircle },
      { key: "admin", label: "Painel Admin", icon: Shield }
    ]
  }
];

function splitTags(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTags(value: string[]) {
  return value.join(", ");
}

function playAlertTone() {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.setValueAtTime(660, context.currentTime + 0.18);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.42);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.45);
}

export default function App() {
  const [view, setView] = useState<ViewKey>("home");
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bosses, setBosses] = useState<BossRecord[]>([]);
  const [checkins, setCheckins] = useState<BossCheckin[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = createId("toast");
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const auth = await getAuthState();
      setUser(auth.user);
      setProfile(auth.profile);
      const bossList = await listBosses(Boolean(auth.profile?.is_admin));
      setBosses(bossList);

      if (auth.user) {
        setCheckins(await listUserCheckins(auth.user.id));
      } else {
        setCheckins([]);
      }
    } catch (error) {
      pushToast({
        title: "Falha ao carregar",
        detail: error instanceof Error ? error.message : "Tente novamente.",
        tone: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const due = checkins.filter(
      (checkin) =>
        !checkin.browser_notified_at && new Date(checkin.cooldown_ends_at).getTime() <= Date.now()
    );

    due.forEach((checkin) => {
      const seenKey = `rubinot-help:browser-alert:${checkin.id}`;
      if (localStorage.getItem(seenKey)) {
        return;
      }

      localStorage.setItem(seenKey, "1");
      playAlertTone();
      pushToast({
        title: "Boss pronto",
        detail: `${checkin.boss?.name ?? "Boss"} saiu do cooldown.`,
        tone: "success"
      });
      markBrowserNotified(checkin.id)
        .then(() => {
          setCheckins((current) =>
            current.map((item) =>
              item.id === checkin.id
                ? { ...item, browser_notified_at: new Date().toISOString() }
                : item
            )
          );
        })
        .catch(() => undefined);
    });
  }, [checkins, pushToast, user, clock]);

  async function handleSignIn(email: string, password: string) {
    const auth = await signIn(email, password);
    setUser(auth.user);
    setProfile(auth.profile);
    await refresh();
    pushToast({ title: "Login realizado", tone: "success" });
  }

  async function handleSignUp(email: string, password: string, nick: string) {
    const auth = await signUp(email, password, nick);
    setUser(auth.user);
    setProfile(auth.profile);
    await refresh();
    pushToast({ title: "Conta criada", tone: "success" });
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setProfile(null);
    setCheckins([]);
    setView("home");
    pushToast({ title: "Sessão encerrada", tone: "info" });
  }

  async function handleCheckIn(boss: BossRecord) {
    if (!user) {
      setView("profile");
      pushToast({ title: "Entre para marcar check-in", tone: "info" });
      return;
    }

    const checkin = await createBossCheckin(user, profile, boss);
    setCheckins((current) => [checkin, ...current]);
    pushToast({
      title: "Check-in salvo",
      detail: `${boss.name} volta em ${formatDuration(boss.cooldown_minutes)}.`,
      tone: "success"
    });
  }

  async function handleProfileSave(patch: Partial<Profile>) {
    if (!user) {
      return;
    }

    const updated = await updateProfile(user.id, patch);
    setProfile(updated);
    pushToast({ title: "Perfil atualizado", tone: "success" });
  }

  async function handleBossSave(draft: BossDraft) {
    const saved = await saveBoss(draft);
    await refresh();
    pushToast({ title: "Boss salvo", detail: saved.name, tone: "success" });
  }

  async function handleDeactivateBoss(id: string) {
    await deactivateBoss(id);
    await refresh();
    pushToast({ title: "Boss desativado", tone: "info" });
  }

  async function handleCancelCheckin(id: string) {
    await cancelCheckin(id);
    setCheckins((current) => current.filter((item) => item.id !== id));
    pushToast({ title: "Cooldown removido", tone: "info" });
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <aside className="rubinot-sidebar mb-4 lg:sticky lg:top-0 lg:mb-0 lg:flex lg:h-screen lg:w-[360px] lg:flex-col">
          <div className="rubinot-sidebar-logo">
            <span>RUBINOT</span>
            <span>TOOLS</span>
          </div>

          <nav className="rubinot-sidebar-scroll">
            {sidebarSections.map((section) => (
              <SidebarSection
                activeView={view}
                isAdmin={Boolean(profile?.is_admin)}
                key={section.title}
                onNavigate={setView}
                section={section}
              />
            ))}

            {usingDemoBackend ? (
              <div className="mx-5 mb-5 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                Modo local ativo. Configure Supabase para produção.
              </div>
            ) : null}

            <UserStrip userEmail={user?.email} profile={profile} onSignOut={handleSignOut} />
          </nav>

          <div className="rubinot-sidebar-footer">
            <span>RUBINOT TOOLS</span>
            <span>V2.1 BETA</span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-6">
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-ink/10 bg-ink px-4 py-3 text-parchment shadow-panel md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-brass">Servidor RubinOT</p>
              <h2 className="text-xl font-black tracking-normal md:text-2xl">
                {viewTitles[view]}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="green">Bestiary 2x</Badge>
              <Badge tone="fire">Loot 2.5x</Badge>
              <Badge tone="stone">Save 10:00 UTC-3</Badge>
            </div>
          </div>

          {loading ? (
            <div className="panel rounded-lg p-8 text-center font-semibold text-ink">
              Carregando...
            </div>
          ) : (
            <>
              {view === "home" ? (
                <HomePanel
                  bosses={bosses}
                  checkins={checkins}
                  onNavigate={setView}
                  userSignedIn={Boolean(user)}
                />
              ) : null}
              {view === "stamina" ? <StaminaPanel /> : null}
              {view === "bestiary" ? (
                <BestiaryPanel bosses={bosses} userSignedIn={Boolean(user)} onCheckIn={handleCheckIn} />
              ) : null}
              {view === "cooldowns" ? (
                <CooldownsPanel
                  checkins={checkins}
                  userSignedIn={Boolean(user)}
                  onCancel={handleCancelCheckin}
                />
              ) : null}
              {view === "profile" ? (
                <ProfilePanel
                  userEmail={user?.email ?? null}
                  profile={profile}
                  onSignIn={handleSignIn}
                  onSignUp={handleSignUp}
                  onSave={handleProfileSave}
                />
              ) : null}
              {view === "admin" ? (
                <AdminPanel
                  bosses={bosses}
                  isAdmin={Boolean(profile?.is_admin)}
                  onSave={handleBossSave}
                  onDeactivate={handleDeactivateBoss}
                />
              ) : null}
            </>
          )}
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
    </div>
  );
}

function SidebarSection({
  activeView,
  isAdmin,
  onNavigate,
  section
}: {
  activeView: ViewKey;
  isAdmin: boolean;
  onNavigate: (view: ViewKey) => void;
  section: { title: string; items: SidebarItem[] };
}) {
  return (
    <div className="rubinot-sidebar-section">
      <div className="rubinot-sidebar-section-title">
        <span />
        <strong>{section.title}</strong>
        <span />
      </div>

      <div className="space-y-1">
        {section.items.map((item) => {
          const locked = item.key === "admin" && !isAdmin;
          return (
            <SidebarItemButton
              active={Boolean(item.key && activeView === item.key)}
              item={item}
              key={`${section.title}-${item.label}`}
              locked={locked}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>
    </div>
  );
}

function SidebarItemButton({
  active,
  item,
  locked,
  onNavigate
}: {
  active: boolean;
  item: SidebarItem;
  locked: boolean;
  onNavigate: (view: ViewKey) => void;
}) {
  const Icon = item.icon;
  const className = clsx(
    "rubinot-sidebar-link",
    active && "rubinot-sidebar-link-active",
    (item.disabled || locked) && "rubinot-sidebar-link-muted"
  );

  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? <span className="rubinot-sidebar-badge">{item.badge}</span> : null}
      {item.href ? <ExternalLink className="h-4 w-4 shrink-0 opacity-70" /> : null}
      {locked ? <Shield className="h-4 w-4 shrink-0 opacity-70" /> : null}
    </>
  );

  if (item.href) {
    return (
      <a className={className} href={item.href} rel="noreferrer" target="_blank">
        {content}
      </a>
    );
  }

  return (
    <button
      className={className}
      disabled={item.disabled}
      onClick={() => {
        if (item.key) {
          onNavigate(item.key);
        }
      }}
      title={item.disabled ? "Em breve" : item.label}
      type="button"
    >
      {content}
    </button>
  );
}

function UserStrip({
  userEmail,
  profile,
  onSignOut
}: {
  userEmail?: string;
  profile: Profile | null;
  onSignOut: () => void;
}) {
  if (!userEmail) {
    return (
      <div className="mx-5 mb-5 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
        <p className="font-bold text-slate-100">Visitante</p>
        <p className="text-xs text-slate-500">Login em Entre em contato.</p>
      </div>
    );
  }

  return (
    <div className="mx-5 mb-5 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500 text-white">
        <UserRound className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-100">{profile?.nick || "Sem nick"}</p>
        <p className="truncate text-xs text-slate-500">{userEmail}</p>
      </div>
      <button
        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-slate-950 text-slate-300 hover:text-red-400"
        onClick={onSignOut}
        title="Sair"
        type="button"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function Badge({ children, tone }: { children: string; tone: "green" | "fire" | "stone" }) {
  return (
    <span
      className={clsx(
        "rounded-full border px-3 py-1 text-xs font-black",
        tone === "green" && "border-moss/40 bg-moss/20 text-mist",
        tone === "fire" && "border-brass/40 bg-brass/20 text-parchment",
        tone === "stone" && "border-parchment/20 bg-parchment/10 text-parchment"
      )}
    >
      {children}
    </span>
  );
}

function HomePanel({
  bosses,
  checkins,
  onNavigate,
  userSignedIn
}: {
  bosses: BossRecord[];
  checkins: BossCheckin[];
  onNavigate: (view: ViewKey) => void;
  userSignedIn: boolean;
}) {
  const activeCooldowns = checkins.filter(
    (checkin) => new Date(checkin.cooldown_ends_at).getTime() > Date.now()
  ).length;
  const readyCooldowns = checkins.length - activeCooldowns;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div
        className="overflow-hidden rounded-lg border border-ink/10 bg-cover bg-center shadow-panel"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(16,23,19,.96), rgba(16,23,19,.74), rgba(16,23,19,.28)), url(${HERO_IMAGE})`
        }}
      >
        <div className="min-h-[360px] max-w-3xl p-6 text-parchment md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">RUBINOT TOOLS</p>
          <h3 className="mt-16 max-w-xl text-4xl font-black tracking-normal md:text-5xl">
            Painel de caça, stamina e boss tracker.
          </h3>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => onNavigate("bestiary")} type="button">
              <Skull className="h-4 w-4" />
              Boss Tracker
            </button>
            <button className="btn-secondary" onClick={() => onNavigate("stamina")} type="button">
              <Clock3 className="h-4 w-4" />
              Stamina
            </button>
          </div>
        </div>
      </div>

      <div className="panel rounded-lg p-5">
        <h3 className="text-lg font-black text-ink">Resumo</h3>
        <div className="mt-4 grid gap-3">
          <Metric label="Bosses ativos" value={bosses.length.toString()} />
          <Metric label="Cooldowns ativos" value={userSignedIn ? activeCooldowns.toString() : "Login"} />
          <Metric label="Prontos" value={userSignedIn ? readyCooldowns.toString() : "0"} />
        </div>
        <div className="mt-4 grid gap-2">
          <button className="btn-secondary justify-between" onClick={() => onNavigate("cooldowns")} type="button">
            <span className="inline-flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Meus cooldowns
            </span>
            <span>{activeCooldowns}</span>
          </button>
          <button className="btn-secondary justify-between" onClick={() => onNavigate("profile")} type="button">
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              Perfil e WhatsApp
            </span>
            <span>{userSignedIn ? "OK" : "Entrar"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function StaminaPanel() {
  const [hours, setHours] = useState(38);
  const [minutes, setMinutes] = useState(59);
  const [target, setTarget] = useState<StaminaTarget>("full");
  const [mode, setMode] = useState<RegenMode>("offline");

  const currentMinutes = toStaminaMinutes(hours, minutes);
  const projection = calculateStaminaProjection(currentMinutes, target, mode);
  const band = getStaminaBand(currentMinutes);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="panel rounded-lg p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Horas">
            <input
              className="input"
              max={42}
              min={0}
              onChange={(event) => setHours(Number(event.target.value))}
              type="number"
              value={hours}
            />
          </Field>
          <Field label="Minutos">
            <input
              className="input"
              max={59}
              min={0}
              onChange={(event) => setMinutes(Number(event.target.value))}
              type="number"
              value={minutes}
            />
          </Field>
          <Field label="Meta">
            <select
              className="input"
              onChange={(event) => setTarget(event.target.value as StaminaTarget)}
              value={target}
            >
              {Object.entries(STAMINA_TARGETS).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Regeneração">
            <select
              className="input"
              onChange={(event) => setMode(event.target.value as RegenMode)}
              value={mode}
            >
              {Object.entries(REGEN_RATES).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric label="Atual" value={formatStamina(currentMinutes)} />
          <Metric label="Faixa" value={band.label} />
          <Metric label="Tempo real" value={formatDuration(projection.recoveryMinutes)} />
          <Metric label="Pronto" value={formatDateTime(projection.readyAt)} />
        </div>

        <div className="mt-5 rounded-lg border border-ink/10 bg-mist p-4">
          <p className="text-sm font-black text-ink">{band.effect}</p>
          <p className="mt-1 text-sm text-ink/70">
            De {formatStamina(currentMinutes)} para {formatStamina(projection.target)} usando{" "}
            {REGEN_RATES[mode].label.toLowerCase()}.
          </p>
        </div>
      </div>

      <div className="panel rounded-lg p-5">
        <h3 className="text-lg font-black text-ink">Regras RubinOT</h3>
        <div className="mt-4 space-y-3 text-sm">
          <RuleRow left="42:00 ~ 39:00" right="Bonus EXP +50%" />
          <RuleRow left="38:59 ~ 14:00" right="EXP normal" />
          <RuleRow left="13:59 ~ 00:00" right="EXP -50%" />
          <RuleRow left="08:00 ~ 00:00" right="Sem loot" />
        </div>
        <div className="mt-5 overflow-hidden rounded-lg border border-ink/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-pine text-parchment">
              <tr>
                <th className="px-3 py-2">Condição</th>
                <th className="px-3 py-2">Orange</th>
                <th className="px-3 py-2">Green</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10 bg-white/70">
              {Object.values(REGEN_RATES).map((rate) => (
                <tr key={rate.label}>
                  <td className="px-3 py-2 font-bold">{rate.label}</td>
                  <td className="px-3 py-2">{rate.orangeMinutesPerStamina}min</td>
                  <td className="px-3 py-2">{rate.greenMinutesPerStamina}min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function RuleRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2">
      <span className="font-black">{left}</span>
      <span className="text-right text-ink/70">{right}</span>
    </div>
  );
}

function BestiaryPanel({
  bosses,
  userSignedIn,
  onCheckIn
}: {
  bosses: BossRecord[];
  userSignedIn: boolean;
  onCheckIn: (boss: BossRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "boss" | "mini-boss">("all");

  const filtered = useMemo(() => {
    return bosses.filter((boss) => {
      const matchesType = type === "all" || boss.type === type;
      const text = `${boss.name} ${boss.weaknesses.join(" ")} ${boss.damage_types.join(" ")}`.toLowerCase();
      return matchesType && text.includes(query.toLowerCase());
    });
  }, [bosses, query, type]);

  return (
    <section className="space-y-4">
      <div className="panel flex flex-col gap-3 rounded-lg p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
          <input
            className="input pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar boss, fraqueza ou dano"
            value={query}
          />
        </div>
        <div className="grid grid-cols-3 rounded-lg bg-ink/10 p-1 text-sm font-black">
          {[
            ["all", "Todos"],
            ["boss", "Boss"],
            ["mini-boss", "Mini"]
          ].map(([key, label]) => (
            <button
              className={clsx(
                "rounded-md px-3 py-2 transition",
                type === key ? "bg-ink text-parchment" : "text-ink hover:bg-white/70"
              )}
              key={key}
              onClick={() => setType(key as "all" | "boss" | "mini-boss")}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((boss) => (
          <BossCard key={boss.id} boss={boss} userSignedIn={userSignedIn} onCheckIn={onCheckIn} />
        ))}
      </div>

      {filtered.length === 0 ? <EmptyState title="Nenhum boss encontrado" /> : null}
    </section>
  );
}

function BossCard({
  boss,
  userSignedIn,
  onCheckIn
}: {
  boss: BossRecord;
  userSignedIn: boolean;
  onCheckIn: (boss: BossRecord) => void;
}) {
  return (
    <article className="panel overflow-hidden rounded-lg">
      <img
        alt={boss.name}
        className="h-48 w-full object-cover"
        src={boss.image_url || HERO_IMAGE}
      />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ember">
              {boss.type === "boss" ? "Boss" : "Mini boss"}
            </p>
            <h3 className="truncate text-xl font-black text-ink">{boss.name}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-pine px-3 py-1 text-xs font-black text-parchment">
            {formatDuration(boss.cooldown_minutes)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="HP" value={boss.hp.toLocaleString("pt-BR")} compact />
          <Metric label="Mana" value={boss.mana.toLocaleString("pt-BR")} compact />
        </div>

        <TagGroup label="Fraquezas" tags={boss.weaknesses} />
        <TagGroup label="Danos" tags={boss.damage_types} />

        <InfoBlock title="Mecânicas" value={boss.mechanics} />
        <InfoBlock title="Acesso" value={boss.access_notes} />
        <InfoBlock title="Equipamentos" value={boss.recommended_equipment} />

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={() => onCheckIn(boss)}
            title={userSignedIn ? "Marcar check-in" : "Entrar para marcar check-in"}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            Check-in
          </button>
          {boss.youtube_url ? (
            <a className="btn-secondary" href={boss.youtube_url} rel="noreferrer" target="_blank">
              <Play className="h-4 w-4" />
              Vídeo
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CooldownsPanel({
  checkins,
  userSignedIn,
  onCancel
}: {
  checkins: BossCheckin[];
  userSignedIn: boolean;
  onCancel: (id: string) => void;
}) {
  if (!userSignedIn) {
    return <EmptyState title="Entre para ver seus cooldowns" />;
  }

  if (checkins.length === 0) {
    return <EmptyState title="Nenhum cooldown ativo" />;
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {checkins.map((checkin) => {
        const remaining = minutesUntil(checkin.cooldown_ends_at);
        const ready = remaining <= 0;
        return (
          <article className="panel rounded-lg p-4" key={checkin.id}>
            <div className="flex items-start gap-3">
              <img
                alt={checkin.boss?.name ?? "Boss"}
                className="h-16 w-16 rounded-lg object-cover"
                src={checkin.boss?.image_url || HERO_IMAGE}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black text-ink">
                  {checkin.boss?.name ?? "Boss removido"}
                </p>
                <p className="text-sm text-ink/65">Check-in {formatDateTime(checkin.checked_at)}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => onCancel(checkin.id)}
                title="Remover cooldown"
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric label={ready ? "Status" : "Falta"} value={ready ? "Pronto" : formatDuration(remaining)} />
              <Metric label="Horário" value={formatDateTime(checkin.cooldown_ends_at)} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-ink/70">
              {ready ? <Bell className="h-4 w-4 text-ember" /> : <Clock3 className="h-4 w-4" />}
              <span>{ready ? "Alerta do navegador registrado." : "WhatsApp agendado se o perfil permitir."}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ProfilePanel({
  userEmail,
  profile,
  onSignIn,
  onSignUp,
  onSave
}: {
  userEmail: string | null;
  profile: Profile | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, nick: string) => Promise<void>;
  onSave: (patch: Partial<Profile>) => Promise<void>;
}) {
  if (!userEmail || !profile) {
    return <AuthPanel onSignIn={onSignIn} onSignUp={onSignUp} />;
  }

  return <ProfileForm profile={profile} userEmail={userEmail} onSave={onSave} />;
}

function AuthPanel({
  onSignIn,
  onSignUp
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, nick: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password, nick);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha no login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mx-auto max-w-xl rounded-lg p-5">
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-ink/10 p-1 text-sm font-black">
        <button
          className={clsx("rounded-md px-3 py-2", mode === "signin" && "bg-ink text-parchment")}
          onClick={() => setMode("signin")}
          type="button"
        >
          Entrar
        </button>
        <button
          className={clsx("rounded-md px-3 py-2", mode === "signup" && "bg-ink text-parchment")}
          onClick={() => setMode("signup")}
          type="button"
        >
          Criar conta
        </button>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <Field label="Nick">
            <input className="input" onChange={(event) => setNick(event.target.value)} required value={nick} />
          </Field>
        ) : null}
        <Field label="Email">
          <input
            className="input"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </Field>
        <Field label="Senha">
          <input
            className="input"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </Field>
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p> : null}
        <button className="btn-primary w-full justify-center" disabled={busy} type="submit">
          <LogIn className="h-4 w-4" />
          {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </section>
  );
}

function ProfileForm({
  profile,
  userEmail,
  onSave
}: {
  profile: Profile;
  userEmail: string;
  onSave: (patch: Partial<Profile>) => Promise<void>;
}) {
  const [nick, setNick] = useState(profile.nick);
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp);
  const [optIn, setOptIn] = useState(profile.whatsapp_opt_in);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({ nick, whatsapp, whatsapp_opt_in: optIn });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mx-auto max-w-2xl rounded-lg p-5">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Email">
          <input className="input bg-ink/5" disabled value={userEmail} />
        </Field>
        <Field label="Nick">
          <input className="input" onChange={(event) => setNick(event.target.value)} required value={nick} />
        </Field>
        <Field label="WhatsApp">
          <input
            className="input"
            inputMode="numeric"
            onChange={(event) => setWhatsapp(event.target.value.replace(/\D/g, ""))}
            placeholder="55DDDNUMERO"
            value={whatsapp}
          />
        </Field>
        <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-3 text-sm font-bold text-ink">
          <input
            checked={optIn}
            className="h-4 w-4 accent-ember"
            onChange={(event) => setOptIn(event.target.checked)}
            type="checkbox"
          />
          Receber alertas de boss pelo WhatsApp
        </label>
        <button className="btn-primary" disabled={busy} type="submit">
          <Save className="h-4 w-4" />
          Salvar perfil
        </button>
      </form>
    </section>
  );
}

function AdminPanel({
  bosses,
  isAdmin,
  onSave,
  onDeactivate
}: {
  bosses: BossRecord[];
  isAdmin: boolean;
  onSave: (draft: BossDraft) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<BossDraft>(emptyBossDraft);
  const [weaknessText, setWeaknessText] = useState("");
  const [damageText, setDamageText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return <EmptyState title="Painel admin bloqueado" />;
  }

  function editBoss(boss: BossRecord) {
    setDraft(boss);
    setWeaknessText(joinTags(boss.weaknesses));
    setDamageText(joinTags(boss.damage_types));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({
        ...draft,
        weaknesses: splitTags(weaknessText),
        damage_types: splitTags(damageText),
        hp: Number(draft.hp) || 0,
        mana: Number(draft.mana) || 0,
        cooldown_minutes: Number(draft.cooldown_minutes) || 60
      });
      setDraft(emptyBossDraft);
      setWeaknessText("");
      setDamageText("");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    const url = await uploadBossImage(file);
    setDraft((current) => ({ ...current, image_url: url }));
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(420px,520px)_1fr]">
      <form className="panel space-y-4 rounded-lg p-5" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-ink">{draft.id ? "Editar boss" : "Novo boss"}</h3>
          <button
            className="icon-button"
            onClick={() => {
              setDraft(emptyBossDraft);
              setWeaknessText("");
              setDamageText("");
            }}
            title="Limpar formulário"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <img
          alt={draft.name || "Imagem do boss"}
          className="h-44 w-full rounded-lg object-cover"
          src={draft.image_url || HERO_IMAGE}
        />

        <Field label="Imagem">
          <label className="btn-secondary inline-flex cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload
            <input
              accept="image/*"
              className="hidden"
              onChange={(event) => handleUpload(event.target.files?.[0])}
              type="file"
            />
          </label>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome">
            <input
              className="input"
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              required
              value={draft.name}
            />
          </Field>
          <Field label="Tipo">
            <select
              className="input"
              onChange={(event) =>
                setDraft((current) => ({ ...current, type: event.target.value as BossRecord["type"] }))
              }
              value={draft.type}
            >
              <option value="boss">Boss</option>
              <option value="mini-boss">Mini boss</option>
            </select>
          </Field>
          <Field label="HP">
            <input
              className="input"
              min={0}
              onChange={(event) => setDraft((current) => ({ ...current, hp: Number(event.target.value) }))}
              type="number"
              value={draft.hp}
            />
          </Field>
          <Field label="Mana">
            <input
              className="input"
              min={0}
              onChange={(event) => setDraft((current) => ({ ...current, mana: Number(event.target.value) }))}
              type="number"
              value={draft.mana}
            />
          </Field>
          <Field label="Cooldown em minutos">
            <input
              className="input"
              min={1}
              onChange={(event) =>
                setDraft((current) => ({ ...current, cooldown_minutes: Number(event.target.value) }))
              }
              type="number"
              value={draft.cooldown_minutes}
            />
          </Field>
          <Field label="YouTube">
            <input
              className="input"
              onChange={(event) => setDraft((current) => ({ ...current, youtube_url: event.target.value }))}
              type="url"
              value={draft.youtube_url}
            />
          </Field>
        </div>

        <Field label="Fraquezas">
          <input className="input" onChange={(event) => setWeaknessText(event.target.value)} value={weaknessText} />
        </Field>
        <Field label="Danos">
          <input className="input" onChange={(event) => setDamageText(event.target.value)} value={damageText} />
        </Field>
        <Field label="Mecânicas">
          <textarea
            className="input min-h-24"
            onChange={(event) => setDraft((current) => ({ ...current, mechanics: event.target.value }))}
            value={draft.mechanics}
          />
        </Field>
        <Field label="Acesso">
          <textarea
            className="input min-h-20"
            onChange={(event) => setDraft((current) => ({ ...current, access_notes: event.target.value }))}
            value={draft.access_notes}
          />
        </Field>
        <Field label="Equipamentos">
          <textarea
            className="input min-h-20"
            onChange={(event) =>
              setDraft((current) => ({ ...current, recommended_equipment: event.target.value }))
            }
            value={draft.recommended_equipment}
          />
        </Field>
        <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-3 text-sm font-bold text-ink">
          <input
            checked={draft.is_active}
            className="h-4 w-4 accent-ember"
            onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))}
            type="checkbox"
          />
          Boss ativo
        </label>

        <button className="btn-primary" disabled={busy} type="submit">
          <Save className="h-4 w-4" />
          Salvar boss
        </button>
      </form>

      <div className="panel rounded-lg p-5">
        <h3 className="text-lg font-black text-ink">Catálogo</h3>
        <div className="compact-scroll mt-4 max-h-[900px] space-y-3 overflow-auto pr-1">
          {bosses.map((boss) => (
            <div
              className={clsx(
                "grid gap-3 rounded-lg border border-ink/10 bg-white/70 p-3 md:grid-cols-[72px_1fr_auto]",
                !boss.is_active && "opacity-60"
              )}
              key={boss.id}
            >
              <img alt={boss.name} className="h-18 h-[72px] w-[72px] rounded-lg object-cover" src={boss.image_url || HERO_IMAGE} />
              <div className="min-w-0">
                <p className="truncate font-black text-ink">{boss.name}</p>
                <p className="text-sm text-ink/65">
                  {boss.type === "boss" ? "Boss" : "Mini boss"} · {formatDuration(boss.cooldown_minutes)}
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ember">
                  {boss.is_active ? "Ativo" : "Inativo"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="icon-button" onClick={() => editBoss(boss)} title="Editar" type="button">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  className="icon-button"
                  disabled={!boss.is_active}
                  onClick={() => onDeactivate(boss.id)}
                  title="Desativar"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-ink/60">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  compact
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white/70 px-3 py-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">{label}</p>
      <p className={clsx("mt-1 truncate font-black text-ink", compact ? "text-base" : "text-xl")}>{value}</p>
    </div>
  );
}

function TagGroup({ label, tags }: { label: string; tags: string[] }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-ink/50">{label}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span className="rounded-full bg-moss/15 px-3 py-1 text-xs font-black text-pine" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">{title}</p>
      <p className="mt-1 text-sm leading-6 text-ink/75">{value}</p>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <section className="panel flex min-h-72 items-center justify-center rounded-lg p-8 text-center">
      <div>
        <TimerReset className="mx-auto h-10 w-10 text-ember" />
        <p className="mt-3 text-xl font-black text-ink">{title}</p>
      </div>
    </section>
  );
}

function ToastStack({
  toasts,
  onDismiss
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          className={clsx(
            "rounded-lg border px-4 py-3 shadow-panel",
            toast.tone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : toast.tone === "success"
                ? "border-moss/30 bg-mist text-ink"
                : "border-ink/10 bg-white text-ink"
          )}
          key={toast.id}
        >
          <div className="flex gap-3">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-black">{toast.title}</p>
              {toast.detail ? <p className="mt-1 text-sm opacity-75">{toast.detail}</p> : null}
            </div>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5"
              onClick={() => onDismiss(toast.id)}
              title="Fechar"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
