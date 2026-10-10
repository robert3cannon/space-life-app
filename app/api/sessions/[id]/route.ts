import { withUser } from "@/lib/api";
import { getSessionById } from "@/lib/handlers/routines";

export const GET = withUser(getSessionById);

export const dynamic = "force-dynamic";
