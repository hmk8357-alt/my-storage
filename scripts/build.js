import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
const allowed=new Set(['.html','.css','.js','.svg']);
async function inspect(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await inspect(path);else{if(!allowed.has(extname(path)))throw new Error(`Unexpected public asset: ${path}`);const value=await readFile(path,'utf8');if(/-----BEGIN .*PRIVATE KEY-----|"refresh_token"\s*:|"private_key"\s*:/.test(value))throw new Error(`Credential marker: ${path}`);if(extname(path)==='.html' && /(?:src|href)=["']\/(?!\/)/.test(value))throw new Error(`Root-relative URL: ${path}`);}}}
await inspect('public');await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});await writeFile('dist/.nojekyll','');console.log('Built reviewed static public assets in dist/');
