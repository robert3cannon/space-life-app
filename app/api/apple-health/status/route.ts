import { getHealthStatus } from "@/lib/handlers/health";
import { withUser } from "@/lib/api";

export const GET = withUser(getHealthStatus);
export const dynamic = "force-dynamic";
