import fs from 'node:fs/promises';
import vm from 'node:vm';
import util from 'node:util';
import markdown from 'markdown-it';
import _ from 'lodash';
import Iter, * as iter from 'jcake-utils/iter';

import parseJSML, { compile, OutNestedToken } from './build';

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
        return await Iter(vm.runInContext(`(async function*() {${text}})()`, this)).collect().then(res => res.map(i => typeof i !== 'string' ? util.inspect(i, false, 4, false) : i).join('<br/>'));
    }
}

export type ctx = vm.Context;
export const evaluate = (expr: string, ctx: vm.Context) => vm.runInContext(expr, ctx);

export const functions: Record<string, (tag: { tagName: string, hasBody: boolean, attributes: { [x in string]: string }, children?: OutNestedToken }, env: { [key in string]: any }) => AsyncGenerator<string>> = {
    async *include(tag, env) {
        if (!('file' in tag.attributes))
            throw `Required attribute 'file' not present on include`;
        const file = await fs.readFile(tag.attributes.file, 'utf8');

        for await (const i of compile(parseJSML('\n' + file.trim()), _.merge({}, tag.attributes, env)))
            yield i;
    },
    async *render(tag) {
        return [];
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