import { getPushStatus } from "@/lib/handlers/push";
import { withUser } from "@/lib/api";

export const GET = withUser(getPushStatus);
export const dynamic = "force-dynamic";
