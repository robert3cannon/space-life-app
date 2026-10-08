import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countdownCue, tickFrequency, transitionCue } from "../lib/circuit-cues";
import { settingsPatchSchema } from "../lib/validation";

describe("circuit cues", () => {
  it("beeps on the last three seconds and rises in pitch", () => {
    assert.equal(countdownCue(4), null);
    assert.equal(countdownCue(3), "tick");
    assert.equal(countdownCue(2), "tick");
    assert.equal(countdownCue(1), "tick");
    assert.equal(countdownCue(0), null);
    assert.ok(tickFrequency(3) < tickFrequency(2));
    assert.ok(tickFrequency(2) < tickFrequency(1));
  });

  it("chimes when a set finishes and plays a finale at the end", () => {
    assert.equal(transitionCue("work", false, "timer"), "finish");
    assert.equal(transitionCue("work", false, "done"), "finish");
    assert.equal(transitionCue("work", true, "timer"), "complete");
    assert.equal(transitionCue("work", true, "done"), "complete");
    assert.equal(transitionCue("rest", false, "timer"), null);
    assert.equal(transitionCue("rest", true, "timer"), null);
    assert.equal(transitionCue("work", false, "skip"), null);
    assert.equal(transitionCue("work", true, "back"), null);
  });

  it("accepts a circuit audio patch", () => {
    const parsed = settingsPatchSchema.parse({ circuitAudio: { enabled: false, volume: 40 } });
    assert.equal(parsed.circuitAudio?.enabled, false);
    assert.equal(parsed.circuitAudio?.volume, 40);
    assert.throws(() => settingsPatchSchema.parse({ circuitAudio: { enabled: true, volume: 140 } }));
    assert.throws(() => settingsPatchSchema.parse({ circuitAudio: { enabled: true, volume: -1 } }));
  });
});
