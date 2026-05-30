export type ViewKey =
  | "home"
  | "stamina"
  | "bossTracker"
  | "services"
  | "bestiaryTracker"
  | "cooldowns"
  | "profile"
  | "adminHub"
  | "adminBossTracker"
  | "adminServices";

export type BossType = "boss" | "mini-boss";

export type BossDisplayNameMode = "full" | "popular";

export type BossContentMode = "single" | "group";

export type Channel = "whatsapp";

export type JobStatus = "pending" | "sent" | "failed" | "skipped";

export type ModerationStatus = "pending" | "approved" | "rejected";

export type ServiceCategory = "experience" | "bestiary" | "task";

export interface AppUser {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  nick: string;
  whatsapp: string;
  avatar_url: string;
  whatsapp_opt_in: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface BossRecord {
  id: string;
  name: string;
  full_name: string;
  popular_name: string;
  display_name_mode: BossDisplayNameMode;
  content_mode: BossContentMode;
  type: BossType;
  image_url: string;
  hp: number;
  mana: number;
  weaknesses: string[];
  damage_types: string[];
  mechanics: string;
  access_notes: string;
  requires_access: boolean;
  access_url: string;
  location: string;
  location_url: string;
  recommended_equipment: string;
  cooldown_minutes: number;
  youtube_url: string;
  is_active: boolean;
  steps: BossStep[];
  created_at: string;
  updated_at: string;
}

export type BossDraft = Omit<BossRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export interface BossStep {
  id: string;
  boss_id?: string;
  sort_order: number;
  name: string;
  image_url: string;
  location: string;
  weaknesses: string[];
  damage_types: string[];
  mechanics: string;
  created_at?: string;
  updated_at?: string;
}

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

export interface ServiceReview {
  id: string;
  service_card_id: string;
  user_id: string;
  user_nick: string;
  rating: number;
  comment: string;
  screenshot_url: string;
  status: ModerationStatus;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceCard {
  id: string;
  user_id: string;
  title: string;
  categories: ServiceCategory[];
  price_amount: number;
  price_hours: number;
  package_hours: number;
  package_hour_price: number;
  description: string;
  provider_bio: string;
  whatsapp: string;
  banner_url: string;
  provider_nick: string;
  provider_avatar_url: string;
  status: ModerationStatus;
  rejection_reason: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  reviews: ServiceReview[];
}

export type ServiceCardDraft = Omit<
  ServiceCard,
  "id" | "user_id" | "status" | "rejection_reason" | "approved_at" | "created_at" | "updated_at" | "reviews"
> & {
  id?: string;
  status?: ModerationStatus;
  rejection_reason?: string;
};

export interface ServiceReviewDraft {
  service_card_id: string;
  rating: number;
  comment: string;
  screenshot_url: string;
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
