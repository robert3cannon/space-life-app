import { postMealItem } from "@/lib/handlers/meals";
import { withUser } from "@/lib/api";

export const POST = withUser(postMealItem);

export const dynamic = "force-dynamic";
