import type { ErrorRequestHandler } from 'express';
export const errorHandler:ErrorRequestHandler=(err,req,res,_next)=>{ const status=Number(err?.status)||500; if(status>=500) console.error('[api-error]',req.method,req.path,err?.message??'unknown error'); res.status(status).json({error:status>=500?'Internal server error':String(err.message||'Request failed')}); };
