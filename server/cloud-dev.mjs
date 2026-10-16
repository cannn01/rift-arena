import {createCloudServer} from './cloud.mjs';
const backend=createCloudServer();
await backend.ready();
backend.http.listen(Number(process.env.PORT||3003),'0.0.0.0',()=>console.log('Rift cloud preview ready on port '+backend.http.address().port));
