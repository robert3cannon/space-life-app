import { withBot } from "@/lib/api";
import { getFoodBarcode } from "@/lib/handlers/food";

export const GET = withBot(getFoodBarcode);

export const dynamic = "force-dynamic";
