import type { MobileTokenPayload } from "@/lib/mobile-session";
import type { MobilePushTokenInput } from "@/lib/validators/mobile-push";
import { upsertPushToken } from "@/repositories/push-token.repository";

export interface RegisterPushTokenResult {
  readonly ok: true;
}

export const registerMobilePushToken = async (
  auth: MobileTokenPayload,
  input: MobilePushTokenInput,
): Promise<RegisterPushTokenResult> => {
  await upsertPushToken({
    subjectKind: auth.kind,
    subjectId: auth.subjectId,
    restaurantId: auth.restaurantId,
    deviceId: input.deviceId,
    expoPushToken: input.expoPushToken,
    platform: input.platform,
    appVersion: input.appVersion,
    locale: input.locale,
  });
  return { ok: true };
};
