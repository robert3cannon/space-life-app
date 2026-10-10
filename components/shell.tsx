"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today", icon: TodayIcon },
  { href: "/schedule", label: "Schedule", icon: PlanIcon },
  { href: "/food", label: "Food", icon: FoodIcon },
  { href: "/workouts", label: "Train", icon: TrainIcon },
  { href: "/more", label: "More", icon: MoreIcon },
];

function isOn(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") {
    return ["/more", "/reminders", "/activity", "/settings", "/water", "/sleep", "/habits", "/outfits"].some((path) => pathname.startsWith(path));
  }
  if (href === "/workouts") {
    return pathname.startsWith("/workouts") || pathname.startsWith("/exercises") || pathname.startsWith("/circuits") || pathname.startsWith("/sessions");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("input, textarea, select")) return;
      if (target.closest(".sheet")) return;
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: motion ? "auto" : "smooth" });
      }, 280);
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);
  return (
    <>
      {children}
      <nav className="tabbar" aria-label="Primary">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={isOn(pathname, tab.href) ? "on" : undefined} aria-current={isOn(pathname, tab.href) ? "page" : undefined}>
            <tab.icon />
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" strokeLinecap="round" />
    </svg>
  );
}
function PlanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" strokeLinecap="round" />
    </svg>
  );
}
function FoodIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3.5v7M9 3.5v7M6 7h3M15 3.5c1.8 2 2.4 4 2.4 6.2 0 2.4-1.4 4-3.2 4.6V20" strokeLinecap="round" />
    </svg>
  );
}
function TrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 16l4-8 3 5 2-3 3 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6" cy="12" r="1.35" />
      <circle cx="12" cy="12" r="1.35" />
      <circle cx="18" cy="12" r="1.35" />
    </svg>
  );
}
