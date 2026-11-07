import {readdir,readFile} from 'node:fs/promises';
const roots=['public','scripts','tests','docs','.github'];
const files=['.firebaserc','.gitignore','README.md','firebase.json','firestore.indexes.json','firestore.rules','package.json'];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${item.name}`;if(item.isDirectory())await walk(path);else files.push(path);}}
for(const root of roots)await walk(root);
const tree=[];
for(const path of files){const content=await readFile(path,'utf8');if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"refresh_token"\s*:|"access_token"\s*:|"private_key"\s*:/.test(content))throw Error(`Credential marker in ${path}`);tree.push({path,mode:'100644',type:'blob',content});}
process.stdout.write(JSON.stringify(tree));
