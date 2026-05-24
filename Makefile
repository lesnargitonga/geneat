PYTHON ?= ./.venv/bin/python

.PHONY: dev test-fast doctor-local doctor-live smoke-providers publish-demo-photos bootstrap-demo generate-lily-training

dev:
	./scripts/run_dev.sh

test-fast:
	$(PYTHON) -m pytest -q tests/test_menu_photos.py tests/test_config.py tests/test_config_validator.py tests/test_training_data_generator.py tests/test_graph_messages.py tests/test_rag_cache.py tests/test_safety.py tests/test_quick_replies.py tests/test_channel_fallbacks.py tests/test_output_sanitizer.py tests/test_payments_hardening.py tests/test_redis_client.py tests/test_whatsapp_webhook.py

doctor-local:
	$(PYTHON) scripts/lily_pond_demo_check.py --chat --photo

doctor-live:
	$(PYTHON) scripts/lily_pond_demo_check.py --live --chat --photo

smoke-providers:
	$(PYTHON) scripts/smoke_providers.py

bootstrap-demo:
	set -a && . ./.env && curl -X POST https://api.lesnarai.co.ke/admin/bootstrap/geneat-demo -H "Authorization: Bearer $$ADMIN_API_TOKEN"

publish-demo-photos:
	$(PYTHON) scripts/publish_demo_menu_photos.py

generate-lily-training:
	$(PYTHON) scripts/generate_lily_pond_training.py
