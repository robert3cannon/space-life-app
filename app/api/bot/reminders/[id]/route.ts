import { getReminderById, patchReminder, removeReminder } from "@/lib/handlers/reminders";
import { withBot } from "@/lib/api";

export const GET = withBot(getReminderById);
export const PATCH = withBot(patchReminder);
export const DELETE = withBot(removeReminder);

export const dynamic = "force-dynamic";
