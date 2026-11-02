/**
 * Where the coaches' phones meet: the same free Supabase project Athletic Lab uses (organization
 * "Flesher Family"), in Dugout Lab's own tables. The publishable key is public by design; row-level
 * security is the lock (a request only sees a team's rows when it carries that team's key and a
 * coach token the head coach has not revoked). Empty values turn sync off.
 */
export const SYNC_CONFIG = {
  url: 'https://kdulamsgpgozryacmhok.supabase.co',
  anonKey: 'sb_publishable_L-BWbmrV7Ss1aRJW_Et0Kg_G0EU0dtB'
};
export const SYNC_AVAILABLE = !!SYNC_CONFIG.url && !!SYNC_CONFIG.anonKey;
