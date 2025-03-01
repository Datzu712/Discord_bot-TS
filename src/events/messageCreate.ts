import createEvent from '../utils/decorators/createEvent';
import BaseEvent from '../structures/BaseEvent';
import { Message } from 'discord.js';
import prefixModel from '../database/models/guild';

@createEvent({
    name: 'messageCreate',
    type: 'djs',
})
export default class MessageCreate extends BaseEvent {
    public execute = async (message: Message) => {
        if (message.author.bot) return;

        if (message.guild && !message.guild.prefix) {
            const guildConfig = await prefixModel.findOne({ _id: message.guild.id }).catch(() => undefined);

            message.guild.prefix = guildConfig?.prefix ?? process.env.DEFAULT_BOT_PREFIX;
        }
        // You can add multiples prefixes
        const prefixes: string[] = [
            message.guild?.prefix ?? process.env.DEFAULT_BOT_PREFIX,
            `<@!${this.client.user?.id}> `, // TODO Fix this (I'm very bad using regex)
            `<@${this.client.user?.id}> `,
        ];
        // If the bot is mentioned, he will reply to it with the guild prefix.
        // eslint-disable-next-line security/detect-non-literal-regexp
        const regMention = new RegExp(`^<@!?${this.client.user?.id}>( |)$`);
        if (message.content.match(regMention)) {
            return void message
                .reply({
                    content: `Hello ${'`'}${message.author.username}${'`'}! my prefix is in this server is ${'`'}${[
                        prefixes[0],
                    ]}${'`'}`,
                    attemptReply: true,
                })
                .catch(() => undefined);
        }
        for (const prefix of prefixes) {
            this.client.commands.handle(message, prefix);
        }
    };
}
