import { withUser } from "@/lib/api";
import { postCircuitComplete } from "@/lib/handlers/circuits";

export const POST = withUser(postCircuitComplete);

export const dynamic = "force-dynamic";
