# Audora release acceptance checklist

A green CI run means the repository's automated checks passed. It does not mean that external infrastructure, model weights, or production controls are ready.

## Repository and build
- [ ] CI passes on the exact release commit.
- [ ] Dependency audit has no unresolved high/critical findings.
- [ ] Production Docker image builds and starts.
- [ ] Secrets and local model files are excluded from Git.
- [ ] README and deployment docs match the actual configuration.

## AI inference
- [ ] A licensed model checkpoint is present and its provenance is recorded.
- [ ] Inference server starts with the intended precision and model ID.
- [ ] Real prompts succeed through the public app gateway.
- [ ] Streaming, cancellation, timeout, and provider-error paths are tested against the real runtime.
- [ ] A held-out evaluation set measures correctness, instruction following, latency, and regressions.
- [ ] No hidden chain-of-thought or private scratchpad is exposed.

## Image generation and search
- [ ] Image checkpoint and license are verified.
- [ ] GPU image generation succeeds end to end.
- [ ] Image endpoint authentication, limits, timeout, and output-size limits are tested.
- [ ] SearXNG JSON endpoint is private and reachable from the app.
- [ ] Search citations are checked against the linked sources.

## Public launch
- [ ] HTTPS, authentication, authorization, and account recovery are configured.
- [ ] Durable storage, backups, retention, and deletion workflows are tested.
- [ ] Shared rate limiting and abuse controls are enabled.
- [ ] Monitoring, alerts, log redaction, and incident response are ready.
- [ ] Capacity, GPU memory, concurrency, and cost limits are load-tested.
- [ ] Privacy notice, terms, model/data licensing, and user support channel are published.

Do not mark a section complete based on a mock test or configuration-only check.
