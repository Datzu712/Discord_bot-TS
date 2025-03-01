/* eslint-disable @typescript-eslint/no-explicit-any */

import moment from 'moment';
import { inspect } from 'util';
import { existsSync, mkdirSync, WriteStream, createWriteStream } from 'fs';

import * as colors from '../utils/colors';

export enum LoggerLevel {
    info = 1,
    warn = 2,
    error = 3,
    log = 4,
    debug = 5,
}
//
export type logMessage = any;

export interface basicLogger {
    info: (message: logMessage, ...optionalArguments: any[]) => void;
    debug: (message: logMessage, ...optionalArguments: any[]) => void;
    error: (message: logMessage, ...optionalArguments: any[]) => void;
    warn: (message: logMessage, ...optionalArguments: any[]) => void;
    log: (message: logMessage, ...optionalArguments: any[]) => void;
}

export interface LoggerOptions {
    /**
     * The directory to log to.
     */
    folderPath?: string;
    /**
     * Allow the logger to write debug logs.
     * @default false
     */
    debugAllowed?: boolean;
    /**
     * Logger log template.
     * @default '{timestamp} {service} {level} {message}'
     */
    textTemplate?: string;
    /**
     * Testing mode.
     * Enable it and the logger will write the logs in a different folder.
     * @default false
     */
    testing?: boolean;
    disableLogsFiles?: boolean;
}

export interface CreateLogMessageOptions {
    level: LoggerLevel;
    service: string;
    message: logMessage;
    console?: boolean;
}

export type LogExpressions = 'timestamp' | 'level' | 'service' | 'message';

export class Logger implements basicLogger {
    /**
     * Write an `info` level log.
     * @param { logMessage } message - The message to log.
     * @param { string } service - Name of the service.
     */
    public info!: (message: logMessage, service?: string) => void;
    /**
     * Write an `debug` level log.
     * @param { logMessage } message - The message to log.
     * @param { string } service - Name of the service.
     */
    public debug!: (message: logMessage, service?: string) => void;
    /**
     * Write an `error` level log.
     * @param { logMessage } error - The message to log.
     * @param { string } service - Name of the service.
     */
    public error!: (error: logMessage, service?: string) => void;
    /**
     * Write an `warn` level log.
     * @param { logMessage } message - The message to log.
     * @param { string } service - Name of the service.
     */
    public warn!: (message: logMessage, service?: string) => void;
    /**
     * Write an `log` level log.
     * @param { logMessage } message - The message to log.
     * @param { string } service - Name of the service.
     */
    public log!: (message: logMessage, service?: string) => void;
    /**
     * Logger configuration.
     */
    private config: Required<LoggerOptions>;
    /**
     * Regexp colors regexp.
     * To replace the colors in the log template.
     */
    private colorsRegexp = /{c:[a-z]*}/g;
    /**
     * @param { LoggerOptions } options - The logger configuration.
     */
    constructor({
        debugAllowed = false,
        folderPath = '',
        textTemplate = '{timestamp} - {level:5} {service:15} {message}',
        testing = false,
        disableLogsFiles = false,
    }: LoggerOptions) {
        if (!folderPath && !disableLogsFiles) throw new Error('Missing folderPath');
        this.config = { debugAllowed, folderPath, textTemplate, testing, disableLogsFiles };

        for (const log in LoggerLevel) {
            if (!Number(log)) {
                if (typeof this[log as keyof typeof LoggerLevel] === 'function') continue;
                this[log as keyof typeof LoggerLevel] = (message: logMessage, service?: string) => {
                    this.defaultLogWriter(LoggerLevel[log as keyof typeof LoggerLevel], message, service ?? 'unknown');
                };
            }
        }
    }

    /**
     * Get the file log by level.
     * @param { LoggerLevel } level - The level of the log.
     * @returns { WriteStream } WriteStream - The file log.
     */
    private createWritableLogStream(level: LoggerLevel): WriteStream {
        if (!existsSync(this.config.folderPath)) mkdirSync(this.config.folderPath);
        if (this.config.testing) {
            // Path to testing logs folder
            const path = `${this.config.folderPath}/testing`;
            if (!existsSync(path)) mkdirSync(path);
        }
        let fileType: 'log' | 'debug' | 'error' = 'log';
        /*
            We divide each logs in different files (Error, debug and log).
            Error > only errors
            debug > only debug
            log > Rest of the logs (warn, info, log, etc)
        */
        if (level === LoggerLevel.debug || level === LoggerLevel.error) {
            fileType = level === LoggerLevel.debug ? 'debug' : 'error';
        }
        return createWriteStream(
            `${this.config.folderPath}${this.config.testing ? '/testing/' : '/'}${moment()
                .format('YYYY/MM/DD')
                .replaceAll('/', '-')}${
                this.config.testing
                    ? `${fileType == 'error' ? 'error' : ''}.test`
                    : fileType === 'log'
                    ? ''
                    : `-${fileType}`
            }.log`,
            {
                flags: 'a',
            },
        );
    }

