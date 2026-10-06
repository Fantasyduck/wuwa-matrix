/* Personal cloud plans. Game credentials never enter this module's network payloads. */
const CLOUD={client:null,user:null,plans:[],page:0,size:20,busy:false,error:'',notice:'',verify:null,sendAt:0,epoch:0,loadedId:null};
function cleanCloudPayload(raw){
  if(!raw||raw.mode!=='singularity'||!MX_STAGES[String(raw.stageId)]||!Array.isArray(raw.teams)||raw.teams.length<1||raw.teams.length>64||!Array.isArray(raw.waves)||raw.waves.length<1||raw.waves.length>200)throw Error('方案格式或矩阵期次不受支持');
  const num=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const text=(s,max=160)=>String(s??'').slice(0,max);
  const result={mode:'singularity',stageId:text(raw.stageId,32),fatigueLimit:num(raw.fatigueLimit,1,99),specialId:text(raw.specialId,16),
    teams:raw.teams.map((t,i)=>({id:text(t.id,64),name:text(t.name,80),members:[0,1,2].map(n=>CH_INDEX[String(t.members?.[n])]?String(t.members[n]):null),roleConfigs:cleanRoleConfigs(t.roleConfigs),buff:text(t.buff,64),waves:num(t.waves,0,200),score:num(t.score,0,1000000000),on:t.on!==false})),
    waves:raw.waves.map(w=>({id:text(w.id,64),round:num(w.round,1,200),enemies:(Array.isArray(w.enemies)?w.enemies:[]).slice(0,10).map(e=>({name:text(e.name),icon:/^(assets\/|https:\/\/)/.test(e.icon||'')?text(e.icon,1024):'',res:(Array.isArray(e.res)?e.res:[]).filter(el=>Object.hasOwn(EL_COLOR,el)),chest:!!e.chest,wid:text(e.wid,32)}))}))};
  if(new TextEncoder().encode(JSON.stringify(result)).length>400000)throw Error('方案过大，请减少队伍或角色快照');
  return result;
}
async function cloudClient(){
  if(!CLOUD.client){
    CLOUD.client=(async()=>{
      const {default:cloudbase}=await import('../assets/vendor/cloudbase-3.4.8.js?bundle=1');
      const cfg=window.MATRIX_CLOUD_CONFIG;if(!cfg?.env||!cfg.publishableKey)throw Error('云方案服务尚未配置');
      const app=cloudbase.init({env:cfg.env,region:cfg.region,accessKey:cfg.publishableKey});
      const auth=typeof app.auth==='function'?app.auth():app.auth;
      const db=typeof app.rdb==='function'?app.rdb():app.rdb;
      auth.onAuthStateChange((event,session)=>{
        const user=session?.user||null;
        if(user?.id!==CLOUD.user?.id){CLOUD.epoch++;CLOUD.user=user;CLOUD.plans=[];CLOUD.page=0;CLOUD.loadedId=null;CLOUD.verify=null;CLOUD.draftTitle='';}
        if(!document.querySelector('#profileDlg').hidden)renderProfile();
      });
      return {auth,db};
    })().catch(e=>{CLOUD.client=null;throw e;});
  }
  return CLOUD.client;
}
function cloudResult(result){if(result.error)throw Error(result.error.message||'云服务请求失败');return result.data;}
async function cloudRefresh(){
  const epoch=CLOUD.epoch;const {auth,db}=await cloudClient();const user=cloudResult(await auth.getUser())?.user;
  if(epoch!==CLOUD.epoch)return;
  if(!user?.id)throw Error('请先登录云方案账号');
  CLOUD.user=user;
  const data=cloudResult(await db.from('matrix_plans').select('id,title,revision,created_at,updated_at').eq('owner_id',user.id).order('updated_at',{ascending:false}).order('id',{ascending:false}).range(CLOUD.page*CLOUD.size,(CLOUD.page+1)*CLOUD.size-1));
  if(epoch!==CLOUD.epoch||CLOUD.user?.id!==user.id)return;
  CLOUD.plans=data||[];
}
async function cloudAction(action){
  if(CLOUD.busy)return;CLOUD.busy=true;CLOUD.error='';CLOUD.notice='';renderProfile();
  try{await action();}catch(e){CLOUD.error=String(e.message||'操作失败，请重试').slice(0,240);}finally{CLOUD.busy=false;renderProfile();}
}
async function cloudSendCode(email){
  if(Date.now()-CLOUD.sendAt<60000)throw Error('请等待一分钟后再发送验证码');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('请输入有效邮箱');
  const {auth}=await cloudClient();const data=cloudResult(await auth.signInWithOtp({email,shouldCreateUser:true}));
  if(typeof data?.verifyOtp!=='function')throw Error('验证码服务未返回验证入口');
  CLOUD.verify=data.verifyOtp;CLOUD.email=email;CLOUD.sendAt=Date.now();CLOUD.notice='验证码已发送，请查看邮箱';
}
async function cloudSave(title,id=null){
  title=title.trim();if(!title||title.length>80)throw Error('方案名称应为 1–80 个字');
  const payload=cleanCloudPayload(exportPayload());const {auth,db}=await cloudClient();const user=cloudResult(await auth.getUser())?.user;
  if(!user?.id)throw Error('请先登录');const epoch=CLOUD.epoch;
  if(id){
    const row=CLOUD.plans.find(p=>p.id===id);if(!row)throw Error('方案已变化，请刷新');
    const updated=cloudResult(await db.from('matrix_plans').update({title,payload}).eq('id',id).eq('owner_id',user.id).eq('revision',row.revision).select('id'));
    if(!updated?.length)throw Error('方案已在其他设备修改，请刷新后再保存');
  }else cloudResult(await db.from('matrix_plans').insert({title,payload,owner_id:user.id}).select('id'));
  if(epoch!==CLOUD.epoch||CLOUD.user?.id!==user.id)return;
  CLOUD.page=0;await cloudRefresh();CLOUD.notice='已保存到云端';
}
async function cloudLoad(id){
  const {db}=await cloudClient();const uid=CLOUD.user?.id,epoch=CLOUD.epoch;if(!uid)throw Error('请先登录');
  const rows=cloudResult(await db.from('matrix_plans').select('id,title,payload').eq('id',id).eq('owner_id',uid));
  if(epoch!==CLOUD.epoch||uid!==CLOUD.user?.id)return;
  const row=rows?.[0];if(!row)throw Error('方案不存在或无访问权限');
  const payload=cleanCloudPayload(row.payload);
  if(!confirm('载入「'+row.title+'」将替换当前编排。当前编排会先备份到本机，是否继续？'))return;
  const backup=JSON.stringify(exportPayload()),previous=localStorage.getItem(LS_KEY);
  localStorage.setItem('wuwa-cloud-plan-backup-v1',backup);
  try{localStorage.setItem(LS_KEY,JSON.stringify(payload));if(!load())throw Error('方案载入失败');renderAll();renderSettings();syncModeTabs();save();}
  catch(e){if(previous!=null)localStorage.setItem(LS_KEY,previous);else localStorage.removeItem(LS_KEY);load();renderAll();throw e;}
  CLOUD.loadedId=id;CLOUD.notice='已载入「'+row.title+'」';
}
function renderProfile(){
  const box=document.getElementById('profileBody');if(!box)return;
  const disabled=CLOUD.busy?'disabled':'';
  const owner=CLOUD.user?.id||'',sameOwner=CLOUD.renderedOwner===owner;
  const priorTitle=(sameOwner?box.querySelector('#cloudPlanTitle')?.value:null)??CLOUD.draftTitle??'';CLOUD.draftTitle=priorTitle;
  const email=(sameOwner?box.querySelector('#cloudEmail')?.value:null)??CLOUD.email??'';CLOUD.renderedOwner=owner;
  box.innerHTML=`${CLOUD.error?`<p class="profile-error" role="alert">${esc(CLOUD.error)}</p>`:''}${CLOUD.notice?`<p class="profile-notice" role="status">${esc(CLOUD.notice)}</p>`:''}
    ${!CLOUD.user?`<div class="profile-login"><h2>把方案带到每一台设备</h2><p>使用邮箱验证码登录，首次登录自动创建云方案账号。</p><form id="cloudLogin"><label>邮箱<input id="cloudEmail" type="email" autocomplete="email" value="${esc(email)}" required ${disabled}></label><button class="btn primary" type="submit" ${disabled}>发送验证码</button></form>${CLOUD.verify?`<form id="cloudVerify"><label>验证码<input id="cloudCode" autocomplete="one-time-code" inputmode="numeric" maxlength="12" required ${disabled}></label><button class="btn primary" type="submit" ${disabled}>验证并登录</button><button class="btn ghost" id="cloudChangeEmail" type="button" ${disabled}>更换邮箱</button></form>`:''}<small>云方案账号与库街区登录独立，游戏凭据始终保留在本机。</small></div>`:
    `<div class="profile-user"><span class="profile-avatar">${esc(Array.from(CLOUD.user.email||'云')[0].toUpperCase())}</span><div><b>${esc(CLOUD.user.email||'我的账号')}</b><small>个人方案 · 仅自己可见</small></div><button class="btn ghost" id="cloudLogout" ${disabled}>退出登录</button></div>
    <form id="cloudSaveForm" class="profile-save"><label>方案名称<input id="cloudPlanTitle" maxlength="80" placeholder="例如：本期冲分方案" value="${esc(priorTitle)}" required ${disabled}></label><button class="btn primary" type="submit" ${disabled}>保存当前方案</button></form>
    <div class="profile-list-heading"><h2>我的云方案</h2><button class="btn ghost" id="cloudRefresh" ${disabled}>${CLOUD.busy?'处理中…':'↻ 刷新'}</button></div>
    <div class="profile-plans">${CLOUD.plans.map(p=>`<article><div><b>${esc(p.title)}</b><small>${esc(new Date(p.updated_at).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong'}))}</small></div><div class="profile-plan-actions"><button class="btn" data-cloud-load="${esc(p.id)}" ${disabled}>载入</button><button class="btn ghost" data-cloud-update="${esc(p.id)}" ${disabled}>覆盖</button><button class="btn ghost" data-cloud-delete="${esc(p.id)}" ${disabled}>删除</button></div></article>`).join('')||`<div class="profile-empty">${CLOUD.busy?'正在读取云方案…':'还没有云方案，保存当前编排即可在其他设备打开。'}</div>`}</div>
    <div class="profile-pages"><button class="btn ghost" id="cloudPrev" ${CLOUD.page===0||CLOUD.busy?'disabled':''}>上一页</button><span>第 ${CLOUD.page+1} 页</span><button class="btn ghost" id="cloudNext" ${CLOUD.plans.length<CLOUD.size||CLOUD.busy?'disabled':''}>下一页</button></div>
    ${localStorage.getItem('wuwa-cloud-plan-backup-v1')?`<button class="btn ghost" id="cloudUndo" ${disabled}>恢复载入前的本机编排</button>`:''}`}`;
  const bind=(selector,handler)=>{const el=box.querySelector(selector);if(el)el.onclick=handler;};
  const login=box.querySelector('#cloudLogin');if(login)login.onsubmit=e=>{e.preventDefault();const value=box.querySelector('#cloudEmail').value.trim();cloudAction(()=>cloudSendCode(value));};
  const verify=box.querySelector('#cloudVerify');if(verify)verify.onsubmit=e=>{e.preventDefault();const code=box.querySelector('#cloudCode').value.trim(),fn=CLOUD.verify;cloudAction(async()=>{const data=cloudResult(await fn({token:code}));CLOUD.user=data.user||data.session?.user;if(!CLOUD.user?.id)throw Error('登录未完成，请重试');CLOUD.verify=null;await cloudRefresh();});};
  bind('#cloudChangeEmail',()=>{CLOUD.verify=null;renderProfile();});
  bind('#cloudLogout',()=>cloudAction(async()=>{const {auth}=await cloudClient();cloudResult(await auth.signOut());CLOUD.epoch++;CLOUD.user=null;CLOUD.plans=[];CLOUD.loadedId=null;CLOUD.verify=null;CLOUD.email='';CLOUD.draftTitle='';}));
  bind('#cloudRefresh',()=>cloudAction(cloudRefresh));
  const form=box.querySelector('#cloudSaveForm');if(form)form.onsubmit=e=>{e.preventDefault();const title=box.querySelector('#cloudPlanTitle').value;cloudAction(()=>cloudSave(title));};
  box.querySelectorAll('[data-cloud-load]').forEach(b=>b.onclick=()=>cloudAction(()=>cloudLoad(b.dataset.cloudLoad)));
  box.querySelectorAll('[data-cloud-update]').forEach(b=>b.onclick=()=>{const row=CLOUD.plans.find(p=>p.id===b.dataset.cloudUpdate);if(confirm('用当前编排覆盖「'+row.title+'」？'))cloudAction(()=>cloudSave(row.title,row.id));});
  box.querySelectorAll('[data-cloud-delete]').forEach(b=>b.onclick=()=>{const row=CLOUD.plans.find(p=>p.id===b.dataset.cloudDelete);if(confirm('删除云方案「'+row.title+'」？'))cloudAction(async()=>{const {db}=await cloudClient();const result=cloudResult(await db.from('matrix_plans').delete().eq('id',row.id).eq('owner_id',CLOUD.user.id).eq('revision',row.revision).select('id'));if(!result?.length)throw Error('方案已变化，请刷新后再删除');await cloudRefresh();});});
  bind('#cloudPrev',()=>cloudAction(async()=>{CLOUD.page--;await cloudRefresh();}));bind('#cloudNext',()=>cloudAction(async()=>{CLOUD.page++;await cloudRefresh();}));
  bind('#cloudUndo',()=>{if(!confirm('恢复上次云方案载入前的本机编排？'))return;cloudAction(async()=>{const data=cleanCloudPayload(JSON.parse(localStorage.getItem('wuwa-cloud-plan-backup-v1')));localStorage.setItem(LS_KEY,JSON.stringify(data));if(!load())throw Error('备份载入失败');renderAll();renderSettings();save();localStorage.removeItem('wuwa-cloud-plan-backup-v1');CLOUD.notice='已恢复本机编排';});});
}
function closeProfile(){const root=document.getElementById('profileDlg');root.hidden=true;document.getElementById('btnProfile').focus({preventScroll:true});}
function initProfile(){
  const root=document.createElement('div');root.id='profileDlg';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','profileTitle');
  root.innerHTML='<div class="profile-card"><div class="profile-head"><div><small>PERSONAL / 我的空间</small><h1 id="profileTitle">个人中心</h1></div><button class="btn ghost" id="profileClose" aria-label="关闭个人中心">✕</button></div><div id="profileBody"></div></div>';document.body.appendChild(root);
  document.getElementById('profileClose').onclick=closeProfile;root.onclick=e=>{if(e.target===root)closeProfile();};
  document.getElementById('btnProfile').onclick=()=>{if(ROLE_DIALOG)closeRoleDialog();closeTeamPop();setPoolOpen(false);root.hidden=false;renderProfile();document.getElementById('profileClose').focus();cloudAction(async()=>{const {auth}=await cloudClient();const result=await auth.getUser();CLOUD.user=result.data?.user||null;if(CLOUD.user)await cloudRefresh();});};
  document.addEventListener('keydown',e=>{if(root.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeProfile();}if(e.key==='Tab'){const controls=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
}
initProfile();
