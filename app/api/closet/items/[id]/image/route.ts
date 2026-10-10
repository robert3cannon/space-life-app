import { fromError } from "@/lib/api";
import { getClosetImage } from "@/lib/handlers/closet";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await getClosetImage(req, ctx);
  } catch (err) {
    return fromError(err);
  }
}

export const dynamic = "force-dynamic";
