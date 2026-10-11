import { fromError } from "@/lib/api";
import { getClosetBackCutout } from "@/lib/handlers/closet";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await getClosetBackCutout(req, ctx);
  } catch (err) {
    return fromError(err);
  }
}

export const dynamic = "force-dynamic";
