import { neonAuth } from "@neondatabase/auth/next/server";
import { generateText, NoOutputGeneratedError, Output } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const equipmentUpdateSchema = z.object({
  equipment: z
    .array(z.string())
    .describe("The complete updated list of gym equipment"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await neonAuth();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { prompt, currentEquipment } = await req.json();

    const result = await generateText({
      model: "google/gemini-3-flash",
      output: Output.object({
        schema: equipmentUpdateSchema,
      }),
      system:
        "You are a gym equipment specialist. Your task is to update a list of gym equipment based on a user's natural language prompt. You will be given the current equipment list and an instruction of what to add or remove. Return the FULL updated list of equipment. Be concise with equipment names.",
      prompt: `
        Current Equipment: ${currentEquipment.join(", ") || "None"}
        User Instruction: ${prompt}
        
        Provide the full updated list of equipment.
      `,
      experimental_telemetry: { isEnabled: true },
    });

    let output: z.infer<typeof equipmentUpdateSchema>;
    try {
      output = result.output;
    } catch (error) {
      if (NoOutputGeneratedError.isInstance(error) && result.text) {
        output = equipmentUpdateSchema.parse(JSON.parse(result.text));
      } else {
        throw error;
      }
    }

    return Response.json(output);
  } catch (error) {
    console.error("AI equipment update error:", error);
    return new Response("Failed to update equipment with AI", { status: 500 });
  }
}
