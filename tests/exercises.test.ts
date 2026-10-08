import "./load-env";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { GET as botExercises } from "../app/api/bot/exercises/route";
import { GET as botExercise } from "../app/api/bot/exercises/[id]/route";
import { closeDb } from "../lib/db";
import { HttpError } from "../lib/errors";
import { EXERCISES, resolveExercise, searchExercises } from "../lib/exercises";
import { BACK_MUSCLES, FRONT_MUSCLES } from "../lib/body-figure";
import { MUSCLE_IDS, isMuscleId } from "../lib/muscles";

const ctx = undefined as never;

describe("exercise library", () => {
  after(async () => {
    await closeDb();
  });

  it("keeps a broad catalog with fine-grained muscles", () => {
    assert.ok(EXERCISES.length >= 100);
    const equipment = new Set(EXERCISES.map((exercise) => exercise.equipment));
    for (const kind of ["bodyweight", "dumbbell", "barbell", "machine", "cable"]) {
      assert.ok(equipment.has(kind as never), kind);
    }
    for (const exercise of EXERCISES) {
      assert.ok(exercise.primary.length > 0);
      assert.ok(exercise.steps.length > 0);
      assert.equal(exercise.images.length, 2);
      for (const muscle of [...exercise.primary, ...exercise.secondary]) {
        assert.equal(isMuscleId(muscle), true, muscle);
      }
    }
    for (const muscle of MUSCLE_IDS) {
      assert.ok(EXERCISES.some((exercise) => exercise.primary.includes(muscle)), muscle);
    }
    const drawn = new Set([...FRONT_MUSCLES, ...BACK_MUSCLES].map((shape) => shape.id));
    for (const muscle of MUSCLE_IDS) {
      assert.ok(drawn.has(muscle), `body map missing ${muscle}`);
    }
  });

  it("filters by muscle and matches planned workout names", () => {
    const lower = searchExercises({ muscle: "lower_abs" });
    assert.ok(lower.some((exercise) => exercise.id === "Hanging_Leg_Raise"));
    assert.equal(lower[0].primary.includes("lower_abs"), true);
    assert.equal(resolveExercise(null, "Bench press")?.id, "Barbell_Bench_Press_-_Medium_Grip");
    assert.equal(resolveExercise(null, "Lat pulldown")?.primary.includes("lats"), true);
    assert.throws(() => searchExercises({ muscle: "abs" }), (err: unknown) => err instanceof HttpError && err.status === 400);
  });

  it("serves the library to the bot", async () => {
    const denied = await botExercises(new Request("http://localhost/api/bot/exercises?muscle=lower_abs"), ctx);
    assert.equal(denied.status, 401);
    const ok = await botExercises(
      new Request("http://localhost/api/bot/exercises?muscle=lower_abs&equipment=bodyweight", {
        headers: { authorization: "Bearer test-bot-token-value" },
      }),
      ctx,
    );
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.ok(body.count >= 1);
    assert.ok(body.exercises.every((exercise: { primary: string[]; secondary: string[]; steps: string[] }) =>
      (exercise.primary.includes("lower_abs") || exercise.secondary.includes("lower_abs")) && exercise.steps.length > 0));
    const one = await botExercise(
      new Request("http://localhost/api/bot/exercises/Plank", {
        headers: { authorization: "Bearer test-bot-token-value" },
      }),
      { params: Promise.resolve({ id: "Plank" }) },
    );
    assert.equal(one.status, 200);
    const plank = await one.json();
    assert.equal(plank.name, "Plank");
    assert.ok(plank.images[0].includes("Plank/0.jpg"));
    assert.ok(plank.youtube.includes("youtube.com"));
  });
});
