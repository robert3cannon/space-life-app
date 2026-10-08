import { getSleepRoute, postSleep } from "@/lib/handlers/sleep";
import { withUser } from "@/lib/api";

export const GET = withUser(getSleepRoute);
export const POST = withUser(postSleep);
export const dynamic = "force-dynamic";
