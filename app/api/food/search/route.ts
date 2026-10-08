import { withUser } from "@/lib/api";
import { getFoodSearch } from "@/lib/handlers/food";

export const GET = withUser(getFoodSearch);

export const dynamic = "force-dynamic";
