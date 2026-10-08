import { getWater, postWater } from "@/lib/handlers/water";
import { withUser } from "@/lib/api";

export const GET = withUser(getWater);
export const POST = withUser(postWater);
export const dynamic = "force-dynamic";
