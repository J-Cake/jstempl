import stream from 'node:stream';

import { Config } from './main.js';

export default async function getFile(path: string): Promise<stream.Readable> {
    return new stream.Readable();
}