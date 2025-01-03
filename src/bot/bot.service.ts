import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, Reputations } from '@prisma/client';
import TelegramBot = require('node-telegram-bot-api');
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class BotService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.botMessage();
  }

  async botMessage() {
    const bot = new TelegramBot(process.env.BOT_API_TOKEN, { polling: true });
    const thanksWords = [
      'спасибо',
      'спс',
      'благодарю',
      'заработало',
      'сработало',
      '👍',
    ];

    bot.on('new_chat_members', (msg) =>
      bot.sendMessage(
        msg.chat.id,
        `Привет, ${msg.new_chat_members[0].first_name}! Это пробный чат. Админ чата Snooper (@Snooper7)`,
      ),
    );

    bot.on('message', async (msg) => {
      if (msg?.reply_to_message) {
        const user = await bot.getChatMember(
          msg.chat.id,
          msg.reply_to_message.from.id,
        );

        if (user.status === 'left') {
          return;
        }

        if (msg?.sticker) {
          if (msg.sticker.emoji === '👍') {
            this.handleThanksWordReaction(msg, bot);
          }
          return;
        }

        if (
          msg.reply_to_message.from.username === 'skill_blog_bot' ||
          msg.reply_to_message.from.username === msg.from.username
        ) {
          return;
        }

        const thanksWord = msg.text
          .toLowerCase()
          .split(' ')
          .find((word) =>
            thanksWords.includes(
              word.replace(/[&\/\\#,+()$~%.'":*?!<>{}]/g, ''),
            ),
          );

        if (thanksWord) {
          this.handleThanksWordReaction(msg, bot);
        }
      }
    });

    bot.on(
      'left_chat_member',
      async (msg) =>
        await this.removeReputation(String(msg.left_chat_member.id)),
    );
  }

  async removeReputation(telegramid: string) {
    const user = await this.prisma.reputations.findFirst({
      where: { telegramid },
    });

    if (user) {
      await this.prisma.reputations.delete({ where: { id: user.id } });
    }
  }

  async getAllReputations(): Promise<Reputations[]> {
    return await this.prisma.reputations.findMany();
  }

  async sendReputationMessage(
    chatId: number,
    replyUsername: string,
    fromUsername: string,
    bot: TelegramBot,
    telegramId: string,
  ) {
    const reputationData = await this.getReputation(telegramId);

    bot.sendMessage(
      chatId,
      `Поздравляю ${replyUsername}! Участник ${fromUsername} повысил твою репутацию. Твоя репутация ${reputationData.reputation} `,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Статистика чата',
                url: 'https://skill-bot-client-sigma.vercel.app/',
              },
            ],
          ],
        },
      },
    );
  }

  async getReputation(telegramid: string): Promise<Reputations> {
    return await this.prisma.reputations.findFirst({
      where: { telegramid },
    });
  }

  async updateReputation(reputation: number, id: number): Promise<void> {
    await this.prisma.reputations.update({
      where: { id },
      data: { reputation },
    });
  }

  async addNewReputation(data: Prisma.ReputationsCreateInput): Promise<void> {
    await this.prisma.reputations.create({
      data,
    });
  }

  async increaseReputation(
    telegramid: string,
    username: string,
    fullname: string,
    userAvatar: string,
  ) {
    const reputationData = await this.getReputation(telegramid);

    if (reputationData) {
      await this.updateReputation(
        reputationData.reputation + 1,
        reputationData.id,
      );
      return;
    }

    await this.addNewReputation({
      telegramid,
      username,
      userAvatar,
      fullname,
      reputation: 1,
    });
  }

  async handleThanksWordReaction(msg: TelegramBot.Message, bot: TelegramBot) {
    const telegramId = String(msg.reply_to_message.from.id);
    const userAvatar = await this.getUserAvatarUrl(
      msg.reply_to_message.from.id,
      bot,
    );

    await this.increaseReputation(
      telegramId,
      msg.reply_to_message.from?.username
        ? msg.reply_to_message.from?.username
        : '',
      `${msg.reply_to_message.from?.first_name} ${msg.reply_to_message.from?.last_name}`,
      userAvatar,
    );

    await this.sendReputationMessage(
      msg.chat.id,
      `${msg.reply_to_message.from.username ? `(@${msg.reply_to_message.from.username})` : ''}`,
      msg.from.first_name,
      bot,
      telegramId,
    );
  }

  async getUserAvatarUrl(userid: number, bot: TelegramBot) {
    const userProfile = await bot.getUserProfilePhotos(userid);

    if (!userProfile.photos.length) {
      return '';
    }

    const fileId = userProfile.photos[0][0].file_id;
    const file = await bot.getFile(fileId);
    const filePath = file.file_path;

    return `https://api.telegram.org/file/bot${process.env.BOT_API_TOKEN}/${filePath}`;
  }
}
