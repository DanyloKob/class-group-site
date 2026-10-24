import { Keyboard, type Bot } from "grammy";
import { prisma } from "@/lib/db";

export function registerStart(bot: Bot) {
  bot.command("start", async (ctx) => {
    const token = ctx.match?.trim();
    if (!token) {
      await ctx.reply("Привіт! Відкрийте цього бота за посиланням із сайту, щоб увійти.");
      return;
    }

    const loginRequest = await prisma.telegramLoginRequest.findUnique({ where: { token } });
    if (!loginRequest || loginRequest.status !== "PENDING" || loginRequest.expiresAt < new Date()) {
      await ctx.reply("Посилання для входу застаріло. Поверніться на сайт і спробуйте ще раз.");
      return;
    }

    await prisma.telegramLoginRequest.update({
      where: { token },
      data: {
        telegramChatId: BigInt(ctx.chat.id),
        telegramUserId: ctx.from ? BigInt(ctx.from.id) : null,
      },
    });

    await ctx.reply(
      "@l20253bot — офіційний бот авторизації сайту L-23 LIFE (2025-3.pp.ua). Цей сайт можна вважати офіційним як єдиний ресурс групи L-23. Ресурс створений учасником групи для публічного використання усіма членами групи L-23 і запевняє, що на всіх кроках входу та перебування на сайті вам та вашому пристрою нічого не нашкодить, а ваші дані будуть захищені!",
    );

    const keyboard = new Keyboard().requestContact("📱 Поділитися контактом").resized().oneTime();
    await ctx.reply("Щоб увійти, поділіться своїм контактом кнопкою нижче.", {
      reply_markup: keyboard,
    });
  });
}
