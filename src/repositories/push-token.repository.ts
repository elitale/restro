import type { PushToken } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface UpsertPushTokenData {
  subjectKind: "manager" | "staff";
  subjectId: string;
  restaurantId: string | null;
  deviceId: string;
  expoPushToken: string;
  platform: "ios" | "android";
  appVersion: string;
  locale: string;
}

export const upsertPushToken = (
  data: UpsertPushTokenData,
): Promise<PushToken> =>
  prisma.pushToken.upsert({
    where: {
      subjectKind_subjectId_deviceId: {
        subjectKind: data.subjectKind,
        subjectId: data.subjectId,
        deviceId: data.deviceId,
      },
    },
    create: {
      subjectKind: data.subjectKind,
      subjectId: data.subjectId,
      restaurantId: data.restaurantId,
      deviceId: data.deviceId,
      expoPushToken: data.expoPushToken,
      platform: data.platform,
      appVersion: data.appVersion,
      locale: data.locale,
    },
    update: {
      restaurantId: data.restaurantId,
      expoPushToken: data.expoPushToken,
      platform: data.platform,
      appVersion: data.appVersion,
      locale: data.locale,
    },
  });

export const deletePushTokensForSubject = async (
  subjectKind: "manager" | "staff",
  subjectId: string,
): Promise<number> => {
  const { count } = await prisma.pushToken.deleteMany({
    where: { subjectKind, subjectId },
  });
  return count;
};

export const listPushTokensForSubject = (
  subjectKind: "manager" | "staff",
  subjectId: string,
): Promise<PushToken[]> =>
  prisma.pushToken.findMany({
    where: { subjectKind, subjectId },
  });

export const listPushTokensForRestaurant = (
  restaurantId: string,
): Promise<PushToken[]> =>
  prisma.pushToken.findMany({ where: { restaurantId } });
