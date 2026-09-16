# User invitations

Invitations are managed by approved administrators in People and Access. Each invitation contains explicit module permissions; no invitation grants administrator status. Existing accounts remain blocked until the authenticated, email-confirmed recipient accepts the invitation. Invitation links expire after one hour.

## Deployment

- Apply `sql/user_invitations.sql` in a transaction. It does not change existing profiles.
- Deploy `supabase/functions/access-invitations` with JWT verification enabled.
- Publish `scripts/access-invites.js`, the access-control assets and `index.html`.
- Service-role credentials must stay in the Edge Function environment. Never expose them in the browser.

## Email activation

SMTP was not configured on 2026-09-16. Production therefore defaults to `INVITE_EMAIL_ENABLED=false` and rejects sends before creating invitations or sending email.

1. Configure a verified sender and custom SMTP in Supabase Authentication settings. Use the organization's approved provider and secret manager, not chat or source control.
2. Check the sender domain, provider limits, one-hour token expiration and redirect allowlist for `https://raiz-obras.vercel.app/**`.
3. Configure the Invite User and Magic Link email templates with the application's identity. Keep the built-in confirmation URL so authentication occurs before the application accepts the invitation.
4. Set the Edge Function secret `INVITE_EMAIL_ENABLED=true` only after SMTP is configured.
5. With explicit recipient authorization, send one test invitation through the administrator screen, verify delivery and open the link as its recipient. Verify the selected permissions and password setup. No delivery test has yet been made with real email.

Official SMTP guidance: https://supabase.com/docs/guides/auth/auth-smtp

## Safety

- Native invite email is used for new accounts; an authenticated magic-link email is used for an existing account, with account creation disabled.
- `sent` means the authentication email provider accepted the send request, not confirmed inbox delivery.
- RPCs that prepare, update, revoke and accept invitations are service-role only. The Edge Function independently verifies the signed-in user and administrator profile.
- Acceptance matches the authenticated user's confirmed email, validates the inviter, locks the profile and checks its revision. Newer manual changes invalidate old invitations.
- A consumed invitation cannot restore revoked access. A replacement revokes older pending links.
- Profile changes are recorded in `user_access_audit`; original business records are never deleted.

## Verification

Run `node --test scripts/test_access_invites.mjs scripts/test_access_control.cjs`.
Run `sql/test_user_invitations.sql` inside a transaction and always roll back. The SQL tests create temporary synthetic auth users inside that transaction and must not be committed. Browser tests must mock email sends and business writes.
