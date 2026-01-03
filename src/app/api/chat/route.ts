import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { neonAuth } from "@neondatabase/auth/next/server";
import {
    createAgentUIStreamResponse,
    createIdGenerator,
    ToolLoopAgent,
    tool,
} from "ai";
import { eq, desc, and, ne, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { workouts, gyms, goals, userPreferences } from "@/db/schema";

export const maxDuration = 60;

export async function POST(req: Request) {
    const { user } = await neonAuth();

    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, currentWorkout } = body ?? {};
        const workoutId = id; // useChat id is our workoutId
        const messages = Array.isArray(body?.messages) ? body.messages : undefined;

        if (!workoutId || !currentWorkout) {
            return new Response("Missing workout context", { status: 400 });
        }

        if (!messages) {
            return new Response("Missing chat messages", { status: 400 });
        }


        const [userPrefsResult, goalsResult, historyResult] = await Promise.all([
            db
                .select()
                .from(userPreferences)
                .where(eq(userPreferences.userId, user.id)),
            db
                .select()
                .from(goals)
                .where(and(eq(goals.userId, user.id), isNull(goals.deletedAt))),
            db
                .select({
                    name: workouts.name,
                    date: workouts.date,
                    description: workouts.description,
                    notes: workouts.notes,
                })
                .from(workouts)
                .where(and(eq(workouts.userId, user.id), ne(workouts.id, workoutId)))
                .orderBy(desc(workouts.date))
                .limit(3),
        ]);

        let gymContext = "No gym selected (Bodyweight only).";

        // Fetch gym from the current workout if available
        if (currentWorkout?.gymId) {
            const [gym] = await db
                .select()
                .from(gyms)
                .where(eq(gyms.id, currentWorkout.gymId));

            if (gym) {
                const equipmentList = Array.isArray(gym.equipment)
                    ? gym.equipment.join(", ")
                    : "Unknown equipment";
                gymContext = `Name: ${gym.name}\nEquipment: ${equipmentList}`;
            }
        }

        const activeGoalIds = (userPrefsResult[0]?.preferences as any)?.activeGoalIds;
        const activeGoals = Array.isArray(activeGoalIds) && activeGoalIds.length > 0
            ? goalsResult.filter(g => activeGoalIds.includes(g.id))
            : goalsResult;

        const goalContext =
            activeGoals.length > 0
                ? activeGoals
                    .map((g) => `- ${g.name}${g.description ? `: ${g.description}` : ""}`)
                    .join("\n")
                : "General fitness";

        const historyContext =
            historyResult.length > 0
                ? historyResult
                    .map((w) => {
                        const notes = w.notes ? `\nNotes: ${w.notes}` : "";
                        return `- ${w.name} (${new Date(w.date).toLocaleDateString()})${notes}`;
                    })
                    .join("\n")
                : "No recent workout history.";

        const systemPrompt = `
You are an expert fitness coach and personal trainer. You are chatting with a user about their specific workout session.

**Context:**
- **Current Gym:**
${gymContext}

- **User Goals:**
${goalContext}

- **Recent Workout History:**
${historyContext}

**Current Workout Context:**
Title: ${currentWorkout.name}
Date: ${new Date(currentWorkout.date).toLocaleDateString()}
Description/Plan:
${currentWorkout.description || "No description provided."}

**Your Goal:**
Help the user with this specific workout. You can:
1. Explain exercises or techniques.
2. Suggest modifications (easier/harder versions) based on available equipment.
3. Offer motivation aligned with their goals.
4. Update the workout plan if they ask for changes (e.g., "Change bench press to pushups").
5. Reference previous workouts if relevant (e.g., "You did heavy squats last time, maybe go lighter today").

**Tone:**
Encouraging, knowledgeable, clear, and concise.
`;

        const agent = new ToolLoopAgent({
            model: "google/gemini-3-flash",
            instructions: systemPrompt,
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingLevel: "medium",
                        includeThoughts: true,
                    },
                } satisfies GoogleGenerativeAIProviderOptions,
            },
            experimental_telemetry: { isEnabled: true },
            tools: {
                updateWorkoutDescription: tool({
                    description:
                        "Update the workout description/plan based on user request. Use this when the user asks to modify the exercises or structure.",
                    inputSchema: z.object({
                        newTitle: z
                            .string()
                            .optional()
                            .describe("The new title of the workout."),
                        newDescription: z
                            .string()
                            .describe(
                                "The new, complete markdown description of the workout.",
                            ),
                    }),
                    execute: async ({
                        newTitle,
                        newDescription,
                    }: {
                        newTitle?: string;
                        newDescription: string;
                    }) => {
                        await db
                            .update(workouts)
                            .set({ name: newTitle, description: newDescription })
                            .where(eq(workouts.id, workoutId));
                        return {
                            output: "Workout updated successfully.",
                        };
                    },
                }),
            },
        });

        return createAgentUIStreamResponse({
            agent,
            uiMessages: messages,
            generateMessageId: createIdGenerator({
                prefix: "msg",
                size: 16,
            }),
            onFinish: async ({ messages: responseMessages }) => {
                try {
                    // Prepend the incoming history (which includes the new user message)
                    // to the new response messages from the agent.
                    const fullHistory = [...messages, ...responseMessages];

                    await db
                        .update(workouts)
                        .set({ chatMessages: fullHistory })
                        .where(eq(workouts.id, workoutId));
                } catch (error) {
                    console.error("Failed to save chat messages:", error);
                }
            },
        });
    } catch (error) {
        console.error("Coach chat error:", error);
        return new Response("Failed to process chat", { status: 500 });
    }
}
