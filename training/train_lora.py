"""Supervised LoRA fine-tuning for an open-weight causal language model.

The base model is loaded in BF16/FP16/FP32, never in a quantized format.
Only assistant response tokens contribute to the training loss.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForSeq2Seq,
    Trainer,
    TrainingArguments,
)

ROOT = Path(__file__).resolve().parent
MODEL_ID = os.environ.get("AUDORA_BASE_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
TRAIN_FILE = Path(os.environ.get("AUDORA_TRAIN_FILE", ROOT / "data/train.jsonl"))
OUTPUT_DIR = Path(os.environ.get("AUDORA_OUTPUT_DIR", ROOT / "output/audora-lora"))
MAX_LENGTH = int(os.environ.get("AUDORA_MAX_LENGTH", "1024"))


def load_training_data(path: Path, tokenizer):
    if not path.is_file():
        raise SystemExit(
            f"Training file not found: {path}. Copy training/data/train.example.jsonl "
            "to training/data/train.jsonl and add reviewed examples."
        )
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Invalid JSON on line {line_number}: {exc}") from exc
            prompt, response = row.get("prompt"), row.get("response")
            if not isinstance(prompt, str) or not prompt.strip():
                raise SystemExit(f"Line {line_number}: prompt must be a non-empty string")
            if not isinstance(response, str) or not response.strip():
                raise SystemExit(f"Line {line_number}: response must be a non-empty string")

            messages = [
                {"role": "user", "content": prompt.strip()},
                {"role": "assistant", "content": response.strip()},
            ]
            prompt_ids = tokenizer.apply_chat_template(
                messages[:1], tokenize=True, add_generation_prompt=True
            )
            full_ids = tokenizer.apply_chat_template(
                messages, tokenize=True, add_generation_prompt=False
            )[:MAX_LENGTH]
            prompt_length = min(len(prompt_ids), len(full_ids))
            labels = [-100] * prompt_length + full_ids[prompt_length:]
            if labels and any(label != -100 for label in labels):
                rows.append({
                    "input_ids": full_ids,
                    "attention_mask": [1] * len(full_ids),
                    "labels": labels,
                })
    if len(rows) < 2:
        raise SystemExit("Add at least two usable prompt/response examples before training.")
    return Dataset.from_list(rows)


def main() -> None:
    print(f"Loading {MODEL_ID}; base weights will not be quantized.")
    print("Ensure the selected checkpoint and training batch fit available memory.")
    if MAX_LENGTH < 32:
        raise SystemExit("AUDORA_MAX_LENGTH must be at least 32.")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    dtype = (
        torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported()
        else torch.float16 if torch.cuda.is_available()
        else torch.float32
    )
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID, torch_dtype=dtype)
    model.config.use_cache = False
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()

    adapter_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        target_modules="all-linear",
    )
    model = get_peft_model(model, adapter_config)
    model.print_trainable_parameters()
    tokenized = load_training_data(TRAIN_FILE, tokenizer)

    args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=float(os.environ.get("AUDORA_EPOCHS", "3")),
        per_device_train_batch_size=int(os.environ.get("AUDORA_BATCH_SIZE", "1")),
        gradient_accumulation_steps=int(os.environ.get("AUDORA_GRAD_ACCUM", "8")),
        learning_rate=float(os.environ.get("AUDORA_LEARNING_RATE", "2e-4")),
        logging_steps=5,
        save_strategy="epoch",
        save_total_limit=2,
        gradient_checkpointing=True,
        fp16=dtype == torch.float16,
        bf16=dtype == torch.bfloat16,
        report_to="none",
        remove_unused_columns=False,
    )
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized,
        data_collator=DataCollatorForSeq2Seq(
            tokenizer=tokenizer, padding=True, label_pad_token_id=-100
        ),
    )
    trainer.train()
    final_path = OUTPUT_DIR / "final-adapter"
    model.save_pretrained(final_path)
    tokenizer.save_pretrained(final_path)
    print(f"LoRA adapter saved to {final_path}")


if __name__ == "__main__":
    main()
