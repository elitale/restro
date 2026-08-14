import { withMobileAuthGetRoute } from "@/lib/mobile-authed-api";
import { listMobileTables } from "@/services/mobile-tables.service";

export const GET = withMobileAuthGetRoute((auth) => listMobileTables(auth));
