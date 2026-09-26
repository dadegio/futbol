import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { getWebPushPublicKey, sendWebPush } from "./web-push";

type NotificationInput = {
  userId: string;
  leagueId?: string | null;
  matchId?: string | null;
  kind: string;
  title: string;
  body: string;
  href?: string | null;
  dedupeKey: string;
};

function defaultPreferences() {
  return {
    matchReminders: true,
    pushEnabled: true,
  };
}

export async function getNotificationCenter(userId: string, leagueId?: string | null) {
  const where = leagueId
    ? { userId, OR: [{ leagueId }, { leagueId: null }] }
    : { userId };

  const [notifications, unreadCount, preference] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        leagueId: true,
        matchId: true,
        kind: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
    prisma.notificationPreference.findUnique({
      where: { userId },
      select: { matchReminders: true, pushEnabled: true },
    }),
  ]);

  return {
    notifications,
    unreadCount,
    preferences: preference ?? defaultPreferences(),
    vapidPublicKey: getWebPushPublicKey(),
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function markAllNotificationsRead(userId: string, leagueId?: string | null) {
  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(leagueId ? { OR: [{ leagueId }, { leagueId: null }] } : {}),
    },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function updateNotificationPreferences(
  userId: string,
  input: { matchReminders?: unknown; pushEnabled?: unknown }
) {
  const update: { matchReminders?: boolean; pushEnabled?: boolean } = {};
  if (typeof input.matchReminders === "boolean") update.matchReminders = input.matchReminders;
  if (typeof input.pushEnabled === "boolean") update.pushEnabled = input.pushEnabled;
  if (Object.keys(update).length === 0) {
    throw new AppError(400, "Preferenze non valide", "INVALID_NOTIFICATION_PREFERENCES");
  }

  const current = await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      matchReminders: update.matchReminders ?? true,
      pushEnabled: update.pushEnabled ?? true,
    },
    update,
    select: { matchReminders: true, pushEnabled: true },
  });
  return { ok: true, preferences: current };
}

function cleanSubscriptionInput(input: {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
}) {
  const endpoint = String(input.endpoint ?? "").trim();
  const p256dh = String(input.keys?.p256dh ?? "").trim();
  const auth = String(input.keys?.auth ?? "").trim();
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AppError(400, "Endpoint push non valido", "INVALID_PUSH_ENDPOINT");
  }
  if (url.protocol !== "https:" || !p256dh || !auth) {
    throw new AppError(400, "Sottoscrizione push non valida", "INVALID_PUSH_SUBSCRIPTION");
  }
  return { endpoint: url.toString(), p256dh, auth };
}

export async function savePushSubscription(
  userId: string,
  input: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null }
) {
  const subscription = cleanSubscriptionInput(input);
  await prisma.$transaction([
    prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { userId, ...subscription },
      update: { userId, p256dh: subscription.p256dh, auth: subscription.auth },
    }),
    prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, pushEnabled: true },
      update: { pushEnabled: true },
    }),
  ]);
  return { ok: true };
}

export async function removePushSubscription(userId: string, endpointValue: unknown) {
  const endpoint = String(endpointValue ?? "").trim();
  if (!endpoint) throw new AppError(400, "Endpoint push mancante", "PUSH_ENDPOINT_REQUIRED");

  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  const remaining = await prisma.pushSubscription.count({ where: { userId } });
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, pushEnabled: remaining > 0 },
    update: { pushEnabled: remaining > 0 },
  });
  return { ok: true };
}

export async function createNotification(input: NotificationInput) {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: input.userId },
    select: { matchReminders: true, pushEnabled: true },
  });
  const preferences = preference ?? defaultPreferences();
  if (input.kind === "MATCH_WEEKLY_REMINDER" && !preferences.matchReminders) return null;

  const inserted = await prisma.notification.createMany({
    data: [input],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return null;

  const notification = await prisma.notification.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });
  if (!notification || !preferences.pushEnabled || !getWebPushPublicKey()) return notification;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: input.userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      const result = await sendWebPush(subscription, {
        title: notification.title,
        body: notification.body,
        href: notification.href,
        tag: notification.dedupeKey,
      });
      if (result.status === 404 || result.status === 410) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint },
        });
      }
    })
  );

  return notification;
}
