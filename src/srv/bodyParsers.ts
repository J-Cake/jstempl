import * as stream from 'node:stream';
import _ from 'lodash';
import Iter, * as iter from 'jcake-utils/iter';

export async function json<T>(body: stream.Readable): Promise<T> {
    const data = await iter.collect(body);
    return JSON.parse(data.toString());
}

export async function xUrlEncoded(body: stream.Readable): Promise<Record<string, string>> {
    const data = await iter.collect(body);
    return _.chain(await Iter(data.toString().split('&')).map(i => i.split('=')).collect())
        .fromPairs()
        .mapValues(i => i.replaceAll('+', ' '))
        .value()
}

// GH Copilot did that one. I have no idea if it works or not, but I'ma trust it.
export async function multipartForm(body: stream.Readable): Promise<Record<string, string>> {
    const data = await iter.collect(body);
    const boundary = data.toString().split('\r\n').find(i => i.startsWith('--'))?.substr(2);
    if (!boundary)
        throw new Error('multipart/form-data without boundary');
    
        const parts = await Iter(data.toString().split(`--${boundary}`).slice(1)).map(i => i.split('\r\n\r\n')).collect();
    const result: Record<string, string> = {};
    
    for (const [key, value] of parts) {
        const [name, filename] = key.split('; ');

        if (filename)
            result[name] = filename;
        else
            result[name] = value;
    }
    
    return result;
}