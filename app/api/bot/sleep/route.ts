import { getSleepRoute, postSleep } from "@/lib/handlers/sleep";
import { withBot } from "@/lib/api";

export const GET = withBot(getSleepRoute);
export const POST = withBot(postSleep);
export const dynamic = "force-dynamic";
