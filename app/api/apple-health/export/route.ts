import { getHealthExport } from "@/lib/handlers/health";
import { withHealth } from "@/lib/api";

export const GET = withHealth(getHealthExport);
export const dynamic = "force-dynamic";
