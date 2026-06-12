"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { usePathname } from "next/navigation";
import { HeroGiftStageLoader } from "@/components/three-d/HeroGiftStageLoader";

type ShowroomRoute =
  | "home"
  | "collections"
  | "product"
  | "studio"
  | "story"
  | "safari"
  | "quiet";

const routeClass: Record<ShowroomRoute, string> = {
  home: "showroom-shell--home",
  collections: "showroom-shell--collections",
  product: "showroom-shell--product",
  studio: "showroom-shell--studio",
  story: "showroom-shell--story",
  safari: "showroom-shell--safari",
  quiet: "showroom-shell--quiet",
};

function showroomRoute(pathname: string): ShowroomRoute {
  if (pathname === "/") return "home";
  if (pathname === "/collections") return "collections";
  if (pathname.startsWith("/collections/") || pathname.startsWith("/treasures/")) return "product";
  if (pathname === "/build") return "studio";
  if (pathname === "/about") return "story";
  if (pathname.includes("safari") || pathname === "/hosts-guides") return "safari";
  return "quiet";
}

export function ShowroomShell() {
  const pathname = usePathname() ?? "";
  const route = showroomRoute(pathname);
  const { scrollY } = useScroll();
  const stageY = useTransform(scrollY, [0, 900], [0, -76]);
  const stageScale = useTransform(scrollY, [0, 900], [1, 0.9]);
  const homeOpacity = useTransform(scrollY, [0, 640, 1180], [1, 0.7, 0.18]);
  const lightY = useTransform(scrollY, [0, 1600], [0, 120]);

  return (
    <div className={`showroom-shell ${routeClass[route]}`} aria-hidden="true">
      <motion.div className="showroom-shell__light" style={{ y: lightY }} />
      <div className="showroom-shell__architecture">
        <span className="showroom-shell__rail showroom-shell__rail--left" />
        <span className="showroom-shell__rail showroom-shell__rail--right" />
        <span className="showroom-shell__horizon" />
      </div>
      <motion.div
        className="showroom-shell__stage"
        style={{
          y: stageY,
          scale: stageScale,
          opacity: route === "home" ? homeOpacity : undefined,
        }}
      >
        <HeroGiftStageLoader />
      </motion.div>
    </div>
  );
}
