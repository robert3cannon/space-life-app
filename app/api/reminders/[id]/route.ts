import { getReminderById, patchReminder, removeReminder } from "@/lib/handlers/reminders";
import { withUser } from "@/lib/api";

export const GET = withUser(getReminderById);
export const PATCH = withUser(patchReminder);
export const DELETE = withUser(removeReminder);

export const dynamic = "force-dynamic";
