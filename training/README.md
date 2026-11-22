# Audora model training workspace

This directory contains **starter fine-tuning code**, not a pretrained Audora foundation model.

## Choose the right experiment

| Goal | Method | What changes |
|---|---|---|
| Improve answers without training | Prompting, tools, retrieval, evaluation | Product behavior; no weights |
| Adapt a permitted instruct model | LoRA/PEFT | Adapter weights; base remains unchanged |
| Update all model weights | Full fine-tuning | Derived checkpoint; still not scratch pretraining |
| Create an original foundation model | Pretraining from initialized weights | New base weights, tokenizer/data/training program required |

Start with product-level evaluation and retrieval. Fine-tuning cannot reliably fix missing facts, weak search, unsafe tool permissions, or poor data quality.

## Current scripts

- \`train.py\`: full fine-tuning of an existing causal language model in BF16/FP16.
- \`train_lora.py\`: LoRA/PEFT adapter training with an existing base model.
- \`data/train.example.jsonl\`: tiny format example only; it is not a useful training corpus.
- \`requirements.txt\`: Python dependencies. Install a CUDA-compatible PyTorch build separately when using NVIDIA GPUs.

Both scripts require a compatible model/tokenizer chat template and suitable hardware. Training completion is not evidence of improved quality.

## LoRA quick start

1. Review the selected base model's license and intended-use restrictions.
2. Create a reviewed, permissioned dataset. Never copy private user chats by default.
3. Copy the example file to \`training/data/train.jsonl\` and replace the examples with reviewed records.
4. Install CUDA-compatible PyTorch, then install \`training/requirements.txt\`.
5. Set \`AUDORA_BASE_MODEL\`, \`AUDORA_TRAIN_FILE\`, \`AUDORA_OUTPUT_DIR\`, and resource settings as needed.
6. Run \`python training/train_lora.py\`.
7. Evaluate the adapter against the untouched base on a held-out set before serving it.

## Validate a governed manifest

For a new manifest using the strict provenance contract, run:

\`\`\`bash
python training/validate_training_data.py path/to/manifest.jsonl
python -m unittest discover -s training -p 'test_*.py'
\`\`\`

The validator checks required provenance fields, approved review status, message shape, unique IDs, and normalized exact duplicates across splits (Unicode NFKC, case, and whitespace differences are normalized). It cannot verify that a license claim is true, detect personal information, or detect semantic/near-duplicates; those still require review and dedicated tooling.

Existing starter scripts continue to accept the older prompt/response format, so migrate and validate a governed dataset before using it for serious experiments.

## Dataset quality rules

- Record source, license/permission, split, language, and review status in a dataset manifest.
- Keep train, validation, and test records separate; do not tune on the test set.
- Remove personal information, credentials, private documents, and content without training permission.
- Deduplicate exact and near-duplicate examples; inspect low-quality, contradictory, and synthetic examples.
- Balance task categories and languages intentionally; do not infer quality from dataset size alone.
- Keep an immutable manifest/hash for every run.

The current training scripts accept simple \`prompt\`/\`response\` or chat \`messages\` records; they do **not** yet enforce this governance metadata. The provenance contract is a target, not an implemented validator.

## Resource and safety notes

- Full fine-tuning needs substantially more VRAM than LoRA because optimizer states, gradients, and activations consume memory.
- LoRA reduces trainable parameters but still loads the base model; it is not automatically feasible on every GPU.
- Do not assume CPU training is practical for meaningful models.
- Do not commit model weights, API keys, private datasets, or user data to Git.
- Pin model revisions and dependency versions for reproducibility.
- Keep a baseline checkpoint and a rollback route.
- Compare factuality, reasoning tasks, Hindi/English quality, safety, tool-use behavior, latency, and serving cost.

See [Foundation Model & Intelligence Roadmap](../docs/FOUNDATION-MODEL-STRATEGY.md) for the staged architecture and release gates.
