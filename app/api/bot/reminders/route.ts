import { getReminders, postReminder } from "@/lib/handlers/reminders";
import { withBot } from "@/lib/api";

export const GET = withBot(getReminders);
export const POST = withBot(postReminder);

export const dynamic = "force-dynamic";
