import { Token, OutNestedToken, NestedToken } from "./build";

export function* peekableIterator<T, R>(iterator: Iterable<T>, map: (i: T) => R, filter: (i: R) => boolean): Generator<[current: R, skip: () => R]> {
    const mapped = function* (iterator: Iterable<T>): Iterable<R> {
        for (const i of iterator) {
            const out = map(i);
            if (filter(out))
                yield out;
        }
    }

    const iter = mapped(iterator)[Symbol.iterator]();
    for (let i = iter.next(); !i.done; i = iter.next())
        yield [i.value, () => (i = iter.next()).value];
}

export function collectSync<T, R>(iterator: Iterable<T>, map?: (i: T) => R): R[] {
    const out: R[] = [];
    for (const i of iterator)
        if (map)
            out.push(map(i))
        else
            out.push(i as any);

    return out;
}

export async function collect<T, R>(iterator: AsyncIterable<T>, map?: (i: T) => R): Promise<R[]> {
    const out: R[] = [];

    for await (const i of iterator)
        if (map)
            out.push(map(i))
        else
            out.push(i as any);

    return out;
}

export async function* concatIterator<T>(...args: Array<Iterable<T> | AsyncIterable<T>>): AsyncGenerator<T> {
    for await (const i of args)
        for await (const j of i)
            yield j;
}

export const isTag = (x: Token<any>): x is Token<{ tagName: string, hasBody: boolean, attributes: { [x in string]: string }, children?: (depth?: number) => Promise<string[]> }> => x.type == 'tag';
export const isJSML = (x: Token<any>): x is Token<NestedToken> => x.type == 'jsml';
export const isText = (x: Token<any>): x is Token<string> => x.type == 'text';
export const isExpr = (x: Token<any>): x is Token<string> => x.type == 'expr';