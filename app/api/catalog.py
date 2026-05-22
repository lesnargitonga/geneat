"""Public catalog endpoints for the consumer portal.

Safe, read-only business media data that can be shown to customers without
admin auth.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.menu_photos import MENU_PHOTOS
from app.db.session import SessionLocal
from app.services.business_service import get_business_by_slug

router = APIRouter(prefix="/catalog", tags=["catalog"])


class MenuPhotoCatalogOut(BaseModel):
    slug: str
    photos: dict[str, str]


@router.get("/businesses/{slug}/menu-photos", response_model=MenuPhotoCatalogOut)
async def get_menu_photos(slug: str) -> MenuPhotoCatalogOut:
    async with SessionLocal() as db:
        business = await get_business_by_slug(db, slug)
        if business is None:
            raise HTTPException(status_code=404, detail=f"Business '{slug}' not found")

        merged = dict(MENU_PHOTOS.get(slug, {}))
        profile_photos = (business.profile or {}).get("menu_photos")
        if isinstance(profile_photos, dict):
            for key, value in profile_photos.items():
                key_text = str(key or "").strip()
                url = str(value or "").strip()
                if key_text and url:
                    merged[key_text] = url

        return MenuPhotoCatalogOut(slug=slug, photos=merged)
