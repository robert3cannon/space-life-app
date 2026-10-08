import { getFood, postFood } from "@/lib/handlers/food";
import { withUser } from "@/lib/api";

export const GET = withUser(getFood);
export const POST = withUser(postFood);

export const dynamic = "force-dynamic";
