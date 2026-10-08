import { withUser } from "@/lib/api";
import { getCircuits } from "@/lib/handlers/circuits";

export const GET = withUser(getCircuits);

export const dynamic = "force-dynamic";
