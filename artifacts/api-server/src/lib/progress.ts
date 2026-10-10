// Pure functions that turn one user's attempt history into progress numbers.
// No database or HTTP here, so every rule is easy to read and unit-test.
import type { Concept, Task } from "./tasks";
import { tasks } from "./tasks";

export type AttemptRecord = {
  taskId: string;
  concept: string;
  score: number | null;
  createdAt: Date;
};

/**
 * The user's next task: the earliest task (by order) they have not attempted yet.
 * Derived from their own history, never from a shared counter, so users are fully
 * independent and a double-submit cannot skip a task.
 * After all tasks are done, the last task stays available for extra practice.
 */
export function nextTaskFor(history: AttemptRecord[]): Task {
  const done = new Set(history.map((attempt) => attempt.taskId));
  return tasks.find((task) => !done.has(task.id)) ?? tasks[tasks.length - 1];
}

/** Guests are not stored; their position comes from the free-attempt cookie. */
export function guestTask(freeAttemptsUsed: number): Task {
  return tasks[Math.min(Math.max(0, freeAttemptsUsed), tasks.length - 1)];
}

function average(values: number[]): number {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;
}

function scoresOf(history: AttemptRecord[]): number[] {
  return history.map((attempt) => attempt.score).filter((score): score is number => score !== null);
}

/** Calendar day (YYYY-MM-DD) of a moment in the given IANA time zone. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * Consecutive days with at least one attempt, ending today or yesterday.
 * (Yesterday still counts so a streak does not reset before you practise today.)
 */
export function dayStreak(history: AttemptRecord[], now: Date, timeZone: string): number {
  const days = new Set(history.map((attempt) => dayKey(attempt.createdAt, timeZone)));
  const oneDay = 24 * 60 * 60 * 1000;
  let cursor = now;
  if (!days.has(dayKey(cursor, timeZone))) {
    cursor = new Date(cursor.getTime() - oneDay);
    if (!days.has(dayKey(cursor, timeZone))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor, timeZone))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - oneDay);
  }
  return streak;
}

export function buildProgress(history: AttemptRecord[], now: Date, timeZone: string) {
  const completed = new Set(history.map((attempt) => attempt.taskId)).size;
  const scores = scoresOf(history);
  return {
    completed,
    total: tasks.length,
    averageScore: average(scores),
    currentConcept: nextTaskFor(history).conceptFocus,
    streak: dayStreak(history, now, timeZone),
    scores,
  };
}

/** A reflection on the user's five most recent scored attempts. */
export function buildCheckpoint(history: AttemptRecord[]) {
  const recent = history.filter((attempt) => attempt.score !== null).slice(-5);
  const next = nextTaskFor(history).conceptFocus;
  const averageScore = average(scoresOf(recent));

  const byConcept = new Map<string, number[]>();
  for (const attempt of recent) {
    byConcept.set(attempt.concept, [...(byConcept.get(attempt.concept) ?? []), attempt.score as number]);
  }
  const ranked = [...byConcept.entries()]
    .map(([concept, values]) => ({ concept, avg: average(values) }))
    .sort((a, b) => b.avg - a.avg);

  return {
    completed: new Set(history.map((attempt) => attempt.taskId)).size,
    averageScore,
    conceptMastered: ranked[0]?.concept ?? next,
    recurringWeakness: ranked[ranked.length - 1]?.concept ?? next,
    headline: averageScore >= 7 ? "You’re building real prompt instincts." : "Your next improvement is getting clearer.",
    nextFocus: next as Concept,
  };
}
