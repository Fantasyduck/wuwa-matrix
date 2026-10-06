/* 角色配置与库街区详情。只存规范化后的游戏数据，不保存原始响应或临时访问令牌。 */
const ROLE_DETAIL_KEY = "wuwa-role-details-v1";
const ROLE_WEAPONS = Object.fromEntries((typeof WEAPONS!=="undefined" ? WEAPONS : []).map(w=>[w.id,w]));
let ROLE_CACHE = {account:"",roles:{}};
let ROLE_SESSION = 0;
const ROLE_PENDING = new Map(), ROLE_ERRORS = new Map();
let ROLE_ACCESS = null, ROLE_BINDING = null;
let ROLE_DIALOG = null;

function roleDps(damage){ return (Math.max(0,Number(damage)||0)/120/10000).toFixed(2); }
function roleInteger(value,min,max){
  if(value==null || value==="") return null;
  const n=Number(value); return Number.isFinite(n) ? Math.max(min,Math.min(max,Math.trunc(n))) : null;
}
function roleText(value){ return String(value==null?"":value).slice(0,240); }
function rolePublicIcon(value){
  try{ const u=new URL(String(value)); return u.protocol==="https:" && /(^|\.)(kurobbs\.com|nanoka\.cc)$/.test(u.hostname) ? u.href : ""; }
  catch(e){return "";}
}
function roleProps(list){
  if(!Array.isArray(list)) return [];
  return list.slice(0,40).filter(p=>p && typeof p==="object").map(p=>({
    name:roleText(p.attributeName ?? p.name ?? p.key),value:roleText(p.attributeValue ?? p.value)
  })).filter(p=>p.name && p.value!=="");
}
function normalizeRoleDetail(data,cid){
  if(typeof data==="string") {try{data=JSON.parse(data);}catch(e){data=null;}}
  if(!data || typeof data!=="object" || Array.isArray(data)) throw new Error("角色详情返回结构不完整");
  const role=data.role||{}, expected=String(cid);
  if(role.roleId!=null && String(role.roleId)!==expected) throw new Error("接口返回的角色与所选角色不一致");
  const wd=data.weaponData||{}, w=wd.weapon||data.weapon||{}, pd=data.phantomData||{};
  const chain=Array.isArray(data.chainList) ? data.chainList.filter(c=>c && (c.unlocked===true || c.unlocked===1)).length : roleInteger(data.chain ?? data.chainLevel,0,6);
  let stats=data.roleAttributeList ?? data.attributeData ?? data.attributes ?? data.attributeList ?? data.props ?? [];
  if(stats && !Array.isArray(stats) && typeof stats==="object") stats=stats.attributeList||stats.attributes||stats.list||Object.entries(stats).map(([name,value])=>({name,value}));
  const echoes=(pd.equipPhantomList || data.echoes || []).filter(Boolean).slice(0,5).map(e=>{
    const p=e.phantomProp||e, f=e.fetterDetail||{};
    return {id:roleText(p.phantomId ?? e.id),name:roleText(p.name||e.name),icon:rolePublicIcon(p.iconUrl||e.icon),
      level:roleInteger(e.level,0,25),cost:roleInteger(e.cost ?? p.cost,0,4),set:roleText(f.name||e.set),
      main:roleProps(e.mainProps||e.main),sub:roleProps(e.subProps||e.sub),
      mainAvailable:e.mainAvailable??Array.isArray(e.mainProps||e.main),
      subAvailable:e.subAvailable??Array.isArray(e.subProps||e.sub)};
  });
  if(!data.role && !data.weaponData && !data.chainList && !data.stats && !data.echoes && !data.attributeData && !data.attributes)
    throw new Error("角色详情未包含配置数据");
  return {id:expected,level:roleInteger(data.level ?? role.level,1,90),chain:roleInteger(chain,0,6),
    weapon:{id:roleText(w.weaponId ?? w.id),name:roleText(w.weaponName||w.name),type:roleText(w.weaponTypeName||w.type),
      rank:roleInteger(w.weaponStarLevel ?? w.rank,1,5),icon:rolePublicIcon(w.weaponIcon||w.icon)},
    refinement:roleInteger(wd.resonLevel ?? data.refinement,1,5),weaponLevel:roleInteger(wd.level ?? data.weaponLevel,1,90),
    stats:roleProps(data.stats||stats),echoes,at:Date.now()};
}
function roleAccountKey(){
  return typeof KURO!=="undefined" && KURO.user ? String(KURO.user.roleId||"")+":"+String(KURO.user.serverId||"") : "";
}
function roleLoadCache(){
  try{
    const saved=JSON.parse(localStorage.getItem(ROLE_DETAIL_KEY)||"null");
    if(saved && saved.account===roleAccountKey() && saved.roles && typeof saved.roles==="object") {
      const roles={};
      Object.entries(saved.roles).forEach(([id,value])=>{try{roles[id]=roleSnapshot(value,id);}catch(e){}});
      ROLE_CACHE={account:saved.account,roles};
    }
  }catch(e){}
}
function roleSnapshot(value,id){
  if(!value || typeof value!=="object") return null;
  return normalizeRoleDetail({role:{roleId:id},level:value.level,chain:value.chain,
    weapon:value.weapon,refinement:value.refinement,weaponLevel:value.weaponLevel,stats:value.stats||[],echoes:value.echoes||[]},id);
}
function roleResetAccount(){
  if(typeof resetAccountMatrix==="function")resetAccountMatrix();
  ROLE_SESSION++; ROLE_CACHE={account:roleAccountKey(),roles:{}};
  ROLE_PENDING.clear();ROLE_ERRORS.clear();ROLE_ACCESS=null;ROLE_BINDING=null;ROLE_SYNC_PROMISE=null;
  try{localStorage.removeItem(ROLE_DETAIL_KEY);}catch(e){}
  if(ROLE_DIALOG) renderRoleDialog();
}
function roleEnsureAccount(){if(ROLE_CACHE.account!==roleAccountKey()) roleResetAccount();}
function roleDetailOf(team,cid){
  const current=ROLE_CACHE.account===roleAccountKey() ? ROLE_CACHE.roles[cid] : null;
  if(current) return current;
  const cfg=(team.roleConfigs||{})[cid];
  return cfg && cfg.snapshot ? roleSnapshot(cfg.snapshot,cid) : null;
}
function roleConfigOf(team,cid){
  const cfg=(team.roleConfigs||{})[cid]||{}, detail=roleDetailOf(team,cid)||{};
  const own=(key)=>Object.prototype.hasOwnProperty.call(cfg,key);
  const id=own("weaponId") ? cfg.weaponId : (detail.weapon||{}).id||"";
  const known=ROLE_WEAPONS[id];
  const weapon=known ? {...known,icon:typeof WEAPON_PORTRAITS!=="undefined" ? WEAPON_PORTRAITS[id]||"" : ""}
    : ((detail.weapon||{}).id===id ? detail.weapon : {id,name:"未选择武器",icon:""});
  return {chain:own("chain") ? roleInteger(cfg.chain,0,6) : detail.chain??null,weapon,
    refinement:own("refinement") ? roleInteger(cfg.refinement,1,5) : detail.refinement??(id?1:null),
    weaponLevel:own("weaponLevel") ? roleInteger(cfg.weaponLevel,1,90) : detail.weaponLevel??null,
    detail:{...detail,echoModal:cfg.echoModal||""},source:ROLE_CACHE.account===roleAccountKey() && ROLE_CACHE.roles[cid] ? "account" : detail.id?"snapshot":"empty",manual:Object.keys(cfg).some(k=>["chain","weaponId","refinement","weaponLevel"].includes(k))};
}
function cleanRoleConfigs(raw){
  const out={};
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return out;
  Object.entries(raw).slice(0,64).forEach(([id,c])=>{
    if(!/^\d{4}$/.test(id) || !c || typeof c!=="object") return;
    const cfg={};
    ["chain","refinement","weaponLevel"].forEach(k=>{if(Object.prototype.hasOwnProperty.call(c,k)) cfg[k]=roleInteger(c[k],k==="chain"?0:1,k==="chain"?6:k==="refinement"?5:90);});
    if(Object.prototype.hasOwnProperty.call(c,"weaponId")) cfg.weaponId=/^\d{1,12}$/.test(String(c.weaponId)) ? String(c.weaponId) : "";
    if(["frost","phantom"].includes(c.echoModal) && id==="1109") cfg.echoModal=c.echoModal;
    if(c.snapshot){try{cfg.snapshot=roleSnapshot(c.snapshot,id);}catch(e){}}
    out[id]=cfg;
  });
  return out;
}
function serializeRoleConfigs(team){
  const out=cleanRoleConfigs(team.roleConfigs);
  team.members.filter(Boolean).forEach(c=>{
    const detail=roleDetailOf(team,c.id);
    if(detail) out[c.id]={...(out[c.id]||{}),snapshot:roleSnapshot(detail,c.id)};
  });
  return out;
}
async function roleBinding(){
  if(KURO.user && KURO.user.roleId && KURO.user.serverId) return {roleId:KURO.user.roleId,serverId:KURO.user.serverId,userId:KURO.user.userId};
  if(!ROLE_BINDING) ROLE_BINDING=(async()=>{
    const u=kuroResponse(await kuroPostRaw("/gamer/role/list",{gameId:3},false,12000));
    if(!u.ok) throw new Error(kuroSafeText(u.msg||"绑定账号读取失败"));
    const list=Array.isArray(u.data)?u.data:(u.data||{}).roleList||[];
    const r=list.find(r=>Number(r.gameId)===3 && String(r.roleId)===String((KURO.user||{}).roleId));
    if(!r) throw new Error("请重新登录库街区并选择绑定角色");
    return r;
  })();
  try{return await ROLE_BINDING;}catch(e){ROLE_BINDING=null;throw e;}
}
async function roleAccess(binding){
  if(!ROLE_ACCESS) ROLE_ACCESS=(async()=>{
    const body={roleId:String(binding.roleId),serverId:String(binding.serverId)};
    if(binding.userId!=null && binding.userId!=="") body.userId=String(binding.userId);
    const u=kuroResponse(await kuroPostRaw("/aki/roleBox/requestToken",body,false,12000));
    if(!u.ok) throw new Error(kuroSafeText(u.msg||"角色详情授权失败"));
    let data=u.data;if(typeof data==="string"){try{data=JSON.parse(data);}catch(e){}}
    if(!data || typeof data.accessToken!=="string" || !data.accessToken.trim()) throw new Error("角色详情授权未返回临时访问令牌，请重新登录后重试");
    // 官方 mcbox：b-at 始终发送；tokenRequire=false 时省略登录 token。
    // tokenRequire 控制登录 token，不能用来判断是否需要 b-at。
    return {accessToken:data.accessToken,tokenRequire:data.tokenRequire!==false};
  })();
  try{return await ROLE_ACCESS;}catch(e){ROLE_ACCESS=null;throw e;}
}
async function fetchRoleDetail(cid,force){
  roleEnsureAccount();
  if(!KURO_CRED.token || !KURO.user) throw new Error("登录库街区后可读取账号声骸和面板");
  if(!kuroOwnsCharacter(CH_INDEX[cid]||{})) throw new Error("该角色不在当前账号的已拥有角色中");
  if(!force && ROLE_CACHE.roles[cid]) return ROLE_CACHE.roles[cid];
  if(ROLE_PENDING.has(cid)) return ROLE_PENDING.get(cid);
  const session=ROLE_SESSION;
  const task=(async()=>{
    const binding=await roleBinding();
    if(session!==ROLE_SESSION) throw new Error("账号已切换，已取消旧账号读取");
    const access=await roleAccess(binding);
    if(session!==ROLE_SESSION) throw new Error("账号已切换，已取消旧账号读取");
    const body={gameId:3,roleId:String(binding.roleId),serverId:String(binding.serverId),id:String(cid),channelId:"19",countryCode:"1"};
    const headers={"b-at":access.accessToken};
    if(!access.tokenRequire) headers.omitLoginToken=true;
    const u=kuroResponse(await kuroPostRaw("/aki/roleBox/akiBox/getRoleDetail",body,false,15000,headers));
    if(!u.ok) {
      const code=u.code!=null?"（"+u.code+"）":"";
      throw new Error(kuroSafeText(u.msg||"角色详情读取失败")+code+(Number(u.code)===10900?"。请在库街区切换当前绑定角色、确认角色详情可见后重试。":""));
    }
    const detail=normalizeRoleDetail(u.data,cid);
    if(session!==ROLE_SESSION) throw new Error("账号已切换，已取消旧账号读取");
    ROLE_CACHE.roles[cid]=detail;ROLE_ERRORS.delete(cid);
    try{localStorage.setItem(ROLE_DETAIL_KEY,JSON.stringify(ROLE_CACHE));}catch(e){}
    return detail;
  })();
  ROLE_PENDING.set(cid,task);
  try{return await task;}catch(e){if(session===ROLE_SESSION) ROLE_ERRORS.set(cid,kuroSafeText(e.message||e));throw e;}
  finally{if(ROLE_PENDING.get(cid)===task) ROLE_PENDING.delete(cid);}
}
function roleRefreshViews(){ renderTeams();renderSummary();renderTeamPop();if(ROLE_DIALOG) renderRoleDialog(); }
let ROLE_SYNC_PROMISE=null;
function roleSyncTeams(force){
  if(ROLE_SYNC_PROMISE) return ROLE_SYNC_PROMISE;
  const task=roleSyncTeamsWork(force);
  ROLE_SYNC_PROMISE=task;
  task.finally(()=>{if(ROLE_SYNC_PROMISE===task) ROLE_SYNC_PROMISE=null;}).catch(()=>{});
  return task;
}
async function roleSyncTeamsWork(force){
  if(!KURO_CRED.token || !KURO.user) return;
  roleEnsureAccount();
  const ids=[...new Set(state.teams.flatMap(t=>t.members.filter(Boolean).map(c=>c.id)))].filter(id=>
    kuroOwnedSet().has((CH_INDEX[id]||{}).name) && (force || (!ROLE_CACHE.roles[id] && !ROLE_ERRORS.has(id))));
  let cursor=0;
  await Promise.all([0,1].map(async()=>{while(cursor<ids.length){const id=ids[cursor++];try{await fetchRoleDetail(id,force);}catch(e){} }}));
  if(ids.length) roleRefreshViews();
}
function roleSlotBadge(team,c){
  const cfg=roleConfigOf(team,c.id);
  return `<span class="role-chain" title="共鸣链 ${cfg.chain==null?"未设置":cfg.chain}">${cfg.chain??"—"}</span>`;
}
function roleWeaponStrip(team,c){
  const cfg=roleConfigOf(team,c.id),w=cfg.weapon;
  return `<div class="weapon-mini" title="${esc(w.name||"未选择武器")}"><span class="weapon-mini-art">${w.icon?`<img src="${esc(w.icon)}" alt="" loading="lazy">`:'<span class="weapon-placeholder">◇</span>'}<b>${w.id?(cfg.refinement??"—"):"—"}</b></span><span>${esc(w.name||"未选择武器")}</span></div>`;
}
function roleSetConfig(key,value){
  if(!ROLE_DIALOG) return;
  const team=findTeam(ROLE_DIALOG.teamId);if(!team) return;
  team.roleConfigs=team.roleConfigs||{};
  const cfg=team.roleConfigs[ROLE_DIALOG.cid]||(team.roleConfigs[ROLE_DIALOG.cid]={});
  if(key==="echoModal"){
    if(ROLE_DIALOG.cid!=="1109" || !["frost","phantom"].includes(value)) return;
    cfg.echoModal=value;
  }else if(key==="weaponId") {
    const c=CH_INDEX[ROLE_DIALOG.cid],w=ROLE_WEAPONS[value];
    if(value && (!w || w.type!==c.weapon)) return;
    cfg.weaponId=String(value);cfg.refinement=value?1:null;
  }else cfg[key]=roleInteger(value,key==="chain"?0:1,key==="chain"?6:key==="refinement"?5:90);
  save();renderTeams();renderRoleDialog();
  const field=document.querySelector('[data-role-field="'+key+'"]');if(field) field.focus({preventScroll:true});
}
function roleStatsHTML(props){
  return props.length ? `<div class="role-stats">${props.map(p=>`<div><span>${esc(p.name)}</span><b>${esc(p.value)}</b></div>`).join("")}</div>`
    : `<div class="role-empty">库街区暂未提供该角色的面板属性。共鸣链和武器配置可在「配置」中手动选择。</div>`;
}
function roleLevelControl(key,title,value,min,max,disabled=false){
  const current=value??min,unit=key==="chain"?"链":"阶",fill=(current-min)/(max-min)*100;
  return `<section class="role-level-control ${value==null?"unset":""} ${disabled?"unavailable":""}" aria-label="${title}">
    <div class="role-level-heading"><span>${title}</span><output for="role-${key}">${disabled?"未选择武器":value==null?"未设置":`${value} <small>${unit}</small>`}</output></div>
    <input id="role-${key}" data-role-field="${key}" type="range" min="${min}" max="${max}" step="1" value="${current}" aria-label="${title}" aria-valuetext="${value==null?"未设置":value+unit}" style="--fill:${fill}%" ${disabled?"disabled":""}>
    <div class="role-level-ticks">${Array.from({length:max-min+1},(_,i)=>i+min).map(n=>`<button type="button" data-role-level="${key}" data-level="${n}" aria-label="${title} ${n} ${unit}" aria-pressed="${value===n}" ${disabled?"disabled":""}>${n}</button>`).join("")}</div>
    ${key==="chain"?`<button type="button" class="role-level-reset" data-role-level="chain" data-level="" ${value==null?"disabled":""}>未设置</button>`:""}
  </section>`;
}
function roleWeaponPickerHTML(c,cfg,weapons){
  const open=!!ROLE_DIALOG.weaponPicker,w=cfg.weapon;
  const image=(weapon)=>{const icon=typeof WEAPON_PORTRAITS!=="undefined"?WEAPON_PORTRAITS[weapon.id]||weapon.icon:weapon.icon;return icon?`<img src="${esc(icon)}" alt="" loading="lazy">`:'<span aria-hidden="true">◇</span>';};
  return `<section class="role-weapon-select wide"><div class="role-weapon-heading"><span>武器 · ${esc(c.weapon)}</span><small>仅显示适用武器</small></div>
    <button type="button" class="role-weapon-trigger" id="roleWeaponPicker" aria-expanded="${open}" aria-controls="roleWeaponCatalog"><span class="role-weapon-current-art">${image(w)}</span><span class="role-weapon-current-copy"><b>${esc(w.name||"未选择武器")}</b><small>${w.id?"★".repeat(w.rank||0)+" · 点击更换":"打开武器图鉴"}</small></span><span class="role-weapon-chevron">${open?"▴":"▾"}</span></button>
    ${open?`<div class="role-weapon-catalog" id="roleWeaponCatalog"><div class="role-weapon-tools"><input id="roleWeaponSearch" type="search" placeholder="搜索武器名称…" aria-label="搜索武器名称" value="${esc(ROLE_DIALOG.weaponQuery||"")}"><button type="button" class="btn ghost" id="roleWeaponClear">卸下武器</button></div>
      <div class="role-weapon-ranks" aria-label="武器星级筛选">${[0,5,4,3,2,1].map(rank=>`<button type="button" data-weapon-rank="${rank}" aria-pressed="${(ROLE_DIALOG.weaponRank||0)===rank}">${rank?rank+" 星":"全部"}</button>`).join("")}</div>
      <div class="role-weapon-grid">${[...weapons].sort((a,b)=>b.rank-a.rank||a.name.localeCompare(b.name,"zh-CN")).map(weapon=>`<button type="button" class="role-weapon-card" data-weapon-id="${weapon.id}" data-weapon-name="${esc(weapon.name)}" data-rank="${weapon.rank}" aria-pressed="${w.id===weapon.id}" title="${esc(weapon.name)} · ${weapon.rank} 星"><span class="role-weapon-card-art">${image(weapon)}</span><b>${esc(weapon.name)}</b><small>${"★".repeat(weapon.rank)}</small><span class="role-weapon-selected" aria-hidden="true">✓</span></button>`).join("")}</div>
      <p class="role-weapon-no-results" id="roleWeaponEmpty" hidden>未找到符合条件的武器</p></div>`:""}</section>`;
}
function roleConfigHTML(c,cfg,weapons){
  return `<div class="role-config-grid">${roleLevelControl("chain","共鸣链",cfg.chain,0,6)}${roleLevelControl("refinement","武器精炼",cfg.refinement,1,5,!cfg.weapon.id)}${roleWeaponPickerHTML(c,cfg,weapons)}
    <label>武器等级<input data-role-field="weaponLevel" type="number" min="1" max="90" value="${cfg.weaponLevel??""}" placeholder="未设置" ${!cfg.weapon.id?"disabled":""}></label>
    <div class="role-weapon-preview">${cfg.weapon.icon?`<img src="${esc(cfg.weapon.icon)}" alt="${esc(cfg.weapon.name)}">`:'<span>◇</span>'}<div><b>${esc(cfg.weapon.name||"未选择武器")}</b><small>${cfg.weapon.id?"精炼 "+(cfg.refinement??"—")+" 阶":"配置将显示在队伍与长图中"}</small></div></div></div><p class="role-local-note">手动配置仅用于当前方案与长图。</p><button class="btn" id="roleRestore" ${!cfg.manual?"disabled":""}>恢复账号配置</button>`;
}
function bindRoleConfigControls(root){
  root.querySelectorAll('input[type="range"][data-role-field]').forEach(input=>input.oninput=()=>{
    const unit=input.dataset.roleField==="chain"?"链":"阶",control=input.closest('.role-level-control');
    input.style.setProperty('--fill',((Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');
    input.setAttribute('aria-valuetext',input.value+unit);control.classList.remove('unset');
    control.querySelector('output').innerHTML=input.value+' <small>'+unit+'</small>';
    control.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.level===input.value));
  });
  root.querySelectorAll('[data-role-level]').forEach(b=>b.onclick=()=>roleSetConfig(b.dataset.roleLevel,b.dataset.level));
  const trigger=root.querySelector('#roleWeaponPicker');
  if(trigger)trigger.onclick=()=>{ROLE_DIALOG.weaponPicker=!ROLE_DIALOG.weaponPicker;renderRoleDialog();document.getElementById(ROLE_DIALOG.weaponPicker?'roleWeaponSearch':'roleWeaponPicker')?.focus({preventScroll:true});};
  const filter=()=>{
    const q=(ROLE_DIALOG.weaponQuery||'').trim().toLocaleLowerCase(),rank=ROLE_DIALOG.weaponRank||0;
    let count=0;root.querySelectorAll('[data-weapon-id]').forEach(b=>{b.hidden=!(b.dataset.weaponName.toLocaleLowerCase().includes(q)&&(!rank||Number(b.dataset.rank)===rank));if(!b.hidden)count++;});
    const empty=root.querySelector('#roleWeaponEmpty');if(empty)empty.hidden=count>0;
    root.querySelectorAll('[data-weapon-rank]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.weaponRank)===rank));
  };
  const search=root.querySelector('#roleWeaponSearch');if(search)search.oninput=()=>{ROLE_DIALOG.weaponQuery=search.value;filter();};
  root.querySelectorAll('[data-weapon-rank]').forEach(b=>b.onclick=()=>{ROLE_DIALOG.weaponRank=Number(b.dataset.weaponRank);filter();});
  const choose=(id)=>{
    const team=findTeam(ROLE_DIALOG.teamId),same=roleConfigOf(team,ROLE_DIALOG.cid).weapon.id===id;
    ROLE_DIALOG.weaponPicker=false;
    if(same)renderRoleDialog();else roleSetConfig('weaponId',id);
    document.getElementById('roleWeaponPicker')?.focus({preventScroll:true});
  };
  root.querySelectorAll('[data-weapon-id]').forEach(b=>b.onclick=()=>choose(b.dataset.weaponId));
  const clear=root.querySelector('#roleWeaponClear');if(clear)clear.onclick=()=>choose('');
  filter();
}
function renderRoleDialog(){
  const root=document.getElementById("roleDlg");if(!root) return;
  if(!ROLE_DIALOG){root.hidden=true;return;}
  const team=findTeam(ROLE_DIALOG.teamId),c=CH_INDEX[ROLE_DIALOG.cid];
  if(!team || !c || !team.members.some(m=>m && m.id===c.id)){closeRoleDialog();return;}
  root.hidden=false;
  const cfg=roleConfigOf(team,c.id),detail=cfg.detail;
  const tab=ROLE_DIALOG.tab||"config",busy=ROLE_PENDING.has(c.id),err=ROLE_ERRORS.get(c.id)||"";
  const weapons=Object.values(ROLE_WEAPONS).filter(w=>w.type===c.weapon);
  const html=`<div class="role-hero"><img class="role-portrait" src="${charIcon(c)}" alt="${esc(characterLabel(c))}"><div><span class="role-eyebrow">RESONATOR / 角色档案</span><h2 id="roleDialogTitle">${esc(characterLabel(c))}</h2><p>${esc(c.element)} · ${esc(c.weapon)} · ${detail.level?"Lv. "+detail.level:"等级未读取"}</p><span class="role-source">${cfg.manual?"含手动配置":cfg.source==="account"?"账号配置":cfg.source==="snapshot"?"配置快照":"待配置"}</span></div><button class="role-close" id="roleClose" aria-label="关闭角色详情">✕</button></div>
    <div class="role-toolbar"><div class="role-tabs">${[["config","配置"],["stats","面板"],["echoes","声骸"]].map(([key,label])=>`<button data-role-tab="${key}" class="${tab===key?"on":""}" aria-pressed="${tab===key}">${label}</button>`).join("")}</div><button class="btn ghost" id="roleRefresh" ${busy || !KURO_CRED.token?"disabled":""}>${busy?"读取中…":"↻ 读取账号配置"}</button></div>
    ${err?`<div class="role-read-error" role="status">${esc(err)}</div>`:""}
    ${!KURO_CRED.token?'<p class="role-local-note">当前为本地配置。登录库街区后，会自动读取队伍角色的声骸与可用面板。</p>':""}
    <div class="role-content">${tab==="config"?roleConfigHTML(c,cfg,weapons)
      : tab==="stats"?roleStatsHTML(detail.stats||[])
      :roleEchoesHTML(c,detail)}</div>`;
  document.getElementById("roleDialogBody").innerHTML=html;
  document.getElementById("roleClose").onclick=closeRoleDialog;
  root.querySelectorAll("[data-role-tab]").forEach(b=>b.onclick=()=>{ROLE_DIALOG.tab=b.dataset.roleTab;renderRoleDialog();});
  root.querySelectorAll("[data-role-field]").forEach(el=>el.onchange=()=>roleSetConfig(el.dataset.roleField,el.value));
  bindRoleConfigControls(root);
  document.getElementById("roleRefresh").onclick=async()=>{
    const cid=c.id;ROLE_ACCESS=null;
    const promise=fetchRoleDetail(cid,true);renderRoleDialog();
    try{await promise;}catch(e){}roleRefreshViews();
  };
  const restore=document.getElementById("roleRestore");
  if(restore) restore.onclick=()=>{delete (team.roleConfigs||{})[c.id];save();renderTeams();renderRoleDialog();};
}
function openRoleDialog(teamId,cid){
  const team=findTeam(teamId);
  if(!team || !team.members.some(member=>member && member.id===cid)) return;
  if(ROLE_DIALOG) closeRoleDialog();
  closeTeamPop();ROLE_DIALOG={teamId,cid,tab:"config",focus:document.activeElement};
  renderRoleDialog();document.getElementById("roleClose").focus();
  if(KURO_CRED.token && KURO.user && !ROLE_CACHE.roles[cid] && !ROLE_ERRORS.has(cid)) {
    const promise=fetchRoleDetail(cid,false);renderRoleDialog();promise.catch(()=>{}).finally(roleRefreshViews);
  }
}
function closeRoleDialog(){
  const prior=ROLE_DIALOG;ROLE_DIALOG=null;const root=document.getElementById("roleDlg");if(root) root.hidden=true;
  if(prior && prior.focus && prior.focus.isConnected) prior.focus.focus({preventScroll:true});
}
function initRoleDialog(){
  roleLoadCache();const root=document.getElementById("roleDlg");if(!root) return;
  root.addEventListener("click",ev=>{if(ev.target===root) closeRoleDialog();});
  document.addEventListener("keydown",ev=>{
    if(!ROLE_DIALOG) return;
    if(ev.key==="Escape"){ev.preventDefault();ev.stopImmediatePropagation();closeRoleDialog();}
    if(ev.key==="Tab"){
      const controls=[...root.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length>0);
      const first=controls[0],last=controls[controls.length-1];
      if(ev.shiftKey && document.activeElement===first){ev.preventDefault();last.focus();}
      else if(!ev.shiftKey && document.activeElement===last){ev.preventDefault();first.focus();}
    }
  },true);
}
