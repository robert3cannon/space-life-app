import { postMealItem } from "@/lib/handlers/meals";
import { withBot } from "@/lib/api";

export const POST = withBot(postMealItem);

export const dynamic = "force-dynamic";
