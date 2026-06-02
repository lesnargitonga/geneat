"""Map Hazina WhatsApp interactive payloads to portal chat action chips."""
from __future__ import annotations

from typing import Any

from app.services.whatsapp_menus import command_for_interactive_id


def portal_send_text(label: str, interactive_id: str | None, *, fallback: str | None = None) -> str:
    """Format text the same way Meta list/button taps arrive (title + [lp:id])."""
    body = (label or "").strip()
    if interactive_id:
        return f"{body} [{interactive_id}]"
    return (fallback or body).strip()


def portal_actions_from_interactive(interactive: dict | None) -> list[dict[str, Any]]:
    """Flatten Meta list/button payloads into portal ``ChatAction`` rows."""
    if not interactive or not isinstance(interactive, dict):
        return []
    kind = str(interactive.get("type") or "").lower()
    out: list[dict[str, Any]] = []

    if kind == "buttons":
        for idx, button in enumerate(interactive.get("buttons") or []):
            if not isinstance(button, dict):
                continue
            iid = str(button.get("id") or "").strip() or None
            label = str(button.get("title") or "Option").strip()
            cmd = command_for_interactive_id(iid)
            out.append(
                {
                    "label": label[:48],
                    "value": portal_send_text(label, iid, fallback=cmd or label),
                    "primary": idx == 0,
                    "interactive_id": iid,
                }
            )
        return out[:12]

    if kind == "list":
        for section in interactive.get("sections") or []:
            if not isinstance(section, dict):
                continue
            for row in section.get("rows") or []:
                if not isinstance(row, dict):
                    continue
                iid = str(row.get("id") or "").strip() or None
                label = str(row.get("title") or "Option").strip()
                desc = str(row.get("description") or "").strip()
                cmd = command_for_interactive_id(iid)
                chip_label = label if not desc else f"{label} — {desc}"
                out.append(
                    {
                        "label": chip_label[:72],
                        "value": portal_send_text(label, iid, fallback=cmd or label),
                        "primary": len(out) == 0,
                        "interactive_id": iid,
                    }
                )
                if len(out) >= 12:
                    return out
        return out

    return out
