import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import {
  EvaluatePromptBody,
  EvaluatePromptResponse,
  GetCheckpointBody,
  GetCheckpointResponse,
  GetProgressResponse,
  GetTaskResponse,
  ListTasksResponse,
} from "@workspace/api-zod";

type Concept = "Role" | "Task" | "Context" | "Constraints" | "Output Format";

type Task = {
  id: string;
  order: number;
  title: string;
  brief: string;
  conceptFocus: Concept;
  category: string;
  categoryColor: string;
  tip: string;
};

type Attempt = {
  taskId: string;
  conceptFocus: Concept;
  score: number;
  flaws: string[];
};

const tasks: Task[] = [
  {
    id: "role-01",
    order: 1,
    title: "A clearer study buddy",
    brief: "Write a prompt that asks an AI to explain photosynthesis to a 12-year-old student.",
    conceptFocus: "Role",
    category: "Learning",
    categoryColor: "#2F7E78",
    tip: "Give the AI a helpful point of view or expertise to work from.",
  },
  {
    id: "role-02",
    order: 2,
    title: "The helpful travel planner",
    brief: "Write a prompt that creates a 3-day plan for a family visiting Jaipur for the first time.",
    conceptFocus: "Role",
    category: "Planning",
    categoryColor: "#C76B39",
    tip: "Try assigning a role that matches the kind of help you need.",
  },
  {
    id: "role-03",
    order: 3,
    title: "Feedback from an editor",
    brief: "Write a prompt that asks AI to improve a short school essay without changing the student's ideas.",
    conceptFocus: "Role",
    category: "Writing",
    categoryColor: "#6A5AA5",
    tip: "A role can set the AI's level of expertise and point of view.",
  },
  {
    id: "role-04",
    order: 4,
    title: "A patient coding guide",
    brief: "Write a prompt that asks AI to help a beginner understand why a Python function is not working.",
    conceptFocus: "Role",
    category: "Coding",
    categoryColor: "#B5526A",
    tip: "Name the kind of expert you want, and who they are helping.",
  },
  {
    id: "task-01",
    order: 5,
    title: "Make the ask unmistakable",
    brief: "Write a prompt that turns a paragraph about recycling into three key takeaways.",
    conceptFocus: "Task",
    category: "Summarize",
    categoryColor: "#2F7E78",
    tip: "Start with one clear action word: summarize, compare, plan, rewrite, or explain.",
  },
  {
    id: "task-02",
    order: 6,
    title: "One decision, not five",
    brief: "Write a prompt that compares two school club ideas and recommends the better choice.",
    conceptFocus: "Task",
    category: "Analysis",
    categoryColor: "#C76B39",
    tip: "Say exactly what decision or result you want at the end.",
  },
  {
    id: "task-03",
    order: 7,
    title: "From notes to plan",
    brief: "Write a prompt that turns messy meeting notes into a simple list of next steps.",
    conceptFocus: "Task",
    category: "Organize",
    categoryColor: "#6A5AA5",
    tip: "If the AI could do two different things with your words, the task needs sharpening.",
  },
  {
    id: "task-04",
    order: 8,
    title: "Explain the tricky bit",
    brief: "Write a prompt that explains how a rainbow forms using an everyday example.",
    conceptFocus: "Task",
    category: "Learning",
    categoryColor: "#B5526A",
    tip: "Describe what should be explained, not just the topic name.",
  },
  {
    id: "context-01",
    order: 9,
    title: "A summary with a reader",
    brief: "Write a prompt that summarizes a school policy for parents who have never read it before.",
    conceptFocus: "Context",
    category: "Summarize",
    categoryColor: "#2F7E78",
    tip: "Tell the AI who will use the answer and what they already know.",
  },
  {
    id: "context-02",
    order: 10,
    title: "The real audience",
    brief: "Write a prompt for a short announcement about a school science fair for busy families.",
    conceptFocus: "Context",
    category: "Writing",
    categoryColor: "#C76B39",
    tip: "A few details about the situation can change the quality of the answer.",
  },
  {
    id: "context-03",
    order: 11,
    title: "Debug with the clues",
    brief: "Write a prompt that helps find the bug in a small Python program when you can share the error message.",
    conceptFocus: "Context",
    category: "Coding",
    categoryColor: "#6A5AA5",
    tip: "Include the background, inputs, examples, or evidence the AI needs.",
  },
  {
    id: "context-04",
    order: 12,
    title: "A plan that fits real life",
    brief: "Write a prompt that makes a revision plan for a student with one week before exams and one hour each evening.",
    conceptFocus: "Context",
    category: "Planning",
    categoryColor: "#B5526A",
    tip: "Constraints are useful later; context explains the situation first.",
  },
  {
    id: "constraints-01",
    order: 13,
    title: "Keep it short",
    brief: "Write a prompt that explains a difficult word to a child in no more than 30 words.",
    conceptFocus: "Constraints",
    category: "Learning",
    categoryColor: "#2F7E78",
    tip: "Limits help the AI choose what to leave out.",
  },
  {
    id: "constraints-02",
    order: 14,
    title: "What not to say",
    brief: "Write a prompt for a friendly event reminder that avoids jargon and does not sound like an advertisement.",
    conceptFocus: "Constraints",
    category: "Writing",
    categoryColor: "#C76B39",
    tip: "Say what to avoid as well as what you want.",
  },
  {
    id: "constraints-03",
    order: 15,
    title: "Handle the edge case",
    brief: "Write a prompt that creates a simple budget plan while asking the AI to flag missing or uncertain costs.",
    conceptFocus: "Constraints",
    category: "Analysis",
    categoryColor: "#6A5AA5",
    tip: "Think about what could go wrong or be missing.",
  },
  {
    id: "constraints-04",
    order: 16,
    title: "The fair comparison",
    brief: "Write a prompt that compares two options using the same three criteria and does not invent facts.",
    conceptFocus: "Constraints",
    category: "Analysis",
    categoryColor: "#B5526A",
    tip: "Specific rules make the answer more reliable and easier to check.",
  },
  {
    id: "format-01",
    order: 17,
    title: "Three useful bullets",
    brief: "Write a prompt that summarizes a long article into three bullet points for a school newsletter.",
    conceptFocus: "Output Format",
    category: "Summarize",
    categoryColor: "#2F7E78",
    tip: "Name the shape, length, tone, and reader of the final answer.",
  },
  {
    id: "format-02",
    order: 18,
    title: "A table that teaches",
    brief: "Write a prompt that compares renewable and non-renewable energy in a simple table for a class presentation.",
    conceptFocus: "Output Format",
    category: "Learning",
    categoryColor: "#C76B39",
    tip: "The format is part of the answer, not an afterthought.",
  },
  {
    id: "format-03",
    order: 19,
    title: "The right tone",
    brief: "Write a prompt that drafts a warm, clear email to a teacher asking for help with a missed assignment.",
    conceptFocus: "Output Format",
    category: "Writing",
    categoryColor: "#6A5AA5",
    tip: "Add the tone and audience so the response sounds like it belongs.",
  },
  {
    id: "format-04",
    order: 20,
    title: "A complete creative brief",
    brief: "Write a prompt that generates five ideas for a community clean-up poster with a headline and a call to action.",
    conceptFocus: "Output Format",
    category: "Creative",
    categoryColor: "#B5526A",
    tip: "Describe what each output should contain, not only how many you want.",
  },
];

