# Production Operations Runbook

This runbook is an operator checklist, not a claim that Audora is already deployed or production-certified.

## Before exposing the gateway

- [ ] Deploy behind HTTPS with a maintained reverse proxy.
- [ ] Keep the model inference endpoint and image-generation service on a private network.
- [ ] Set a unique, high-entropy server-side provider key. Never put provider secrets in browser code or commit them.
- [ ] Set `AUDORA_TRUST_PROXY=1` only when exactly one trusted proxy is directly in front of the app.
- [ ] Configure `AUDORA_ALLOWED_ORIGINS` for the exact browser origins that should be allowed.
- [ ] Configure request timeouts and rate limits for the expected provider capacity.
- [ ] Set `AUDORA_METRICS_TOKEN` to a strong secret if the in-memory metrics endpoint is needed. Keep it server-side.
- [ ] Review provider privacy, retention, regional processing, and billing terms.
- [ ] Publish the operator's own privacy notice and abuse-reporting contact.

## Verify a release

1. Install from the lockfile with `npm ci`.
2. Run `npm run build`.
3. Run `npm test`.
4. Run `npm run eval:validate`.
5. Run `npm run doctor` and resolve every applicable configuration warning.
6. Deploy to a staging environment using the same proxy/provider topology as production.
7. Verify `GET /api/health`. A `configured` status only confirms configuration checks; it does not prove the provider is reachable or that model output is correct.
8. Perform a real, low-cost chat request and a bounded agent request. Confirm the provider, model ID, timeout, and cancellation behavior.
9. Confirm unauthorized metrics requests are rejected and that logs contain no prompts, API keys, or uploaded content.
10. Roll back if error rates, latency, spend, or user-visible quality exceed the release thresholds defined by the operator.

## Incident response

- **Provider outage:** preserve the user-facing error, check provider status and server logs, and avoid automatic provider switching unless the operator explicitly configured and tested it.
- **Unexpected spend:** disable or restrict the affected model route, rotate exposed credentials, inspect aggregate usage with the provider, and restore only after limits are in place.
- **Suspected credential exposure:** revoke and rotate the credential immediately; remove it from active deployment configuration and investigate logs and repository history.
- **Abuse or prompt injection:** disable the affected tool or route while investigating. Treat retrieved pages, files, and tool output as untrusted data.
- **Data deletion request:** the current starter stores chat history in browser local storage and has no server-side account database. Explain the actual storage boundary; do not promise deletion from systems Audora does not control.

## Current operational limitations

- Rate limiting and metrics are process-local and reset on restart; they are not distributed systems.
- The health endpoint reports configuration, not live model readiness.
- There is no durable identity, server-side chat database, billing ledger, or tenant-isolation layer in this starter.
- The agent has a bounded allow-list; it is not a coding sandbox and must not be granted shell or arbitrary code execution.
- CI uses mocked inference providers. Passing CI does not certify model quality, GPU capacity, real provider availability, or production security.
