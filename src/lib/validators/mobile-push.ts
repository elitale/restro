import { z } from "zod";

export const mobilePushTokenSchema = z.object({
  expoPushToken: z
    .string()
    .trim()
    .min(4)
    .max(200)
    .refine(
      (v) =>
        v.startsWith("ExponentPushToken[") || v.startsWith("ExpoPushToken["),
      { message: "Not an Expo push token" },
    ),
  deviceId: z.string().trim().min(4).max(120),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().trim().min(1).max(40),
  locale: z.string().trim().min(2).max(20),
});
export type MobilePushTokenInput = z.infer<typeof mobilePushTokenSchema>;
