import fs from 'node:fs/promises';
import vm from 'node:vm';
import markdown from 'markdown-it';
import _ from 'lodash';

import parseJSML, { compile, OutNestedToken } from './build';

const md = markdown({ linkify: true });

export const loaders: Record<string, (text: string) => string> = {
    'text/html': text => text,
    'text/css': text => text,
    'text/md': text => md.render(text),
    'text/markdown': text => md.render(text),
    'text/html+markdown': text => md.render(text),
    'text/html+md': text => md.render(text),
    'text/javascript': text => text,
    'text/js': text => text,
    'text/js+node': text => evaluate(text, {})
}

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
    renderMd: text => md.render(text),
};

export function evaluate(text: string, variables: { [name: string]: any }): string {
    const out: string[] = [];

    // const glob = _.merge({ echo: text => void out.push(text) }, variables, global);
    const glob = {
        ...variables,
        ...global,
        echo: text => void out.push(text),
        glob: (name: string, value: any) => global[name] = value,
    }
    const context = vm.createContext(glob);

    const script = new vm.Script(text);
    out.push(script.runInContext(context));

    return out.filter(i => i).join('\n').trim();
}