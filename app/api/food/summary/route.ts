import { getFoodSummary } from "@/lib/handlers/food";
import { withUser } from "@/lib/api";

export const GET = withUser(getFoodSummary);

export const dynamic = "force-dynamic";
