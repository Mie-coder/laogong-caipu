import { NextRequest } from "next/server";
import { applyFamilyGate } from "@/lib/auth/family-gate";

export async function middleware(request: NextRequest) {
  return applyFamilyGate(request, process.env.FAMILY_SESSION_SECRET);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
