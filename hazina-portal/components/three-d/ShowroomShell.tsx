"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { HeroGiftStageLoader } from "@/components/three-d/HeroGiftStageLoader";

type ShowroomRoute =
  | "home"
  | "collections"
  | "product"
  | "studio"
  | "story"
  | "safari"
  | "quiet";

type StageDragDetail = {
  phase: "start" | "move" | "end";
  dx: number;
  dy: number;
};

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
  const dragStart = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const { scrollY } = useScroll();
  const stageY = useTransform(scrollY, [0, 900], [0, -76]);
  const stageScale = useTransform(scrollY, [0, 900], [1, 0.9]);
  const homeOpacity = useTransform(scrollY, [0, 640, 1180], [1, 0.7, 0.18]);
  const lightY = useTransform(scrollY, [0, 1600], [0, 120]);

  const dispatchStageDrag = (detail: StageDragDetail) => {
    window.dispatchEvent(new CustomEvent<StageDragDetail>("hazina:stage-drag", { detail }));
  };

  const endStageDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    dispatchStageDrag({ phase: "end", dx: 0, dy: 0 });
  };

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
      {route === "home" && (
        <div
          className={`showroom-shell__interaction-lane${isDragging ? " is-dragging" : ""}`}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") return;
            dragStart.current.x = event.clientX;
            dragStart.current.y = event.clientY;
            isDraggingRef.current = true;
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            dispatchStageDrag({ phase: "start", dx: 0, dy: 0 });
          }}
          onPointerMove={(event) => {
            if (!isDraggingRef.current || event.pointerType === "touch") return;
            dispatchStageDrag({
              phase: "move",
              dx: event.clientX - dragStart.current.x,
              dy: event.clientY - dragStart.current.y,
            });
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            endStageDrag();
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            endStageDrag();
          }}
          onLostPointerCapture={endStageDrag}
        />
      )}
    </div>
  );
}
