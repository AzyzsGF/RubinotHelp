import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlarmClock,
  Bell,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Eye,
  EyeOff,
  ExternalLink,
  Gavel,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogIn,
  LogOut,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Send,
  Shield,
  Skull,
  Sparkles,
  Star,
  Store,
  Swords,
  TimerReset,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";
import clsx from "clsx";
import {
  BossCheckin,
  BossDraft,
  BossRecord,
  ModerationStatus,
  Profile,
  ServiceCard,
  ServiceCardDraft,
  ServiceCategory,
  ServiceReviewDraft,
  ToastMessage,
  ViewKey
} from "./types";
import {
  adminSaveServiceCard,
  cancelCheckin,
  createBossCheckin,
  deleteBoss,
  deleteServiceCard,
  deleteServiceReview,
  getAuthState,
  listBosses,
  listServiceCards,
  listUserCheckins,
  markBrowserNotified,
  saveBoss,
  saveServiceCard,
  saveServiceReview,
  setBossPublished,
  setServiceCardStatus,
  setServiceReviewStatus,
  signIn,
  signOut,
  signUp,
  updateAccountEmail,
  updateAccountPassword,
  updateProfile,
  uploadBossImage,
  uploadProfileAvatar,
  uploadReviewScreenshot,
  uploadServiceBanner,
  usingDemoBackend
} from "./lib/dataClient";
import { HERO_IMAGE } from "./lib/demoData";
import {
  calculateStaminaProjection,
  formatStamina,
  getStaminaBand,
  GREEN_STAMINA_START,
  MAX_STAMINA_MINUTES,
  NO_LOOT_START,
  NORMAL_STAMINA_START,
  REGEN_RATES,
  RegenMode,
  STAMINA_TARGETS,
  StaminaTarget,
  toStaminaMinutes
} from "./lib/stamina";
import { createId, formatDateTime, formatDuration, formatTime, minutesUntil } from "./lib/time";

const emptyBossDraft: BossDraft = {
  name: "",
  full_name: "",
  popular_name: "",
  display_name_mode: "full",
  content_mode: "single",
  type: "boss",
  image_url: HERO_IMAGE,
  hp: 0,
  mana: 0,
  weaknesses: [],
  damage_types: [],
  mechanics: "",
  access_notes: "",
  requires_access: false,
  access_url: "",
  location: "",
  location_url: "",
  recommended_equipment: "",
  cooldown_minutes: 20 * 60,
  youtube_url: "",
  is_active: true,
  steps: []
};

const SERVICE_BANNER_PLACEHOLDER = HERO_IMAGE;

const serviceCategoryLabels: Record<ServiceCategory, string> = {
  experience: "Experiencia",
  bestiary: "Bestiario",
  task: "Task"
};

const emptyServiceDraft: ServiceCardDraft = {
  title: "",
  categories: [],
  price_amount: 10,
  price_hours: 1,
  package_hours: 10,
  package_hour_price: 9,
  description: "",
  provider_bio: "",
  whatsapp: "",
  banner_url: SERVICE_BANNER_PLACEHOLDER,
  provider_nick: "",
  provider_avatar_url: ""
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
  stamina: "Calculadora de Stamina",
  bossTracker: "BOSS TRACKER",
  services: "SERVICES",
  bestiaryTracker: "BESTIARIO TRACKER",
  cooldowns: "Task Delivery",
  profile: "Painel do Usuario",
  adminHub: "Painel Admin",
  adminBossTracker: "Editar Boss Tracker",
  adminServices: "Editar Services"
};

const sidebarSections: Array<{ title: string; items: SidebarItem[] }> = [
  {
    title: "Principal",
    items: [
      { key: "bossTracker", label: "BOSS TRACKER", icon: Skull },
      { label: "COMPRAR/VENDER RC", icon: Gavel, disabled: true },
      { label: "MARKETPLACE", icon: Store, disabled: true },
      { key: "services", label: "SERVICES", icon: Swords }
    ]
  },
  {
    title: "Ferramentas",
    items: [
      { key: "stamina", label: "CALCULADORA DE STAMINA", icon: Clock3 },
      { label: "CALCULADORA DE SKILLS", icon: Calculator, disabled: true },
      { label: "OTIMIZADOR DE CHARMS", icon: Sparkles, disabled: true },
      { key: "bestiaryTracker", label: "BESTIARIO TRACKER", icon: BookOpen },
      { label: "CRONOMETRO", icon: AlarmClock, disabled: true }
    ]
  }
];

