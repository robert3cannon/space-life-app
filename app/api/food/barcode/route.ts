import { withUser } from "@/lib/api";
import { getFoodBarcode } from "@/lib/handlers/food";

export const GET = withUser(getFoodBarcode);

export const dynamic = "force-dynamic";
