import type { Bot } from "grammy";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/auth/phone";

export function registerContact(bot: Bot) {
  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    const fromId = ctx.from?.id;

    // Reject a forwarded/pasted contact card that isn't the sender's own —
    // otherwise someone could log in as a classmate by sending their card.
    if (!contact.user_id || !fromId || contact.user_id !== fromId) {
      await ctx.reply("Будь ласка, поділіться саме своїм контактом (не чужим).");
      return;
    }

    const loginRequest = await prisma.telegramLoginRequest.findFirst({
      where: { telegramUserId: BigInt(fromId), status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!loginRequest) {
      await ctx.reply(
        "Не знайшов запит на вхід. Поверніться на сайт і натисніть «Увійти через Telegram» ще раз.",
      );
      return;
    }

    const phone = normalizePhone(contact.phone_number);
    const user = await prisma.user.findUnique({ where: { phone } });

    if (user) {
      await prisma.$transaction([
        prisma.telegramLoginRequest.update({
          where: { id: loginRequest.id },
          data: { status: "SUCCESS", matchedUserId: user.id },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { telegramUserId: BigInt(fromId), telegramUsername: ctx.from?.username ?? null },
        }),
      ]);
      await ctx.reply(`Успішно! Вхід підтверджено, ${user.firstName}. Поверніться на сайт.`, {
        reply_markup: { remove_keyboard: true },
      });
    } else {
      await prisma.telegramLoginRequest.update({
        where: { id: loginRequest.id },
        data: { status: "FAILED", failureReason: "no_match" },
      });
      await ctx.reply(
        "Цей номер телефону не зареєстрований у групі. Зверніться до старости чи адміністратора, щоб виправити дані.",
        { reply_markup: { remove_keyboard: true } },
      );
    }
  });
}
