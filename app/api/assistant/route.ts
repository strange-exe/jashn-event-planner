import { handleAssistant, AssistantRequestSchema } from "@/lib/ai/handlers";
import { jsonRoute } from "@/lib/http";

export const POST = jsonRoute(AssistantRequestSchema, (body) => handleAssistant(body));
