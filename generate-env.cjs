const fs = require('fs');
const toml = require('toml');

const tomlData = toml.parse(fs.readFileSync('./shopify.app.toml', 'utf-8'));

const envFileContent = `export const environment = ${JSON.stringify(tomlData)};`;

fs.writeFileSync('./environment.ts', envFileContent);