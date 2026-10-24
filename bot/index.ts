import "dotenv/config";
import { Bot } from "grammy";
import { registerStart } from "@/bot/handlers/start";
import { registerContact } from "@/bot/handlers/contact";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.warn(
    "[bot] TELEGRAM_BOT_TOKEN не задано — Telegram-вхід вимкнено, бот в режимі очікування.",
  );
  // Keep the process alive (so `concurrently`/pm2 don't treat this as a
  // crash-loop) without polling Telegram.
  setInterval(() => {}, 1 << 30);
} else {
  const bot = new Bot(token);

  registerStart(bot);
  registerContact(bot);

  bot.catch((err) => {
    console.error("[bot] помилка обробника:", err);
  });

  bot.start({
    onStart: (info) => console.log(`[bot] запущено як @${info.username}`),
  });
}
