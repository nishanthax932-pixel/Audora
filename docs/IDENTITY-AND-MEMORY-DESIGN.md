# Audora identity and durable memory design

Status: design proposal only. This document does not enable accounts, create a database, or claim production readiness.

## Goals

- Replace browser-only identity assumptions with a maintained OpenID Connect (OIDC) identity provider.
- Enforce authorization in the API, never by trusting a user ID supplied in request JSON.
- Keep conversation and memory data isolated by authenticated subject.
- Support account recovery, session revocation, export, and deletion.
- Preserve a migration path from existing browser-local exports without silently uploading them.

## Decisions required before implementation

Choose and configure one supported identity provider (evaluate Supabase Auth, Auth.js with a trusted OIDC provider, and Clerk against cost, data residency, operational ownership, and recovery requirements). Choose a managed PostgreSQL service and define backup/restore and retention requirements. These decisions require the operator; no provider credentials or database URL belong in Git.

## Identity boundary

1. The browser completes sign-in with the selected provider using its documented Authorization Code + PKCE flow.
2. The API validates the provider-issued access token or a server-side session using the provider's supported SDK/library. Validate signature, issuer, audience, expiry, and allowed algorithm; never decode a JWT and treat its claims as trusted without verification.
3. The API derives an immutable internal principal from the verified provider subject. Ignore or reject client-supplied `userId`, `ownerId`, or tenant ownership fields.
4. Every private-resource query includes the authenticated principal in its predicate. Prefer PostgreSQL row-level security as defense in depth, with a transaction-local principal set only by trusted server code.
5. Use secure, HttpOnly, SameSite cookies for server sessions where applicable; configure CSRF protection for cookie-authenticated state-changing requests, strict origin checks, short session lifetimes, rotation, and revocation.
6. Keep provider secrets and signing material in deployment secret storage. Never place them in frontend bundles, logs, fixtures, or Git history.

## Proposed PostgreSQL schema

The initial relational schema should be provider-neutral:

- `users`: internal UUID primary key, unique provider + subject pair, created/updated timestamps, optional minimal profile fields.
- `sessions` (only if sessions are managed by Audora): hashed opaque session token, user foreign key, expiry, created/revoked timestamps, device label; never store a raw bearer token.
- `conversations`: UUID, owner user foreign key, title, timestamps, optional archived timestamp.
- `messages`: UUID, conversation foreign key, role, content, created timestamp, ordering key, optional model/prompt metadata. Enforce ownership through the parent conversation.
- `memories`: UUID, owner user foreign key, content, memory type, source/provenance, confidence/review state, created/updated/expiry timestamps.
- `memory_events`: append-only audit events for create, edit, delete, export, and retention actions; do not copy sensitive message bodies into audit logs.

Use foreign keys, indexes on owner + updated time, bounded text sizes, and explicit cascade/restrict behavior. Add pgvector only after a measured retrieval use case and a documented embedding model/version; embeddings inherit the source data's privacy and deletion requirements.

## API and isolation requirements

- Authentication middleware runs before all private API routes.
- Public routes are explicitly allow-listed (health and public config only); chat, agent, conversation, memory, export, billing, and usage routes require a principal.
- Resource lookup must combine resource ID and owner ID in the database query. A random UUID is not authorization.
- Return the same not-found behavior for nonexistent and other users' resources to reduce enumeration.
- Add integration tests with two users proving that read, update, delete, export, and memory retrieval cannot cross tenant boundaries.
- Rate-limit by authenticated principal as well as network source; use a shared limiter for multi-instance deployment.
- Do not persist prompts or model outputs for telemetry by default. Make any retention opt-in, documented, and independently deletable.

## Browser-local migration

- Keep the existing JSON export/import workflow.
- After sign-in, show a clear, explicit import preview and require user confirmation before uploading any local history.
- Validate size, message roles, timestamps, and schema on the server; associate imported records only with the authenticated principal.
- Provide export before account deletion and explain that deletion may have provider/database backup retention windows.
- Never auto-import localStorage into cloud storage in the background.

## Rollout gates

1. Provider and hosting decisions documented; secrets configured outside source control.
2. Token/session verification and CSRF/origin protections reviewed.
3. Database migrations, backup/restore, and row-level security tested.
4. Two-user isolation tests pass for every private endpoint.
5. Recovery, session revocation, export, deletion, and retention flows tested.
6. Security review and privacy notice completed before enabling sign-up in production.

## Current status

The current Audora starter still stores chat history and profile memory in browser localStorage. It has no accounts, cross-device sync, or PostgreSQL memory. This proposal is a blueprint for Issues #30 and #31, not an implementation or a claim that these capabilities are available.
