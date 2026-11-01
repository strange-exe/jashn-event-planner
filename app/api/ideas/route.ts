import { handleIdeas, IdeasRequestSchema } from "@/lib/ai/handlers";
import { jsonRoute } from "@/lib/http";

export const POST = jsonRoute(IdeasRequestSchema, (body) => handleIdeas(body));
