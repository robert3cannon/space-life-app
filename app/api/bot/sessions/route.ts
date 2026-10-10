import { withBot } from "@/lib/api";
import { getSessions, postSession } from "@/lib/handlers/routines";

export const GET = withBot(getSessions);
export const POST = withBot(postSession);

export const dynamic = "force-dynamic";