const attempts: Attempt[] = [];

function isSignedIn(req: Request): boolean {
  return Boolean(getAuth(req)?.userId);
}

function requireAuth(req: Request, res: any, next: any): void {
  if (!isSignedIn(req)) {
    res.status(401).json({ error: "Please sign in to continue your practice." });
    return;
  }
  next();
}

function currentTask(): Task {
  return tasks[Math.min(attempts.length, tasks.length - 1)];
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function evaluate(task: Task, userPrompt: string): {
  score: number;
  flaws: string[];
  improvedRewrite: string;
  encouragement: string;
} {
  const prompt = userPrompt.trim();
  const lower = prompt.toLowerCase();
  const checks = {
    role: hasAny(lower, ["you are", "act as", "as a", "expert", "teacher", "editor", "coach"]),
    task: hasAny(lower, ["explain", "summarize", "write", "create", "compare", "plan", "turn", "draft", "list", "improve"]),
    context: hasAny(lower, ["for ", "because", "student", "teacher", "parent", "audience", "situation", "given", "background"]),
    constraints: hasAny(lower, ["under ", "less than", "no more", "avoid", "don't", "do not", "must", "only", "at least"]),
    format: hasAny(lower, ["bullet", "list", "table", "paragraph", "steps", "email", "headline", "tone", "words"]),
  };

  const focusMatches: Record<Concept, boolean> = {
    Role: checks.role,
    Task: checks.task,
    Context: checks.context,
    Constraints: checks.constraints,
    "Output Format": checks.format,
  };
  const focusMatch = focusMatches[task.conceptFocus];
  const coverage = Object.values(checks).filter(Boolean).length;
  const lengthBonus = prompt.length >= 90 ? 1 : prompt.length >= 45 ? 0.5 : 0;
  const score = Math.max(1, Math.min(10, Math.round(3 + coverage + lengthBonus + (focusMatch ? 1 : 0))));

  const flaws: string[] = [];
  if (!focusMatch) {
    const focusFlaws: Record<Concept, string> = {
      Role: "Role: your prompt does not give the AI a point of view or expertise level to work from.",
      Task: "Task: the requested action is still broad, so the AI may not know what a finished answer should do.",
      Context: "Context: it is missing who the answer is for or what situation the AI should keep in mind.",
      Constraints: "Constraints: there is no clear limit or rule for what the response should include or avoid.",
      "Output Format": "Output Format: the prompt does not describe the shape, tone, or length of the answer.",
    };
    flaws.push(focusFlaws[task.conceptFocus]);
  }
  if (!checks.task) flaws.push("Task: add a specific action such as explain, compare, summarize, or draft.");
  if (!checks.context) flaws.push("Context: add one detail about the audience or situation so the answer can fit.");
  if (!checks.constraints && flaws.length < 3) flaws.push("Constraints: add a useful boundary, such as a word count or something to avoid.");
  if (!checks.format && flaws.length < 3) flaws.push("Output Format: name the structure you want, such as bullets, steps, or a table.");
  if (flaws.length === 0) flaws.push("This is a solid attempt. Try making one detail even more precise for a stronger result.");

  const improvedRewrite = `You are a helpful ${task.category.toLowerCase()} coach. ${task.brief} The audience is a beginner who needs a practical answer. Include the important context from the task, keep the response focused, and use a clear structure with specific, easy-to-follow language.`;
  const encouragement =
    score >= 8
      ? "Strong work — your prompt gives the AI enough direction to do useful work on the first try."
      : score >= 6
        ? "You’re on the right track. One or two more details will make your request much easier to follow."
        : "Good first rep. Prompting is a skill built through small improvements, and you have a clear next step.";

  return { score, flaws: flaws.slice(0, 3), improvedRewrite, encouragement };
}

const arenaRouter: IRouter = Router();

arenaRouter.get("/task", (_req, res): void => {
  res.json(GetTaskResponse.parse(currentTask()));
});

arenaRouter.get("/tasks", (_req, res): void => {
  res.json(ListTasksResponse.parse(tasks));
});

arenaRouter.post("/evaluate", (req, res): void => {
  const parsed = EvaluatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please write at least 10 characters before submitting." });
    return;
  }

  const signedIn = isSignedIn(req);
  if (!signedIn && req.cookies?.prompt_arena_free_used === "1") {
    res.status(401).json({ error: "Your free rep is complete. Sign in to keep practicing." });
    return;
  }

  const task = tasks.find((item) => item.id === parsed.data.taskId) ?? currentTask();
  const feedback = evaluate(task, parsed.data.userPrompt);
  attempts.push({ taskId: task.id, conceptFocus: task.conceptFocus, score: feedback.score, flaws: feedback.flaws });
  if (!signedIn) {
    res.cookie("prompt_arena_free_used", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  }
  res.json(
    EvaluatePromptResponse.parse({
      score: feedback.score,
      conceptFocus: task.conceptFocus,
      flaws: feedback.flaws,
      improvedRewrite: feedback.improvedRewrite,
      encouragement: feedback.encouragement,
    }),
  );
});

arenaRouter.get("/progress", requireAuth, (_req, res): void => {
  const completed = attempts.length;
  const scores = attempts.map((attempt) => attempt.score);
  const averageScore = scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : 0;
  const currentConcept = currentTask().conceptFocus;
  res.json(GetProgressResponse.parse({
    completed,
    total: tasks.length,
    averageScore,
    currentConcept,
    streak: completed ? Math.min(completed, 7) : 0,
    scores,
  }));
});

arenaRouter.post("/checkpoint", requireAuth, (req, res): void => {
  const parsed = GetCheckpointBody.safeParse(req.body ?? {});
  const completed = Math.min(Number(parsed.success ? parsed.data.completed ?? attempts.length : attempts.length), attempts.length);
  const recent = attempts.slice(Math.max(0, completed - 5), completed);
  const averageScore = recent.length
    ? Number((recent.reduce((sum, attempt) => sum + attempt.score, 0) / recent.length).toFixed(1))
    : 0;
  const focusCounts = recent.reduce<Record<string, number>>((counts, attempt) => {
    counts[attempt.conceptFocus] = (counts[attempt.conceptFocus] ?? 0) + 1;
    return counts;
  }, {});
  const weakestConcept = recent.length
    ? recent.reduce((weakest, attempt) => (attempt.score < weakest.score ? attempt : weakest), recent[0]).conceptFocus
    : currentTask().conceptFocus;
  const conceptMastered = Object.entries(focusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? currentTask().conceptFocus;
  res.json(GetCheckpointResponse.parse({
    completed,
    averageScore,
    conceptMastered,
    recurringWeakness: weakestConcept,
    headline: averageScore >= 7 ? "You’re building real prompt instincts." : "Five reps in — your next improvement is getting clearer.",
    nextFocus: tasks.find((task) => task.order > completed)?.conceptFocus ?? "Output Format",
  }));
});

export default arenaRouter;