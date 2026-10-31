const enc = new TextEncoder();
const ADMIN = 'sys_admin_credentials_v2';
const USERS = 'sys_users_list_v2';
const GROUPS = 'sys_source_groups_v3';
const SESSION_COOKIE = 'sg_session';
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function fromBase64url(s) {return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function mac(secret, data) {
  const k = await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(data))));
}
function secureSecret(env) {if (!env.SESSION_SECRET || env.SESSION_SECRET.length<32) throw Error('请在 Cloudflare Pages 环境变量中配置至少32位 SESSION_SECRET'); return env.SESSION_SECRET;}
async function read(env,key) {const row=await env.DB.prepare('SELECT value FROM user_data WHERE key = ?').bind(key).first();return row?.value ?? null;}
async function write(env,key,value) {return env.DB.prepare('INSERT INTO user_data (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind(key,typeof value==='string'?value:JSON.stringify(value)).run();}
async function digest(str){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(str)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function resolveUserPermissions(env,found){
  let groups=[];try{groups=JSON.parse(await read(env,GROUPS)||'[]');}catch{}
  const list=Array.isArray(groups)?groups:[];
  const group=(found.groupId&&list.find(g=>g&&g.id===found.groupId))||(found.groupName&&list.find(g=>g&&g.name===found.groupName))||list.find(g=>g&&g.isDefault)||list[0]||null;
  const allowedSites=Array.isArray(group?.sites)?group.sites:(Array.isArray(found.allowedSites)?found.allowedSites:['*']);
  return {username:found.username,role:'user',groupId:group?.id||found.groupId||'def',groupName:group?.name||found.groupName||'默认分组',allowedSites};
}
async function sessionCookie(env,user){const credential=user.role==='admin'?JSON.parse(await read(env,ADMIN)||'null'):JSON.parse(await read(env,USERS)||'[]').find(x=>x.username===user.username);const payload=base64url(enc.encode(JSON.stringify({u:user.username,r:user.role,v:credential?.passHash,exp:Date.now()+7*86400000})));return `${SESSION_COOKIE}=${payload}.${await mac(secureSecret(env),payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;}
const clearCookie=`${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
async function getUser(request,env){
 const cookie=request.headers.get('Cookie')||'';const raw=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 if(!raw)return null; const pos=raw.lastIndexOf('.');if(pos<1)return null;
 try {const payload=raw.slice(0,pos);if(await mac(secureSecret(env),payload)!==raw.slice(pos+1))return null;const token=JSON.parse(new TextDecoder().decode(fromBase64url(payload)));if(token.exp<Date.now())return null;
 if(token.r==='admin'){const admin=JSON.parse(await read(env,ADMIN)||'null');return admin?.username===token.u&&admin.passHash===token.v?{username:token.u,role:'admin',allowedSites:['*']}:null;}
 const users=JSON.parse(await read(env,USERS)||'[]');const found=users.find(x=>x.username===token.u);return found&&found.passHash===token.v?await resolveUserPermissions(env,found):null;
 }catch{return null;}
}
function isPersonalKey(key,user){return key===`favs_u_${user.username}`||key===`history_u_${user.username}`||key===`theme_u_${user.username}`;}
function canRead(key,user){if(!user)return false;if(user.role==='admin')return true;if(key===ADMIN||key===USERS)return false;if(key.startsWith('favs_u_')||key.startsWith('history_u_')||key.startsWith('theme_u_'))return isPersonalKey(key,user);return true;}
function canWrite(key,user){if(!user)return false;if(user.role==='admin')return true;return isPersonalKey(key,user)||key==='sys_theme_appearance_v1';}
function validKey(key){return typeof key==='string'&&key.length>0&&key.length<=160&&/^[\w\u4e00-\u9fa5.-]+$/.test(key);}
function sameOrigin(request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin;}
export {ADMIN,USERS,GROUPS,json,read,write,digest,sessionCookie,clearCookie,getUser,resolveUserPermissions,canRead,canWrite,validKey,sameOrigin,secureSecret};
