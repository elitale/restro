import { withMobileJsonRoute } from "@/lib/mobile-api";
import { mobileVerifyPinSchema } from "@/lib/validators/mobile-auth";
import { verifyMobilePin } from "@/services/mobile-auth.service";

export const POST = withMobileJsonRoute(mobileVerifyPinSchema, verifyMobilePin);
