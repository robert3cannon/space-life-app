import { withBot } from "@/lib/api";
import { getSessionById } from "@/lib/handlers/routines";

export const GET = withBot(getSessionById);

export const dynamic = "force-dynamic";
