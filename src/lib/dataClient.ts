import {
  AppUser,
  AuthState,
  BossCheckin,
  BossContentMode,
  BossDisplayNameMode,
  BossDraft,
  BossRecord,
  BossStep,
  ModerationStatus,
  Profile,
  ServiceCard,
  ServiceCardDraft,
  ServiceCategory,
  ServiceReview,
  ServiceReviewDraft
} from "../types";
import { createDemoBosses } from "./demoData";
import { supabase, hasSupabaseConfig } from "./supabase";
import { addMinutes, createId, nowIso } from "./time";

type LocalUser = AppUser & {
  password: string;
  created_at: string;
};

const LOCAL_KEYS = {
  users: "rubinot-help:users",
  session: "rubinot-help:session",
  profiles: "rubinot-help:profiles",
  bosses: "rubinot-help:bosses",
  checkins: "rubinot-help:checkins",
  jobs: "rubinot-help:jobs",
  serviceCards: "rubinot-help:service-cards",
  serviceReviews: "rubinot-help:service-reviews"
};

export const usingDemoBackend = !hasSupabaseConfig;

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getLocalUsers() {
  return readLocal<LocalUser[]>(LOCAL_KEYS.users, []);
}

function setLocalUsers(users: LocalUser[]) {
  writeLocal(LOCAL_KEYS.users, users);
}

function getLocalProfiles() {
  return readLocal<Profile[]>(LOCAL_KEYS.profiles, []);
}

function setLocalProfiles(profiles: Profile[]) {
  writeLocal(LOCAL_KEYS.profiles, profiles);
}

function getLocalBosses() {
  const bosses = readLocal<Record<string, unknown>[]>(LOCAL_KEYS.bosses, []);
  if (bosses.length > 0) {
    return bosses.map((boss) => mapBoss(boss));
  }

  const seeded = createDemoBosses();
  writeLocal(LOCAL_KEYS.bosses, seeded);
  return seeded;
}

function setLocalBosses(bosses: BossRecord[]) {
  writeLocal(LOCAL_KEYS.bosses, bosses);
}

function getLocalCheckins() {
  return readLocal<BossCheckin[]>(LOCAL_KEYS.checkins, []);
}

function setLocalCheckins(checkins: BossCheckin[]) {
  writeLocal(LOCAL_KEYS.checkins, checkins);
}

function getLocalServiceCards() {
  return readLocal<Record<string, unknown>[]>(LOCAL_KEYS.serviceCards, []).map((card) => mapServiceCard(card));
}

function setLocalServiceCards(cards: ServiceCard[]) {
  writeLocal(LOCAL_KEYS.serviceCards, cards);
}

function getLocalServiceReviews() {
  return readLocal<Record<string, unknown>[]>(LOCAL_KEYS.serviceReviews, []).map((review) => mapServiceReview(review));
}

function setLocalServiceReviews(reviews: ServiceReview[]) {
  writeLocal(LOCAL_KEYS.serviceReviews, reviews);
}

function getCurrentLocalUser(): AppUser | null {
  const userId = localStorage.getItem(LOCAL_KEYS.session);
  if (!userId) {
    return null;
  }

  const user = getLocalUsers().find((item) => item.id === userId);
  return user ? { id: user.id, email: user.email } : null;
}

