export type ViewKey = "home" | "stamina" | "bestiary" | "cooldowns" | "profile" | "admin";

export type BossType = "boss" | "mini-boss";

export type Channel = "whatsapp";

export type JobStatus = "pending" | "sent" | "failed" | "skipped";

export interface AppUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  nick: string;
  whatsapp: string;
  whatsapp_opt_in: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface BossRecord {
  id: string;
  name: string;
  type: BossType;
  image_url: string;
  hp: number;
  mana: number;
  weaknesses: string[];
  damage_types: string[];
  mechanics: string;
  access_notes: string;
  recommended_equipment: string;
  cooldown_minutes: number;
  youtube_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BossDraft = Omit<BossRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export interface BossCheckin {
  id: string;
  user_id: string;
  boss_id: string;
  checked_at: string;
  cooldown_ends_at: string;
  browser_notified_at: string | null;
  created_at: string;
  boss?: BossRecord;
}

export interface NotificationJob {
  id: string;
  user_id: string;
  checkin_id: string;
  channel: Channel;
  status: JobStatus;
  scheduled_for: string;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: AppUser | null;
  profile: Profile | null;
}

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  tone?: "success" | "error" | "info";
}
