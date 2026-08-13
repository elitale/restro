import { withMobileJsonRoute } from "@/lib/mobile-api";
import { mobileRequestOtpSchema } from "@/lib/validators/mobile-auth";
import { requestMobileOtp } from "@/services/mobile-auth.service";

export const POST = withMobileJsonRoute(mobileRequestOtpSchema, ({ phone }) =>
  requestMobileOtp(phone),
);