function normalizeList(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeCategories(value: string[] | null | undefined): ServiceCategory[] {
  const allowed: ServiceCategory[] = ["experience", "bestiary", "task"];
  return normalizeList(value).filter((item): item is ServiceCategory =>
    allowed.includes(item as ServiceCategory)
  );
}

function normalizeStatus(value: unknown): ModerationStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function mapBossStep(row: Record<string, unknown>, index = 0): BossStep {
  return {
    id: String(row.id ?? createId("step")),
    boss_id: row.boss_id ? String(row.boss_id) : undefined,
    sort_order: Number(row.sort_order ?? index),
    name: String(row.name ?? ""),
    image_url: String(row.image_url ?? ""),
    location: String(row.location ?? ""),
    weaknesses: normalizeList(row.weaknesses as string[]),
    damage_types: normalizeList(row.damage_types as string[]),
    mechanics: String(row.mechanics ?? ""),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapBoss(row: Record<string, unknown>): BossRecord {
  const rawSteps = (row.steps ?? row.boss_steps) as Record<string, unknown>[] | null | undefined;
  const steps = Array.isArray(rawSteps)
    ? rawSteps.map((step, index) => mapBossStep(step, index)).sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const legacyName = String(row.name ?? "");
  const fullName = String(row.full_name ?? legacyName);
  const popularName = String(row.popular_name ?? "");
  const displayNameMode: BossDisplayNameMode = row.display_name_mode === "popular" ? "popular" : "full";
  const contentMode: BossContentMode = row.content_mode === "group" || steps.length > 0 ? "group" : "single";
  const displayName =
    displayNameMode === "popular"
      ? popularName || fullName || legacyName
      : fullName || popularName || legacyName;

  return {
    id: String(row.id),
    name: displayName,
    full_name: fullName,
    popular_name: popularName,
    display_name_mode: displayNameMode,
    content_mode: contentMode,
    type: row.type === "mini-boss" ? "mini-boss" : "boss",
    image_url: String(row.image_url ?? ""),
    hp: Number(row.hp ?? 0),
    mana: Number(row.mana ?? 0),
    weaknesses: normalizeList(row.weaknesses as string[]),
    damage_types: normalizeList(row.damage_types as string[]),
    mechanics: String(row.mechanics ?? ""),
    access_notes: String(row.access_notes ?? ""),
    requires_access: Boolean(row.requires_access),
    access_url: String(row.access_url ?? ""),
    location: String(row.location ?? ""),
    location_url: String(row.location_url ?? row.youtube_url ?? ""),
    recommended_equipment: String(row.recommended_equipment ?? ""),
    cooldown_minutes: Number(row.cooldown_minutes ?? 0),
    youtube_url: String(row.youtube_url ?? ""),
    is_active: Boolean(row.is_active),
    steps,
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso())
  };
}

function mapCheckin(row: Record<string, unknown>): BossCheckin {
  const boss = row.boss as Record<string, unknown> | null | undefined;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    boss_id: String(row.boss_id),
    checked_at: String(row.checked_at),
    cooldown_ends_at: String(row.cooldown_ends_at),
    browser_notified_at: row.browser_notified_at ? String(row.browser_notified_at) : null,
    created_at: String(row.created_at ?? nowIso()),
    boss: boss ? mapBoss(boss) : undefined
  };
}

function mapServiceReview(row: Record<string, unknown>): ServiceReview {
  return {
    id: String(row.id ?? createId("review")),
    service_card_id: String(row.service_card_id ?? ""),
    user_id: String(row.user_id ?? ""),
    user_nick: String(row.user_nick ?? ""),
    rating: Number(row.rating ?? 0),
    comment: String(row.comment ?? ""),
    screenshot_url: String(row.screenshot_url ?? ""),
    status: normalizeStatus(row.status),
    rejection_reason: String(row.rejection_reason ?? ""),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso())
  };
}

function mapServiceCard(row: Record<string, unknown>): ServiceCard {
  const rawReviews = row.reviews as Record<string, unknown>[] | null | undefined;
  const reviews = Array.isArray(rawReviews)
    ? rawReviews.map((review) => mapServiceReview(review)).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : [];

  return {
    id: String(row.id ?? createId("service")),
    user_id: String(row.user_id ?? ""),
    title: String(row.title ?? ""),
    categories: normalizeCategories(row.categories as string[]),
    price_amount: Number(row.price_amount ?? 0),
    price_hours: Number(row.price_hours ?? 1),
    package_hours: Number(row.package_hours ?? 0),
    package_hour_price: Number(row.package_hour_price ?? 0),
    description: String(row.description ?? ""),
    provider_bio: String(row.provider_bio ?? ""),
    whatsapp: String(row.whatsapp ?? ""),
    banner_url: String(row.banner_url ?? ""),
    provider_nick: String(row.provider_nick ?? ""),
    provider_avatar_url: String(row.provider_avatar_url ?? ""),
    status: normalizeStatus(row.status),
    rejection_reason: String(row.rejection_reason ?? ""),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
    reviews
  };
}

