# Audora Production Readiness Roadmap

This roadmap tracks gaps between the current open-source starter and a secure, reliable hosted product. It does not claim these capabilities are already implemented.

## Foundation-model strategy

Audora should **not train a foundation model from scratch at this stage**. Continue using hosted or open-weight models behind the existing provider abstraction. Consider fine-tuning/LoRA only if held-out evaluations show measurable product-specific benefit, with licensed data and affordable compute.

## Delivery order

### P0 — Trust and quality
1. Golden-set evaluation harness
2. Prompt-injection and tool security
3. Privacy, retention, and deletion policy

### P1 — Backend and core capabilities
4. Durable authentication
5. PostgreSQL-backed memory
6. Isolated coding sandbox
7. Bounded agent execution and MCP
8. Document/PDF ingestion
9. Managed web search and citations
10. Usage metering and cost controls
11. Observability and prompt versioning

### P2 — Launch and polish
12. Public landing page
13. Billing
14. Data export and portability
15. Mobile, streaming, and onboarding polish

## Engineering guardrails
- Do not advertise a feature until acceptance criteria and tests pass.
- Keep inference provider-agnostic; do not build a foundation model from scratch.
- Treat web pages and uploaded files as untrusted input.
- Enforce authorization and tenant isolation server-side.
- Never expose secrets to prompts, browser storage, logs or telemetry.
- Run unit, integration, security and eval tests before enabling hosted features.
- Distinguish code/configuration from a deployed, operational service.

All work is tracked in GitHub issues. Implementation and deployment require engineering, infrastructure, security review and operational validation.
