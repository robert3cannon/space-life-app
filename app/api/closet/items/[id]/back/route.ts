import { fromError, withUser } from "@/lib/api";
import { getClosetBack, postClosetBack } from "@/lib/handlers/closet";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await getClosetBack(req, ctx);
  } catch (err) {
    return fromError(err);
  }
}

export const POST = withUser(postClosetBack);
export const dynamic = "force-dynamic";
