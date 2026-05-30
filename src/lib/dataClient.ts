import {
  AppUser,
  AuthState,
  BossCheckin,
  BossDraft,
  BossRecord,
  Profile
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
  jobs: "rubinot-help:jobs"
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
  const bosses = readLocal<BossRecord[]>(LOCAL_KEYS.bosses, []);
  if (bosses.length > 0) {
    return bosses;
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

function mapBoss(row: Record<string, unknown>): BossRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    type: row.type === "mini-boss" ? "mini-boss" : "boss",
    image_url: String(row.image_url ?? ""),
    hp: Number(row.hp ?? 0),
    mana: Number(row.mana ?? 0),
    weaknesses: normalizeList(row.weaknesses as string[]),
    damage_types: normalizeList(row.damage_types as string[]),
    mechanics: String(row.mechanics ?? ""),
    access_notes: String(row.access_notes ?? ""),
    recommended_equipment: String(row.recommended_equipment ?? ""),
    cooldown_minutes: Number(row.cooldown_minutes ?? 0),
    youtube_url: String(row.youtube_url ?? ""),
    is_active: Boolean(row.is_active),
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

export async function listBosses(includeInactive = false) {
  if (!supabase) {
    return getLocalBosses()
      .filter((boss) => includeInactive || boss.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  let query = supabase.from("bosses").select("*").order("name", { ascending: true });
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
  const payload = {
    name: draft.name,
    type: draft.type,
    image_url: draft.image_url,
    hp: draft.hp,
    mana: draft.mana,
    weaknesses: draft.weaknesses,
    damage_types: draft.damage_types,
    mechanics: draft.mechanics,
    access_notes: draft.access_notes,
    recommended_equipment: draft.recommended_equipment,
    cooldown_minutes: draft.cooldown_minutes,
    youtube_url: draft.youtube_url,
    is_active: draft.is_active
  };

  if (!supabase) {
    const bosses = getLocalBosses();
    const boss: BossRecord = draft.id
      ? {
          ...(bosses.find((item) => item.id === draft.id) as BossRecord),
          ...payload,
          id: draft.id,
          updated_at: now
        }
      : {
          ...payload,
          id: createId("boss"),
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

  return mapBoss(data as Record<string, unknown>);
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

export async function uploadBossImage(file: File) {
  if (!supabase) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });
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
    .select("*, boss:bosses(*)")
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
