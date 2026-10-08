import { safeEqual, startSession } from "@/lib/auth";
import { fromError, json } from "@/lib/api";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const expected = process.env.APP_PASSWORD;
    if (!expected || !safeEqual(body.password, expected)) {
      return json({ error: "Wrong passcode" }, 401);
    }
    return await startSession();
  } catch (err) {
    return fromError(err);
  }
}

export const dynamic = "force-dynamic";
