import { clearSession } from "@/lib/auth";

export async function POST() {
  return clearSession();
}

export const dynamic = "force-dynamic";
