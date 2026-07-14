import assert from "node:assert/strict";
import test from "node:test";
import { classifyGame } from "@/lib/games-sync/game-classifier";

test("scratch-off classification by source type", () => {
  const result = classifyGame({
    name: "Sample Scratch",
    sourceType: "scratch_offs",
  });
  assert.equal(result, "scratch_off");
});

test("draw-game classification by draw fields", () => {
  const result = classifyGame({
    name: "Powerball",
    drawDays: ["Monday", "Wednesday"],
    drawTimes: ["10:12 p.m."],
    salesCutoff: "sales cutoff 9:00 p.m.",
  });
  assert.equal(result, "draw_game");
});

test("unknown classification when no matching fields", () => {
  const result = classifyGame({
    name: "Mystery Game",
  });
  assert.equal(result, "unknown");
});

