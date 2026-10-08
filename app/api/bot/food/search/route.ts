import { withBot } from "@/lib/api";
import { getFoodSearch } from "@/lib/handlers/food";

export const GET = withBot(getFoodSearch);

export const dynamic = "force-dynamic";
