import { postHealthToken } from "@/lib/handlers/health";
import { withUser } from "@/lib/api";

export const POST = withUser(postHealthToken);
export const dynamic = "force-dynamic";
