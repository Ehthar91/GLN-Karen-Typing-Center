import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';

const files=['index.html','styles.css','padauk.css','practice.css','games.css','race.css','app.js','practice.js','games.js','race.js'];
const types={html:'text/html; charset=UTF-8',css:'text/css; charset=UTF-8',js:'text/javascript; charset=UTF-8'};
const assets={};
for(const file of files){const ext=file.split('.').pop();assets[`/${file==='index.html'?'':file}`]={body:await readFile(file,'utf8'),type:types[ext]}}
assets['/logo.png']={base64:(await readFile('logo.png')).toString('base64'),type:'image/png'};
const template=await readFile('worker/index.js','utf8');
const output=template.replace('__EMBEDDED_ASSETS__',JSON.stringify(assets));
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',output);
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
