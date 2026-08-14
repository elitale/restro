import { withMobileAuthGetRoute } from "@/lib/mobile-authed-api";
import { listMobileMenu } from "@/services/mobile-menu.service";

export const GET = withMobileAuthGetRoute((auth) => listMobileMenu(auth));
