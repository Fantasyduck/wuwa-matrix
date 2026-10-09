/* 库街区真实矩阵战绩。参考 XutheringWavesUID 的 api.py / requests.py / model/battle.py。
   只读官方接口；账号战绩独立于本地推演，临时授权和返回值不写入部署资源。 */
let ACCOUNT_MATRIX={account:"",data:null,busy:false,error:"",at:0,pending:null,phase:"",version:0};
function resetAccountMatrix(){
  const version=ACCOUNT_MATRIX.version+1;
  ACCOUNT_MATRIX={account:"",data:null,busy:false,error:"",at:0,pending:null,phase:"",version};
  if(typeof document!=="undefined")renderAccountMatrix();
}
function matrixNumber(value){if(value==null || value==="")return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
function normalizeAccountMatrix(value){
  value=kuroDeep(value);
  if(!value || typeof value!=="object" || Array.isArray(value) || (!Array.isArray(value.modeDetails) && value.isUnlock!==false))throw new Error("库街区矩阵返回结构不完整");
  const mode=(value.modeDetails||[]).find(m=>Number(m.modeId)===1);
  const teams=(Array.isArray(mode?.teams)?mode.teams:[]).slice(0,80).map(team=>({
    score:matrixNumber(team.score),round:matrixNumber(team.round),bossCount:matrixNumber(team.bossCount),passBoss:matrixNumber(team.passBoss),
    roles:(Array.isArray(team.roleList)&&team.roleList.length?team.roleList:team.roleIcons?.map(iconUrl=>({iconUrl}))||[]).slice(0,3).map(r=>({id:String(r.roleId||""),icon:rolePublicIcon(r.iconUrl),branch:matrixNumber(r.skillBranchIndex)})),
    buffs:(Array.isArray(team.buffs)?team.buffs:[]).slice(0,8).map(b=>({id:String(b.buffId||""),name:roleText(b.buffName),description:roleText(b.desc),icon:rolePublicIcon(b.buffIcon)}))
  }));
  return {isUnlock:value.isUnlock!==false,endTime:matrixNumber(value.endTime),reward:matrixNumber(value.reward),totalReward:matrixNumber(value.totalReward),
    mode:mode?{hasRecord:mode.hasRecord===true,isUnlock:mode.isUnlock!==false,score:matrixNumber(mode.score),rank:matrixNumber(mode.rank),bossCount:matrixNumber(mode.bossCount),passBoss:matrixNumber(mode.passBoss),round:matrixNumber(mode.round),teams}:null};
}
// refreshData is an action: code=200 with null data can be a successful sync.
function matrixRefreshResponse(raw){
  const response=kuroResponse(raw),body=kuroDeep(raw?.json);
  if(!response.ok && Number(raw?.status)>=200 && Number(raw?.status)<300 && Number(body?.code)===200 && body?.success!==false)return {ok:true,data:body.data};
  return response;
}
async function readAccountMatrix(force=false){
  if(!KURO_CRED.token || !KURO.user)throw new Error("请先登录库街区");
  roleEnsureAccount();
  const account=roleAccountKey();
  if(ACCOUNT_MATRIX.account!==account)resetAccountMatrix();
  if(ACCOUNT_MATRIX.pending)return ACCOUNT_MATRIX.pending;
  if(!force && ACCOUNT_MATRIX.data)return ACCOUNT_MATRIX.data;
  ACCOUNT_MATRIX.account=account;ACCOUNT_MATRIX.busy=true;ACCOUNT_MATRIX.error="";ACCOUNT_MATRIX.phase="同步战绩中…";
  const version=ACCOUNT_MATRIX.version;
  const current=()=>version===ACCOUNT_MATRIX.version && account===roleAccountKey() && !!KURO_CRED.token;
  const task=(async()=>{
    try{
      const binding=await roleBinding();
      if(!current())throw new Error("账号已切换，已取消旧账号读取");
      let access=await roleAccess(binding);
      const body={gameId:3,roleId:String(binding.roleId),serverId:String(binding.serverId)};
      const headers=()=>({"b-at":access.accessToken,omitLoginToken:true,cache:"no-store"});
      const request=path=>kuroPostRaw(path,body,false,15000,headers()).then(kuroResponse);
      const sync=()=>kuroPostRaw("/aki/roleBox/akiBox/refreshData",body,false,15000,headers()).then(matrixRefreshResponse);
      let refreshed=await sync();
      if(!current())throw new Error("账号已切换，已取消旧账号读取");
      if(!refreshed.ok && Number(refreshed.code)===10900){
        ROLE_ACCESS=null;access=await roleAccess(binding);
        if(!current())throw new Error("账号已切换，已取消旧账号读取");
        refreshed=await sync();
        if(!current())throw new Error("账号已切换，已取消旧账号读取");
      }
      if(!refreshed.ok)throw new Error("同步战绩失败："+kuroSafeText(refreshed.msg||"库街区未完成数据同步")+(refreshed.code!=null?"（"+refreshed.code+"）":""));
      ACCOUNT_MATRIX.phase="读取矩阵中…";renderAccountMatrix();
      const paths=["/aki/roleBox/akiBox/newTowerIndex","/aki/roleBox/akiBox/newTowerDetail"];
      let responses=await Promise.all(paths.map(path=>request(path).catch(e=>({ok:false,msg:kuroSafeText(e.message)}))));
      if(responses.some(r=>Number(r.code)===10900) && current()){
        ROLE_ACCESS=null;access=await roleAccess(binding);
        if(!current())throw new Error("账号已切换，已取消旧账号读取");
        responses=await Promise.all(responses.map((r,i)=>r.ok?r:request(paths[i]).catch(e=>({ok:false,msg:kuroSafeText(e.message)}))));
      }
      if(!current())throw new Error("账号已切换，已取消旧账号读取");
      let data=null;const errors=[];
      for(const i of [1,0]){
        const response=responses[i];
        if(!response.ok){errors.push(kuroSafeText(response.msg||"矩阵读取失败")+(response.code!=null?"（"+response.code+"）":""));continue;}
        try{data=normalizeAccountMatrix(response.data);data.detailAvailable=i===1;break;}catch(e){errors.push(e.message);}
      }
      if(!data)throw new Error(errors.join("；")||"未能读取矩阵信息");
      ACCOUNT_MATRIX.data=data;ACCOUNT_MATRIX.at=Date.now();
      ACCOUNT_MATRIX.error=data.detailAvailable?"":("已读取实战概览，队伍详情暂不可用："+errors.join("；"));
      return data;
    }catch(e){if(current())ACCOUNT_MATRIX.error=kuroSafeText(e.message||"矩阵读取失败");throw e;}
    finally{if(current()){ACCOUNT_MATRIX.busy=false;ACCOUNT_MATRIX.pending=null;ACCOUNT_MATRIX.phase="";renderAccountMatrix();}}
  })();
  ACCOUNT_MATRIX.pending=task;renderAccountMatrix();return task;
}
// UI state is kept separately from official records and local team plans.
const MATRIX_RECORD_VIEW={account:"",selected:0};
function matrixTeamShortName(team,index){
  const initials=(team.roles||[]).slice(0,3).map(r=>CH_INDEX[r.id]?Array.from(String(CH_INDEX[r.id].name||'').trim())[0]||'?':'?').join('');
  return initials||'队伍 '+(index+1);
}
function matrixRankedTeams(teams){
  return teams.map((team,index)=>({team,index,score:matrixNumber(team.score),name:matrixTeamShortName(team,index)})).sort((a,b)=>a.score==null?(b.score==null?a.index-b.index:1):b.score==null?-1:b.score-a.score||a.index-b.index);
}
function matrixTeamLabel(team){return team.roles.map(r=>CH_INDEX[r.id]?characterLabel(CH_INDEX[r.id]):"未识别角色").join(" · ")||"角色资料未提供";}
function matrixScoreChartHTML(teams){
  if(!teams.length)return '<p class="matrix-empty">官方接口暂未提供逐队记录，暂无可绘制的得分。</p>';
  const ranked=matrixRankedTeams(teams),series=ranked.map(entry=>entry.score),known=teams.map(t=>matrixNumber(t.score)).filter(n=>n!=null),max=known.length?Math.max(...known):null,average=known.length?known.reduce((a,b)=>a+b,0)/known.length:null;
  const width=Math.max(560,teams.length*58+70),height=232,left=62,right=24,top=24,bottom=42,plotH=height-top-bottom;
  const highest=Math.max(1,...series.filter(n=>n!=null)),unit=10**Math.floor(Math.log10(highest)),step=Math.max(1,Math.ceil(highest/4/unit*10)/10*unit),ceiling=step*4;
  const x=i=>teams.length===1?(width+left-right)/2:left+i*(width-left-right)/(teams.length-1),y=n=>top+plotH*(1-n/ceiling);
  let paths=[],path=[];series.forEach((n,i)=>{if(n==null){if(path.length)paths.push(path);path=[];}else path.push([x(i),y(n)]);});if(path.length)paths.push(path);
  const axis=n=>n>=10000?(n/10000).toFixed(1).replace(/\.0$/,"")+"万":fmt(n);
  const selected=MATRIX_RECORD_VIEW.selected,selectedRank=ranked.findIndex(entry=>entry.index===selected),team=teams[selected],selectedScore=matrixNumber(team.score);
  return `<section class="matrix-score-card" aria-labelledby="matrixScoreTitle"><div class="matrix-score-heading"><div><span class="matrix-eyebrow">TEAM PERFORMANCE</span><h3 id="matrixScoreTitle">实战得分排名</h3></div><span class="matrix-score-order">得分从高到低</span></div><div class="matrix-chart-stats"><span>最高单队 <b>${max==null?'—':fmt(max)}</b></span><span>平均单队 <b>${average==null?'—':fmt(Math.round(average))}</b></span><span>${known.length} / ${teams.length} 队有得分</span></div>
    <div class="matrix-chart-scroll" tabindex="0" aria-label="队伍得分图，可横向滚动"><svg class="matrix-score-chart" style="min-width:${width}px" viewBox="0 0 ${width} ${height}" aria-labelledby="matrixChartTitle matrixChartDesc"><title id="matrixChartTitle">队伍实战得分排名折线图</title><desc id="matrixChartDesc">横轴为队伍简称，按实战得分从高到低排列，纵轴为实战积分。点选数据点查看队伍；缺失分数不按零分计算。</desc><defs><linearGradient id="matrixScoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a185bd" stop-opacity=".27"/><stop offset="1" stop-color="#a185bd" stop-opacity="0"/></linearGradient></defs>
    ${[0,1,2,3,4].map(i=>{const n=i*step;return `<line x1="${left}" x2="${width-right}" y1="${y(n)}" y2="${y(n)}" class="matrix-gridline"/><text x="${left-12}" y="${y(n)+4}" text-anchor="end" class="matrix-axis">${axis(n)}</text>`;}).join('')}
    ${paths.map(points=>`<path d="M${points.map(p=>p.join(',')).join(' L')} L${points.at(-1)[0]},${top+plotH} L${points[0][0]},${top+plotH} Z" fill="url(#matrixScoreFill)"/><path d="M${points.map(p=>p.join(',')).join(' L')}" class="matrix-score-line"/>`).join('')}
    ${ranked.map(({team:t,index,score,name},i)=>`<text x="${x(i)}" y="${height-15}" text-anchor="middle" class="matrix-axis matrix-team-axis ${index===selected?'selected':''}">${esc(name)}</text>${score==null?'':`<circle cx="${x(i)}" cy="${y(score)}" r="16" class="matrix-point-hit" data-matrix-point="${index}" data-matrix-rank="${i+1}" role="button" tabindex="0" aria-label="第 ${i+1} 名，${esc(name)}，${fmt(score)} 分，原第 ${index+1} 队，${esc(matrixTeamLabel(t))}" aria-pressed="${index===selected}"><title>${esc(name)} · ${fmt(score)} 分 · 原第 ${index+1} 队</title></circle><circle cx="${x(i)}" cy="${y(score)}" r="${index===selected?6:4}" class="matrix-score-dot ${index===selected?'selected':''}" pointer-events="none"/>`}`).join('')}</svg></div>
    <div class="matrix-chart-selection" aria-live="polite"><div><span>${selectedScore==null?'分数未提供':'第 '+(selectedRank+1)+' 名'} · 原第 ${selected+1} 队</span><b>${esc(matrixTeamShortName(team,selected))}<small class="matrix-selection-roles">${esc(matrixTeamLabel(team))}</small></b></div><strong>${selectedScore==null?'未提供':fmt(selectedScore)}<small> 实战积分</small></strong><button type="button" id="matrixChartTeam">查看队伍 ↗</button></div><p class="matrix-chart-caption">按实战得分从高到低排列，横轴取角色首字；点选圆点查看队伍。${teams.length>7?' 可左右滑动查看全部队伍。':''}</p></section>`;
}
function renderAccountMatrix(){
  if(typeof window.renderPersonalDashboard==="function")window.renderPersonalDashboard();
  const box=document.getElementById("accountMatrixBody");if(!box)return;
  const m=ACCOUNT_MATRIX,data=m.account===roleAccountKey()?m.data:null,mode=data?.mode;
  const value=n=>n==null?"—":fmt(n);
  const time=data?.endTime?new Date(data.endTime*(data.endTime>1e12?1:1000)).toLocaleDateString("zh-CN",{timeZone:"Asia/Hong_Kong"}):"";
  const teams=mode?.teams||[];
  if(MATRIX_RECORD_VIEW.account!==m.account){MATRIX_RECORD_VIEW.account=m.account;MATRIX_RECORD_VIEW.selected=matrixRankedTeams(teams)[0]?.index||0;}
  MATRIX_RECORD_VIEW.selected=Math.max(0,Math.min(MATRIX_RECORD_VIEW.selected,teams.length-1));
  const summary=document.querySelector("#accountMatrixSection > summary");
  if(summary)summary.textContent="库街区 · 实战矩阵"+(mode?.score!=null?" · "+fmt(mode.score)+" 分":"");
  const scroll=box.querySelector('.matrix-chart-scroll')?.scrollLeft||0,opened=[...box.querySelectorAll('.matrix-real-team[open]')].map(el=>el.dataset.matrixTeam);
  box.innerHTML=`<div class="account-matrix-tools"><div><span class="matrix-eyebrow">SINGULARITY / 奇点扩张</span><h2>实战档案</h2><span>${m.at&&data?"读取于 "+new Date(m.at).toLocaleTimeString("zh-CN",{timeZone:"Asia/Hong_Kong",hour:"2-digit",minute:"2-digit"}):"连接账号，查看你的矩阵表现"}</span></div><button class="btn matrix-sync" id="matrixRead" ${m.busy?'disabled aria-busy="true"':''}>${m.busy?(m.phase||"读取中…"):KURO_CRED.token?"↻ 同步最新战绩":"登录后读取"}</button></div>
    <div class="matrix-import-actions">${data?.isUnlock&&mode?.isUnlock!==false&&mode?.hasRecord&&teams.length?`<button type="button" class="btn matrix-import-button" id="matrixImportTeams" ${m.busy?'disabled':''}>↗ 导入到编排</button><span>按实战上场顺序 · 目标：${esc(state.period.label||'当前期次')}</span>`:''}${typeof matrixImportBackup==='function'&&matrixImportBackup()?'<button type="button" class="matrix-import-restore" id="matrixRestoreTeams">恢复导入前编排</button>':''}</div><p id="matrixImportError" class="matrix-read-error" role="status" hidden></p>
    ${m.error?`<p class="matrix-read-error" role="status">${esc(m.error)}</p>`:""}
    ${!data?`<p class="matrix-empty">${m.busy?"正在同步并读取当前账号的矩阵战绩…":"登录库街区可读取实战得分、队伍与增幅回路。"}</p>`:
      !data.isUnlock || mode?.isUnlock===false?'<p class="matrix-empty">库街区当前返回矩阵未解锁，暂无可读取的实战记录。</p>':
      !mode?.hasRecord?'<p class="matrix-empty">当前期次暂无奇点扩张实战记录。</p>':
      `<div class="matrix-real-stats"><div class="matrix-total-score"><small>实战总得分</small><b>${value(mode.score)}</b><span>${teams.length} 支队伍 · 官方战绩</span></div><div><small>已击破</small><b>${value(mode.passBoss)}${mode.bossCount!=null?" / "+value(mode.bossCount):""}</b></div><div><small>到达轮次</small><b>${mode.round!=null?"R"+mode.round:"—"}</b></div>${mode.rank>0?`<div><small>排名</small><b>${value(mode.rank)}</b></div>`:""}</div>
       <div class="matrix-real-meta">${time?"结束日期 "+esc(time):""}${data.reward!=null&&data.totalReward!=null?" · 奖励 "+value(data.reward)+" / "+value(data.totalReward):""}</div>
       ${matrixScoreChartHTML(teams)}<div class="matrix-teams-heading"><h3>上场队伍</h3><span>${teams.length} 队</span></div>
       <div class="matrix-real-teams">${teams.map((team,i)=>`<details class="matrix-real-team ${i===MATRIX_RECORD_VIEW.selected?'chart-selected':''}" data-matrix-team="${i}" ${opened.includes(String(i))?'open':''}><summary><span class="matrix-team-order">${String(i+1).padStart(2,'0')}</span><span class="matrix-team-name"><strong>队伍 ${i+1}</strong><small>${esc(matrixTeamLabel(team))}</small></span><b>${value(team.score)}<small> 分</small></b><span class="matrix-team-chevron">⌄</span></summary><div class="matrix-team-content"><div class="matrix-real-roles">${team.roles.map(r=>{const c=CH_INDEX[r.id];return `<div>${avatarHTML(c?charIcon(c):r.icon,c?characterLabel(c):"角色未识别")}<span>${esc(c?characterLabel(c):"角色未识别")}</span></div>`;}).join("")}</div><div class="matrix-team-meta">${team.round!=null?"R"+team.round+" · ":""}击破 ${value(team.passBoss)}${team.bossCount!=null?" / "+value(team.bossCount):""}</div><div class="matrix-real-buffs">${team.buffs.map(b=>`<span title="${esc(b.description)}">${b.icon?`<img src="${esc(b.icon)}" alt="" loading="lazy" onerror="this.hidden=true">`:""}${esc(b.name||"增幅回路")}</span>`).join("")}</div></div></details>`).join("")}</div><p class="matrix-record-note">实战积分来自官方记录，与编排中的估分独立。</p>`}`;
  if(box.querySelector('.matrix-chart-scroll'))box.querySelector('.matrix-chart-scroll').scrollLeft=scroll;
  document.getElementById("matrixRead").onclick=()=>{if(!KURO_CRED.token || !KURO.user){setKuroOpen(true);return;}readAccountMatrix(true).catch(()=>{});};
  const importError=error=>{const message=box.querySelector('#matrixImportError');message.hidden=false;message.textContent=error.message||'操作未完成';};
  const importButton=box.querySelector('#matrixImportTeams');if(importButton)importButton.onclick=()=>{try{importMatrixTeams();}catch(e){importError(e);}};
  const restoreButton=box.querySelector('#matrixRestoreTeams');if(restoreButton)restoreButton.onclick=()=>{try{restoreMatrixTeamImport();}catch(e){importError(e);}};
  const select=(index,focus=false)=>{MATRIX_RECORD_VIEW.selected=index;renderAccountMatrix();if(focus)box.querySelector(`[data-matrix-point="${index}"]`)?.focus({preventScroll:true});};
  box.querySelectorAll('[data-matrix-point]').forEach(point=>{
    point.onclick=()=>select(Number(point.dataset.matrixPoint));
    point.onkeydown=e=>{let index=Number(point.dataset.matrixPoint);if(e.key==='Enter'||e.key===' '){e.preventDefault();select(index,true);}else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const ranked=matrixRankedTeams(teams).filter(entry=>entry.score!=null),position=ranked.findIndex(entry=>entry.index===index),next=position+(e.key==='ArrowRight'?1:-1);if(ranked[next])select(ranked[next].index,true);}};
  });
  const jump=box.querySelector('#matrixChartTeam');if(jump)jump.onclick=()=>{const team=box.querySelector(`[data-matrix-team="${MATRIX_RECORD_VIEW.selected}"]`);if(team){team.open=true;team.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});team.querySelector('summary')?.focus({preventScroll:true});}};
}
