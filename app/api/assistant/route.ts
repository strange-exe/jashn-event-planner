import { handleAssistant, AssistantRequestSchema } from "@/lib/ai/handlers";
import { jsonRoute } from "@/lib/ai/route";

export const POST = jsonRoute(AssistantRequestSchema, (body) => handleAssistant(body));
