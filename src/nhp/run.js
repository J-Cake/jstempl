import main from './main.js';

await main(process.argv.slice(2))
    .catch(err => console.error(err) ?? 255)
    .then(code => (console.log('Stopping Server:', code), process.exit(code)))