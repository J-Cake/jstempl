import fs from 'node:fs/promises';
import vm from 'node:vm';
import util from 'node:util';
import markdown from 'markdown-it';
import _ from 'lodash';
import Iter, * as iter from 'jcake-utils/iter';

import parseJSML, { compile, OutNestedToken } from './build.js';
import { accessSync } from 'node:fs';

const md = markdown({ linkify: false, typographer: true, html: true, xhtmlOut: true, breaks: true, langPrefix: '', quotes: '“”‘’' });

export const loaders: Record<string, (text: string) => Promise<string> | string> = {
    'text/html': text => text,
    'text/css': text => text,
    'text/md': text => md.render(text),
    'text/markdown': text => md.render(text),
    'text/html+markdown': text => md.render(text),
    'text/html+md': text => md.render(text),
    'text/javascript': text => text,
    'text/js': text => text,
    async 'text/js+node'(this: vm.Context, text: string) {
        return await Iter(vm.runInContext(`(async function*() {${text}})()`, this))
            .collect()
            .then(res => res.filter(i => i))
            .then(res => res.map(i => typeof i !== 'string' ? util.inspect(i, false, 4, false) : i).join(''));
    }
}

export type ctx = vm.Context;
export const evaluate = (expr: string, ctx: vm.Context) => vm.runInContext(expr, ctx);

export const flattenPath = function (path: string, root: string) {
    const segments = path.replace(/\\/g, '/').replace(/\/+/g, '/').split('/').filter(i => i !== '.');

    while (segments[0] == '..')
        segments.shift();

    while (segments.includes('..'))
        segments.splice(segments.indexOf('..') - 1, 2);

    return ['', ...root.split('/').filter(i => i != '.' && i.length > 0), ...segments].join('/');
};

var asyncGen: (new (...args: string[]) => typeof functions[string]) = (async function* () { }).constructor as any;
export const functions: Record<string, (tag: { tagName: string, hasBody: boolean, attributes: { [x in string]: string }, children?: (depth?: number) => Promise<string[]> }, env: { [key in string]: any }) => AsyncGenerator<string>> = {
    async *include(tag, env) {
        if ('content_type' in tag.attributes && tag.attributes.content_type !== 'text/jsml') {
            const file = await fs.readFile(tag.attributes.file, 'utf8');

            yield loaders[tag.attributes.content_type](file);
        } else {
            if (!('file' in tag.attributes))
                throw `Required attribute 'file' not present on include`;
            const file = await fs.readFile(tag.attributes.file, 'utf8');

            for await (const i of compile(parseJSML('\n' + file.trim()), _.merge({}, tag.attributes, env)))
                yield i;
        }
    },
    async *use(tag, env) {
        if (!('template' in tag.attributes))
            throw `Required attribute 'template' not present on use`;
        // const template = await fs.readFile(flattenPath(tag.attributes.template, tag.attributes.template.startsWith('/') ? process.cwd() : tag.file), 'utf8');
        const template = await fs.readFile(tag.attributes.template, 'utf8');

        let name = 'content';

        if ('as' in tag.attributes && typeof tag.attributes['as'] == 'string')
            name = tag.attributes['as'];

        const variables = _.merge({}, env, tag.hasBody ? { [name]: await tag.children().then(res => res.filter(i => i)) } : {}, tag.attributes);

        for await (const i of compile(parseJSML('\n' + template.trim()), variables))
            yield i;
    },
    async *md(tag) {
        if (!('file' in tag.attributes))
            throw `Required attribute 'file' not present on md`;
        const file = await fs.readFile(tag.attributes.file, 'utf8');

        yield md.render(file)
    },
    async *def(tag) {
        if (!('name' in tag.attributes))
            throw `Required attribute 'name' not present on def`;
            
        if (!(tag.attributes['name'] in functions))
            functions[tag.attributes['name']] = new asyncGen('tag', 'env', await tag.children().then(res => res.filter(i => i).join('')));
    }
}

export const global = {
    methods: {
        get: 'GET',
        post: 'POST',
        put: 'PUT',
        delete: 'DELETE'
    },
    renderMd: text => md.render(text),
};

export function createContext(variables: { [name: string]: any }): vm.Context {
    const glob = {
        ...variables,
        ...global,
        glob: (name: string, value: any) => global[name] = value,
        console,
        process
    };

    return vm.createContext(glob);
}