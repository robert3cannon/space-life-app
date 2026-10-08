import { testPush } from "@/lib/handlers/push";
import { withUser } from "@/lib/api";

export const POST = withUser(testPush);
export const dynamic = "force-dynamic";
