import { postNotify } from "@/lib/handlers/notify";
import { withBot } from "@/lib/api";

export const POST = withBot(postNotify);
export const dynamic = "force-dynamic";
