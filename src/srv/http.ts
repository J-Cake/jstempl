import http from 'node:http';
import fss, { promises as fs } from 'node:fs';
import { Stream, Readable } from 'node:stream';
import urllib from 'node:url';
import chalk from 'chalk';
import _ from 'lodash';

import { Config } from './srv';
import Mime from './mime.json'
import * as parsers from './bodyParsers';
import * as iter from 'jcake-utils/iter';

const { default: jstempl, compile } = await import('../build');

export async function resolve(path: string, roots: string[]): Promise<string> {
    if (!path)
        return null;

    const segments = path.split(/[\/\\]/).filter(i => i && i.length > 0 && i !== '.');

    for (const i of roots) {
        const full = i.split('/').concat(segments);

        if (await fs.stat(full.join('/')).then(stat => !stat.isDirectory()).catch(() => false))
            return full.join('/');
        else if (await fs.stat(full.concat(['/index.nhp']).join('/')).then(stat => !stat.isDirectory()).catch(() => false))
            return full.concat(['/index.nhp']).join('/');
        else if (await fs.stat(full.concat(['/index.jsml']).join('/')).then(stat => !stat.isDirectory()).catch(() => false))
            // ideally, you'd treat .jsml files as static, and .nhp as preprocessed JSML files. But hey, it's still early days
            return full.concat(['/index.jsml']).join('/');

    }

    return null;
}

async function collect<T>(stream: Readable, format: 'text/json'): Promise<T>;
async function collect(stream: Readable, format: 'application/x-www-form-urlencoded'): Promise<Record<string, string>>;
async function collect(stream: Readable, format: 'multipart/form-data'): Promise<Record<string, string>>;
async function collect(stream: Readable, format?: string): Promise<any>;
async function collect(stream: Readable, format?: string): Promise<any> {
    if (format == 'text/json')
        return await parsers.json(stream);
    else if (format == 'application/x-www-form-urlencoded')
        return await parsers.xUrlEncoded(stream);
    else if (format == 'multipart/form-data')
        return await parsers.multipartForm(stream);
    else
        return iter.collect(stream).then(res => res.join(''));
}

export default async function serve(config: Config): Promise<http.Server> {
    return http.createServer(async function (req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new urllib.URL(req.url, 'http://localhost');
        res.on('finish', () => console.log(`${chalk.yellow(new Date().toISOString())} ${chalk.green(req.method)} ${chalk.yellow(res.statusCode)} ${chalk.blue(url.pathname)}`));

        // todo: collect body
        const body = config.doNotParseBody ? await iter.collect(req).then(res => res.join('')) : await collect(req, req.headers['content-type'] as string);

        let path = await resolve(url.pathname, config.roots);

        const cookies = _.fromPairs(req.headers.cookie.split(';').map(i => i.split('=')));

        if (!path)
            path = await resolve(config.errors?.[res.statusCode = 404], config.roots);

        if (path)
            try {
                res.writeHead(200, { 'content-type': Mime[path.trim().split('.').pop().toLowerCase()] ?? 'text/plain', cookies: Object.entries(cookies).map(i => i.join('=')).join(',') });

                if (['jsml', 'nhp'].includes(path?.split('.').pop().toLowerCase()))
                    Stream.Readable.from(compile(jstempl(await fs.readFile(path, 'utf8')), {
                        method: req.method.toUpperCase(),
                        path: url.pathname,
                        query: url.searchParams,
                        headers: req.headers,
                        cookies: cookies,
                        body: body ?? null,
                    })).pipe(res);
                else if (path)
                    fss.createReadStream(path).pipe(res);
                else
                    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404: Not found');
            } catch (err) {
                res.writeHead(500, { 'Content-type': 'text/plain' });
                if (err instanceof Error)
                    res.end(`${err.name}: ${err.message}`);
                else
                    res.end(err.toString());
            }
        else
            res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404: Not found');

    }).listen(config.port, () => console.log(chalk.green(`Server listening on port ${chalk.yellow(config.port)}`)));
}