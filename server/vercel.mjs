import {createCloudServer} from './cloud.mjs';
// Export the HTTP server so Vercel handles both HTTP and WebSocket upgrades.
const backend=createCloudServer();
export default backend.http;
