import { promises as fs } from "node:fs";
import StateManager from "@j-cake/jcake-utils/state";
import * as iterSync from '@j-cake/jcake-utils/iterSync';
import * as Formats from '@j-cake/jcake-utils/args';

import pkg from '../../package.json';
import Serve from "./srv.js";
import { log } from "./log.js";
import chalk from "chalk";

export enum LogLevel {
    Error = 0,
    Client,
    Info,
    Verbose,
    Debug
}

export type Config = {
    roots: string[],
    static: string[],
    port: number,
    useChildPrerenderer: boolean,
    doNotParseBody: boolean,
    markdownTemplate: string,
    key?: Buffer,
    cert?: Buffer,
    logLevel: LogLevel,
    errors?: {
        404?: string,
        500?: string
    }
};

export function help(): 0 {
    return 0;
}

export function version(): 0 {
    log.info(`${chalk.whiteBright(pkg.name)} - ${chalk.grey(pkg.version)}`);

    return 0;
}

export const args = new StateManager<Config>({ static: [], roots: [], logLevel: LogLevel.Info });
export default async function main(argv: string[]): Promise<number> {
    const levels = ['Error', 'Warn', 'Info', 'Verbose', 'Debug'] as const;
    const logLevel = Formats.oneOf(levels, false);

    for (const { current: i, skip } of iterSync.peekable(argv))
        if (i == '--port' || i == '-p')
            args.setState({ port: parseInt(skip()) });
        else if (i == '--static' || i == '-S')
            args.setState(prev => ({ static: [...prev.static, ...skip().split(',')] }))
        else if (i == '--use-child-prerenderer' || i == '-C')
            args.setState({ useChildPrerenderer: true });
        else if (i == '--no-parse-body' || i == '-B')
            args.setState({ doNotParseBody: true });
        else if (i == '--markdown')
            args.setState({ markdownTemplate: skip() });
        else if (i == '--log-level')
            args.setState({ logLevel: LogLevel[logLevel(skip())] });
        else if (i == '--tls')
            args.setState({
                key: await fs.readFile(skip()),
                cert: await fs.readFile(skip())
            });
        else if (i == '--error')
            await args.setStateAsync(async prev => ({
                errors: {
                    ...prev.errors,
                    [skip()]: await fs.readFile(skip())       
                }
            }));
        else if (i == '--help' || i == '-h')
            return help();
        else if (i == '-v' || i == '--version')
            return version();
        else // TODO: Implement root aliases
            args.setState(prev => ({ roots: [...prev.roots, i] }));

    return await new Promise<number>(async ok => Serve(args.get()).then(srv => srv.once('close', () => ok(0))));
}