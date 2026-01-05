
import { format, parseISO } from "date-fns";

const tripStartDate = "2025-03-02"; // Sunday

// Mimic what I suspect is happening in the prompt generation
const mimicAgentDate = new Date(tripStartDate);
console.log("Raw Date object:", mimicAgentDate.toISOString());
console.log("Agent sees (native toString):", mimicAgentDate.toString());
console.log("Agent sees (toLocaleDateString - en-US):", mimicAgentDate.toLocaleDateString("en-US"));

// What we want
const correctDate = parseISO(tripStartDate);
console.log("Correct Date (parseISO):", correctDate.toString());
console.log("Correct Formatted:", format(correctDate, "PPP")); // e.g., March 2nd, 2025
