import util from 'node:util';
import chalk from 'chalk';

import { LogLevel, args } from "./main.js";

export const colour: Record<LogLevel, (tag: string) => string> = {
    [LogLevel.Error]: chalk.red,
    [LogLevel.Client]: chalk.yellow,
    [LogLevel.Info]: chalk.green,
    [LogLevel.Verbose]: chalk.cyan,
    [LogLevel.Debug]: chalk.gray
}

export const print = (tag: LogLevel, ...x: any[]) => args.get().logLevel >= tag && process.stdout.write(x.map(i => typeof i == 'object' ? util.inspect(i, false, null, true) : i).join(' ').split('\n').map(i => `${chalk.grey(`[${colour[tag](LogLevel[tag])}]`)} ${i}`).join('\n') + '\n');
export const log: Record<Lowercase<keyof typeof LogLevel>, (...x: any[]) => void> = {
    error: (...x: any[]) => print(LogLevel.Error, ...x),
    client: (...x: any[]) => print(LogLevel.Client, ...x),
    info: (...x: any[]) => print(LogLevel.Info, ...x),
    verbose: (...x: any[]) => print(LogLevel.Verbose, ...x),
    debug: (...x: any[]) => print(LogLevel.Debug, ...x)
}