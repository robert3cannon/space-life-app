import { withUser } from "@/lib/api";
import { postCircuitSchedule } from "@/lib/handlers/circuits";

export const POST = withUser(postCircuitSchedule);

export const dynamic = "force-dynamic";
