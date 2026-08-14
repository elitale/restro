import { withMobileAuthJsonRoute } from "@/lib/mobile-authed-api";
import { mobilePushTokenSchema } from "@/lib/validators/mobile-push";
import { registerMobilePushToken } from "@/services/mobile-push.service";

export const POST = withMobileAuthJsonRoute(
  mobilePushTokenSchema,
  (auth, input) => registerMobilePushToken(auth, input),
);
