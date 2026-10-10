import { fromError } from "@/lib/api";
import { getClosetCutout } from "@/lib/handlers/closet";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await getClosetCutout(req, ctx);
  } catch (err) {
    return fromError(err);
  }
}

export const dynamic = "force-dynamic";
