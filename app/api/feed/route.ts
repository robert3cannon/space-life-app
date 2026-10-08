import { getFeed, postFeed } from "@/lib/handlers/feed";
import { withUser } from "@/lib/api";

export const GET = withUser(getFeed);
export const POST = withUser(postFeed("user"));
export const dynamic = "force-dynamic";
