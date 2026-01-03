import { neonAuth } from "@neondatabase/auth/next/server";
import { generateText, NoOutputGeneratedError, Output } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const goalDraftSchema = z.object({
  name: z.string().describe("A short, clear goal title"),
  description: z
    .string()
    .describe("One to two sentences describing the training goal"),
});

export async function POST(req: Request) {
  const { user } = await neonAuth();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response("Missing goal prompt", { status: 400 });
    }

    const result = await generateText({
      model: "google/gemini-3-flash",
      output: Output.object({
        schema: goalDraftSchema,
      }),
      system:
        "You are a fitness coach helping a user turn a rough idea into a clear training goal.",
      prompt: `
Create a concise goal from the user's prompt.

User prompt: ${prompt}

Return a short title and a 1-2 sentence description focusing on intent, timeline, and focus areas if mentioned.
      `,
      experimental_telemetry: { isEnabled: true },
    });

    let output: z.infer<typeof goalDraftSchema>;
    try {
      output = result.output;
    } catch (error) {
      if (NoOutputGeneratedError.isInstance(error) && result.text) {
        output = goalDraftSchema.parse(JSON.parse(result.text));
      } else {
        throw error;
      }
    }

    return Response.json(output);
  } catch (error) {
    console.error("AI goal generation error:", error);
    return new Response("Failed to generate goal", { status: 500 });
  }
}
