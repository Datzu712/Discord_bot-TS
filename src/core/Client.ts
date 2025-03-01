import djs from 'discord.js';
import { Logger } from './Logger';
import CategoryManager from '../managers/Categories';
import CommandManager from '../managers/Commands';
import Mongodb from '../database/mongoose';
import EventManager from '../managers/Event';
import { resolve } from 'path';
import Util from '../utils/Util';

import('../structures/Guild');
import('../structures/Message');

class Client extends djs.Client {
    public readonly commands: CommandManager;
    public readonly categories: CategoryManager;
    public readonly logger: Logger;

    private readonly events: EventManager;
    public readonly utils: Util;

    // provisional
    public readonly team = ['444295883182309378'];

    constructor(options: djs.ClientOptions) {
        super(options);

        const debugAllowed = process.env.NODE_ENV === 'development' ? true : false;

        this.logger = new Logger({
            folderPath: resolve(`${__dirname}/../../logs`),
            debugAllowed,
        });

        this.commands = new CommandManager(this);
        this.categories = new CategoryManager(this);
        this.events = new EventManager(this);

        this.utils = new Util(this);
    }

    /**
     * Setup connection with the database, and load all the commands, categories, events and sync it (commands with categories)
     * @returns
     */
    public async setup(): Promise<Client> {
        this.logger.info('Importing commands and categories...', 'client');
        try {
            await Promise.all([
                this.commands.importCommands(resolve(`${__dirname}/../commands`)),
                this.categories.importCategories(resolve(`${__dirname}/../categories`)),
                Mongodb.connect(this.logger),
                this.events.initEvents(resolve(`${__dirname}/../events`)),
            ])
                .then(() => this.categories.syncCommands())
                // It's difficult that the promise be rejected.
                .catch((err) => this.logger.error(err, 'client'));
        } catch (error) {
            this.logger.error(error, 'Client');
        }
        return this;
    }
}

export default Client;
