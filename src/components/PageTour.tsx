"use client";

import { useEffect, useRef, useCallback } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

export type PageTourStep = {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: "top" | "right" | "bottom" | "left" | "over";
    align?: "start" | "center" | "end";
  };
};

const STORAGE_PREFIX = "gym-platform-page-tour-";
const STORAGE_SUFFIX = "-v1";
const EVENT_PREFIX = "gym-platform-start-page-tour-";

function getStorageKey(pageKey: string): string {
  return `${STORAGE_PREFIX}${pageKey}${STORAGE_SUFFIX}`;
}

function getEventName(pageKey: string): string {
  return `${EVENT_PREFIX}${pageKey}`;
}

function markCompleted(pageKey: string) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getStorageKey(pageKey), "done");
    } catch {
      // ignore
    }
  }
}

export function PageTour({
  pageKey,
  steps,
  delay = 600,
}: {
  pageKey: string;
  steps: PageTourStep[];
  delay?: number;
}) {
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
    const driverObj = driver({
      showProgress: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      popoverClass: "gym-onboarding-popover",
      steps: steps.map((s) => ({
        element: s.element,
        popover: {
          ...s.popover,
          side: (s.popover.side ?? "top") as "top" | "right" | "bottom" | "left",
          align: (s.popover.align ?? "start") as "start" | "center" | "end",
        },
      })),
      onDestroyed: () => {
        markCompleted(pageKey);
      },
    });
    driverRef.current = driverObj;
    driverObj.drive();
  }, [pageKey, steps]);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(getStorageKey(pageKey));
      if (seen !== "done") {
        const timer = setTimeout(startTour, delay);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [pageKey, delay, startTour]);

  useEffect(() => {
    const handleStart = () => startTour();
    const eventName = getEventName(pageKey);
    window.addEventListener(eventName, handleStart);
    return () => window.removeEventListener(eventName, handleStart);
  }, [pageKey, startTour]);

  return null;
}

export function restartPageTour(pageKey: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(getEventName(pageKey)));
  }
}

export function PageTourRestart({
  pageKey,
  className,
  children,
}: {
  pageKey: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => restartPageTour(pageKey)}
      className={className ?? "text-xs text-white/60 hover:text-white/90 underline"}
    >
      {children ?? "Restart tour"}
    </button>
  );
}