    /**
     * Write the log.
     * @param { string } message - The message to log.
     * @param { LoggerLevel } level - The level of the log.
     */
    private write(message: string, level: LoggerLevel): void {
        const file = this.createWritableLogStream(level);
        file.write(`${message}\n`);
        file.close();
    }

    /**
     * Crate text log.
     * @param { LoggerLevel } level - The level of the log.
     * @param { any } message - The message to log.
     * @param { string } service - The service of the log.
     */
    private defaultLogWriter(level: LoggerLevel, message: logMessage, service: string): void {
        if (!this.config.debugAllowed && level === LoggerLevel.debug) return;

        console.log(this.createLogMessage({ level, message: message, service, console: true }));
        if (this.config.disableLogsFiles) return;
        this.write(this.createLogMessage({ level, message: message, service, console: false }), level);
    }

    /**
     * Crate text log.
     * @param { CreateLogMessageOptions } options - The level of the log.
     */
    private createLogMessage(options: CreateLogMessageOptions): string {
        let logMessage = this.config.textTemplate;
        /*
            Match expressions like <string:number> in the message.
        */
        // eslint-disable-next-line security/detect-unsafe-regex
        const matchedExpressions = logMessage.match(/{[a-zA-Z]+([:0-9]?)+}/g) ?? [];
        /*
            Map of valid expressions with their space count. 
            validExpressions (3) {
                'timestamp': 5,           5 Spaces after the date
                'level': 4,          4 Spaces after the level
                'service': NaN,  No Spaces after the serviceName
            }
            The space after word is depending on the length of the word.
         */
        const validExpressions: Map<LogExpressions, number> = new Map();

        for (const expression of matchedExpressions) {
            /**
             * Match the expression and get the word and the space count.
             * EJ:
             * ["{timestamp:1}", 5];
             *       0           1
             *  expression    spaceCount
             */
            // eslint-disable-next-line security/detect-unsafe-regex
            const evaluatedExpression = /{[a-zA-Z]+([:0-9]?)+}/g.exec(expression);
            if (!evaluatedExpression) continue;
            // Set the values in the map.
            validExpressions.set(
                evaluatedExpression.input.replace(/{|}|:|[:0-9]/g, '') as LogExpressions,
                parseInt(evaluatedExpression.input.replace(/\D/g, '')),
            );
        }
        for (const [expression, spaceCount] of validExpressions) {
            let replacedString = '';
            let color = '';

            if (expression === 'timestamp') {
                replacedString = moment().format('YYYY/MM/DD LT');
                color = colors.green;
            } else if (expression === 'level') {
                replacedString = LoggerLevel[options.level]?.toUpperCase();
                color =
                    options.level === LoggerLevel.error
                        ? colors.red
                        : options.level === LoggerLevel.warn
                        ? colors.yellow
                        : options.level === LoggerLevel.debug
                        ? colors.magenta
                        : options.level === LoggerLevel.info
                        ? colors.green
                        : colors.cyan;
            } else if (expression === 'service') {
                // If the service is not defined, use the default service.
                replacedString = options.service;
                color = colors.red;
            } else if (expression === 'message') {
                // If the message is not a string, we try to inspect it (convert into a object string).
                replacedString =
                    typeof options.message === 'string'
                        ? options.message
                        : inspect(options.message, { colors: options.console ?? false, depth: null });

                if (this.colorsRegexp.test(replacedString)) {
                    const matches = replacedString.match(this.colorsRegexp) as RegExpMatchArray;
                    for (const match of matches) {
                        const targetColor = match.replace('{c:', '').replace('}', '');
                        if (!colors[targetColor as keyof typeof colors]) continue;
                        options.console
                            ? (replacedString = replacedString.replace(
                                  match,
                                  colors[targetColor as keyof typeof colors],
                              ))
                            : (replacedString = replacedString.replace(match, ''));
                    }
                }
            }
            /**
             * Calculate the spaces to add to the string.
             * The idea is subtract the spaceCount from the length of the replacedString
             * and if it is 0 or less, it will be 0.
             * EJ:
             *  replacedString = 'log';
             *  spaceCount = 5;
             *
             *  (3 means the length of the replacedString)
             *             5       -          3                 = 2
             *  spaces = spaceCount - replacedString.length; // = 2
             *
             * 2 spaces will be added to the string.
             */
            const spaces = spaceCount - replacedString.length <= 0 ? 0 : spaceCount - replacedString.length;
            logMessage = logMessage.replace(
                spaceCount ? `{${expression}:${spaceCount}}` : `{${expression}}`,
                `${options.console ? `${color}${replacedString}${colors.reset}` : replacedString}${' '.repeat(
                    spaces ?? 0,
                )}`,
            );
        }
        return logMessage;
    }
}
