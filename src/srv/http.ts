import http from 'node:http';
import fss, { promises as fs } from 'node:fs';
import { Stream, Readable } from 'node:stream';
import urllib from 'node:url';
import chalk from 'chalk';
import _ from 'lodash';
import markdown from 'markdown-it';

import { Config } from './srv.js';
import Mime from './mime.json'
import * as parsers from './bodyParsers.js';
import * as iter from 'jcake-utils/iter';

const { default: jstempl, compile } = await import('../build.js');

const md = markdown({ linkify: false, typographer: true, html: true, xhtmlOut: true, breaks: true, langPrefix: '', quotes: '“”‘’' });

export async function resolve(path: string, roots: string[]): Promise<string> {
    if (!path)
        throw `Path is empty`;

    const segments = path.split(/[\/\\]/).filter(i => i && i.length > 0 && i !== '.');

    for (const [i, origin] of roots.map(i => [i, i['origin']])) {


        const full = i.split('/').concat(segments);

        if (await fs.stat(full.join('/')).then(stat => !stat.isDirectory()).catch(() => false))
            return full.join('/');
        else if (await fs.stat(full.concat(['/index.nhp']).join('/')).then(stat => !stat.isDirectory()).catch(() => false))
            return full.concat(['/index.nhp']).join('/');
        else if (await fs.stat(full.concat(['/index.jsml']).join('/')).then(stat => !stat.isDirectory()).catch(() => false))
            // ideally, you'd treat .jsml files as static, and .nhp as preprocessed JSML files. But hey, it's still early days
            return full.concat(['/index.jsml']).join('/');
        else if (await fs.stat(full.concat(['/index.md']).join('/')).then(stat => !stat.isDirectory()).catch(() => false))
            return full.concat(['/index.md']).join('/');
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
    else if (format == 'multipart/form-data') {
        console.error('Warning: multipart/form-data potentially yields large amounts of data. It is recommended to handle this yourself');
        return await parsers.multipartForm(stream);
    } else
        return iter.collect(stream).then(res => res.join(''));
}

export default async function serve(config: Config): Promise<http.Server> {
    return http.createServer(async function (req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new urllib.URL(req.url, 'http://localhost');
        res.on('finish', () => console.log(`${chalk.yellow(new Date().toISOString())} ${chalk.green(req.method)} ${chalk.yellow(res.statusCode)} ${chalk.blue(url.pathname)}`));

        const body = config.doNotParseBody ? await iter.collect(req).then(res => res.join('')) : await collect(req, req.headers['content-type'] as string);

        let path = await resolve(url.pathname, config.roots);

        const cookies = _.fromPairs((req.headers?.cookie ?? '')?.split(';').map(i => i.split('=')));
        const vars = {
            method: req.method.toUpperCase(),
            path: url.pathname,
            query: url.searchParams,
            headers: req.headers,
            cookies: cookies,
            body: body ?? null,
        };

        if (path)
            try {
                res.writeHead(200, { 'content-type': Mime[path.trim().split('.').pop().toLowerCase()] ?? 'text/plain', cookies: Object.entries(cookies).map(i => i.join('=')).join(',') });

                if (['jsml', 'nhp'].includes(path?.split('.').pop().toLowerCase()))
                    return Stream.Readable.from(compile(jstempl('\n[]\n' + await fs.readFile(path, 'utf8')), vars)).pipe(res);
                else if (['md'].includes(path?.split('.').pop().toLowerCase()) && config.markdownTemplate)
                    return Stream.Readable.from(compile(jstempl('\n[]\n' + await fs.readFile(config.markdownTemplate, 'utf8'), config.markdownTemplate), { ...vars, md: md.render(await fs.readFile(path, 'utf8')) })).pipe(res);
                else if (path)
                    return fss.createReadStream(path).pipe(res);
                else throw `Invalid path`;

            } catch (err) {
                let _500: string = config?.errors[500] ? await resolve(config?.errors[500], config.roots) : null;
                if (_500)
                    return Stream.Readable.from(compile(jstempl('\n[]\n' + await fs.readFile(_500, 'utf8')), { err, ...vars })).pipe(res.writeHead(500, { 'Content-Type': 'text/plain' }));
                else {
                    res.writeHead(500, { 'Content-type': 'text/plain' });
                    if (err instanceof Error)
                        res.end(`${err.name}: ${err.message}`);
                    else
                        res.end(err.toString());
                }
            }

        else if (config?.errors[404]) {
            const _404 = await resolve(config?.errors[404], [process.cwd()]);

            res.writeHead(404, { 'content-type': Mime[_404.trim().split('.').pop().toLowerCase()] ?? 'text/plain', cookies: Object.entries(cookies).map(i => i.join('=')).join(',') });

            if (_404)
                if (_404.endsWith('.md') && config.markdownTemplate)
                    return Stream.Readable.from(compile(jstempl('\n[]\n' + await fs.readFile(config.markdownTemplate, 'utf8'), config.markdownTemplate), { ...vars, md: md.render(await fs.readFile(_404, 'utf8')) })).pipe(res);
                else if (_404.endsWith('.jsml') || _404.endsWith('.nhp'))
                    return Stream.Readable.from(compile(jstempl('\n[]\n' + await fs.readFile(_404, 'utf8')), {})).pipe(res.writeHead(404, { 'Content-Type': 'text/html' }));
                else
                    return fss.createReadStream(_404).pipe(res.writeHead(404, { 'Content-Type': 'text/html' }));
            else
                return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404: Not found');
        } else
            return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404: Not found');

    }).listen(config.port, () => console.log(chalk.green(`Server listening on port ${chalk.yellow(config.port)}`)));
}