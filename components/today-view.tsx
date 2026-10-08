"use client";

import Link from "next/link";
import { EVENT_META, MEAL_META } from "@/lib/constants";
import { formatAgo, formatTime, formatTimeRange } from "@/lib/format";
import type { TodayPayload, WorkoutDto } from "@/lib/types";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, Meter, PageTitle, Ring } from "./ui";

export function TodayView() {
  const { data, error, loading, reload } = useLoad<TodayPayload>("/api/today");
  return (
    <main className="page">
      <PageTitle title="Today" />
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data ? <TodayBody data={data} /> : null}
    </main>
  );
}

function TodayBody({ data }: { data: TodayPayload }) {
  const calories = data.food.totals.calories;
  const target = data.food.targets.calories;
  return (
    <>
      <p className="kicker">{data.place}</p>
      <h1 className="display">{data.greeting}</h1>
      <p className="sub">{new Intl.DateTimeFormat("en-US", { timeZone: data.timezone, weekday: "long", month: "long", day: "numeric" }).format(new Date(data.now))}</p>

      <section className="card hero" style={{ marginTop: 18 }}>
        {data.focus ? (
          <>
            <p className="kicker">{data.focus.label}</p>
            <h2>{data.focus.title}</h2>
            <p>{data.focus.detail}</p>
          </>
        ) : (
          <>
            <p className="kicker">Clear sky</p>
            <h2>Nothing on the board</h2>
            <p>Add a class, shift, or study block when the week fills in.</p>
          </>
        )}
      </section>

      <div className="section-title">
        <h2>Today</h2>
        <Link href="/schedule">Schedule</Link>
      </div>
      <div className="stack">
        {data.events.length === 0 ? <p className="muted">No blocks today.</p> : null}
        {data.events.map((event) => {
          const past = new Date(event.endsAt).getTime() < new Date(data.now).getTime();
          return (
            <Link key={event.id} href="/schedule" className={`event ${past ? "past" : ""}`}>
              <time>{formatTime(event.startsAt)}</time>
              <div>
                <strong>{event.title}</strong>
                <span>
                  {EVENT_META[event.type].label}
                  {event.location ? ` · ${event.location}` : ""} · {formatTimeRange(event.startsAt, event.endsAt)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="section-title">
        <h2>Fuel</h2>
        <Link href="/food">Log</Link>
      </div>
      <section className="card">
        <div className="fuel">
          <Ring value={calories} max={target} />
          <div>
            <Meter label="Protein" value={data.food.totals.proteinG} max={data.food.targets.proteinG} unit="g" tone="protein" />
            <Meter label="Carbs" value={data.food.totals.carbsG} max={data.food.targets.carbsG} unit="g" tone="carbs" />
            <Meter label="Fat" value={data.food.totals.fatG} max={data.food.targets.fatG} unit="g" tone="fat" />
          </div>
        </div>
        {data.food.logs.length ? (
          <p className="faint" style={{ margin: "10px 0 0" }}>
            {data.food.logs.map((log) => MEAL_META[log.meal].label).filter((value, index, all) => all.indexOf(value) === index).join(" · ")} logged
          </p>
        ) : (
          <p className="faint" style={{ margin: "10px 0 0" }}>Nothing logged yet today.</p>
        )}
      </section>

      <div className="section-title">
        <h2>Training</h2>
        <Link href="/workouts">Open</Link>
      </div>
      {data.workouts.length ? (
        <div className="stack">
          {data.workouts.map((workout) => (
            <WorkoutCard key={workout.id} workout={workout} />
          ))}
        </div>
      ) : data.nextWorkout ? (
        <WorkoutCard workout={data.nextWorkout} upcoming />
      ) : (
        <p className="muted">No session planned.</p>
      )}

      <div className="section-title">
        <h2>Reminders</h2>
        <Link href="/reminders">All</Link>
      </div>
      <div className="stack">
        {data.reminders.length === 0 ? <p className="muted">None waiting.</p> : null}
        {data.reminders.map((reminder) => (
          <div key={reminder.id} className="event">
            <time>{formatTime(reminder.fireAt)}</time>
            <div>
              <strong>{reminder.title}</strong>
              <span>{reminder.body}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">
        <h2>Activity</h2>
        <Link href="/activity">Feed</Link>
      </div>
      <div className="stack">
        {data.activity.length === 0 ? <p className="muted">Bots can leave notes here.</p> : null}
        {data.activity.map((item) => (
          <article key={item.id} className="card" style={{ padding: 14 }}>
            <div className="spread">
              <strong>{item.author || "Orbit"}</strong>
              <span className="faint">{formatAgo(item.createdAt)}</span>
            </div>
            <p style={{ margin: "6px 0 0" }}>{item.message}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function WorkoutCard({ workout, upcoming = false }: { workout: WorkoutDto; upcoming?: boolean }) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const done = sets.filter((set) => set.completed).length;
  return (
    <Link href={`/workouts/${workout.id}`} className="card" style={{ display: "block" }}>
      <div className="spread">
        <p className="kicker" style={{ margin: 0 }}>{upcoming ? "Next session" : workout.status === "done" ? "Done" : "Today"}</p>
        <span className={`pill`} data-type="workout">{sets.length ? `${done}/${sets.length} sets` : workout.status}</span>
      </div>
      <strong style={{ display: "block", marginTop: 8, fontSize: 18 }}>{workout.title}</strong>
      <span className="muted">{workout.scheduledAt ? formatTime(workout.scheduledAt) : "Unscheduled"}</span>
    </Link>
  );
}
