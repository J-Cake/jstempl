import _ from 'lodash';
import parseJSML, { compile } from './jsml/build.js';
import { collect } from './jsml/util.js';

(async function () {
    const input = '\n' + Buffer.concat(await collect(process.stdin)).toString('utf-8').trim();
    const vars = _.chain(process.argv.slice(2))
        .reduce((acc, i, a) => a % 2 != 0 ? [...acc.slice(0, -1), acc.at(-1).concat(i)] : [...acc, [i]], [])
        .filter(i => i && i[0] && i[1])
        .fromPairs()
        .value();

    try {
        for await (const i of compile(parseJSML(input), vars))
            process.stdout.write(i);

    } catch (err) {
        console.error(err);
    }
})();