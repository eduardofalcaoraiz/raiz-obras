import { createHandler } from './handler.mjs';
Deno.serve(createHandler({
  url: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  // Google's private queue is active; an explicit false remains a kill switch.
  emailEnabled: Deno.env.get('INVITE_EMAIL_ENABLED') !== 'false',
  delivery: Deno.env.get('INVITE_EMAIL_DELIVERY') || 'google',
}));
