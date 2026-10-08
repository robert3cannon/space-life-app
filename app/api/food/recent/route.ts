import { getRecentFood } from "@/lib/handlers/food";
import { withUser } from "@/lib/api";

export const GET = withUser(getRecentFood);

export const dynamic = "force-dynamic";
