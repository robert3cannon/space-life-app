"use client";

import Link from "next/link";
import { PageTitle } from "./ui";

const links = [
  { href: "/reminders", title: "Reminders", copy: "Meal, workout, and custom nudges." },
  { href: "/activity", title: "Activity", copy: "Notes from your scheduler and coach bots." },
  { href: "/settings", title: "Settings", copy: "Targets, home screen, and notifications." },
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