function servicePayloadFromDraft(draft: ServiceCardDraft, user: AppUser, profile: Profile | null) {
  return {
    user_id: user.id,
    title: draft.title.trim(),
    categories: draft.categories,
    price_amount: Number(draft.price_amount) || 0,
    price_hours: Math.max(0.25, Number(draft.price_hours) || 1),
    package_hours: Math.max(0, Number(draft.package_hours) || 0),
    package_hour_price: Math.max(0, Number(draft.package_hour_price) || 0),
    description: draft.description.trim(),
    provider_bio: draft.provider_bio.trim(),
    whatsapp: draft.whatsapp.replace(/\D/g, ""),
    banner_url: draft.banner_url,
    provider_nick: (profile?.nick || draft.provider_nick || user.email).trim(),
    provider_avatar_url: profile?.avatar_url || draft.provider_avatar_url || "",
    status: "pending" as ModerationStatus,
    rejection_reason: ""
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase nao configurado.");
  }

  return supabase;
}

async function getSupabaseProfile(user: AppUser): Promise<Profile> {
  const client = requireSupabase();
  const { data, error } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as Profile;
  }

  const created = {
    id: user.id,
    email: user.email,
    nick: "",
    whatsapp: "",
    avatar_url: "",
    whatsapp_opt_in: false,
    is_admin: false
  };

  const { data: inserted, error: insertError } = await client
    .from("profiles")
    .insert(created)
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted as Profile;
}

export async function getAuthState(): Promise<AuthState> {
  if (!supabase) {
    const user = getCurrentLocalUser();
    const profile = user ? getLocalProfiles().find((item) => item.id === user.id) ?? null : null;
    return { user, profile };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    return { user: null, profile: null };
  }

  const user = { id: data.user.id, email: data.user.email };
  const profile = await getSupabaseProfile(user);
  return { user, profile };
}

export async function signUp(email: string, password: string, nick: string) {
  if (!supabase) {
    const users = getLocalUsers();
    if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Este email ja esta cadastrado.");
    }

    const created = nowIso();
    const user: LocalUser = {
      id: createId("user"),
      email,
      password,
      created_at: created
    };
    const profile: Profile = {
      id: user.id,
      email,
      nick,
      whatsapp: "",
      avatar_url: "",
      whatsapp_opt_in: false,
      is_admin: users.length === 0,
      created_at: created,
      updated_at: created
    };

    setLocalUsers([...users, user]);
    setLocalProfiles([...getLocalProfiles(), profile]);
    localStorage.setItem(LOCAL_KEYS.session, user.id);
    return getAuthState();
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nick }
    }
  });

  if (error) {
    const authCode = (error as { code?: string }).code;
    if (authCode === "over_email_send_rate_limit" || error.message.toLowerCase().includes("email rate")) {
      throw new Error(
        "Limite de envio de email do Supabase atingido. Aguarde alguns minutos ou desative a confirmacao de email no painel do Supabase."
      );
    }

    throw error;
  }

  if (!data.session) {
    throw new Error(
      "Conta criada, mas o Supabase pediu confirmacao por email. Confirme o email recebido ou desative a confirmacao no painel do Supabase para login imediato."
    );
  }

  return getAuthState();
}