const regenCards: Array<{ mode: RegenMode; icon: typeof Activity }> = [
  { mode: "offline", icon: Moon },
  { mode: "trainer", icon: Dumbbell },
  { mode: "protection", icon: Shield }
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

function createBossStep(sortOrder: number): BossDraft["steps"][number] {
  return {
    id: createId("step"),
    sort_order: sortOrder,
    name: "",
    image_url: "",
    location: "",
    weaknesses: [],
    damage_types: [],
    mechanics: ""
  };
}

function normalizeBossStep(step: Partial<BossDraft["steps"][number]>, index: number): BossDraft["steps"][number] {
  return {
    id: step.id ?? createId("step"),
    boss_id: step.boss_id,
    sort_order: index,
    name: step.name ?? "",
    image_url: step.image_url ?? "",
    location: step.location ?? "",
    weaknesses: step.weaknesses ?? [],
    damage_types: step.damage_types ?? [],
    mechanics: step.mechanics ?? "",
    created_at: step.created_at,
    updated_at: step.updated_at
  };
}

function resizeBossSteps(steps: BossDraft["steps"], count: number) {
  const safeCount = Math.max(1, Math.min(20, Math.round(count) || 1));
  const next = steps.slice(0, safeCount).map((step, index) => normalizeBossStep(step, index));

  while (next.length < safeCount) {
    next.push(createBossStep(next.length));
  }

  return next;
}

function bossKindLabel(boss: BossRecord) {
  if (boss.content_mode === "group") {
    return "Grupo";
  }

  return boss.type === "boss" ? "Boss" : "Mini boss";
}

function approvedReviews(card: ServiceCard) {
  return card.reviews.filter((review) => review.status === "approved");
}

function serviceRating(card: ServiceCard) {
  const reviews = approvedReviews(card);
  if (reviews.length === 0) {
    return { average: 0, count: 0 };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}

function serviceHourlyPrice(card: ServiceCard) {
  return card.price_amount / Math.max(0.25, card.price_hours);
}

function serviceIsNew(card: ServiceCard) {
  return Date.now() - new Date(card.created_at).getTime() <= 3 * 24 * 60 * 60 * 1000;
}

function whatsappLink(phone: string, text?: string) {
  const number = phone.replace(/\D/g, "");
  const message = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number}${message}`;
}

let alertAudioContext: AudioContext | null = null;

function getAudioContextCtor() {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return AudioContextCtor ?? null;
}

async function unlockAlertTone() {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return false;
  }

  try {
    alertAudioContext ??= new AudioContextCtor();
    if (alertAudioContext.state === "suspended") {
      await alertAudioContext.resume();
    }

    return alertAudioContext.state === "running";
  } catch {
    return false;
  }
}

async function playAlertTone() {
  const ready = await unlockAlertTone();
  const context = alertAudioContext;
  if (!ready || !context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startAt = context.currentTime + 0.01;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, startAt);
  oscillator.frequency.setValueAtTime(660, startAt + 0.18);
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.42);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.45);
}

async function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported" as const;
  }

  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }

  return Notification.permission;
}

function getNotificationIcon(boss?: BossRecord) {
  const imageUrl = boss?.image_url || HERO_IMAGE;
  if (!imageUrl || imageUrl.startsWith("data:")) {
    return new URL(HERO_IMAGE, window.location.origin).href;
  }

  try {
    return new URL(imageUrl, window.location.origin).href;
  } catch {
    return new URL(HERO_IMAGE, window.location.origin).href;
  }
}

function showBrowserCooldownNotification(checkin: BossCheckin) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  try {
    const bossName = checkin.boss?.name ?? "Boss";
    const notification = new Notification("Boss pronto no Rubinot Help", {
      body: `${bossName} saiu do cooldown.`,
      icon: getNotificationIcon(checkin.boss),
      silent: false,
      tag: `rubinot-help:${checkin.id}`
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

async function prepareCooldownAlerts() {
  const [permission] = await Promise.all([
    requestBrowserNotificationPermission(),
    unlockAlertTone()
  ]);

  return permission;
}

export default function App() {
  const [view, setView] = useState<ViewKey>("bossTracker");
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bosses, setBosses] = useState<BossRecord[]>([]);
  const [checkins, setCheckins] = useState<BossCheckin[]>([]);
  const [serviceCards, setServiceCards] = useState<ServiceCard[]>([]);
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
      setServiceCards(await listServiceCards(Boolean(auth.profile?.is_admin)));

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
      void playAlertTone();
      showBrowserCooldownNotification(checkin);
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
    setServiceCards(await listServiceCards(false));
    setView("bossTracker");
    pushToast({ title: "Sessão encerrada", tone: "info" });
  }

  async function handleCheckIn(boss: BossRecord) {
    if (!user) {
      setView("profile");
      pushToast({ title: "Entre para marcar check-in", tone: "info" });
      return;
    }

    const notificationPermission = await prepareCooldownAlerts();
    const checkin = await createBossCheckin(user, profile, boss);
    setCheckins((current) => [checkin, ...current]);
    const alertHint =
      notificationPermission === "granted"
        ? " Notificacao do navegador ativa."
        : notificationPermission === "denied"
          ? " Notificacao do navegador bloqueada nas permissoes."
          : "";
    pushToast({
      title: "Check-in salvo",
      detail: `${boss.name} volta em ${formatDuration(boss.cooldown_minutes)}.${alertHint}`,
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

  async function handleEmailChange(email: string) {
    if (!user) {
      return;
    }

    const updated = await updateAccountEmail(user.id, email);
    setUser({ id: user.id, email });
    setProfile(updated);
    await refresh();
    pushToast({ title: "Email atualizado", detail: "Se o Supabase pedir confirmacao, confira sua caixa de entrada.", tone: "success" });
  }

  async function handlePasswordChange(password: string) {
    if (!user) {
      return;
    }

    await updateAccountPassword(user.id, password);
    pushToast({ title: "Senha atualizada", tone: "success" });
  }

  async function handleAvatarUpload(file: File) {
    if (!user || !profile) {
      return "";
    }

    const avatarUrl = await uploadProfileAvatar(user.id, file);
    const updated = await updateProfile(user.id, { ...profile, avatar_url: avatarUrl });
    setProfile(updated);
    await refresh();
    pushToast({ title: "Foto de perfil atualizada", tone: "success" });
    return avatarUrl;
  }

  async function handleServiceSave(draft: ServiceCardDraft) {
    if (!user) {
      setView("profile");
      pushToast({ title: "Entre para cadastrar service", tone: "info" });
      return;
    }

    const saved = await saveServiceCard(user, profile, draft);
    await refresh();
    pushToast({
      title: "Service enviado para revisao",
      detail: saved.title,
      tone: "success"
    });
  }

  async function handleServiceDelete(id: string) {
    const confirmed = window.confirm("Excluir este card de service?");
    if (!confirmed) {
      return;
    }

    await deleteServiceCard(id);
    await refresh();
    pushToast({ title: "Service excluido", tone: "info" });
  }

  async function handleServiceBannerUpload(file: File) {
    if (!user) {
      throw new Error("Entre para enviar imagem.");
    }

    return uploadServiceBanner(user.id, file);
  }

  async function handleReviewScreenshotUpload(file: File) {
    if (!user) {
      throw new Error("Entre para enviar print.");
    }

    return uploadReviewScreenshot(user.id, file);
  }

  async function handleServiceReviewSave(draft: ServiceReviewDraft) {
    if (!user) {
      setView("profile");
      pushToast({ title: "Entre para avaliar", tone: "info" });
      return;
    }

    await saveServiceReview(user, profile, draft);
    await refresh();
    pushToast({ title: "Avaliacao enviada para revisao", tone: "success" });
  }

  async function handleServiceStatus(id: string, status: ModerationStatus, reason = "") {
    await setServiceCardStatus(id, status, reason);
    await refresh();
    pushToast({ title: status === "approved" ? "Service aprovado" : status === "rejected" ? "Service recusado" : "Service atualizado", tone: "success" });
  }

  async function handleAdminServiceSave(card: ServiceCard) {
    await adminSaveServiceCard(card);
    await refresh();
    pushToast({ title: "Service editado", tone: "success" });
  }

  async function handleReviewStatus(id: string, status: ModerationStatus, reason = "") {
    await setServiceReviewStatus(id, status, reason);
    await refresh();
    pushToast({ title: status === "approved" ? "Avaliacao aprovada" : "Avaliacao recusada", tone: "success" });
  }

  async function handleReviewDelete(id: string) {
    await deleteServiceReview(id);
    await refresh();
    pushToast({ title: "Avaliacao excluida", tone: "info" });
  }

  async function handleBossSave(draft: BossDraft) {
    const saved = await saveBoss(draft);
    await refresh();
    pushToast({ title: "Boss salvo", detail: saved.name, tone: "success" });
  }

  async function handleBossPublished(id: string, isActive: boolean) {
    await setBossPublished(id, isActive);
    await refresh();
    pushToast({ title: isActive ? "Boss publicado" : "Boss ocultado", tone: "info" });
  }

  async function handleBossDelete(id: string) {
    const boss = bosses.find((item) => item.id === id);
    const confirmed = window.confirm(`Excluir ${boss?.name ?? "este boss"} do catalogo?`);
    if (!confirmed) {
      return;
    }

    await deleteBoss(id);
    await refresh();
    pushToast({ title: "Boss excluido do catalogo", tone: "info" });
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
            <span>HELP</span>
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

            <UserStrip
              onAdminClick={() => setView("adminHub")}
              onProfileClick={() => setView("profile")}
              onSignOut={handleSignOut}
              profile={profile}
              userEmail={user?.email}
            />
          </nav>

          <div className="rubinot-sidebar-footer">
            <span>RUBINOT HELP</span>
            <span>V2.1 BETA</span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-6">
          <div className="site-topbar mb-4 flex flex-col gap-3 rounded-lg px-4 py-3 text-parchment shadow-panel md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-brass">Servidor RubinOT</p>
              <h2 className="text-xl font-black tracking-normal md:text-2xl">
                {viewTitles[view]}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="fire">Bestiary 2x</Badge>
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
              {view === "bossTracker" ? (
                <BossTrackerPanel
                  bosses={bosses}
                  checkins={checkins}
                  userSignedIn={Boolean(user)}
                  onCheckIn={handleCheckIn}
                />
              ) : null}
              {view === "services" ? (
                <ServicesPanel
                  cards={serviceCards}
                  onNavigate={setView}
                  onReview={handleServiceReviewSave}
                  onScreenshotUpload={handleReviewScreenshotUpload}
                  user={user}
                />
              ) : null}
              {view === "bestiaryTracker" ? <BestiaryTrackerPanel /> : null}
              {view === "cooldowns" ? (
                <CooldownsPanel
                  checkins={checkins}
                  userSignedIn={Boolean(user)}
                  onCancel={handleCancelCheckin}
                />
              ) : null}
              {view === "profile" ? (
                <ProfilePanel
                  currentUser={user}
                  userEmail={user?.email ?? null}
                  profile={profile}
                  serviceCards={serviceCards}
                  onAvatarUpload={handleAvatarUpload}
                  onEmailChange={handleEmailChange}
                  onPasswordChange={handlePasswordChange}
                  onSignIn={handleSignIn}
                  onSignUp={handleSignUp}
                  onSave={handleProfileSave}
                  onServiceBannerUpload={handleServiceBannerUpload}
                  onServiceDelete={handleServiceDelete}
                  onServiceSave={handleServiceSave}
                />
              ) : null}
              {view === "adminHub" ? (
                <AdminHubPanel isAdmin={Boolean(profile?.is_admin)} onNavigate={setView} />
              ) : null}
              {view === "adminBossTracker" ? (
                <AdminPanel
                  bosses={bosses}
                  isAdmin={Boolean(profile?.is_admin)}
                  onSave={handleBossSave}
                  onDelete={handleBossDelete}
                  onSetPublished={handleBossPublished}
                />
              ) : null}
              {view === "adminServices" ? (
                <AdminServicesPanel
                  cards={serviceCards}
                  isAdmin={Boolean(profile?.is_admin)}
                  onDelete={handleServiceDelete}
                  onReviewDelete={handleReviewDelete}
                  onReviewStatus={handleReviewStatus}
                  onSave={handleAdminServiceSave}
                  onStatus={handleServiceStatus}
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
          const locked =
            (item.key === "adminHub" || item.key === "adminBossTracker") && !isAdmin;
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
  onAdminClick,
  onProfileClick,
  userEmail,
  profile,
  onSignOut
}: {
  onAdminClick: () => void;
  onProfileClick: () => void;
  userEmail?: string;
  profile: Profile | null;
  onSignOut: () => void;
}) {
  if (!userEmail) {
    return (
      <div className="mx-5 mb-5 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
        <p className="font-bold text-slate-100">Visitante</p>
        <p className="text-xs text-slate-500">Login, nick e WhatsApp.</p>
        <button className="mt-3 w-full justify-center btn-primary" onClick={onProfileClick} type="button">
          <LogIn className="h-4 w-4" />
          Entrar
        </button>
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
      {profile?.is_admin ? (
        <button
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-slate-950 text-slate-300 hover:text-red-400"
          onClick={onAdminClick}
          title="Painel admin"
          type="button"
        >
          <LayoutDashboard className="h-4 w-4" />
        </button>
      ) : null}
      <button
        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-slate-950 text-slate-300 hover:text-red-400"
        onClick={onProfileClick}
        title="Perfil"
        type="button"
      >
        <UserRound className="h-4 w-4" />
      </button>
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
    <section className="grid min-h-[calc(100vh-7.5rem)] items-center gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-lg p-2 text-parchment md:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brass drop-shadow">
            RUBINOT HELP
          </p>
          <h3 className="mt-16 max-w-4xl text-5xl font-black leading-[0.98] tracking-normal drop-shadow-[0_5px_20px_rgba(0,0,0,0.65)] md:text-7xl">
            Painel de caça, stamina e boss tracker.
          </h3>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => onNavigate("bossTracker")} type="button">
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

function getStaminaBarColor(totalMinutes: number) {
  if (totalMinutes >= GREEN_STAMINA_START) {
    return "#22c55e";
  }

  if (totalMinutes >= NORMAL_STAMINA_START) {
    return "#f59e0b";
  }

  if (totalMinutes >= NO_LOOT_START) {
    return "#ef4444";
  }

  return "#7f1d1d";
}

function StaminaPanel() {
  const [hours, setHours] = useState(38);
  const [minutes, setMinutes] = useState(59);
  const [target, setTarget] = useState<StaminaTarget>("full");

  const currentMinutes = toStaminaMinutes(hours, minutes);
  const projections = regenCards.map(({ mode, icon }) => ({
    icon,
    mode,
    rate: REGEN_RATES[mode],
    projection: calculateStaminaProjection(currentMinutes, target, mode)
  }));
  const targetMinutes = projections[0]?.projection.target ?? currentMinutes;
  const band = getStaminaBand(currentMinutes);
  const staminaPercent = Math.min(100, Math.max(0, (currentMinutes / MAX_STAMINA_MINUTES) * 100));
  const barColor = getStaminaBarColor(currentMinutes);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="panel rounded-lg p-5">
        <div className="rounded-lg border border-slate-800/20 bg-[#111722] p-4 text-slate-100 shadow-inner">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-black text-slate-400">Stamina Bar</span>
            <span className="font-black">{formatStamina(currentMinutes)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-black/50 bg-black/45">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${staminaPercent}%`,
                backgroundColor: barColor,
                boxShadow: `0 0 18px ${barColor}`
              }}
            />
          </div>
          <div className="mt-2 grid grid-cols-4 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
            <span>0:00</span>
            <span className="text-center">8:00</span>
            <span className="text-center">14:00</span>
            <span className="text-right">42:00</span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
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
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label="Atual" value={formatStamina(currentMinutes)} />
          <Metric label="Faixa" value={band.label} />
          <Metric label="Meta" value={formatStamina(targetMinutes)} />
        </div>

        <div className="mt-5 rounded-lg border border-red-500/20 bg-red-50/80 p-4">
          <p className="text-sm font-black text-ink">{band.effect}</p>
          <p className="mt-1 text-sm text-ink/70">
            De {formatStamina(currentMinutes)} para {formatStamina(targetMinutes)}. Veja abaixo o
            tempo nas três formas de regeneração.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          {projections.map(({ icon: Icon, mode, projection, rate }) => (
            <div
              className="rounded-lg border border-red-500/18 bg-white/80 p-4 shadow-sm"
              key={mode}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.28)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-black text-ink">{rate.label}</p>
                  <p className="text-xs font-bold text-ink/55">
                    Orange {rate.orangeMinutesPerStamina}min · Green {rate.greenMinutesPerStamina}min
                  </p>
                </div>
              </div>
              <Metric label="Tempo real" value={formatDuration(projection.recoveryMinutes)} compact />
              <div className="mt-2">
                <Metric label="Pronto" value={formatDateTime(projection.readyAt)} compact />
              </div>
            </div>
          ))}
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
            <thead className="bg-red-950 text-parchment">
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

