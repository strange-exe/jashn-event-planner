import { handleLocal, LocalRequestSchema } from "@/lib/ai/handlers";
import { jsonRoute } from "@/lib/http";

export const POST = jsonRoute(LocalRequestSchema, (body) => handleLocal(body));
