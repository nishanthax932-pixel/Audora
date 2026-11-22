# Audora Foundation Model & Intelligence Roadmap

**Status:** architecture and research plan; no foundation model has been pretrained by this document.  
**Goal:** build an Audora-owned intelligence stack with measurable product quality, provider independence, and a credible path from model adaptation to original pretraining.

## 1. Define what “our own model” means

These are different deliverables and must not be conflated:

1. **Audora product intelligence:** system prompts, tools, retrieval, memory, orchestration, safety, and evaluations. This can improve the shipped product without changing base weights.
2. **Audora-adapted checkpoint:** a legally usable open-weight base model fine-tuned on permissioned, curated Audora data. The resulting adapter/checkpoint is Audora-specific, but the base model remains third-party.
3. **Audora pretrained foundation model:** weights initialized and pretrained by Audora on a documented, licensed corpus with a tokenizer, architecture, training run, evaluation suite, and reproducible artifacts. This is a separate, expensive research program.

The near-term plan is (1), then carefully validated (2). Do not claim (3) until pretraining has actually completed and the resulting model passes release gates.

## 2. Target architecture

Keep the existing provider-agnostic inference boundary. Evolve it into these independently testable layers:

- **Model gateway:** provider/model registry, capability metadata (chat, tools, vision, JSON, streaming), timeouts, retries, cancellation, health checks, per-model limits, and cost accounting.
- **Orchestrator:** bounded planning/tool loop, task routing, context assembly, retrieval, memory policy, and response validation. Tools remain explicit allow-lists with per-tool authorization.
- **Knowledge layer:** user/tenant-scoped documents and memories, hybrid lexical/vector retrieval, provenance, deletion, retention, and export.
- **Intelligence layer:** base model(s), Audora adapters, optional reranker/embedding model, and modality-specific models.
- **Trust layer:** prompt-injection boundaries, input/output policy checks, tool permission checks, secret redaction, audit events, and abuse controls.
- **Evaluation layer:** frozen golden sets, regression tests, model/provider comparisons, adversarial tests, latency/cost measurements, and human review.
- **Operations:** durable identity, tenant isolation, PostgreSQL, object storage, queueing, distributed rate limits, telemetry, backups, and staged releases.

Never let model-generated text directly grant permissions or bypass server-side authorization.

## 3. Delivery phases and exit criteria

### Phase A — reliable model gateway (near-term)
- Document and test provider contract and capability negotiation.
- Add request IDs, timeout/cancellation behavior, bounded retries only for safe failures, and consistent error mapping.
- Add model registry configuration without exposing provider secrets to clients.
- Add provider contract tests with mocked OpenAI-compatible and Ollama responses.
- Record model ID, provider, latency, token usage when returned, and estimated cost without logging prompts or personal content.

**Exit:** all provider contract tests pass; unsupported capabilities fail clearly; no secret appears in client config or logs.

### Phase B — data and evaluation foundation
- Define a dataset card and provenance fields for every training/evaluation source.
- Accept only data with documented permission/licence and purpose; remove personal data and secrets.
- Deduplicate exact and near-duplicate records; detect train/eval contamination.
- Keep train, validation, and held-out test sets separate by source/time where practical.
- Build task-specific evaluations: factual QA, math, coding, instruction following, Hindi/English quality, tool selection, refusal/safety, retrieval grounding, and multimodal tasks only when supported.
- Add semantic/human grading; current phrase-match evaluator remains a smoke test only.
- Version prompts, datasets, model IDs, adapters, and evaluation results.

**Exit:** dataset provenance is reviewable; leakage checks pass; every release candidate has a baseline report and human-reviewed sample.

### Phase C — product adaptation
- Establish a baseline with a permitted open-weight instruct model and the same inference harness.
- Compare prompt/RAG improvements before training; do not fine-tune to compensate for missing retrieval or broken tools.
- Run LoRA/PEFT experiments first, with fixed seeds and small controlled runs.
- Compare against the untouched base on held-out and adversarial evaluations.
- Merge/export only if the license allows it and evaluation improves without unacceptable regressions.
- Preserve a rollback path to the original base model.

**Exit:** measurable improvement on predeclared Audora tasks, no material safety regression, reproducible training metadata, and acceptable serving latency/cost.

### Phase D — original pretraining research (long-term, optional)
Only begin after a written feasibility review and funded compute/data plan.

Required decisions:
- Model family and parameter scale based on a realistic GPU budget.
- Tokenizer design and multilingual coverage, especially Hindi and English.
- Corpus acquisition, licensing, provenance, filtering, deduplication, PII removal, and data governance.
- Architecture, sequence length, context strategy, optimizer, learning-rate schedule, batch/token budget, checkpoint cadence, and distributed training stack.
- Compute estimates, failure recovery, storage, networking, experiment tracking, and checkpoint validation.
- Benchmark contamination controls, independent evaluations, safety tuning, and release/licensing policy.

A scratch pretraining run is not a weekend feature. GitHub stores code and metadata, not GPU compute, model weights, or training data. No model-size or completion claims should be made without run logs and artifacts.

## 4. Training data contract

Preferred JSONL record shape for future datasets:

```json
{
  "id": "stable-record-id",
  "messages": [
    {"role": "user", "content": "Question"},
    {"role": "assistant", "content": "Answer"}
  ],
  "source": "permissioned-source-name",
  "license": "license-or-permission-reference",
  "split": "train",
  "language": "en",
  "review_status": "approved"
}
```

The current training scripts accept simpler prompt/response examples; they do not yet enforce this full provenance contract. Do not place private user conversations into training by default. Obtain explicit permission, minimize data, and honor deletion/opt-out requirements before any future training use.

## 5. Release gates

A candidate is not production-ready merely because training exits successfully. Require:

- Reproducible config, code revision, base model revision, tokenizer revision, data manifest hash, and run metadata.
- No train/evaluation leakage detected by the available checks.
- Held-out task scores compared to the baseline, with confidence intervals or repeated runs where practical.
- Human review of factuality, instruction following, Hindi/English quality, and harmful failure modes.
- Prompt-injection and tool authorization tests.
- Load, latency, memory, and cost tests on the actual serving hardware.
- Model card, dataset card, limitations, license review, rollback plan, and deployment sign-off.

## 6. Current honest status

The repository currently contains:
- A provider-configurable Node.js AI workspace (DeepSeek, Ollama, and OpenAI-compatible endpoint paths).
- A bounded calculator/time/web-search agent loop.
- Starter full fine-tuning and LoRA scripts for existing causal language models.
- A small example dataset and a smoke evaluation harness.

It does **not** currently contain:
- A pretrained Audora foundation checkpoint or original tokenizer.
- A from-scratch pretraining pipeline or large licensed corpus.
- A production-grade model registry, semantic evaluation platform, or GPU training cluster.
- A deployed coding sandbox, durable identity/memory database, or production tenant isolation.

## 7. Immediate engineering sequence

1. Provider contract/capability tests and robust cancellation.
2. Semantic evaluation + dataset provenance and leakage checks.
3. Secure authentication, PostgreSQL, tenant isolation, and durable memory.
4. Retrieval/embeddings/reranking with citations and deletion semantics.
5. Cost/usage metering and observability.
6. Controlled LoRA experiments against a frozen baseline.
7. Only then decide whether original pretraining is economically and technically justified.
