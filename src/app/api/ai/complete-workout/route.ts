import { neonAuth } from "@neondatabase/auth/next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workouts, gyms } from "@/db/schema";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
    const { user } = await neonAuth();

    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const { workoutId, notes } = await req.json();

        if (!workoutId) {
            return new Response("Missing workoutId", { status: 400 });
        }

        // 1. Fetch the workout
        const [workout] = await db
            .select()
            .from(workouts)
            .where(and(eq(workouts.id, workoutId), eq(workouts.userId, user.id)));

        if (!workout) {
            return new Response("Workout not found", { status: 404 });
        }

        // 2. Fetch the gym to know context if available
        let gymName = "Unknown Gym";
        if (workout.gymId) {
            const [gym] = await db
                .select()
                .from(gyms)
                .where(eq(gyms.id, workout.gymId));
            if (gym) gymName = gym.name;
        }

        // 3. Generate AI Summary
        const prompt = `
      You are an expert fitness coach. 
      The user just completed a workout at ${gymName}.
      
      Original Workout Name: ${workout.name}
      Original Description: ${workout.description || "N/A"}
      
      User's Completion Notes: "${notes || "No specific notes provided."}"
      
      Please generate a concise summary of the completed workout, incorporating the user's notes. 
      If the user noted changes (e.g. "did squats instead of leg press"), reflect that in the summary.
      The summary should be formatted as a clean, list-based description suitable for a workout log history.
      Do not use markdown headers like # or ##. Just text and bullet points.
    `;

        const { text: finalNotes } = await generateText({
            model: "google/gemini-3-flash",
            prompt: prompt,
        });

        // 4. Update the workout
        await db
            .update(workouts)
            .set({
                status: "completed",
                notes: finalNotes,
                date: new Date(),
            })
            .where(eq(workouts.id, workoutId));

        return new Response(JSON.stringify({ success: true, summary: finalNotes }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Failed to complete workout with AI:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