export async function signIn(email: string, password: string) {
  if (!supabase) {
    const user = getLocalUsers().find(
      (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
    );

    if (!user) {
      throw new Error("Email ou senha invalidos.");
    }

    localStorage.setItem(LOCAL_KEYS.session, user.id);
    return getAuthState();
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  return getAuthState();
}

export async function signOut() {
  if (!supabase) {
    localStorage.removeItem(LOCAL_KEYS.session);
    return;
  }

  await supabase.auth.signOut();
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  const allowed = {
    nick: patch.nick ?? "",
    whatsapp: patch.whatsapp ?? "",
    avatar_url: patch.avatar_url ?? "",
    whatsapp_opt_in: Boolean(patch.whatsapp_opt_in)
  };

  if (!supabase) {
    const profiles = getLocalProfiles();
    const updated = profiles.map((profile) =>
      profile.id === userId ? { ...profile, ...allowed, updated_at: nowIso() } : profile
    );
    setLocalProfiles(updated);
    return updated.find((profile) => profile.id === userId) ?? null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(allowed)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function updateAccountEmail(userId: string, email: string) {
  const nextEmail = email.trim().toLowerCase();
  if (!nextEmail) {
    throw new Error("Informe um email valido.");
  }

  if (!supabase) {
    const users = getLocalUsers();
    if (users.some((user) => user.id !== userId && user.email.toLowerCase() === nextEmail)) {
      throw new Error("Este email ja esta cadastrado.");
    }

    setLocalUsers(users.map((user) => (user.id === userId ? { ...user, email: nextEmail } : user)));
    const profiles = getLocalProfiles().map((profile) =>
      profile.id === userId ? { ...profile, email: nextEmail, updated_at: nowIso() } : profile
    );
    setLocalProfiles(profiles);
    return profiles.find((profile) => profile.id === userId) ?? null;
  }

  const { error: authError } = await supabase.auth.updateUser({ email: nextEmail });
  if (authError) {
    throw authError;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ email: nextEmail })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function updateAccountPassword(userId: string, password: string) {
  if (password.length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  if (!supabase) {
    setLocalUsers(getLocalUsers().map((user) => (user.id === userId ? { ...user, password } : user)));
    return;
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw error;
  }
}

export async function listBosses(includeInactive = false) {
  if (!supabase) {
    return getLocalBosses()
      .filter((boss) => includeInactive || boss.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  let query = supabase
    .from("bosses")
    .select("*, steps:boss_steps(*)")
    .order("name", { ascending: true })
    .order("sort_order", { referencedTable: "boss_steps", ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapBoss(row as Record<string, unknown>));
}

export async function saveBoss(draft: BossDraft) {
  const now = nowIso();
  const fullName = draft.full_name.trim() || draft.name.trim();
  const popularName = draft.popular_name.trim();
  const displayNameMode: BossDisplayNameMode = draft.display_name_mode === "popular" ? "popular" : "full";
  const contentMode: BossContentMode = draft.content_mode === "group" ? "group" : "single";
  const displayName =
    displayNameMode === "popular" ? popularName || fullName : fullName || popularName;
  const payload = {
    name: displayName,
    full_name: fullName,
    popular_name: popularName,
    display_name_mode: displayNameMode,
    content_mode: contentMode,
    type: draft.type,
    image_url: draft.image_url,
    hp: draft.hp,
    mana: draft.mana,
    weaknesses: draft.weaknesses,
    damage_types: draft.damage_types,
    mechanics: draft.mechanics,
    access_notes: draft.access_notes,
    requires_access: draft.requires_access,
    access_url: draft.requires_access ? draft.access_url : "",
    location: draft.location,
    location_url: draft.location_url,
    recommended_equipment: draft.recommended_equipment,
    cooldown_minutes: draft.cooldown_minutes,
    youtube_url: "",
    is_active: draft.is_active
  };

  if (!supabase) {
    const bosses = getLocalBosses();
    const boss: BossRecord = draft.id
      ? {
          ...(bosses.find((item) => item.id === draft.id) as BossRecord),
          ...payload,
          id: draft.id,
          steps: draft.steps.map((step, index) => ({
            ...step,
            weaknesses: step.weaknesses ?? [],
            damage_types: step.damage_types ?? [],
            sort_order: index
          })),
          updated_at: now
        }
      : {
          ...payload,
          id: createId("boss"),
          steps: draft.steps.map((step, index) => ({
            ...step,
            weaknesses: step.weaknesses ?? [],
            damage_types: step.damage_types ?? [],
            sort_order: index
          })),
          created_at: now,
          updated_at: now
        };

    const next = draft.id
      ? bosses.map((item) => (item.id === draft.id ? boss : item))
      : [...bosses, boss];
    setLocalBosses(next);
    return boss;
  }

  const upsertPayload = draft.id ? { ...payload, id: draft.id } : payload;
  const { data, error } = await supabase.from("bosses").upsert(upsertPayload).select("*").single();
  if (error) {
    throw error;
  }

  const savedBoss = mapBoss(data as Record<string, unknown>);
  const steps = draft.steps
    .map((step, index) => ({
      boss_id: savedBoss.id,
      sort_order: index,
      name: step.name.trim(),
      image_url: step.image_url,
      location: step.location,
      weaknesses: step.weaknesses ?? [],
      damage_types: step.damage_types ?? [],
      mechanics: step.mechanics
    }))
    .filter((step) => step.name);

  const { error: deleteStepsError } = await supabase.from("boss_steps").delete().eq("boss_id", savedBoss.id);
  if (deleteStepsError) {
    throw deleteStepsError;
  }

  if (steps.length > 0) {
    const { error: insertStepsError } = await supabase.from("boss_steps").insert(steps);
    if (insertStepsError) {
      throw insertStepsError;
    }
  }

  return {
    ...savedBoss,
    steps: steps.map((step, index) => ({
      id: createId("step"),
      boss_id: savedBoss.id,
      sort_order: index,
      name: step.name,
      image_url: step.image_url,
      location: step.location,
      weaknesses: step.weaknesses,
      damage_types: step.damage_types,
      mechanics: step.mechanics
    }))
  };
}

export async function deactivateBoss(id: string) {
  if (!supabase) {
    setLocalBosses(
      getLocalBosses().map((boss) =>
        boss.id === id ? { ...boss, is_active: false, updated_at: nowIso() } : boss
      )
    );
    return;
  }

  const { error } = await supabase.from("bosses").update({ is_active: false }).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function setBossPublished(id: string, isActive: boolean) {
  if (!supabase) {
    setLocalBosses(
      getLocalBosses().map((boss) =>
        boss.id === id ? { ...boss, is_active: isActive, updated_at: nowIso() } : boss
      )
    );
    return;
  }

  const { error } = await supabase.from("bosses").update({ is_active: isActive }).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteBoss(id: string) {
  if (!supabase) {
    const removedCheckins = getLocalCheckins().filter((checkin) => checkin.boss_id === id).map((checkin) => checkin.id);
    setLocalBosses(getLocalBosses().filter((boss) => boss.id !== id));
    setLocalCheckins(getLocalCheckins().filter((checkin) => checkin.boss_id !== id));
    const jobs = readLocal<Record<string, unknown>[]>(LOCAL_KEYS.jobs, []);
    writeLocal(
      LOCAL_KEYS.jobs,
      jobs.filter((job) => !removedCheckins.includes(String(job.checkin_id)))
    );
    return;
  }

  const { error } = await supabase.from("bosses").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function uploadBossImage(file: File) {
  if (!supabase) {
    return readFileAsDataUrl(file);
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const path = `${createId("boss-image")}-${safeName}`;
  const { error } = await supabase.storage.from("boss-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("boss-images").getPublicUrl(path);
  return data.publicUrl;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

async function uploadPublicImage(bucket: string, file: File, userId: string, prefix: string) {
  if (!supabase) {
    return readFileAsDataUrl(file);
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const path = `${userId}/${createId(prefix)}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProfileAvatar(userId: string, file: File) {
  return uploadPublicImage("profile-avatars", file, userId, "avatar");
}

export async function uploadServiceBanner(userId: string, file: File) {
  return uploadPublicImage("service-banners", file, userId, "service-banner");
}

export async function uploadReviewScreenshot(userId: string, file: File) {
  return uploadPublicImage("service-review-screens", file, userId, "service-review");
}

export async function listServiceCards(includeAll = false) {
  if (!supabase) {
    return getLocalServiceCards()
      .filter((card) => includeAll || card.status === "approved")
      .map((card) => ({
        ...card,
        reviews: getLocalServiceReviews().filter(
          (review) =>
            review.service_card_id === card.id && (includeAll || review.status === "approved")
        )
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const query = supabase
    .from("service_cards")
    .select("*, reviews:service_reviews(*)")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "service_reviews", ascending: false });

  const { data, error } = includeAll ? await query : await query.eq("status", "approved");
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapServiceCard(row as Record<string, unknown>));
}

export async function saveServiceCard(user: AppUser, profile: Profile | null, draft: ServiceCardDraft) {
  const now = nowIso();
  const payload = servicePayloadFromDraft(draft, user, profile);

  if (!payload.title || payload.categories.length === 0 || !payload.description || !payload.provider_bio) {
    throw new Error("Preencha titulo, categoria, descricao e sobre o serviceiro.");
  }

  if (!supabase) {
    const cards = getLocalServiceCards();
    const existing = draft.id ? cards.find((card) => card.id === draft.id) : cards.find((card) => card.user_id === user.id);
    const saved: ServiceCard = existing
      ? {
          ...existing,
          ...payload,
          id: existing.id,
          updated_at: now
        }
      : {
          ...payload,
          id: createId("service"),
          approved_at: null,
          created_at: now,
          updated_at: now,
          reviews: []
        };

    const next = existing
      ? cards.map((card) => (card.id === existing.id ? saved : card))
      : [...cards, saved];
    setLocalServiceCards(next);
    return saved;
  }

  const upsertPayload = draft.id ? { ...payload, id: draft.id } : payload;
  const { data, error } = await supabase
    .from("service_cards")
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select("*, reviews:service_reviews(*)")
    .single();

  if (error) {
    throw error;
  }

  return mapServiceCard(data as Record<string, unknown>);
}

export async function adminSaveServiceCard(draft: ServiceCard) {
  const payload = {
    title: draft.title.trim(),
    categories: draft.categories,
    price_amount: Number(draft.price_amount) || 0,
    price_hours: Math.max(0.25, Number(draft.price_hours) || 1),
    package_hours: Math.max(0, Number(draft.package_hours) || 0),
    package_hour_price: Math.max(0, Number(draft.package_hour_price) || 0),
    description: draft.description.trim(),
    provider_bio: draft.provider_bio.trim(),
    whatsapp: draft.whatsapp.replace(/\D/g, ""),
    banner_url: draft.banner_url,
    provider_nick: draft.provider_nick.trim(),
    provider_avatar_url: draft.provider_avatar_url,
    status: draft.status,
    rejection_reason: draft.status === "rejected" ? draft.rejection_reason : "",
    approved_at: draft.status === "approved" ? draft.approved_at ?? nowIso() : null
  };

  if (!supabase) {
    const saved = { ...draft, ...payload, updated_at: nowIso() };
    setLocalServiceCards(getLocalServiceCards().map((card) => (card.id === draft.id ? saved : card)));
    return saved;
  }

  const { data, error } = await supabase
    .from("service_cards")
    .update(payload)
    .eq("id", draft.id)
    .select("*, reviews:service_reviews(*)")
    .single();

  if (error) {
    throw error;
  }

  return mapServiceCard(data as Record<string, unknown>);
}

export async function deleteServiceCard(id: string) {
  if (!supabase) {
    setLocalServiceCards(getLocalServiceCards().filter((card) => card.id !== id));
    setLocalServiceReviews(getLocalServiceReviews().filter((review) => review.service_card_id !== id));
    return;
  }

  const { error } = await supabase.from("service_cards").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function setServiceCardStatus(id: string, status: ModerationStatus, reason = "") {
  const patch = {
    status,
    rejection_reason: status === "rejected" ? reason : "",
    approved_at: status === "approved" ? nowIso() : null
  };

  if (!supabase) {
    setLocalServiceCards(
      getLocalServiceCards().map((card) => (card.id === id ? { ...card, ...patch, updated_at: nowIso() } : card))
    );
    return;
  }

  const { error } = await supabase.from("service_cards").update(patch).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function saveServiceReview(user: AppUser, profile: Profile | null, draft: ServiceReviewDraft) {
  if (draft.comment.trim().length < 30) {
    throw new Error("A avaliacao precisa ter pelo menos 30 caracteres.");
  }

  if (!draft.screenshot_url) {
    throw new Error("Envie uma print do service para avaliar.");
  }

  const now = nowIso();
  const payload = {
    service_card_id: draft.service_card_id,
    user_id: user.id,
    user_nick: profile?.nick || user.email,
    rating: draft.rating,
    comment: draft.comment.trim(),
    screenshot_url: draft.screenshot_url,
    status: "pending" as ModerationStatus,
    rejection_reason: ""
  };

  if (!supabase) {
    const cards = getLocalServiceCards();
    const target = cards.find((card) => card.id === draft.service_card_id);
    if (!target || target.status !== "approved" || target.user_id === user.id) {
      throw new Error("Voce nao pode avaliar este card.");
    }

    const reviews = getLocalServiceReviews();
    const existing = reviews.find((review) => review.service_card_id === draft.service_card_id && review.user_id === user.id);
    const saved: ServiceReview = existing
      ? { ...existing, ...payload, updated_at: now }
      : { ...payload, id: createId("review"), created_at: now, updated_at: now };
    setLocalServiceReviews(existing ? reviews.map((review) => (review.id === existing.id ? saved : review)) : [...reviews, saved]);
    return saved;
  }

  const { data, error } = await supabase
    .from("service_reviews")
    .upsert(payload, { onConflict: "service_card_id,user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapServiceReview(data as Record<string, unknown>);
}

export async function setServiceReviewStatus(id: string, status: ModerationStatus, reason = "") {
  const patch = {
    status,
    rejection_reason: status === "rejected" ? reason : ""
  };

  if (!supabase) {
    setLocalServiceReviews(
      getLocalServiceReviews().map((review) => (review.id === id ? { ...review, ...patch, updated_at: nowIso() } : review))
    );
    return;
  }

  const { error } = await supabase.from("service_reviews").update(patch).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteServiceReview(id: string) {
  if (!supabase) {
    setLocalServiceReviews(getLocalServiceReviews().filter((review) => review.id !== id));
    return;
  }

  const { error } = await supabase.from("service_reviews").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function listUserCheckins(userId: string) {
  if (!supabase) {
    const bosses = getLocalBosses();
    return getLocalCheckins()
      .filter((checkin) => checkin.user_id === userId)
      .map((checkin) => ({
        ...checkin,
        boss: bosses.find((boss) => boss.id === checkin.boss_id)
      }))
      .sort((a, b) => new Date(b.cooldown_ends_at).getTime() - new Date(a.cooldown_ends_at).getTime());
  }

  const { data, error } = await supabase
    .from("boss_checkins")
    .select("*, boss:bosses(*, steps:boss_steps(*))")
    .eq("user_id", userId)
    .order("cooldown_ends_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapCheckin(row as Record<string, unknown>));
}

export async function createBossCheckin(user: AppUser, profile: Profile | null, boss: BossRecord) {
  const checkedAt = new Date();
  const cooldownEndsAt = addMinutes(checkedAt, boss.cooldown_minutes).toISOString();
  const base = {
    user_id: user.id,
    boss_id: boss.id,
    checked_at: checkedAt.toISOString(),
    cooldown_ends_at: cooldownEndsAt,
    browser_notified_at: null
  };

  if (!supabase) {
    const checkin: BossCheckin = {
      ...base,
      id: createId("checkin"),
      created_at: nowIso(),
      boss
    };
    setLocalCheckins([...getLocalCheckins(), checkin]);

    if (profile?.whatsapp && profile.whatsapp_opt_in) {
      const jobs = readLocal(LOCAL_KEYS.jobs, []);
      writeLocal(LOCAL_KEYS.jobs, [
        ...jobs,
        {
          id: createId("job"),
          user_id: user.id,
          checkin_id: checkin.id,
          channel: "whatsapp",
          status: "pending",
          scheduled_for: cooldownEndsAt,
          attempts: 0,
          last_error: null,
          sent_at: null,
          created_at: nowIso(),
          updated_at: nowIso()
        }
      ]);
    }

    return checkin;
  }

  const { data, error } = await supabase
    .from("boss_checkins")
    .insert(base)
    .select("*, boss:bosses(*)")
    .single();

  if (error) {
    throw error;
  }

  const checkin = mapCheckin(data as Record<string, unknown>);
  if (profile?.whatsapp && profile.whatsapp_opt_in) {
    const { error: jobError } = await supabase.from("notification_jobs").insert({
      user_id: user.id,
      checkin_id: checkin.id,
      channel: "whatsapp",
      scheduled_for: cooldownEndsAt
    });

    if (jobError) {
      console.warn("Check-in salvo, mas o job de WhatsApp falhou.", jobError);
    }
  }

  return checkin;
}

export async function markBrowserNotified(checkinId: string) {
  const timestamp = nowIso();

  if (!supabase) {
    setLocalCheckins(
      getLocalCheckins().map((checkin) =>
        checkin.id === checkinId ? { ...checkin, browser_notified_at: timestamp } : checkin
      )
    );
    return;
  }

  const { error } = await supabase
    .from("boss_checkins")
    .update({ browser_notified_at: timestamp })
    .eq("id", checkinId);

  if (error) {
    throw error;
  }
}

export async function cancelCheckin(checkinId: string) {
  if (!supabase) {
    setLocalCheckins(getLocalCheckins().filter((checkin) => checkin.id !== checkinId));
    return;
  }

  const { error } = await supabase.from("boss_checkins").delete().eq("id", checkinId);
  if (error) {
    throw error;
  }
}
