import { describe, expect, it } from "vitest";
import { buildCheckpoint, buildProgress, dayStreak, guestTask, nextTaskFor, type AttemptRecord } from "./progress";
import { tasks } from "./tasks";

const at = (iso: string) => new Date(iso);
function attempt(taskId: string, score: number | null, iso = "2026-10-10T10:00:00Z"): AttemptRecord {
  const task = tasks.find((t) => t.id === taskId)!;
  return { taskId, concept: task.conceptFocus, score, createdAt: at(iso) };
}

describe("nextTaskFor", () => {
  it("starts a new user at task 1", () => {
    expect(nextTaskFor([]).id).toBe("role-01");
  });

  it("moves to the first task not yet attempted", () => {
    expect(nextTaskFor([attempt("role-01", 6), attempt("role-02", 7)]).id).toBe("role-03");
  });

  it("does not skip a task when the same task is submitted twice (double-click, two tabs)", () => {
    expect(nextTaskFor([attempt("role-01", 6), attempt("role-01", 8)]).id).toBe("role-02");
  });

  it("fills gaps in order if tasks were done out of order", () => {
    expect(nextTaskFor([attempt("role-02", 6)]).id).toBe("role-01");
  });

  it("keeps the last task available after finishing everything", () => {
    expect(nextTaskFor(tasks.map((t) => attempt(t.id, 7))).id).toBe(tasks[tasks.length - 1].id);
  });
});

describe("guestTask", () => {
  it("follows the guest's free-attempt count", () => {
    expect(guestTask(0).id).toBe("role-01");
    expect(guestTask(1).id).toBe("role-02");
  });
});

describe("dayStreak", () => {
  const now = at("2026-10-10T12:00:00Z");

  it("counts consecutive days ending today", () => {
    const history = [attempt("role-01", 5, "2026-10-08T09:00:00Z"), attempt("role-02", 5, "2026-10-09T09:00:00Z"), attempt("role-03", 5, "2026-10-10T09:00:00Z")];
    expect(dayStreak(history, now, "UTC")).toBe(3);
  });

  it("still counts a streak that ended yesterday", () => {
    expect(dayStreak([attempt("role-01", 5, "2026-10-09T09:00:00Z")], now, "UTC")).toBe(1);
  });

  it("is 0 after a missed day", () => {
    expect(dayStreak([attempt("role-01", 5, "2026-10-07T09:00:00Z")], now, "UTC")).toBe(0);
  });

  it("uses the configured time zone for day boundaries", () => {
    // 20:00 UTC on Oct 9 is already Oct 10 in India (UTC+5:30).
    const history = [attempt("role-01", 5, "2026-10-09T20:00:00Z")];
    expect(dayStreak(history, now, "Asia/Kolkata")).toBe(1);
  });
});

describe("buildProgress", () => {
  it("summarises one user's history", () => {
    const history = [attempt("role-01", 4), attempt("role-01", 8), attempt("role-02", null)];
    expect(buildProgress(history, at("2026-10-10T12:00:00Z"), "UTC")).toEqual({
      completed: 2,
      total: 20,
      averageScore: 6,
      currentConcept: "Role",
      streak: 1,
      scores: [4, 8],
    });
  });
});

describe("buildCheckpoint", () => {
  it("names the strongest and weakest concept from recent scores", () => {
    const history = [attempt("role-01", 9), attempt("task-01", 3), attempt("context-01", 6)];
    const result = buildCheckpoint(history);
    expect(result.conceptMastered).toBe("Role");
    expect(result.recurringWeakness).toBe("Task");
    expect(result.averageScore).toBe(6);
  });
});
