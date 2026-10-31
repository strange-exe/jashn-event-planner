import { handleIdeas, IdeasRequestSchema } from "@/lib/ai/handlers";
import { jsonRoute } from "@/lib/ai/route";

export const POST = jsonRoute(IdeasRequestSchema, (body) => handleIdeas(body));
