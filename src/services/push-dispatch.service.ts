import { Expo, type ExpoPushMessage } from "expo-server-sdk";

import { prisma } from "@/lib/prisma";
import { listPushTokensForSubject } from "@/repositories/push-token.repository";

const expo = new Expo({});

export interface PushNotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly data: Record<string, string>;
  readonly channelId?: string;
  readonly categoryId?: string;
}

export interface DispatchTargets {
  readonly subjectKind: "manager" | "staff";
  readonly subjectId: string;
}

const build = (
  tokens: readonly string[],
  payload: PushNotificationPayload,
): ExpoPushMessage[] =>
  tokens
    .filter((t) => Expo.isExpoPushToken(t))
    .map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: "default",
      priority: "high",
      channelId: payload.channelId,
      categoryId: payload.categoryId,
      data: payload.data,
    }));

async function sendChunks(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      // Never let a push-service outage break the writer request.
      console.warn("[push-dispatch] chunk send failed", e);
    }
  }
}

/** Send a notification to every device registered for one specific subject. */
export const sendToSubject = async (
  target: DispatchTargets,
  payload: PushNotificationPayload,
): Promise<void> => {
  const rows = await listPushTokensForSubject(
    target.subjectKind,
    target.subjectId,
  );
  await sendChunks(
    build(
      rows.map((r) => r.expoPushToken),
      payload,
    ),
  );
};

/** Send a notification to every device in a restaurant that belongs to any of
 * the given roles. `roles` is a mix of manager roles (from `User.role`) and
 * staff roles (from `Staff.role`). Silent if none match. */
export const sendToRoles = async (
  restaurantId: string,
  roles: readonly string[],
  payload: PushNotificationPayload,
): Promise<void> => {
  if (roles.length === 0) return;
  const [managers, staff] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: roles as ("MANAGER" | "ADMIN" | "SUPER_ADMIN")[] } },
      select: { id: true },
    }),
    prisma.staff.findMany({
      where: {
        restaurantId,
        deletedAt: null,
        role: { in: roles as ("WAITER" | "KITCHEN" | "MANAGEMENT")[] },
      },
      select: { id: true },
    }),
  ]);
  const managerIds = managers.map((m) => m.id);
  const staffIds = staff.map((s) => s.id);
  if (managerIds.length === 0 && staffIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({
    where: {
      OR: [
        { subjectKind: "manager", subjectId: { in: managerIds } },
        { subjectKind: "staff", subjectId: { in: staffIds } },
      ],
      restaurantId,
    },
    select: { expoPushToken: true },
  });
  await sendChunks(
    build(
      tokens.map((t) => t.expoPushToken),
      payload,
    ),
  );
};
