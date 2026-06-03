#!/usr/bin/env python3
"""Quick probe before training — run on the GPU pod."""
import torch

print("torch.__version__:", torch.__version__)
print("cuda.is_available():", torch.cuda.is_available())
print("cuda.device_count():", torch.cuda.device_count())
if torch.cuda.is_available():
    print("gpu:", torch.cuda.get_device_name(0))
if hasattr(torch, "accelerator"):
    print("torch.accelerator.is_available():", torch.accelerator.is_available())
try:
    from unsloth import FastLanguageModel  # noqa: F401
    print("unsloth import: OK")
except Exception as e:
    print("unsloth import: FAIL", e)
    raise SystemExit(1)
