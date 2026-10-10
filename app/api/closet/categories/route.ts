import { withUser } from "@/lib/api";
import { getCategories, postCategory } from "@/lib/handlers/closet";

export const GET = withUser(getCategories);
export const POST = withUser(postCategory);
export const dynamic = "force-dynamic";
