import { getReminders, postReminder } from "@/lib/handlers/reminders";
import { withUser } from "@/lib/api";

export const GET = withUser(getReminders);
export const POST = withUser(postReminder);

export const dynamic = "force-dynamic";
