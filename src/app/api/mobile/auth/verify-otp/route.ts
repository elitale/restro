import { withMobileJsonRoute } from "@/lib/mobile-api";
import { mobileVerifyOtpSchema } from "@/lib/validators/mobile-auth";
import { verifyMobileOtp } from "@/services/mobile-auth.service";

export const POST = withMobileJsonRoute(mobileVerifyOtpSchema, verifyMobileOtp);
