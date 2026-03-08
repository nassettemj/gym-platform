"use client";

import { useEffect, useRef, useCallback } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

const STORAGE_KEY = "gym-platform-onboarding-v1";

const TOUR_STEPS = [
  {
    element: "body",
    popover: {
      title: "Welcome",
      description:
        "Welcome to the admin. This short tour will show you the main areas so you can get started.",
      side: "top" as const,
      align: "center" as const,
    },
  },
  {
    element: '[data-tour="admin-menu"]',
    popover: {
      title: "Navigation",
      description:
        "Use this menu to open Members, Schedule, Plans, My schedule, and Reporting. Everything you need is here.",
      side: "bottom" as const,
      align: "end" as const,
    },
  },
  {
    element: '[data-tour="admin-main"]',
    popover: {
      title: "Your workspace",
      description:
        "This is your main workspace. The content here changes depending on where you navigate—members list, class schedule, your profile, and more.",
      side: "top" as const,
      align: "start" as const,
    },
  },
  {
    element: "body",
    popover: {
      title: "You're ready",
      description:
        "You're all set. You can replay this tour anytime from the menu (Restart tour).",
      side: "top" as const,
      align: "center" as const,
    },
  },
];

function markCompleted() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // ignore
    }
  }
}

export function AdminOnboarding({
  gymSlug,
  userRole,
  children,
}: {
  gymSlug: string;
  userRole?: string;
  children: React.ReactNode;
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
      steps: TOUR_STEPS,
      onDestroyed: () => {
        markCompleted();
      },
    });
    driverRef.current = driverObj;
    driverObj.drive();
  }, []);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== "done") {
        const timer = setTimeout(startTour, 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [startTour]);

  useEffect(() => {
    const handleStart = () => startTour();
    const eventName = "gym-platform-start-onboarding";
    window.addEventListener(eventName, handleStart);
    return () => window.removeEventListener(eventName, handleStart);
  }, [startTour]);

  return <>{children}</>;
}

export function restartOnboardingTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gym-platform-start-onboarding"));
  }
}
