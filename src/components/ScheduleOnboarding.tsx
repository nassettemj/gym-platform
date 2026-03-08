"use client";

import { useEffect, useRef, useCallback } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

const STORAGE_KEY = "gym-platform-schedule-onboarding-v1";

const TOUR_STEPS = [
  {
    element: "body",
    popover: {
      title: "Planning (schedule)",
      description:
        "Here you manage your weekly classes. This short tour will show you the main controls.",
      side: "top" as const,
      align: "center" as const,
    },
  },
  {
    element: '[data-tour="schedule-view-toggle"]',
    popover: {
      title: "View",
      description:
        "Switch between Day, Week, and Month to see your classes. Use the arrows to move to another date.",
      side: "bottom" as const,
      align: "start" as const,
    },
  },
  {
    element: '[data-tour="schedule-filters"]',
    popover: {
      title: "Filters",
      description:
        "Filter by location, instructor, or category to focus on specific classes.",
      side: "bottom" as const,
      align: "end" as const,
    },
  },
  {
    element: '[data-tour="schedule-grid"]',
    popover: {
      title: "Calendar",
      description:
        "Your classes appear here. Click a class to view or edit it. In Week or Month view you can select multiple days to create a class on several dates at once.",
      side: "top" as const,
      align: "start" as const,
    },
  },
  {
    element: '[data-tour="schedule-new-class"]',
    popover: {
      title: "New class",
      description:
        "Click here to create a single class. You can set name, location, time, instructor, and whether it repeats.",
      side: "left" as const,
      align: "center" as const,
    },
  },
  {
    element: "body",
    popover: {
      title: "You're set",
      description:
        "You can replay this tour anytime using the link below the calendar.",
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

export function ScheduleOnboarding({ gymSlug }: { gymSlug: string }) {
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
        const timer = setTimeout(startTour, 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [startTour]);

  useEffect(() => {
    const handleStart = () => startTour();
    const eventName = "gym-platform-start-schedule-onboarding";
    window.addEventListener(eventName, handleStart);
    return () => window.removeEventListener(eventName, handleStart);
  }, [startTour]);

  return null;
}

export function restartScheduleTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("gym-platform-start-schedule-onboarding")
    );
  }
}

export function ScheduleTourRestart() {
  return (
    <button
      type="button"
      onClick={restartScheduleTour}
      className="text-xs text-white/60 hover:text-white/90 underline"
    >
      Restart schedule tour
    </button>
  );
}
