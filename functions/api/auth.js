import {ADMIN,USERS,json,read,write,digest,sessionCookie,clearCookie,getUser,sameOrigin,secureSecret} from './_security.js';
export async function onRequest({request,env}) {
 try {
  if(!env.DB)return json({error:'D1 数据库未绑定'},503);
  secureSecret(env);
  if(request.method==='GET')return json({user:await getUser(request,env),adminExists:!!(await read(env,ADMIN))});
  if(request.method!=='POST')return json({error:'不支持的方法'},405);
  if(!sameOrigin(request))return json({error:'跨站请求已拒绝'},403);
  const body=await request.json();const action=body.action;
  if(action==='logout')return json({success:true},200,{'Set-Cookie':clearCookie});
  if(!['login','register','bootstrap'].includes(action))return json({error:'不支持的操作'},400);
  const username=String(body.username||'').trim(),password=String(body.password||'');
  if(!/^[\w\u4e00-\u9fa5.-]{2,32}$/.test(username)||(action!=='login'&&password.length<8)||!password||password.length>128)return json({error:'账号需2-32位，密码至少8位'},400);
  const passHash=await digest(password);let user;
  const admin=JSON.parse(await read(env,ADMIN)||'null');
  if(action==='bootstrap') {
    if(admin)return json({error:'管理员已存在'},403);
    await write(env,ADMIN,{username,passHash});user={username,role:'admin',allowedSites:['*']};
  } else if(action==='register') {
    if(!admin)return json({error:'请先初始化管理员'},403);
    const users=JSON.parse(await read(env,USERS)||'[]');
    if(username===admin.username||users.some(u=>u.username===username))return json({error:'账号已存在'},409);
    const groups=JSON.parse(await read(env,'sys_source_groups_v3')||'[]');const group=groups.find(g=>g.isDefault)||groups[0]||{id:'def',name:'默认分组'};
    users.push({username,passHash,groupId:group.id,groupName:group.name});await write(env,USERS,users);
    user={username,role:'user',groupId:group.id,groupName:group.name};
  } else {
    if(admin?.username===username&&admin.passHash===passHash)user={username,role:'admin',allowedSites:['*']};
    else {const users=JSON.parse(await read(env,USERS)||'[]');const found=users.find(u=>u.username===username&&u.passHash===passHash);if(found)user={username,role:'user',groupId:found.groupId||'def',groupName:found.groupName||'默认分组'};}
    if(!user)return json({error:'账号或密码错误'},401);
  }
  return json({success:true,user},200,{'Set-Cookie':await sessionCookie(env,user)});
 } catch(e){return json({error:e.message||'认证失败'},500);}
}
