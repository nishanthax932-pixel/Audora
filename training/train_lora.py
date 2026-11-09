"""Supervised LoRA fine-tuning for an open-weight causal language model.

This starter deliberately does NOT quantize the base model. Select a checkpoint
that fits your available GPU/RAM. Training only updates LoRA adapter weights.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, TaskType, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

ROOT = Path(__file__).resolve().parent
MODEL_ID = os.environ.get("AUDORA_BASE_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
TRAIN_FILE = Path(os.environ.get("AUDORA_TRAIN_FILE", ROOT / "data/train.jsonl"))
OUTPUT_DIR = Path(os.environ.get("AUDORA_OUTPUT_DIR", ROOT / "output/audora-lora"))
MAX_LENGTH = int(os.environ.get("AUDORA_MAX_LENGTH", "1024"))


def validate_dataset(path: Path) -> int:
    if not path.is_file():
        raise SystemExit(
            f"Training file not found: {path}. Copy training/data/train.example.jsonl "
            "to training/data/train.jsonl and add reviewed examples."
        )
    count = 0
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Invalid JSON on line {line_number}: {exc}") from exc
            if not isinstance(row.get("prompt"), str) or not row["prompt"].strip():
                raise SystemExit(f"Line {line_number}: prompt must be a non-empty string")
            if not isinstance(row.get("response"), str) or not row["response"].strip():
                raise SystemExit(f"Line {line_number}: response must be a non-empty string")
            count += 1
    if count < 2:
        raise SystemExit("Add at least two valid prompt/response examples before training.")
    return count


def main() -> None:
    rows = validate_dataset(TRAIN_FILE)
    print(f"Loading {MODEL_ID}; validated {rows} training examples.")
    print("Base weights will not be quantized. Ensure the selected model fits available memory.")

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

    dataset = load_dataset("json", data_files=str(TRAIN_FILE), split="train")

    def format_and_tokenize(batch):
        texts = [
            f"### User:\n{prompt.strip()}\n\n### Assistant:\n{response.strip()}{tokenizer.eos_token}"
            for prompt, response in zip(batch["prompt"], batch["response"])
        ]
        return tokenizer(texts, truncation=True, max_length=MAX_LENGTH)

    tokenized = dataset.map(
        format_and_tokenize,
        batched=True,
        remove_columns=dataset.column_names,
        desc="Tokenizing reviewed examples",
    )
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
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    trainer.train()
    model.save_pretrained(OUTPUT_DIR / "final-adapter")
    tokenizer.save_pretrained(OUTPUT_DIR / "final-adapter")
    print(f"LoRA adapter saved to {OUTPUT_DIR / 'final-adapter'}")


if __name__ == "__main__":
    main()
