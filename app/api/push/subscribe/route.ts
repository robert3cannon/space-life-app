import { subscribePush, unsubscribePush } from "@/lib/handlers/push";
import { withUser } from "@/lib/api";

export const POST = withUser(subscribePush);
export const DELETE = withUser(unsubscribePush);
export const dynamic = "force-dynamic";
