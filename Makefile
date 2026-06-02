PYTHON ?= ./.venv/bin/python

.PHONY: dev dev-hazina preview-hazina test-fast test-hazina doctor-local doctor-live doctor-hazina-live doctor-hazina-api smoke-hazina-war-room smoke-providers publish-demo-photos bootstrap-demo generate-lily-training eval-whatsapp-live eval-whatsapp-local pre-demo-local pre-demo-live

dev-hazina:
	./scripts/dev-hazina.sh --background

dev-hazina-fg:
	./scripts/dev-hazina.sh

preview-hazina:
	./scripts/preview-hazina.sh

dev:
	./scripts/run_dev.sh

test-fast:
	$(PYTHON) -m pytest -q tests/test_menu_photos.py tests/test_business_service.py tests/test_config.py tests/test_config_validator.py tests/test_health_version.py tests/test_training_data_generator.py tests/test_graph_messages.py tests/test_rag_cache.py tests/test_safety.py tests/test_quick_replies.py tests/test_channel_fallbacks.py tests/test_prompts.py tests/test_output_sanitizer.py tests/test_payments_hardening.py tests/test_redis_client.py tests/test_whatsapp_webhook.py tests/test_whatsapp_menus.py tests/test_gift_automation.py tests/test_payment_routing.py tests/test_ai_tools_payment.py

test-hazina:
	$(PYTHON) -m pytest -q tests/test_business_service.py tests/test_whatsapp_menus.py tests/test_gift_automation.py tests/test_payment_routing.py tests/test_ai_tools_payment.py tests/test_channel_fallbacks.py tests/test_payments_hardening.py tests/test_order_tracking.py tests/test_ops_automation.py

doctor-local:
	$(PYTHON) scripts/lily_pond_demo_check.py --chat --photo

doctor-live:
	$(PYTHON) scripts/lily_pond_demo_check.py --live --chat --photo

doctor-hazina-live:
	$(PYTHON) scripts/hazina_live_check.py

doctor-hazina-api:
	$(PYTHON) scripts/hazina_live_check.py --hazina-api

smoke-hazina-war-room:
	$(PYTHON) scripts/hazina_war_room_smoke.py

smoke-providers:
	$(PYTHON) scripts/smoke_providers.py

bootstrap-demo:
	$(PYTHON) scripts/bootstrap_geneat_demo_live.py

publish-demo-photos:
	$(PYTHON) scripts/publish_demo_menu_photos.py

generate-lily-training:
	$(PYTHON) scripts/generate_lily_pond_training.py

eval-whatsapp-local:
	$(PYTHON) scripts/eval_whatsapp_reply_matrix.py

eval-whatsapp-live:
	$(PYTHON) scripts/eval_whatsapp_reply_matrix.py --live

pre-demo-local:
	$(PYTHON) scripts/pre_demo_battery.py

pre-demo-live:
	$(PYTHON) scripts/pre_demo_battery.py --live
