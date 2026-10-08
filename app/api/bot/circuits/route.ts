import { withBot } from "@/lib/api";
import { getCircuits } from "@/lib/handlers/circuits";

export const GET = withBot(getCircuits);

export const dynamic = "force-dynamic";
