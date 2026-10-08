import { postHealthAck } from "@/lib/handlers/health";
import { withHealth } from "@/lib/api";

export const POST = withHealth(postHealthAck);
export const dynamic = "force-dynamic";
