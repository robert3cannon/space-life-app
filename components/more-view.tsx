"use client";

import Link from "next/link";
import { PageTitle } from "./ui";

const groups = [
  {
    title: "Wellness",
    links: [
      { href: "/water", title: "Water", copy: "Daily ounces, quick add, and the week." },
      { href: "/sleep", title: "Sleep", copy: "Bedtime, wake time, and the weekly trend." },
      { href: "/habits", title: "Habits", copy: "Check-ins, streaks, and a month view." },
      { href: "/settings/health", title: "Apple Health", copy: "Shortcut import, export, and the sync token." },
    ],
  },
  {
    title: "Planning",
    links: [
      { href: "/reminders", title: "Reminders", copy: "Meals, water, wind-down, and custom nudges." },
      { href: "/activity", title: "Activity", copy: "Notes from your scheduler and coach bots." },
    ],
  },
  {
    title: "Settings",
    links: [
      { href: "/settings", title: "Settings", copy: "Targets, reminders, and notifications." },
    ],
  },
];

export function MoreView() {
  return (
    <main className="page">
      <PageTitle title="More" />
      <p className="kicker">Orbit</p>
      <h1 className="display">More</h1>
      <p className="sub">Wellness, planning, and settings.</p>
      {groups.map((group) => (
        <section key={group.title} className="menu-group" aria-labelledby={`more-${group.title.toLowerCase()}`}>
          <p className="kicker" id={`more-${group.title.toLowerCase()}`}>{group.title}</p>
          <div className="stack">
            {group.links.map((link) => (
              <Link key={link.href} href={link.href} className="card link-card">
                <strong>{link.title}</strong>
                <span className="muted">{link.copy}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
