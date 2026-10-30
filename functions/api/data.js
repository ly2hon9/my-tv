import {ADMIN,USERS,json,read,write,getUser,canRead,canWrite,validKey,sameOrigin,secureSecret} from './_security.js';
function allowedProxyUrl(raw) {
 try {const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return false;
 const h=u.hostname.toLowerCase().replace(/\.$/,'');
 if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.workers.dev')||h.endsWith('.pages.dev')||h.endsWith('.cloudflare.com')||h==='metadata.google.internal'||h==='169.254.169.254')return false;
 if(/^\d+(\.\d+){3}$/.test(h)||h.includes(':')||/^0x|^0[0-9]/.test(h)||!h.includes('.'))return false;
 if(u.port&&!['80','443'].includes(u.port))return false;return true;
 }catch{return false;}
}
export async function onRequest({request,env}) {
 try {
  if(!env.DB)return json({error:'D1 数据库未绑定'},503);
  secureSecret(env);
  const user=await getUser(request,env);if(!user)return json({error:'请先登录'},401);
  const url=new URL(request.url);const key=url.searchParams.get('key');const action=url.searchParams.get('action');
  if(action==='proxy') {
    if(request.method!=='GET')return json({error:'不支持的方法'},405);
    const target=url.searchParams.get('proxy_url');if(!target||!allowedProxyUrl(target))return json({error:'代理地址不允许'},400);
    const response=await fetch(target,{redirect:'manual',headers:{'Accept':'application/json, text/plain, */*','User-Agent':'Mozilla/5.0'}});
    if(response.status>=300&&response.status<400)return json({error:'代理禁止重定向'},400);
    const len=Number(response.headers.get('content-length')||0);if(len>3_000_000)return json({error:'响应过大'},413);
    const body=await response.text();if(body.length>3_000_000)return json({error:'响应过大'},413);
    return new Response(body,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(request.method==='GET') {
    if(action==='batch') {
      const rawKeys=url.searchParams.get('keys');if(!rawKeys)return json({error:'缺少 keys 参数'},400);
      const requested=rawKeys.split(',').map(k=>k.trim()).filter(Boolean);
      if(requested.length>48)return json({error:'批量读取的键数量超出限制'},400);
      if(requested.some(k=>!validKey(k)))return json({error:'无效的键'},400);
      const keys=[...new Set(requested)];
      const readableKeys=keys.filter(k=>canRead(k,user));
      if(!readableKeys.length)return json({});
      const placeholders=readableKeys.map(()=>'?').join(',');
      const {results}=await env.DB.prepare(`SELECT key,value FROM user_data WHERE key IN (${placeholders})`).bind(...readableKeys).all();
      return json(Object.fromEntries((results||[]).map(x=>[x.key,x.value])));
    }
    if(key){if(!validKey(key))return json({error:'无效的键'},400);if(!canRead(key,user))return json({error:'无权读取'},403);return json({value:await read(env,key)});}
    if(user.role!=='admin')return json({error:'仅管理员可读取全部配置'},403);
    const {results}=await env.DB.prepare('SELECT key,value FROM user_data').all();return json(Object.fromEntries((results||[]).map(x=>[x.key,x.value])));
  }
  if(!sameOrigin(request))return json({error:'跨站请求已拒绝'},403);
  if(request.method==='POST') {
    const body=await request.json();const k=body.key;if(!validKey(k))return json({error:'无效的键'},400);
    if(!canWrite(k,user))return json({error:'无权修改'},403);
    let value=typeof body.value==='string'?body.value:JSON.stringify(body.value);
    if(value.length>2_000_000)return json({error:'数据超过限制'},413);
    if(k===ADMIN||k===USERS){let parsed;try{parsed=JSON.parse(value)}catch{return json({error:'账号数据格式错误'},400)};
      if(k===ADMIN&&(!parsed?.username||!parsed?.passHash))return json({error:'管理员数据无效'},400);
      if(k===USERS&&!Array.isArray(parsed))return json({error:'用户数据无效'},400);
    }
    await write(env,k,value);return json({success:true});
  }
  if(request.method==='DELETE') {
    if(!validKey(key)||!canWrite(key,user))return json({error:'无权删除'},403);
    await env.DB.prepare('DELETE FROM user_data WHERE key=?').bind(key).run();return json({success:true});
  }
  return json({error:'不支持的方法'},405);
 }catch(e){return json({error:e.message||'服务器错误'},500);}
}
