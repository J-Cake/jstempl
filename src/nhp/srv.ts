import * as http from 'node:http';
import * as urllib from 'node:url';
import * as stream from 'node:stream';
import chalk from 'chalk';
import _ from 'lodash';

import { log } from './log.js';
import { Config } from "./main.js";

export default async function Serve(config: Config): Promise<http.Server> {
    return new http.Server(async function (req: http.IncomingMessage, res: http.ServerResponse) {

        const url = new urllib.URL(req.url, 'http://localhost');
        res.on('finish', () => log.client(`${chalk.yellow(new Date().toISOString())} ${chalk.grey(req.method.toUpperCase().padStart(7, ' '))} ${chalk.yellow(res.statusCode)} ${chalk.blue(url.pathname)}`));

        log.verbose(`Not parsing body.`);

        const request = {
            method: req.method,
            url: url.pathname,
            headers: req.headers,
            cookies: _.fromPairs((req.headers?.cookie ?? '')?.split(';').map(i => i.split('='))),
            query: url.searchParams,
            body: stream.Readable.from(req)
        };

        

    }).listen(config.port, () => log.info(`Listening on port ${config.port}`));
}