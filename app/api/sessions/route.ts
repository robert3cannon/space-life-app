import { withUser } from "@/lib/api";
import { getSessions, postSession } from "@/lib/handlers/routines";

export const GET = withUser(getSessions);
export const POST = withUser(postSession);

export const dynamic = "force-dynamic";
