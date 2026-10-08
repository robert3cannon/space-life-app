import { circuitExercises, resolvePlan } from "../circuits";
import { getZonedParts } from "../time";
import type { CircuitComplete, CircuitSchedule } from "../validation";
import { getSettings } from "./settings";
import { createWorkout, updateWorkout } from "./workouts";

export async function scheduleCircuit(id: string, input: CircuitSchedule) {
  const settings = await getSettings();
  const plan = resolvePlan(id, input.difficulty, input.rounds);
  return createWorkout({
    title: plan.circuit.name,
    date: input.date,
    time: input.time,
    notes: plan.notes,
    exercises: circuitExercises(id, plan.difficulty, plan.rounds, false, settings.equipment),
  });
}

export async function completeCircuit(id: string, input: CircuitComplete, now = new Date()) {
  const settings = await getSettings();
  const plan = resolvePlan(id, input.difficulty, input.rounds);
  const parts = getZonedParts(now);
  const planned = await createWorkout({
    title: plan.circuit.name,
    date: parts.date,
    time: parts.time,
    reminderMinutesBefore: null,
    notes: plan.notes,
    exercises: circuitExercises(id, plan.difficulty, plan.rounds, true, settings.equipment),
  });
  return updateWorkout(planned.id, { status: "done" });
}
