"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { HAZINA_VAULT_REVEAL_EVENT } from "@/lib/showroom";

const REVEAL_DURATION_MS = 1050;

function supportsVaultReveal() {
  return (
    window.matchMedia("(min-width: 1200px) and (hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    Boolean(document.querySelector(".hero-gift-stage canvas"))
  );
}

export function VaultEntryLink() {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !supportsVaultReveal()
    ) {
      return;
    }

    event.preventDefault();
    if (opening) return;

    setOpening(true);
    window.dispatchEvent(new Event(HAZINA_VAULT_REVEAL_EVENT));
    timerRef.current = window.setTimeout(() => router.push("/collections"), REVEAL_DURATION_MS);
  };

  return (
    <Link
      href="/collections"
      className={`btn-bronze vault-entry-link${opening ? " is-opening" : ""}`}
      data-cursor="magnetic"
      aria-busy={opening || undefined}
      onClick={handleClick}
    >
      <span className="vault-entry-link__label">
        {opening ? "Opening collection rooms" : "Enter the collection rooms"}
      </span>
      <span className="vault-entry-link__mark" aria-hidden="true" />
    </Link>
  );
}
