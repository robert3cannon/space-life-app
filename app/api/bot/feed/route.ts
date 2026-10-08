import { getFeed, postFeed } from "@/lib/handlers/feed";
import { withBot } from "@/lib/api";

export const GET = withBot(getFeed);
export const POST = withBot(postFeed("bot"));
export const dynamic = "force-dynamic";
