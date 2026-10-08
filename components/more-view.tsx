"use client";

import Link from "next/link";
import { PageTitle } from "./ui";

const links = [
  { href: "/water", title: "Water", copy: "Daily ounces, quick add, and the week." },
  { href: "/sleep", title: "Sleep", copy: "Bedtime, wake time, and the weekly trend." },
  { href: "/habits", title: "Habits", copy: "Check-ins, streaks, and a month view." },
  { href: "/reminders", title: "Reminders", copy: "Meals, water, wind-down, and custom nudges." },
  { href: "/activity", title: "Activity", copy: "Notes from your scheduler and coach bots." },
  { href: "/settings/health", title: "Apple Health", copy: "Shortcut import, export, and the sync token." },
  { href: "/settings", title: "Settings", copy: "Targets, reminders, and notifications." },
];

export function MoreView() {
  return (
    <main className="page">
      <PageTitle title="More" />
      <p className="kicker">Orbit</p>
      <h1 className="display">More</h1>
      <div className="stack" style={{ marginTop: 18 }}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="card link-card">
            <strong>{link.title}</strong>
            <span className="muted">{link.copy}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
