import argparse
import json
from pathlib import Path

import torch
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, DataCollatorForLanguageModeling, Trainer, TrainingArguments


def load_examples(path: Path, tokenizer, max_length: int):
    rows = []
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            messages = record.get("messages")
            if not isinstance(messages, list) or len(messages) < 2:
                raise ValueError(f"Line {line_number}: expected a messages array")
            for message in messages:
                if message.get("role") not in {"system", "user", "assistant"} or not isinstance(message.get("content"), str):
                    raise ValueError(f"Line {line_number}: invalid message")
            rendered = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
            encoded = tokenizer(rendered, truncation=True, max_length=max_length)
            if len(encoded["input_ids"]) >= 8:
                rows.append(encoded)
    if not rows:
        raise ValueError("Training file contains no usable chat examples")
    return Dataset.from_list(rows)


def main():
    parser = argparse.ArgumentParser(description="Full fine-tuning starter for unquantized Audora weights.")
    parser.add_argument("--model", required=True, help="Open-weight model ID or local checkpoint")
    parser.add_argument("--data", required=True, type=Path, help="Permissioned JSONL chat dataset")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--epochs", type=float, default=2.0)
    parser.add_argument("--max-length", type=int, default=2048)
    args = parser.parse_args()

    if not torch.cuda.is_available():
        raise RuntimeError("A CUDA GPU is required by this full fine-tuning starter.")
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load floating-point weights directly: no 4-bit/8-bit, GGUF, GPTQ or AWQ.
    model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=dtype, low_cpu_mem_usage=True)
    model.config.use_cache = False
    model.gradient_checkpointing_enable()
    dataset = load_examples(args.data, tokenizer, args.max_length)
    training_args = TrainingArguments(
        output_dir=str(args.output),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-5,
        warmup_ratio=0.03,
        weight_decay=0.01,
        logging_steps=5,
        save_strategy="epoch",
        save_total_limit=2,
        bf16=(dtype == torch.bfloat16),
        fp16=(dtype == torch.float16),
        gradient_checkpointing=True,
        optim="adamw_torch",
        report_to="none",
        remove_unused_columns=False,
    )
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
        tokenizer=tokenizer,
    )
    trainer.train()
    trainer.save_model(str(args.output))
    tokenizer.save_pretrained(str(args.output))
    print(f"Saved Audora checkpoint to {args.output}")


if __name__ == "__main__":
    main()
