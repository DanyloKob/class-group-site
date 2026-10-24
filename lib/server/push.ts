import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export type NotifyCategory = "notifyTasks" | "notifyNews" | "notifyHomework" | "notifyMemories";

type PushPayload = { title: string; body: string; url: string };

/**
 * Fire-and-forget from every call site (never awaited there) - a slow or
 * failing push send must never delay or break the create/delete request
 * that triggered it. Dead subscriptions (410/404 - the browser or OS
 * dropped them) are pruned as they're discovered instead of retried.
 */
export async function sendPushToCategory(
  category: NotifyCategory,
  payload: PushPayload,
  excludeUserId?: string,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: { [category]: true, ...(excludeUserId && { id: { not: excludeUserId } }) },
    },
  });

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] send failed", { subscriptionId: sub.id, error });
        }
      }
    }),
  );
}
