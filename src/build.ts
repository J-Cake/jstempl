import _ from 'lodash';
import Iter, * as iter from '@j-cake/jcake-utils/iter';
import IterSync, * as iterSync from '@j-cake/jcake-utils/iterSync';

import { loaders, functions, global, createContext, evaluate, ctx } from './loaders.js';
import { isExpr, isJSML, isTag, isText, peekableIterator } from './util.js';

export type Token<T> = {
    type: string;
    body: T;
    length: number;
};
export type NestedToken = Set<Token<any> | NestedToken>;
export type OutNestedToken = Iterable<Token<any> | OutNestedToken>;

export function bracketCount(source: string, open: string, close: string): { body: string, length: number } {
    if (!source.trim().startsWith(open) || !source.includes(open) || !source.includes(close))
        return null

    const start = source.indexOf(open);
    for (let i = start, count = 0; i < source.length; i++)
        if (source[i] === open)
            count++;
        else if (source[i] === close && --count === 0)
            return {
                body: source.slice(start + 1, i),
                length: i + 1
            };

    throw new Error(`Bracket mismatch`);
}

export default function parseJSML(jsml: string, origin?: string): NestedToken {
    const tokens: NestedToken = new Set();

    const matchers: Record<string, (src: string) => { body: any, length: number }> = {
        jsml: function (source) {
            const jsml = bracketCount(source, '{', '}');

            if (jsml)
                return { body: parseJSML(jsml.body, origin), length: jsml.length };
            return null;
        },
        text: source => bracketCount(source, '[', ']'),
        expr: source => bracketCount(source, '(', ')'),
    };

    let index = 0;
    while (index < jsml.trim().length) {

        let token: Token<any> = null;

        const tag_match = /^\n\s*((?<tag>[^\s\{\[\(\)\]\}]+)(?:\s+[^\s\{\[\(\)\]\}]+\s*=\s*(?:(?:'[^']*')|(?:"[^"]*")))*(?:\s*;|(?=\s*[\{\[\(])))/g.exec(jsml.slice(index));
        const attrs = /\s+(?<attr>\S+)\s*=\s*(?<value>(?:'[^']*')|(?:"[^"]*"))/g;

        if (tag_match)
            token = {
                type: 'tag',
                body: {
                    tagName: tag_match[2],
                    hasBody: !tag_match[1].endsWith(';'),
                    attributes: _.chain(IterSync(tag_match[1].matchAll(attrs))
                        .map(i => [i.groups.attr, i.groups.value.slice(1, -1)] as [attr: string, value: string])
                        .collect())
                        .fromPairs()
                        .value()
                },
                length: tag_match[0].length
            }
        else
            for (const [name, matcher] of Object.entries(matchers)) {
                const match = matcher(jsml.slice(index));

                if (match)
                    token = {
                        type: name,
                        body: match.body,
                        length: match.length
                    };
            }

        if (!token) {
            index += Math.max(1, jsml.slice(index).split(/\W/)[0].length); // skip whitespace
            // console.error(`Invalid JSML: ${jsml.slice(index).split(/\w/).shift()}`);
            continue;
        }

        tokens.add(token);
        index += token.length;

    }

    return tokens;
}

export async function renderTextComponent(text: string, ctx: ctx): Promise<string> {
    const [mime, ...body] = text.split(/\s/);

    if (mime.trim() in loaders && body.length > 0)
        return await loaders[mime.trim()].bind(ctx)(text.slice(mime.length));

    return text;
}

export async function* compile(jsml: NestedToken, variables: { [name: string]: any }): AsyncGenerator<string> {
    const glob = _.merge({}, variables, global);
    const ctx = createContext(variables);

    if (!jsml)
        return ``;

    // TODO: Replace with bracket-matched version
    const attr = (attr: string): string => attr.replace(/\$\{([^}]+)\}/g, (_, expr) => evaluate(expr, ctx));
    const evalAttr = (attributes: { [attr in string]: string }) => _.chain(attributes).mapValues((value, key) => ` ${key}="${attr(value)}"`).values().value().join('');

    const fold = function* (jsml: NestedToken | Token<any>): Generator<Token<any> | OutNestedToken> {
        if (jsml instanceof Set)
            for (const [i, skip] of peekableIterator(jsml, i => i, i => !!i))
                if (i instanceof Set)
                    yield* fold(i);
                else if (isTag(i) && i.body.hasBody)
                    yield {
                        type: 'tag',
                        length: i.length,
                        body: {
                            ...i.body,
                            children: (depth: number = 0) => iter.collect(render(fold(skip()), depth))
                        }
                    }
                else yield* fold(i);
        else
            yield jsml;
    }

    const render = async function* (jsml: OutNestedToken, depth: number = 0): AsyncGenerator<string> {
        // const indent = '\n' + new Array(depth).fill('  ').join('');
        const indent = '';

        for (const i of jsml)
            if (i)
                if ('type' in i)
                    if (isTag(i))
                        if (i.body.tagName.startsWith("$") && i.body.tagName.slice(1) in functions)
                            yield* iter.concat([indent], functions[i.body.tagName.slice(1)](i.body, glob));
                        else if (i.body.hasBody && 'children' in i.body)
                            for (const j of iterSync.concat([`${indent}<${i.body.tagName}${evalAttr(i.body.attributes)}>`], await i.body.children(depth + 1), [`${indent}</${i.body.tagName}>`]))
                                yield j;
                        else
                            yield `${indent}<${i.body.tagName}${evalAttr(i.body.attributes)} />`;
                    else if (isText(i))
                        yield `${indent}${await renderTextComponent(i.body, ctx)}`;
                    else if (isExpr(i))
                        yield `${indent}${evaluate(i.body, ctx)}`;
                    else if (isJSML(i))
                        yield* iter.concat([indent], render(fold(i.body), depth + 1));
                    else { }
                else yield* iter.concat([indent], render(i, depth + 1));
    }

    for await (const i of render(fold(jsml)))
        yield i;
}