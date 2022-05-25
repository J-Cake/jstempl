import { promises as fs } from "fs";

import Serve from "./http.js";

export type Config = {
    roots: string[],
    port: number,
    useChildPrerenderer: boolean,
    doNotParseBody: boolean,
    markdownTemplate: string,
    key?: Buffer,
    cert?: Buffer,
    errors?: {
        404?: string,
        500?: string
    }
};

const args: Partial<Config> = {};

const argv = process.argv.slice(2);
while (argv.length > 0) {
    let arg: string = argv.shift();
    switch (arg) {
        case '--port':
        case '-p':
            args.port = parseInt(argv.shift());
            break;
        case '--use-child-prerenderer':
            args.useChildPrerenderer = true;
            break;
        case '--tls':
            args.key = await fs.readFile(argv.shift());
            args.cert = await fs.readFile(argv.shift());
            break;
        case '--error':
            args.errors = { ...args.errors, ...{ [argv.shift()]: argv.shift() } };
            break;
        case '--root':
        case '-I':
            args.roots = (args.roots ?? []).concat(argv.shift().split(','));
            break;
        case '--no-parse-body':
            args.doNotParseBody = true;
            break;
        case '--markdown':
            args.markdownTemplate = argv.shift();
            break;
            
        default:
            if (args[0] == 'to') {
                argv.shift();
                const origin = argv.shift();
                args.roots = [...args.roots ?? [], new Proxy<String>(arg, {
                    get: (target, prop) => prop == 'origin' ? origin : target[prop]
                }) as string]
            } else args.roots = [...args.roots ?? [], arg];
            
    }
}

Serve({
    roots: (!args.roots || args.roots.length <= 0) ? [process.cwd()] : args.roots,
    port: (!args.port || args.port < 1024) ? (args.key && args.cert) ? 443 : 80 : args.port,
    useChildPrerenderer: args.useChildPrerenderer,
    errors: args.errors,
    doNotParseBody: args.doNotParseBody,
    markdownTemplate: args.markdownTemplate,
    key: args.key,
    cert: args.cert
});