import { WriteStream, createWriteStream } from 'fs';
import { existsSync, mkdir } from 'fs-extra';
import moment from 'moment';
// import { LikeFunction } from '../typings/global';
import { reset, cyan, red, yellow, green, magenta } from '../util/colors';

export enum LoggerLevel {
    info = 1,
    warn = 2,
    error = 3,
    log = 4,
    debug = 5,
}

export interface textTemplateOptions {
    error?: Error;
    message?: string;
    level: LoggerLevel;
    serviceName?: string;
}

export default class Logger {
    private dateFormat: Intl.DateTimeFormat;
    private textTemplate = `[<dateNow>] [<serviceName>] [<level>] <message>`;

    public notifier!: LikeFunction<void, Error>;

    constructor(public folderLogsPath: string, public debugAllowed = false) {
        this.dateFormat = Intl.DateTimeFormat('en', {
            dateStyle: 'short',
            timeStyle: 'medium',
            hour12: false,
        });

        console.debug = this.debug.bind(this);
    }

    /**
     * Write a 'log' level log.
     * @param { string } message - The message to log.
     * @param { LoggerLevel } level - The level of the log.
     */
    private write(message: string, level: LoggerLevel): void {
        const file = this.getFileLog(level);
        file.write(`${message}\n`);
        file.close();
    }

    /**
     * Write an `error` level log.
     * @param { Error } Error - The Error to log.
     */
    public error(error: Error, service?: string): void {
        if (this.notifier) this.notifier(error);

        const textLog = this.resolveTextLog({ error, level: LoggerLevel.error, serviceName: service });

        console.log(`${red}${textLog}`, reset);
        this.write(textLog, LoggerLevel.error);
    }

    /**
     * Write a `warn` level log.
     * @param { string } message - The message to log.
     */
    public warn(message: string, serviceName?: string): void {
        const textLog = this.resolveTextLog({ message, level: LoggerLevel.warn, serviceName });

        console.log(`${yellow}${textLog}`, reset);
        this.write(textLog, LoggerLevel.warn);
    }

    /**
     * Write an `info` level log.
     * @param { string } message - The message to log.
     */
    public info(message: string, serviceName?: string): void {
        const textLog = this.resolveTextLog({ message, level: LoggerLevel.info, serviceName });

        console.log(`${cyan}${textLog}`, reset);
        this.write(textLog, LoggerLevel.info);
    }

    /**
     * Get the file log by level.
     * @param { LoggerLevel } LoggerLevel - The level of the log.
     * @returns { WriteStream } WriteStream - The file log.
     */
    private getFileLog(level: LoggerLevel): WriteStream {
        if (!existsSync(this.folderLogsPath)) mkdir(this.folderLogsPath);

        let fileType: 'log' | 'debug' | 'error' = 'log';

        // For have a better logs, we divide it in different files (Error, debug and log).
        // Error > only errors
        // debug > only debug
        // log > Rest of the logs (warn, info, log, etc)
        if (level === LoggerLevel.debug || level === LoggerLevel.error) {
            fileType = level === LoggerLevel.debug ? 'debug' : 'error';
        }

        return createWriteStream(
            `${this.folderLogsPath}/${moment().format('l').replaceAll('/', '-')}${
                fileType === 'log' ? '' : `-${fileType}`
            }.log`,
            {
                flags: 'a',
            },
        );
    }

    /**
     * Write a `log` level log.
     * @param { string } message - Message to write.
     * @param { string } serviceName - Name of the service.
     */
    public log(message: string, serviceName?: string): void {
        const textLog = this.resolveTextLog({ message, level: LoggerLevel.log, serviceName });

        console.log(`${green}${textLog}`, reset);
        this.write(textLog, LoggerLevel.log);
    }

    /**
     * Create a text log.
     * @param { textTemplateOptions } options - Text template config options.
     * @returns { string } string - The converted text log.
     */
    private resolveTextLog(log: textTemplateOptions): string {
        return this.textTemplate
            .replaceAll('<dateNow>', this.dateFormat.format(Date.now()))
            .replaceAll('<serviceName>', log.serviceName ?? 'unknown')
            .replaceAll('<level>', LoggerLevel[log.level])
            .replaceAll('<message>', `${log.error?.stack ?? log.message}`);
    }

    /**
     * Set the actual text template to use it in the logs.
     * Valid values: `[<dateNow>] [<serviceName>] [<level>] <message>`
     * @param { string } string - The new text template.
     */
    public setTextTemplate(textTemplate: string): void {
        this.textTemplate = textTemplate;
    }

    public debug(message: string, serviceName?: string): void {
        if (this.debugAllowed) {
            const textLog = this.resolveTextLog({ message, level: LoggerLevel.debug, serviceName });

            console.log(`${magenta}${textLog}`, reset);
            this.write(textLog, LoggerLevel.debug);
        }
    }

    /**
     * Set the notifier function to use it in the error logs.
     * @param { notifier } notifier - The notifier function.
     * @returns void
     */
    public setNotifier = (notifier: LikeFunction<void, Error>) => (this.notifier = notifier);
}
