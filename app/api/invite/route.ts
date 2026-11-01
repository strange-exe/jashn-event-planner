import { handleInvite, InviteRequestSchema } from "@/lib/ai/handlers";
import { jsonRoute } from "@/lib/http";

export const POST = jsonRoute(InviteRequestSchema, (body) => handleInvite(body));