function BossTrackerPanel({
  bosses,
  checkins,
  userSignedIn,
  onCheckIn
}: {
  bosses: BossRecord[];
  checkins: BossCheckin[];
  userSignedIn: boolean;
  onCheckIn: (boss: BossRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "boss" | "mini-boss">("all");
  const [selectedBoss, setSelectedBoss] = useState<BossRecord | null>(null);

  const filtered = useMemo(() => {
    return bosses.filter((boss) => {
      const matchesType = type === "all" || boss.type === type;
      const stepText = boss.steps
        .map(
          (step) =>
            `${step.name} ${step.location} ${step.mechanics} ${step.weaknesses.join(" ")} ${step.damage_types.join(" ")}`
        )
        .join(" ");
      const text =
        `${boss.name} ${boss.full_name} ${boss.popular_name} ${boss.location} ${boss.weaknesses.join(" ")} ${boss.damage_types.join(" ")} ${stepText}`.toLowerCase();
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1700px]:grid-cols-5 min-[1920px]:grid-cols-6">
        {filtered.map((boss) => (
          <BossCard
            key={boss.id}
            boss={boss}
            checkins={checkins}
            onDetails={setSelectedBoss}
            userSignedIn={userSignedIn}
            onCheckIn={onCheckIn}
          />
        ))}
      </div>

      {filtered.length === 0 ? <EmptyState title="Nenhum boss encontrado" /> : null}

      {selectedBoss ? (
        <BossInfoModal
          boss={selectedBoss}
          checkins={checkins}
          onCheckIn={onCheckIn}
          onClose={() => setSelectedBoss(null)}
          userSignedIn={userSignedIn}
        />
      ) : null}
    </section>
  );
}

function BestiaryTrackerPanel() {
  return (
    <section className="panel flex min-h-[420px] items-center justify-center rounded-lg p-8 text-center">
      <div className="max-w-xl">
        <BookOpen className="mx-auto h-12 w-12 text-ember" />
        <p className="mt-4 text-2xl font-black text-ink">Bestiario Tracker</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-ink/65">
          Area separada para monstros, charms e progresso de bestiario. O Boss Tracker agora fica
          exclusivo para bosses, cooldown e check-in.
        </p>
      </div>
    </section>
  );
}

function BossCard({
  boss,
  checkins,
  onDetails,
  userSignedIn,
  onCheckIn
}: {
  boss: BossRecord;
  checkins: BossCheckin[];
  onDetails: (boss: BossRecord) => void;
  userSignedIn: boolean;
  onCheckIn: (boss: BossRecord) => void;
}) {
  const activeCheckin = checkins.find(
    (checkin) => checkin.boss_id === boss.id && minutesUntil(checkin.cooldown_ends_at) > 0
  );
  const remainingMinutes = activeCheckin ? minutesUntil(activeCheckin.cooldown_ends_at) : 0;

  return (
    <article className="panel flex h-full min-h-[205px] flex-col rounded-lg p-3">
      <div className="flex min-h-[120px] items-start gap-3">
        <div className="creature-frame h-[72px] w-[72px] shrink-0">
          <img alt={boss.name} className="creature-sprite" src={boss.image_url || HERO_IMAGE} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ember">
            {bossKindLabel(boss)}
          </p>
          <h3 className="line-clamp-2 min-h-[2.35rem] break-words text-base font-black leading-[1.15] text-ink">
            {boss.name}
          </h3>
          <p className="mt-1 text-xs font-bold text-ink/55">Cooldown {formatDuration(boss.cooldown_minutes)}</p>
          <div className="mt-0.5 min-h-[2.1rem]">
            {activeCheckin ? (
              <p className="text-xs font-black text-ember">
                Volta as {formatTime(activeCheckin.cooldown_ends_at)} · {formatDuration(remainingMinutes)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <button
          className="btn-primary h-14 min-w-0 justify-center px-2 py-2 text-sm leading-tight"
          disabled={Boolean(activeCheckin)}
          onClick={() => onCheckIn(boss)}
          title={userSignedIn ? "Iniciar temporizador" : "Entrar para iniciar temporizador"}
          type="button"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="min-w-0 text-center leading-tight">{activeCheckin ? "Aguardando" : "Check-in"}</span>
        </button>
        <button
          className="btn-secondary h-14 min-w-0 justify-center px-2 py-2 text-sm leading-tight"
          onClick={() => onDetails(boss)}
          type="button"
        >
          <BookOpen className="h-4 w-4" />
          <span className="min-w-0 text-center leading-tight">Mais informações</span>
        </button>
      </div>
    </article>
  );
}

function BossInfoModal({
  boss,
  checkins,
  onCheckIn,
  onClose,
  userSignedIn
}: {
  boss: BossRecord;
  checkins: BossCheckin[];
  onCheckIn: (boss: BossRecord) => void;
  onClose: () => void;
  userSignedIn: boolean;
}) {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const completedSteps = boss.steps.filter((step) => checkedSteps[step.id]).length;
  const allStepsDone = boss.steps.length > 0 && completedSteps === boss.steps.length;
  const activeCheckin = checkins.find(
    (checkin) => checkin.boss_id === boss.id && minutesUntil(checkin.cooldown_ends_at) > 0
  );
  const remainingMinutes = activeCheckin ? minutesUntil(activeCheckin.cooldown_ends_at) : 0;

  useEffect(() => {
    setCheckedSteps({});
  }, [boss.id]);

  function toggleStep(stepId: string) {
    setCheckedSteps((current) => ({ ...current, [stepId]: !current[stepId] }));
  }

  function markAllSteps() {
    if (allStepsDone) {
      setCheckedSteps({});
      return;
    }

    setCheckedSteps(
      boss.steps.reduce<Record<string, boolean>>((items, step) => {
        items[step.id] = true;
        return items;
      }, {})
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <section className="panel max-h-[calc(100vh-2rem)] w-[min(960px,calc(100vw-2rem))] overflow-auto rounded-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/10 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ember">Boss Tracker</p>
            <h3 className="truncate text-xl font-black text-ink">{boss.name}</h3>
            {boss.popular_name && boss.full_name && boss.popular_name !== boss.full_name ? (
              <p className="truncate text-xs font-bold text-ink/55">
                {boss.full_name} · popular: {boss.popular_name}
              </p>
            ) : null}
          </div>
          <button className="icon-button" onClick={onClose} title="Fechar" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            <div className="creature-frame mx-auto h-36 w-36">
              <img alt={boss.name} className="creature-sprite" src={boss.image_url || HERO_IMAGE} />
            </div>
            <div className="rounded-lg border border-ink/10 bg-white/70 p-3 text-center">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Cooldown</p>
              <p className="mt-1 text-lg font-black text-ink">{formatDuration(boss.cooldown_minutes)}</p>
              {activeCheckin ? (
                <p className="mt-1 text-xs font-black text-ember">
                  Volta as {formatTime(activeCheckin.cooldown_ends_at)}
                </p>
              ) : null}
            </div>
            <button
              className="btn-primary w-full justify-center"
              disabled={Boolean(activeCheckin)}
              onClick={() => onCheckIn(boss)}
              title={userSignedIn ? "Iniciar temporizador" : "Entrar para iniciar temporizador"}
              type="button"
            >
              <CheckCircle2 className="h-4 w-4" />
              {activeCheckin ? "Aguardando" : "Check-in"}
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ember">
              {bossKindLabel(boss)}
            </p>
            <h3 className="truncate text-base font-black text-ink">{boss.name}</h3>
          </div>
        </div>

        <div className="grid gap-2">
          <InfoPill icon={MapPin} title="Localizacao" value={boss.location || "Localizacao a definir"} />
          {boss.location_url ? (
            <a className="btn-secondary min-h-8 justify-center px-3 py-1.5 text-xs" href={boss.location_url} rel="noreferrer" target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir localizacao
            </a>
          ) : null}
          <div className="rounded-lg border border-ink/10 bg-white/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
                <Link2 className="h-4 w-4 text-ember" />
                Acesso RubinOT
              </p>
              {boss.requires_access && boss.access_url ? (
                <a
                  className="btn-secondary min-h-8 px-3 py-1.5 text-xs"
                  href={boss.access_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver acesso
                </a>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-bold text-ink">
              {boss.requires_access ? "Precisa de acesso" : "Nao precisa"}
            </p>
          </div>
        </div>

        {boss.content_mode === "single" ? (
          <>
            <TagGroup label="Fraquezas" tags={boss.weaknesses} />
            <TagGroup label="Danos" tags={boss.damage_types} />
            <InfoBlock title="Resumo da mecanica" value={boss.mechanics} />
          </>
        ) : null}

        {boss.steps.length > 0 ? (
          <div className="rounded-lg border border-ink/10 bg-white/70 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
                <ListChecks className="h-4 w-4 text-ember" />
                {boss.content_mode === "group" ? "Bosses do grupo" : "Checklist"} {completedSteps}/{boss.steps.length}
              </p>
              <button className="btn-secondary min-h-8 px-3 py-1.5 text-xs" onClick={markAllSteps} type="button">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {allStepsDone ? "Limpar" : "Marcar todos"}
              </button>
            </div>

            <div className="space-y-2">
              {boss.steps.map((step, index) => (
                <div
                  className={clsx(
                    "grid gap-2 rounded-lg border p-2 transition",
                    checkedSteps[step.id]
                      ? "border-red-500/25 bg-red-50/80"
                      : "border-ink/10 bg-white/75"
                  )}
                  key={step.id}
                >
                  <button
                    className="flex w-full items-center gap-2 text-left"
                    onClick={() => toggleStep(step.id)}
                    type="button"
                  >
                    <span
                      className={clsx(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        checkedSteps[step.id]
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-ink/25 bg-white text-transparent"
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-ink">
                      {index + 1}. {step.name}
                    </span>
                    <span className="creature-frame h-9 w-9">
                      <img
                        alt=""
                        className="creature-sprite"
                        src={step.image_url || boss.image_url || HERO_IMAGE}
                      />
                    </span>
                  </button>
                  {step.location ? (
                    <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-ember">
                      {step.location}
                    </p>
                  ) : null}
                  {step.weaknesses.length > 0 || step.damage_types.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {step.weaknesses.map((tag) => (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-ember" key={`weak-${step.id}-${tag}`}>
                          Fraq: {tag}
                        </span>
                      ))}
                      {step.damage_types.map((tag) => (
                        <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-black text-ink/65" key={`dmg-${step.id}-${tag}`}>
                          Dano: {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {step.mechanics ? (
                    <p className="line-clamp-2 text-xs leading-5 text-ink/70">{step.mechanics}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeCheckin ? (
          <div className="rounded-lg border border-red-500/25 bg-red-50/85 p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-ember">Em cooldown</p>
            <p className="mt-1 text-sm font-black text-ink">
              Volta as {formatTime(activeCheckin.cooldown_ends_at)}
            </p>
            <p className="text-xs font-semibold text-ink/60">Falta {formatDuration(remainingMinutes)}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={onClose} type="button">
            <X className="h-4 w-4" />
            Fechar
          </button>
        </div>
          </div>
        </div>
      </section>
    </div>
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

function ServicesPanel({
  cards,
  onNavigate,
  onReview,
  onScreenshotUpload,
  user
}: {
  cards: ServiceCard[];
  onNavigate: (view: ViewKey) => void;
  onReview: (draft: ServiceReviewDraft) => Promise<void>;
  onScreenshotUpload: (file: File) => Promise<string>;
  user: { id: string; email: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ServiceCategory>("all");
  const [sort, setSort] = useState<"recent" | "low" | "high" | "rating">("recent");
  const [reviewing, setReviewing] = useState<ServiceCard | null>(null);
  const approved = cards.filter((card) => card.status === "approved");
  const topIds = useMemo(() => {
    return approved
      .filter((card) => serviceRating(card).count > 0)
      .sort((a, b) => {
        const aRating = serviceRating(a);
        const bRating = serviceRating(b);
        return bRating.average - aRating.average || bRating.count - aRating.count;
      })
      .slice(0, 3)
      .map((card) => card.id);
  }, [approved]);

  const filtered = useMemo(() => {
    return approved
      .filter((card) => {
        const text = `${card.title} ${card.provider_nick} ${card.description} ${card.provider_bio} ${card.categories.join(" ")}`.toLowerCase();
        const matchesQuery = text.includes(query.toLowerCase());
        const matchesCategory = category === "all" || card.categories.includes(category);
        return matchesQuery && matchesCategory;
      })
      .sort((a, b) => {
        if (sort === "low") {
          return serviceHourlyPrice(a) - serviceHourlyPrice(b);
        }
        if (sort === "high") {
          return serviceHourlyPrice(b) - serviceHourlyPrice(a);
        }
        if (sort === "rating") {
          return serviceRating(b).average - serviceRating(a).average || serviceRating(b).count - serviceRating(a).count;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [approved, category, query, sort]);

  return (
    <section className="space-y-4">
      <div className="panel rounded-lg p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_190px_230px_auto] xl:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
            <input
              className="input pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar serviceiro, service ou categoria"
              value={query}
            />
          </div>
          <select className="input" onChange={(event) => setCategory(event.target.value as "all" | ServiceCategory)} value={category}>
            <option value="all">Todas categorias</option>
            <option value="experience">Experiencia</option>
            <option value="bestiary">Bestiario</option>
            <option value="task">Task</option>
          </select>
          <select className="input" onChange={(event) => setSort(event.target.value as "recent" | "low" | "high" | "rating")} value={sort}>
            <option value="recent">Anunciado recentemente</option>
            <option value="low">Menor preco/hora</option>
            <option value="high">Maior preco/hora</option>
            <option value="rating">Maior avaliacao</option>
          </select>
          <button className="btn-primary justify-center" onClick={() => onNavigate("profile")} type="button">
            <Plus className="h-4 w-4" />
            Meu service
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((card) => (
          <ServicePublicCard
            card={card}
            isOwn={user?.id === card.user_id}
            isTop={topIds.includes(card.id)}
            key={card.id}
            onReview={() => setReviewing(card)}
          />
        ))}
      </div>

      {filtered.length === 0 ? <EmptyState title="Nenhum serviceiro encontrado" /> : null}

      {reviewing ? (
        <ServiceReviewModal
          card={reviewing}
          onClose={() => setReviewing(null)}
          onSave={async (draft) => {
            await onReview(draft);
            setReviewing(null);
          }}
          onScreenshotUpload={onScreenshotUpload}
          userSignedIn={Boolean(user)}
        />
      ) : null}
    </section>
  );
}

function ServicePublicCard({
  card,
  isOwn,
  isTop,
  onReview
}: {
  card: ServiceCard;
  isOwn: boolean;
  isTop: boolean;
  onReview: () => void;
}) {
  const rating = serviceRating(card);
  const hasPackage = card.package_hours > 0 && card.package_hour_price > 0;

  return (
    <article className="panel overflow-hidden rounded-lg">
      <div className="relative h-28 bg-ink">
        <img alt="" className="h-full w-full object-cover" src={card.banner_url || SERVICE_BANNER_PLACEHOLDER} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {serviceIsNew(card) ? <Badge tone="fire">Novo anuncio</Badge> : null}
          {isTop ? <Badge tone="fire">Top 3</Badge> : null}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-red-600 text-white">
            {card.provider_avatar_url ? (
              <img alt="" className="h-full w-full object-cover" src={card.provider_avatar_url} />
            ) : (
              <UserRound className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-lg font-black leading-tight text-ink">{card.title}</p>
            <p className="truncate text-sm font-bold text-ink/60">{card.provider_nick || "Serviceiro"}</p>
          </div>
          <StarRatingDisplay average={rating.average} count={rating.count} />
        </div>

        <div className="flex flex-wrap gap-2">
          {card.categories.map((item) => (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-ember" key={item}>
              {serviceCategoryLabels[item]}
            </span>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Metric compact label="Preco base" value={`R$ ${card.price_amount.toFixed(2)} / ${card.price_hours}h`} />
          <Metric compact label="Hora media" value={`R$ ${serviceHourlyPrice(card).toFixed(2)}`} />
          {hasPackage ? (
            <Metric compact label="Pacote" value={`${card.package_hours}h por R$ ${card.package_hour_price.toFixed(2)}/h`} />
          ) : null}
        </div>

        <p className="line-clamp-3 text-sm leading-6 text-ink/70">{card.description}</p>
        <InfoBlock title="Sobre o serviceiro" value={card.provider_bio} />

        <div className="grid grid-cols-2 gap-2">
          <a className="btn-primary h-11 justify-center px-2 text-sm" href={whatsappLink(card.whatsapp, `Ola, vim pelo Rubinot Help sobre ${card.title}`)} rel="noreferrer" target="_blank">
            <Phone className="h-4 w-4" />
            WhatsApp
          </a>
          <button className="btn-secondary h-11 justify-center px-2 text-sm" disabled={isOwn} onClick={onReview} type="button">
            <Star className="h-4 w-4" />
            Avaliar
          </button>
        </div>
      </div>
    </article>
  );
}

function ServiceReviewModal({
  card,
  onClose,
  onSave,
  onScreenshotUpload,
  userSignedIn
}: {
  card: ServiceCard;
  onClose: () => void;
  onSave: (draft: ServiceReviewDraft) => Promise<void>;
  onScreenshotUpload: (file: File) => Promise<string>;
  userSignedIn: boolean;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    const url = await onScreenshotUpload(file);
    setScreenshotUrl(url);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!userSignedIn) {
      return;
    }

    setBusy(true);
    try {
      await onSave({ service_card_id: card.id, rating, comment, screenshot_url: screenshotUrl });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <form className="panel max-h-[calc(100vh-2rem)] w-[min(620px,calc(100vw-2rem))] overflow-auto rounded-lg p-5" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ember">Avaliacao de service</p>
            <h3 className="text-xl font-black text-ink">{card.title}</h3>
          </div>
          <button className="icon-button" onClick={onClose} title="Fechar" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 rounded-lg border border-red-500/15 bg-red-50/80 p-3 text-sm font-semibold leading-6 text-ink/70">
          Sua avaliacao ajuda outros jogadores a escolherem um serviceiro confiavel. O comentario passa por revisao do admin antes de aparecer.
        </p>

        <div className="space-y-4">
          <Field label="Estrelas">
            <StarRatingInput value={rating} onChange={setRating} />
          </Field>
          <Field label="Comentario">
            <textarea
              className="input min-h-28"
              minLength={30}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Conte como foi o atendimento, prazo, comunicacao e resultado. Minimo 30 caracteres."
              required
              value={comment}
            />
          </Field>
          <Field label="Print do service">
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-secondary inline-flex cursor-pointer">
                <Upload className="h-4 w-4" />
                Enviar print
                <input
                  accept="image/png,image/jpeg,image/webp,image/*"
                  className="hidden"
                  onChange={(event) => handleUpload(event.target.files?.[0])}
                  required={!screenshotUrl}
                  type="file"
                />
              </label>
              {screenshotUrl ? <span className="text-sm font-bold text-ink/65">Print anexada</span> : null}
            </div>
          </Field>
          <button className="btn-primary w-full justify-center" disabled={busy || !userSignedIn} type="submit">
            <Send className="h-4 w-4" />
            {userSignedIn ? "Enviar avaliacao" : "Entre para avaliar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfilePanel({
  currentUser,
  userEmail,
  profile,
  serviceCards,
  onAvatarUpload,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onSignUp,
  onSave,
  onServiceBannerUpload,
  onServiceDelete,
  onServiceSave
}: {
  currentUser: { id: string; email: string } | null;
  userEmail: string | null;
  profile: Profile | null;
  serviceCards: ServiceCard[];
  onAvatarUpload: (file: File) => Promise<string>;
  onEmailChange: (email: string) => Promise<void>;
  onPasswordChange: (password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, nick: string) => Promise<void>;
  onSave: (patch: Partial<Profile>) => Promise<void>;
  onServiceBannerUpload: (file: File) => Promise<string>;
  onServiceDelete: (id: string) => Promise<void>;
  onServiceSave: (draft: ServiceCardDraft) => Promise<void>;
}) {
  if (!userEmail || !profile || !currentUser) {
    return <AuthPanel onSignIn={onSignIn} onSignUp={onSignUp} />;
  }

  return (
    <UserPanel
      currentUser={currentUser}
      onAvatarUpload={onAvatarUpload}
      onEmailChange={onEmailChange}
      onPasswordChange={onPasswordChange}
      onProfileSave={onSave}
      onServiceBannerUpload={onServiceBannerUpload}
      onServiceDelete={onServiceDelete}
      onServiceSave={onServiceSave}
      profile={profile}
      serviceCards={serviceCards}
      userEmail={userEmail}
    />
  );
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

function UserPanel({
  currentUser,
  onAvatarUpload,
  onEmailChange,
  onPasswordChange,
  onProfileSave,
  onServiceBannerUpload,
  onServiceDelete,
  onServiceSave,
  profile,
  serviceCards,
  userEmail
}: {
  currentUser: { id: string; email: string };
  onAvatarUpload: (file: File) => Promise<string>;
  onEmailChange: (email: string) => Promise<void>;
  onPasswordChange: (password: string) => Promise<void>;
  onProfileSave: (patch: Partial<Profile>) => Promise<void>;
  onServiceBannerUpload: (file: File) => Promise<string>;
  onServiceDelete: (id: string) => Promise<void>;
  onServiceSave: (draft: ServiceCardDraft) => Promise<void>;
  profile: Profile;
  serviceCards: ServiceCard[];
  userEmail: string;
}) {
  const [tab, setTab] = useState<"profile" | "service" | "marketplace">("profile");
  const myService = serviceCards.find((card) => card.user_id === currentUser.id) ?? null;
  const tabs: Array<{ key: "profile" | "service" | "marketplace"; label: string; icon: typeof Activity }> = [
    { key: "profile", label: "Perfil e seguranca", icon: UserRound },
    { key: "service", label: "Meu service", icon: Swords },
    { key: "marketplace", label: "Itens no Marketplace", icon: Store }
  ];

  return (
    <section className="space-y-4">
      <div className="panel rounded-lg p-4">
        <div className="grid gap-2 md:grid-cols-3">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
            <button
              className={clsx(
                "flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-black transition",
                tab === item.key ? "border-ember bg-red-600 text-white" : "border-ink/10 bg-white/75 text-ink hover:bg-red-50"
              )}
              key={item.key}
              onClick={() => setTab(item.key)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
            );
          })}
        </div>
      </div>

      {tab === "profile" ? (
        <UserProfileForm
          onAvatarUpload={onAvatarUpload}
          onEmailChange={onEmailChange}
          onPasswordChange={onPasswordChange}
          onSave={onProfileSave}
          profile={profile}
          userEmail={userEmail}
        />
      ) : null}

      {tab === "service" ? (
        <UserServiceManager
          card={myService}
          onBannerUpload={onServiceBannerUpload}
          onDelete={onServiceDelete}
          onSave={onServiceSave}
          profile={profile}
        />
      ) : null}

      {tab === "marketplace" ? (
        <section className="panel rounded-lg p-6 text-center">
          <Store className="mx-auto h-10 w-10 text-ember" />
          <h3 className="mt-3 text-xl font-black text-ink">Marketplace em breve</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
            O painel ja esta reservado para cadastrar itens. A proxima etapa pode usar a mesma logica de aprovacao dos services.
          </p>
        </section>
      ) : null}
    </section>
  );
}

function UserProfileForm({
  profile,
  userEmail,
  onAvatarUpload,
  onEmailChange,
  onPasswordChange,
  onSave
}: {
  profile: Profile;
  userEmail: string;
  onAvatarUpload: (file: File) => Promise<string>;
  onEmailChange: (email: string) => Promise<void>;
  onPasswordChange: (password: string) => Promise<void>;
  onSave: (patch: Partial<Profile>) => Promise<void>;
}) {
  const [nick, setNick] = useState(profile.nick);
  const [email, setEmail] = useState(userEmail);
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [optIn, setOptIn] = useState(profile.whatsapp_opt_in);
  const [busy, setBusy] = useState(false);

  async function handleAvatar(file: File | undefined) {
    if (!file) {
      return;
    }

    const url = await onAvatarUpload(file);
    setAvatarUrl(url);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({ nick, whatsapp, avatar_url: avatarUrl, whatsapp_opt_in: optIn });
      if (email.trim().toLowerCase() !== userEmail.toLowerCase()) {
        await onEmailChange(email);
      }
      if (password) {
        await onPasswordChange(password);
        setPassword("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mx-auto max-w-3xl rounded-lg p-5">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-red-600 text-white">
            {avatarUrl ? <img alt="" className="h-full w-full object-cover" src={avatarUrl} /> : <UserRound className="h-9 w-9" />}
          </div>
          <label className="btn-secondary inline-flex cursor-pointer">
            <ImageIcon className="h-4 w-4" />
            Foto de perfil
            <input accept="image/png,image/jpeg,image/webp,image/*" className="hidden" onChange={(event) => handleAvatar(event.target.files?.[0])} type="file" />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nick">
            <input className="input" onChange={(event) => setNick(event.target.value)} required value={nick} />
          </Field>
          <Field label="WhatsApp">
            <input className="input" inputMode="numeric" onChange={(event) => setWhatsapp(event.target.value.replace(/\D/g, ""))} placeholder="55DDDNUMERO" value={whatsapp} />
          </Field>
          <Field label="Email">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
              <input className="input pl-9" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </div>
          </Field>
          <Field label="Nova senha">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
              <input className="input pl-9" minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="Deixe vazio para nao mudar" type="password" value={password} />
            </div>
          </Field>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-3 text-sm font-bold text-ink">
          <input checked={optIn} className="h-4 w-4 accent-ember" onChange={(event) => setOptIn(event.target.checked)} type="checkbox" />
          Receber alertas de boss pelo WhatsApp
        </label>
        <button className="btn-primary" disabled={busy} type="submit">
          <Save className="h-4 w-4" />
          Salvar painel do usuario
        </button>
      </form>
    </section>
  );
}

function UserServiceManager({
  card,
  onBannerUpload,
  onDelete,
  onSave,
  profile
}: {
  card: ServiceCard | null;
  onBannerUpload: (file: File) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
  onSave: (draft: ServiceCardDraft) => Promise<void>;
  profile: Profile;
}) {
  const draft = card
    ? {
        title: card.title,
        categories: card.categories,
        price_amount: card.price_amount,
        price_hours: card.price_hours,
        package_hours: card.package_hours,
        package_hour_price: card.package_hour_price,
        description: card.description,
        provider_bio: card.provider_bio,
        whatsapp: card.whatsapp,
        banner_url: card.banner_url,
        provider_nick: card.provider_nick,
        provider_avatar_url: card.provider_avatar_url,
        id: card.id
      }
    : { ...emptyServiceDraft, whatsapp: profile.whatsapp, provider_nick: profile.nick, provider_avatar_url: profile.avatar_url };

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(420px,560px)_1fr]">
      <ServiceEditorForm
        initial={draft}
        onBannerUpload={onBannerUpload}
        onSubmit={onSave}
        submitLabel={card ? "Enviar alteracao para revisao" : "Cadastrar service"}
      />
      <div className="panel rounded-lg p-5">
        <h3 className="text-lg font-black text-ink">Status do meu service</h3>
        {card ? (
          <div className="mt-4 space-y-3">
            <StatusPill status={card.status} />
            {card.status === "rejected" && card.rejection_reason ? (
              <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{card.rejection_reason}</p>
            ) : null}
            <ServicePublicCard card={card} isOwn isTop={false} onReview={() => undefined} />
            <button className="btn-secondary w-full justify-center" onClick={() => onDelete(card.id)} type="button">
              <Trash2 className="h-4 w-4" />
              Excluir meu service
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold leading-6 text-ink/60">
            Cada conta pode ter 1 card de service. Depois de salvar, ele fica pendente ate o admin aprovar.
          </p>
        )}
      </div>
    </section>
  );
}

function ServiceEditorForm({
  initial,
  onBannerUpload,
  onSubmit,
  submitLabel
}: {
  initial: ServiceCardDraft;
  onBannerUpload: (file: File) => Promise<string>;
  onSubmit: (draft: ServiceCardDraft) => Promise<void>;
  submitLabel: string;
}) {
  const [draft, setDraft] = useState<ServiceCardDraft>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  function toggleCategory(category: ServiceCategory) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category]
    }));
  }

  async function handleBanner(file: File | undefined) {
    if (!file) {
      return;
    }

    const url = await onBannerUpload(file);
    setDraft((current) => ({ ...current, banner_url: url }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(draft);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel space-y-4 rounded-lg p-5" onSubmit={handleSubmit}>
      <div>
        <h3 className="text-lg font-black text-ink">Card de service</h3>
        <p className="mt-1 text-xs font-semibold text-ink/55">Banner recomendado: 1200x360 px.</p>
      </div>
      <div className="h-32 overflow-hidden rounded-lg border border-ink/10 bg-ink">
        <img alt="" className="h-full w-full object-cover" src={draft.banner_url || SERVICE_BANNER_PLACEHOLDER} />
      </div>
      <label className="btn-secondary inline-flex cursor-pointer">
        <Upload className="h-4 w-4" />
        Enviar banner
        <input accept="image/png,image/jpeg,image/webp,image/*" className="hidden" onChange={(event) => handleBanner(event.target.files?.[0])} type="file" />
      </label>
      <Field label="Titulo do service">
        <input className="input" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: Bestiario e task com horario marcado" required value={draft.title} />
      </Field>
      <Field label="Tipo de service">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(serviceCategoryLabels) as ServiceCategory[]).map((category) => (
            <button
              className={clsx(
                "rounded-md border px-3 py-2 text-sm font-black transition",
                draft.categories.includes(category) ? "border-ember bg-red-600 text-white" : "border-ink/10 bg-white text-ink hover:bg-red-50"
              )}
              key={category}
              onClick={() => toggleCategory(category)}
              type="button"
            >
              {serviceCategoryLabels[category]}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Valor em real">
          <input className="input" min={0} onChange={(event) => setDraft((current) => ({ ...current, price_amount: Number(event.target.value) }))} step="0.01" type="number" value={draft.price_amount} />
        </Field>
        <Field label="Equivale a horas">
          <input className="input" min={0.25} onChange={(event) => setDraft((current) => ({ ...current, price_hours: Number(event.target.value) }))} step="0.25" type="number" value={draft.price_hours} />
        </Field>
        <Field label="Pacote em horas">
          <input className="input" min={0} onChange={(event) => setDraft((current) => ({ ...current, package_hours: Number(event.target.value) }))} step="0.25" type="number" value={draft.package_hours} />
        </Field>
        <Field label="Valor por hora no pacote">
          <input className="input" min={0} onChange={(event) => setDraft((current) => ({ ...current, package_hour_price: Number(event.target.value) }))} step="0.01" type="number" value={draft.package_hour_price} />
        </Field>
      </div>
      <Field label="WhatsApp de contato">
        <input className="input" inputMode="numeric" onChange={(event) => setDraft((current) => ({ ...current, whatsapp: event.target.value.replace(/\D/g, "") }))} placeholder="55DDDNUMERO" required value={draft.whatsapp} />
      </Field>
      <Field label="Descricao breve do servico">
        <textarea className="input min-h-24" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} required value={draft.description} />
      </Field>
      <Field label="Sobre o serviceiro">
        <textarea className="input min-h-24" onChange={(event) => setDraft((current) => ({ ...current, provider_bio: event.target.value }))} required value={draft.provider_bio} />
      </Field>
      <button className="btn-primary w-full justify-center" disabled={busy} type="submit">
        <Save className="h-4 w-4" />
        {submitLabel}
      </button>
    </form>
  );
}

function AdminHubPanel({
  isAdmin,
  onNavigate
}: {
  isAdmin: boolean;
  onNavigate: (view: ViewKey) => void;
}) {
  if (!isAdmin) {
    return <EmptyState title="Painel admin bloqueado" />;
  }

  const items: Array<{
    title: string;
    description: string;
    icon: typeof Activity;
    view?: ViewKey;
    disabled?: boolean;
  }> = [
    {
      title: "Boss Tracker",
      description: "Cadastrar bosses, cooldown, acesso, GIF e checklist.",
      icon: Skull,
      view: "adminBossTracker"
    },
    {
      title: "Comprar/Vender RC",
      description: "Configurar ofertas, regras e automacoes de RC.",
      icon: Gavel,
      disabled: true
    },
    {
      title: "Marketplace",
      description: "Editar itens, anuncios e filtros do marketplace.",
      icon: Store,
      disabled: true
    },
    {
      title: "Services",
      description: "Gerenciar servicos, categorias e pedidos.",
      icon: Swords,
      view: "adminServices"
    },
    {
      title: "Bestiario Tracker",
      description: "Area futura para monstros, charms e progresso.",
      icon: BookOpen,
      disabled: true
    }
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className={clsx(
              "panel flex min-h-44 flex-col items-start justify-between rounded-lg p-5 text-left transition hover:-translate-y-0.5",
              item.disabled && "cursor-not-allowed opacity-65 hover:translate-y-0"
            )}
            disabled={item.disabled}
            key={item.title}
            onClick={() => item.view && onNavigate(item.view)}
            type="button"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-white shadow-[0_0_24px_rgba(220,38,38,0.24)]">
              <Icon className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-black text-ink">{item.title}</span>
              <span className="mt-1 block text-sm font-semibold leading-6 text-ink/65">
                {item.description}
              </span>
            </span>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-ember">
              {item.disabled ? "Em breve" : "Editar"}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function AdminServicesPanel({
  cards,
  isAdmin,
  onDelete,
  onReviewDelete,
  onReviewStatus,
  onSave,
  onStatus
}: {
  cards: ServiceCard[];
  isAdmin: boolean;
  onDelete: (id: string) => Promise<void>;
  onReviewDelete: (id: string) => Promise<void>;
  onReviewStatus: (id: string, status: ModerationStatus, reason?: string) => Promise<void>;
  onSave: (card: ServiceCard) => Promise<void>;
  onStatus: (id: string, status: ModerationStatus, reason?: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<ServiceCard | null>(null);
  const [reason, setReason] = useState("");
  const pendingReviews = cards.flatMap((card) =>
    card.reviews.filter((review) => review.status === "pending").map((review) => ({ review, card }))
  );

  if (!isAdmin) {
    return <EmptyState title="Painel admin bloqueado" />;
  }

  async function rejectCard(card: ServiceCard) {
    const text = reason || "Recusado pelo admin.";
    await onStatus(card.id, "rejected", text);
    setReason("");
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(420px,520px)_1fr]">
      <div className="space-y-4">
        {editing ? (
          <AdminServiceEditForm card={editing} onCancel={() => setEditing(null)} onSave={async (card) => {
            await onSave(card);
            setEditing(null);
          }} />
        ) : (
          <div className="panel rounded-lg p-5">
            <h3 className="text-lg font-black text-ink">Fila de reviews</h3>
            {pendingReviews.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-ink/60">Nenhuma avaliacao pendente.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingReviews.map(({ review, card }) => (
                  <div className="rounded-lg border border-ink/10 bg-white/75 p-3" key={review.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-ink">{card.title}</p>
                        <StarRatingDisplay average={review.rating} count={1} />
                      </div>
                      <a className="btn-secondary min-h-8 px-3 py-1.5 text-xs" href={review.screenshot_url} rel="noreferrer" target="_blank">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Print
                      </a>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/70">{review.comment}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-primary min-h-8 px-3 py-1.5 text-xs" onClick={() => onReviewStatus(review.id, "approved")} type="button">
                        Aprovar
                      </button>
                      <button className="btn-secondary min-h-8 px-3 py-1.5 text-xs" onClick={() => onReviewStatus(review.id, "rejected", "Recusada pelo admin.")} type="button">
                        Recusar
                      </button>
                      <button className="icon-button" onClick={() => onReviewDelete(review.id)} title="Excluir avaliacao" type="button">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel rounded-lg p-5">
        <h3 className="text-lg font-black text-ink">Services cadastrados</h3>
        <Field label="Motivo de recusa">
          <input className="input" onChange={(event) => setReason(event.target.value)} placeholder="Opcional para o card selecionado" value={reason} />
        </Field>
        <div className="compact-scroll mt-4 max-h-[900px] space-y-3 overflow-auto pr-1">
          {cards.map((card) => (
            <div className="grid gap-3 rounded-lg border border-ink/10 bg-white/75 p-3 md:grid-cols-[92px_1fr_auto]" key={card.id}>
              <img alt="" className="h-16 w-24 rounded-md object-cover" src={card.banner_url || SERVICE_BANNER_PLACEHOLDER} />
              <div className="min-w-0">
                <p className="truncate font-black text-ink">{card.title || "Sem titulo"}</p>
                <p className="text-sm font-semibold text-ink/60">{card.provider_nick || "Serviceiro"} · R$ {serviceHourlyPrice(card).toFixed(2)}/h</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusPill status={card.status} />
                  <span className="text-xs font-bold text-ink/50">{card.reviews.length} reviews</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="icon-button" onClick={() => setEditing(card)} title="Editar" type="button">
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="btn-primary min-h-9 px-3 py-1.5 text-xs" onClick={() => onStatus(card.id, "approved")} type="button">
                  Aceitar
                </button>
                <button className="btn-secondary min-h-9 px-3 py-1.5 text-xs" onClick={() => rejectCard(card)} type="button">
                  Recusar
                </button>
                <button className="icon-button" onClick={() => onDelete(card.id)} title="Excluir" type="button">
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

function AdminServiceEditForm({
  card,
  onCancel,
  onSave
}: {
  card: ServiceCard;
  onCancel: () => void;
  onSave: (card: ServiceCard) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ServiceCard>(card);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(card);
  }, [card]);

  function toggleCategory(category: ServiceCategory) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category]
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave(draft);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel space-y-4 rounded-lg p-5" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-ink">Editar service</h3>
        <button className="icon-button" onClick={onCancel} title="Cancelar" type="button">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Field label="Titulo">
        <input className="input" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} value={draft.title} />
      </Field>
      <Field label="Serviceiro">
        <input className="input" onChange={(event) => setDraft((current) => ({ ...current, provider_nick: event.target.value }))} value={draft.provider_nick} />
      </Field>
      <Field label="Categorias">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(serviceCategoryLabels) as ServiceCategory[]).map((category) => (
            <button
              className={clsx(
                "rounded-md border px-3 py-2 text-sm font-black transition",
                draft.categories.includes(category) ? "border-ember bg-red-600 text-white" : "border-ink/10 bg-white text-ink hover:bg-red-50"
              )}
              key={category}
              onClick={() => toggleCategory(category)}
              type="button"
            >
              {serviceCategoryLabels[category]}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Valor">
          <input className="input" onChange={(event) => setDraft((current) => ({ ...current, price_amount: Number(event.target.value) }))} step="0.01" type="number" value={draft.price_amount} />
        </Field>
        <Field label="Horas">
          <input className="input" onChange={(event) => setDraft((current) => ({ ...current, price_hours: Number(event.target.value) }))} step="0.25" type="number" value={draft.price_hours} />
        </Field>
      </div>
      <Field label="Descricao">
        <textarea className="input min-h-24" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description} />
      </Field>
      <Field label="Sobre">
        <textarea className="input min-h-24" onChange={(event) => setDraft((current) => ({ ...current, provider_bio: event.target.value }))} value={draft.provider_bio} />
      </Field>
      <button className="btn-primary w-full justify-center" disabled={busy} type="submit">
        <Save className="h-4 w-4" />
        Salvar edicao
      </button>
    </form>
  );
}

function AdminPanel({
  bosses,
  isAdmin,
  onSave,
  onDelete,
  onSetPublished
}: {
  bosses: BossRecord[];
  isAdmin: boolean;
  onSave: (draft: BossDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetPublished: (id: string, isActive: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState<BossDraft>(emptyBossDraft);
  const [weaknessText, setWeaknessText] = useState("");
  const [damageText, setDamageText] = useState("");
  const [cooldownUnit, setCooldownUnit] = useState<"hours" | "minutes">("hours");
  const [busy, setBusy] = useState(false);
  const cooldownValue =
    cooldownUnit === "hours" ? Number((draft.cooldown_minutes / 60).toFixed(2)) : draft.cooldown_minutes;

  if (!isAdmin) {
    return <EmptyState title="Painel admin bloqueado" />;
  }

  function editBoss(boss: BossRecord) {
    const contentMode = boss.content_mode === "group" || boss.steps.length > 0 ? "group" : "single";
    const steps = boss.steps.map((step, index) => normalizeBossStep(step, index));
    setDraft({
      ...boss,
      content_mode: contentMode,
      steps: contentMode === "group" ? resizeBossSteps(steps, Math.max(1, steps.length)) : steps
    });
    setWeaknessText(joinTags(boss.weaknesses));
    setDamageText(joinTags(boss.damage_types));
    setCooldownUnit(boss.cooldown_minutes % 60 === 0 ? "hours" : "minutes");
  }

  function resetDraft() {
    setDraft({ ...emptyBossDraft, steps: [] });
    setWeaknessText("");
    setDamageText("");
    setCooldownUnit("hours");
  }

  function setContentMode(contentMode: BossDraft["content_mode"]) {
    setDraft((current) => ({
      ...current,
      content_mode: contentMode,
      steps: contentMode === "group" ? resizeBossSteps(current.steps, Math.max(1, current.steps.length)) : current.steps
    }));
  }

  function updateGroupCount(value: string) {
    const parsed = Number(value);
    setDraft((current) => ({
      ...current,
      content_mode: "group",
      steps: resizeBossSteps(current.steps, Number.isFinite(parsed) ? parsed : 1)
    }));
  }

  function updateCooldown(value: string) {
    const parsed = Number(value);
    const nextMinutes =
      cooldownUnit === "hours" ? Math.max(1, Math.round(parsed * 60)) : Math.max(1, Math.round(parsed));
    setDraft((current) => ({ ...current, cooldown_minutes: Number.isFinite(nextMinutes) ? nextMinutes : 1 }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const isGroup = draft.content_mode === "group";
      await onSave({
        ...draft,
        content_mode: draft.content_mode,
        weaknesses: isGroup ? [] : splitTags(weaknessText),
        damage_types: isGroup ? [] : splitTags(damageText),
        hp: 0,
        mana: 0,
        mechanics: isGroup ? "" : draft.mechanics,
        access_notes: "",
        recommended_equipment: "",
        youtube_url: "",
        cooldown_minutes: Number(draft.cooldown_minutes) || 60,
        steps: isGroup
          ? draft.steps
              .map((step, index) => ({
                ...normalizeBossStep(step, index),
                name: step.name.trim()
              }))
              .filter((step) => step.name)
          : []
      });
      resetDraft();
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

  function updateStep(index: number, patch: Partial<BossDraft["steps"][number]>) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, itemIndex) =>
        itemIndex === index ? { ...step, ...patch } : step
      )
    }));
  }

  async function handleStepUpload(index: number, file: File | undefined) {
    if (!file) {
      return;
    }

    const url = await uploadBossImage(file);
    updateStep(index, { image_url: url });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(420px,520px)_1fr]">
      <form className="panel space-y-4 rounded-lg p-5" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-ink">{draft.id ? "Editar boss" : "Novo boss"}</h3>
          <button
            className="icon-button"
            onClick={resetDraft}
            title="Limpar formulário"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-lg border border-ink/10 bg-white/70 p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Formato do card</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className={clsx(
                "rounded-md border px-3 py-2 text-sm font-black transition",
                draft.content_mode === "single"
                  ? "border-ember bg-red-500 text-white"
                  : "border-ink/10 bg-white text-ink hover:bg-red-50"
              )}
              onClick={() => setContentMode("single")}
              type="button"
            >
              1 boss
            </button>
            <button
              className={clsx(
                "rounded-md border px-3 py-2 text-sm font-black transition",
                draft.content_mode === "group"
                  ? "border-ember bg-red-500 text-white"
                  : "border-ink/10 bg-white text-ink hover:bg-red-50"
              )}
              onClick={() => setContentMode("group")}
              type="button"
            >
              Grupo de bosses
            </button>
          </div>
        </div>

        <div className="creature-frame mx-auto h-28 w-28">
          <img
            alt={draft.name || "Imagem do boss"}
            className="creature-sprite"
            src={draft.image_url || HERO_IMAGE}
          />
        </div>

        <Field label="Imagem GIF/PNG">
          <label className="btn-secondary inline-flex cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload
            <input
              accept="image/gif,image/png,image/jpeg,image/webp,image/*"
              className="hidden"
              onChange={(event) => handleUpload(event.target.files?.[0])}
              type="file"
            />
          </label>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome completo">
            <div className="grid gap-2">
              <input
                className="input"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    full_name: event.target.value,
                    name: current.display_name_mode === "full" ? event.target.value : current.name
                  }))
                }
                required
                value={draft.full_name}
              />
              <label className="flex items-center gap-2 rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-ink/65">
                <input
                  checked={draft.display_name_mode === "full"}
                  className="h-4 w-4 accent-ember"
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      display_name_mode: "full",
                      name: current.full_name || current.name
                    }))
                  }
                  type="checkbox"
                />
                Mostrar no card
              </label>
            </div>
          </Field>
          <Field label="Nome popular">
            <div className="grid gap-2">
              <input
                className="input"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    popular_name: event.target.value,
                    name: current.display_name_mode === "popular" ? event.target.value : current.name
                  }))
                }
                value={draft.popular_name}
              />
              <label className="flex items-center gap-2 rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-ink/65">
                <input
                  checked={draft.display_name_mode === "popular"}
                  className="h-4 w-4 accent-ember"
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      display_name_mode: "popular",
                      name: current.popular_name || current.full_name || current.name
                    }))
                  }
                  type="checkbox"
                />
                Mostrar no card
              </label>
            </div>
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
          <Field label="Cooldown">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <input
                className="input"
                min={cooldownUnit === "hours" ? 0.25 : 1}
                onChange={(event) => updateCooldown(event.target.value)}
                step={cooldownUnit === "hours" ? 0.25 : 1}
                type="number"
                value={cooldownValue}
              />
              <select
                className="input"
                onChange={(event) => setCooldownUnit(event.target.value as "hours" | "minutes")}
                value={cooldownUnit}
              >
                <option value="hours">Horas</option>
                <option value="minutes">Minutos</option>
              </select>
            </div>
          </Field>
          <Field label="Localizacao">
            <input
              className="input"
              onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
              value={draft.location}
            />
          </Field>
          <Field label="Link da localizacao">
            <input
              className="input"
              onChange={(event) => setDraft((current) => ({ ...current, location_url: event.target.value }))}
              placeholder="https://..."
              type="url"
              value={draft.location_url}
            />
          </Field>
          <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-3 text-sm font-bold text-ink">
            <input
              checked={draft.requires_access}
              className="h-4 w-4 accent-ember"
              onChange={(event) =>
                setDraft((current) => ({ ...current, requires_access: event.target.checked }))
              }
              type="checkbox"
            />
            Precisa de acesso no RubinOT
          </label>
        </div>

        {draft.requires_access ? (
          <Field label="Link do acesso">
            <input
              className="input"
              onChange={(event) => setDraft((current) => ({ ...current, access_url: event.target.value }))}
              placeholder="https://..."
              type="url"
              value={draft.access_url}
            />
          </Field>
        ) : null}

        {draft.content_mode === "single" ? (
          <>
            <Field label="Fraquezas">
              <input className="input" onChange={(event) => setWeaknessText(event.target.value)} value={weaknessText} />
            </Field>
            <Field label="Danos">
              <input className="input" onChange={(event) => setDamageText(event.target.value)} value={damageText} />
            </Field>
            <Field label="Resumo da mecanica">
              <textarea
                className="input min-h-24"
                onChange={(event) => setDraft((current) => ({ ...current, mechanics: event.target.value }))}
                value={draft.mechanics}
              />
            </Field>
          </>
        ) : (
          <div className="rounded-lg border border-ink/10 bg-white/70 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_150px] md:items-end">
              <div>
                <p className="text-sm font-black text-ink">Bosses do grupo</p>
                <p className="text-xs font-semibold text-ink/55">
                  Cada card abaixo vira um boss interno do grupo, com informacoes proprias.
                </p>
              </div>
              <Field label="Quantidade">
                <input
                  className="input"
                  max={20}
                  min={1}
                  onChange={(event) => updateGroupCount(event.target.value)}
                  type="number"
                  value={Math.max(1, draft.steps.length)}
                />
              </Field>
            </div>

            <div className="mt-4 space-y-4">
              {draft.steps.map((step, index) => (
                <div className="rounded-lg border border-ink/10 bg-white p-3" key={step.id}>
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
                    Boss {index + 1}
                  </p>

                  <div className="grid gap-3 md:grid-cols-[96px_1fr]">
                    <div className="creature-frame h-24 w-24">
                      <img
                        alt={step.name || `Boss ${index + 1}`}
                        className="creature-sprite"
                        src={step.image_url || draft.image_url || HERO_IMAGE}
                      />
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Nome do boss">
                          <input
                            className="input"
                            onChange={(event) => updateStep(index, { name: event.target.value })}
                            placeholder="GT 1, Last GT..."
                            required
                            value={step.name}
                          />
                        </Field>
                        <Field label="Localizacao do boss">
                          <input
                            className="input"
                            onChange={(event) => updateStep(index, { location: event.target.value })}
                            value={step.location}
                          />
                        </Field>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Fraquezas">
                          <input
                            className="input"
                            onChange={(event) => updateStep(index, { weaknesses: splitTags(event.target.value) })}
                            value={joinTags(step.weaknesses)}
                          />
                        </Field>
                        <Field label="Danos">
                          <input
                            className="input"
                            onChange={(event) => updateStep(index, { damage_types: splitTags(event.target.value) })}
                            value={joinTags(step.damage_types)}
                          />
                        </Field>
                      </div>
                      <Field label="Resumo/mecanica do boss">
                        <textarea
                          className="input min-h-20"
                          onChange={(event) => updateStep(index, { mechanics: event.target.value })}
                          value={step.mechanics}
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <label className="btn-secondary inline-flex cursor-pointer">
                          <Upload className="h-4 w-4" />
                          Foto do boss
                          <input
                            accept="image/gif,image/png,image/jpeg,image/webp,image/*"
                            className="hidden"
                            onChange={(event) => handleStepUpload(index, event.target.files?.[0])}
                            type="file"
                          />
                        </label>
                        <Field label="URL da imagem">
                          <input
                            className="input"
                            onChange={(event) => updateStep(index, { image_url: event.target.value })}
                            placeholder="Opcional"
                            value={step.image_url}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-3 text-sm font-bold text-ink">
          <input
            checked={draft.is_active}
            className="h-4 w-4 accent-ember"
            onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))}
            type="checkbox"
          />
          Publicado no Boss Tracker
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
              <div className="creature-frame h-[72px] w-[72px]">
                <img alt={boss.name} className="creature-sprite" src={boss.image_url || HERO_IMAGE} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-ink">{boss.name}</p>
                <p className="text-sm text-ink/65">
                  {bossKindLabel(boss)} · cooldown {formatDuration(boss.cooldown_minutes)}
                </p>
                <p className="truncate text-xs text-ink/55">
                  {boss.location || "Sem localizacao"} · {boss.requires_access ? "Com acesso" : "Sem acesso"}
                  {boss.content_mode === "group" && boss.steps.length ? ` · ${boss.steps.length} bosses` : ""}
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ember">
                  {boss.is_active ? "Publicado" : "Oculto"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="icon-button" onClick={() => editBoss(boss)} title="Editar" type="button">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  className="icon-button"
                  onClick={() => onSetPublished(boss.id, !boss.is_active)}
                  title={boss.is_active ? "Ocultar do Boss Tracker" : "Publicar no Boss Tracker"}
                  type="button"
                >
                  {boss.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  className="icon-button"
                  onClick={() => onDelete(boss.id)}
                  title="Excluir do catalogo"
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

function StatusPill({ status }: { status: ModerationStatus }) {
  const label = status === "approved" ? "Aprovado" : status === "rejected" ? "Recusado" : "Pendente";
  return (
    <span
      className={clsx(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em]",
        status === "approved" && "bg-emerald-100 text-emerald-800",
        status === "pending" && "bg-amber-100 text-amber-800",
        status === "rejected" && "bg-red-100 text-red-800"
      )}
    >
      {label}
    </span>
  );
}

function StarRatingDisplay({ average, count }: { average: number; count: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1 text-xs font-black text-ink/65">
      <Star className={clsx("h-4 w-4", average > 0 ? "fill-red-500 text-red-500" : "text-ink/25")} />
      <span>{average > 0 ? average.toFixed(1) : "Novo"}</span>
      <span className="font-semibold text-ink/45">({count})</span>
    </div>
  );
}

function StarRatingInput({ onChange, value }: { onChange: (value: number) => void; value: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((item) => (
        <button className="rounded-md p-1 hover:bg-red-50" key={item} onClick={() => onChange(item)} type="button">
          <Star className={clsx("h-7 w-7", item <= value ? "fill-red-500 text-red-500" : "text-ink/25")} />
        </button>
      ))}
    </div>
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

function InfoPill({
  icon: Icon,
  title,
  value
}: {
  icon: typeof Activity;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white/70 p-3">
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
        <Icon className="h-4 w-4 text-ember" />
        {title}
      </p>
      <p className="mt-1 text-sm leading-6 text-ink/75">{value}</p>
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
