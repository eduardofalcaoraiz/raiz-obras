# User invitations

Invitations are managed by approved administrators in People and Access. Each invitation contains explicit module permissions; no invitation grants administrator status. Existing accounts remain blocked until the authenticated, email-confirmed recipient accepts the invitation. Google invitation links have no time-based expiration, and remain usable until accepted, revoked or superseded.

## Permanent Links

- Apply `sql/permanent_invitations.sql`, then the updated `sql/user_invitations.sql`
  and `sql/google_invitation_mail.sql` in one transaction. Existing profiles and
  revoked/accepted statuses are preserved. Queue delivery timeouts are unchanged.
- Deploy `access-invite-open` with gateway JWT verification disabled. Its own
  256-bit invitation secret is mandatory; only its SHA-256 digest is stored in a
  service-role-only table. The invitation ID alone cannot mint authentication links.
- Publish `convite.html`. The secret stays in the URL fragment, with no referrer,
  third-party scripts or automatic redemption. Clicking activation checks the
  invitation, administrator, recipient and profile revision before generating a
  fresh, short-lived Supabase authentication link. Native auth token/session
  expiration remains unchanged. Acceptance repeats all authorization checks.
- Previously emailed native authentication links cannot be rewritten. Reissue
  those invitations from the platform when needed; never silently send email.
- Accepted links cannot be reused to sign in or restore revoked access.

Accepted access itself has no expiration: it remains active until an administrator
revokes it, and only an administrator can adjust the permissions. The email makes
this distinction explicit and lists only the granted areas, grouped as read-only
or read-and-edit, using the same labels as the permissions form.

## Deployment

- Apply `sql/user_invitations.sql` in a transaction. It does not change existing profiles.
- Deploy `supabase/functions/access-invitations` with JWT verification enabled.
- Publish `scripts/access-invites.js`, the access-control assets and `index.html`.
- Service-role credentials must stay in the Edge Function environment. Never expose them in the browser.

## Google Sending

The invitation transport is now a private Google Apps Script owned by
`eduardo.falcao@raizeducacao.com.br`. No DNS change, SMTP password, inbox-reading
permission, Google web-app deployment or new mail-provider account is required.

- Project: `1u1xxjEB25uz1HWQzKe-MKpiKBHhDtfR9cjX9wd9QeJS5mvAXmETR7hZC`.
- Source and explicit scopes: `scripts/google-invites/`.
- The administrator prepares a scoped invitation; the server enqueues it and
  reports `queued`, never `sent`. The UI refreshes while sends are pending.
- A one-minute Apps Script trigger fetches at most five items. The worker checks
  Google's RS256 signature, fixed issuer, expiration, exact OAuth audience,
  verified email and the exact owner address. It does not trust decoded JWTs.
- Deploy `access-mail-worker` without the Supabase JWT gateway because it accepts
  Google OIDC tokens, not Supabase tokens. Its own verifier is mandatory. Keep
  `access-invitations` behind the Supabase JWT gateway and administrator checks.
- Queue tables/RPCs are service-role only. No email authentication link or Google
  token is persisted in the queue. Persistent invitation secrets are generated at
  claim time, with only their digest stored; raw secrets go only to Google delivery.
- The worker rechecks the inviter and target profile before claiming. Revoked or
  stale invitations do not release access. An uncertain send is not automatically
  retried. A pending receipt survives a lost connection without resending mail.
- A diagnostic test is hard-limited to the owner email and cannot grant access.
- An inactive worker or exhausted daily quota blocks new invitations. Google
  quotas are checked at runtime and should not be represented as guaranteed delivery.
- Run `verificarConfiguracao` to authorize/check identity without sending. Run
  `ativarEnvioDeConvites` after backend setup to install the one-minute trigger;
  `pausarEnvioDeConvites` removes only this project's invitation trigger.

This transport covers invitations only. Native Supabase password-recovery emails
still require a separately configured email transport; do not claim otherwise.

The public OAuth audience may be versioned in code; it is not a secret. No Google
access token, app password or mailbox credential is stored in the repository.

Official Google sending service: https://developers.google.com/apps-script/reference/mail/mail-app

## Legacy SMTP Transport

SMTP was not configured on 2026-09-16. The Google transport does not require SMTP.
`INVITE_EMAIL_ENABLED=false` remains an emergency stop for all invitation sends.
The following instructions apply only to a future migration back to SMTP.

1. Configure a verified sender and custom SMTP in Supabase Authentication settings. Use the organization's approved provider and secret manager, not chat or source control.
2. Check the sender domain, provider limits, one-hour token expiration and redirect allowlist for `https://raiz-obras.vercel.app/**`.
3. Configure the Invite User and Magic Link email templates with the application's identity. Keep the built-in confirmation URL so authentication occurs before the application accepts the invitation.
4. Set the Edge Function secret `INVITE_EMAIL_ENABLED=true` only after SMTP is configured.
5. With explicit recipient authorization, test the replacement SMTP transport before switching. The Google transport was tested on 2026-09-16 with one non-authentication diagnostic email addressed only to the owner; MailApp confirmed the send. No real third-party invitation was created or sent.

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
Run `node --test scripts/test_google_invites.mjs` for Google identity, queueing and ambiguous-send coverage. Run `sql/test_google_invitation_mail.sql` only inside a transaction followed by rollback.
Run `sql/test_user_invitations.sql` inside a transaction and always roll back. The SQL tests create temporary synthetic auth users inside that transaction and must not be committed. Browser tests must mock email sends and business writes.
