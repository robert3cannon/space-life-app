import { isCronRequest } from "@/lib/auth";
import { error, fromError, json } from "@/lib/api";
import { dispatchReminders } from "@/lib/services/reminders";

async function dispatch(req: Request) {
  try {
    if (!isCronRequest(req)) return error("Unauthorized", 401);
    return json(await dispatchReminders(new Date()));
  } catch (err) {
    return fromError(err);
  }
}

export const GET = dispatch;
export const POST = dispatch;
export const dynamic = "force-dynamic";
