import { withUser } from "@/lib/api";
import { getCircuitById } from "@/lib/handlers/circuits";

export const GET = withUser(getCircuitById);

export const dynamic = "force-dynamic";
