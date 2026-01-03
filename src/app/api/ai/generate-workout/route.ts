import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { neonAuth } from "@neondatabase/auth/next/server";
import { generateText, NoOutputGeneratedError, Output } from "ai";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { workouts } from "@/db/schema";

export const maxDuration = 60;

const workoutDraftSchema = z.object({
  title: z.string().describe("Short workout title"),
  description: z
    .string()
    .describe("Markdown formatted workout plan with exercises and structure"),
  date: z.iso
    .datetime()
    .optional()
    .describe("ISO-8601 date if the user specifies a day or date"),
});

export async function POST(req: Request) {
  const { user } = await neonAuth();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { equipment, prompt, goals, experienceLevel, gymId, clientDate } =
      await req.json();

    const normalizedGoals = Array.isArray(goals)
      ? goals
      : typeof goals === "string"
        ? [{ name: goals }]
        : [];

    const goalContext =
      normalizedGoals.length > 0
        ? normalizedGoals
          .map((goal: { name?: string; description?: string }) => {
            const title = goal.name || "Goal";
            return goal.description
              ? `- ${title}: ${goal.description}`
              : `- ${title}`;
          })
          .join("\n")
        : "General fitness";

    const extraFocus = typeof prompt === "string" ? prompt.trim() : "";

    const equipmentList =
      equipment && Array.isArray(equipment)
        ? typeof equipment[0] === "string"
          ? equipment
          : equipment.map((e: any) => e.name)
        : [];

    const previousWorkouts = await db
      .select({
        name: workouts.name,
        date: workouts.date,
        description: workouts.description,
        notes: workouts.notes,
      })
      .from(workouts)
      .where(eq(workouts.userId, user.id))
      .orderBy(desc(workouts.date))
      .limit(10);

    const workoutHistoryContext =
      previousWorkouts.length > 0
        ? previousWorkouts
          .map((w) => {
            const notesContext = w.notes
              ? `\n**User Notes:** ${w.notes}`
              : "";
            return `### ${w.name} (${new Date(w.date).toLocaleDateString()})\n${w.description || "No details available."}${notesContext}`;
          })
          .join("\n\n")
        : "No previous workouts found.";

    const fallbackClientDate = (() => {
      if (typeof clientDate !== "string") return new Date();
      const parsed = new Date(clientDate);
      return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    })();

    const result = await generateText({
      model: "google/gemini-3-flash",
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: "high",
            includeThoughts: true,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
      output: Output.object({
        schema: workoutDraftSchema,
      }),
      system:
        "You are an expert fitness coach. Create workouts based strictly on available equipment and previous workout history to ensure progression and variety. Return a JSON object with title, description (Markdown), and an optional date.",
      prompt: `
        Create a complete workout session.
        
        **Context:**
        - Available Equipment: ${equipmentList.join(", ") || "Bodyweight only"}
        - Active Goals:
        ${goalContext}
        - Additional Focus: ${extraFocus || "None"}
        - Experience Level: ${experienceLevel || "Intermediate"}
        - Current Date (Client): ${fallbackClientDate.toISOString()}

        **Critical:**
        - Always prioritize the additional focus provided by the user over the goals, history, and equipment.
           - If the additional focus is ambiguous, infer user intent from goals and history.
           - If the additional focus is specific, make sure to include it in the workout.
           - Ex 1. if they only want to do rowing today dont include other modalities
           - Ex 2. if they want to focus on legs, make sure the workout is leg dominant
           - Ex 3. if they say they only want to do a couple exercises, keep it brief and focused.
        
        
        **Level rules:**
        - Beginner: prioritize technique, simpler movements, more rest, mostly moderate effort; progress via small volume/time increases.
        - Intermediate: add structured progression + moderate complexity; introduce 1-2 hard sessions/week.
        - Advanced: prioritize specificity and fatigue management; use smaller increments, targeted intensity, planned deload/taper, and more autoregulation.
        
        **Last 3 Workouts:**
        ${workoutHistoryContext}

        **Instructions:**
        1. If the user includes a date or day (e.g. "this Wednesday", "next Sunday"), resolve it relative to the Current Date and include it as an ISO-8601 string in the "date" field.
        2. If no date is specified, omit the "date" field.
        3. Start with a warm-up.
        4. List exercises with sets and reps.
        5. Explain *why* this workout fits the equipment and follows the previous sessions. Pay special attention to "User Notes" from previous workouts to adjust volume, intensity, or exercise selection (e.g., if they mentioned pain or that it was too easy).
        6. Keep it concise but motivating.
        7. Format the workout in Markdown for the "description" field.
      `,
      experimental_telemetry: { isEnabled: true },
    });

    let output: z.infer<typeof workoutDraftSchema>;
    try {
      output = result.output;
    } catch (error) {
      if (NoOutputGeneratedError.isInstance(error) && result.text) {
        try {
          output = workoutDraftSchema.parse(JSON.parse(result.text));
        } catch {
          const titleMatch =
            result.text.match(/^#\s+(.+)$/m) ||
            result.text.match(/^#+\s+(.+)$/m);
          output = {
            title: titleMatch ? titleMatch[1] : "Generated Workout",
            description: result.text,
          };
        }
      } else {
        throw error;
      }
    }

    const name = output.title?.trim() || "Generated Workout";
    const description = (output.description?.trim() || "").replace(
      /\\n/g,
      "\n",
    );
    let workoutDate = output.date ? new Date(output.date) : fallbackClientDate;
    if (Number.isNaN(workoutDate.getTime())) {
      workoutDate = fallbackClientDate;
    }

    const [newWorkout] = await db
      .insert(workouts)
      .values({
        userId: user.id,
        gymId,
        name,
        description,
        status: "draft",
        date: workoutDate,
      })
      .returning();

    return Response.json(newWorkout);
  } catch (error) {
    console.error("Workout generation error:", error);
    return new Response("Failed to generate workout", { status: 500 });
  }
}
