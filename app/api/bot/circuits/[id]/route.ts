import { withBot } from "@/lib/api";
import { getCircuitById } from "@/lib/handlers/circuits";

export const GET = withBot(getCircuitById);

export const dynamic = "force-dynamic";
