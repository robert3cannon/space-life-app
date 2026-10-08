import { postHealthImport } from "@/lib/handlers/health";
import { withHealth } from "@/lib/api";

export const POST = withHealth(postHealthImport);
export const dynamic = "force-dynamic";
