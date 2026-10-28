import type { Response } from 'express';
const clients = new Set<Response>();
export function addClient(res:Response):void { clients.add(res); res.on('close',()=>clients.delete(res)); }
export function publishEvent(type:string,data:unknown):void { const payload=JSON.stringify({type,data,at:new Date().toISOString()}); for(const client of clients){ try { client.write(`event: ${type}\ndata: ${payload}\n\n`); } catch { clients.delete(client); } } }
export function clientCount():number{return clients.size;}
