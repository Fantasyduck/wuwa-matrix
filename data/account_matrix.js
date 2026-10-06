/* 库街区真实矩阵战绩。参考 XutheringWavesUID 的 api.py / requests.py / model/battle.py。
   只读官方接口；账号战绩独立于本地推演，临时授权和返回值不写入部署资源。 */
let ACCOUNT_MATRIX={account:"",data:null,busy:false,error:"",at:0,pending:null,version:0};
function resetAccountMatrix(){
  const version=ACCOUNT_MATRIX.version+1;
  ACCOUNT_MATRIX={account:"",data:null,busy:false,error:"",at:0,pending:null,version};
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
async function readAccountMatrix(force=false){
  if(!KURO_CRED.token || !KURO.user)throw new Error("请先登录库街区");
  roleEnsureAccount();
  const account=roleAccountKey();
  if(ACCOUNT_MATRIX.account!==account)resetAccountMatrix();
  if(ACCOUNT_MATRIX.pending)return ACCOUNT_MATRIX.pending;
  if(!force && ACCOUNT_MATRIX.data)return ACCOUNT_MATRIX.data;
  ACCOUNT_MATRIX.account=account;ACCOUNT_MATRIX.busy=true;ACCOUNT_MATRIX.error="";
  const version=ACCOUNT_MATRIX.version;
  const current=()=>version===ACCOUNT_MATRIX.version && account===roleAccountKey() && !!KURO_CRED.token;
  const task=(async()=>{
    try{
      const binding=await roleBinding();
      if(!current())throw new Error("账号已切换，已取消旧账号读取");
      let access=await roleAccess(binding);
      const body={gameId:3,roleId:String(binding.roleId),serverId:String(binding.serverId)};
      const request=path=>kuroPostRaw(path,body,false,15000,{"b-at":access.accessToken,omitLoginToken:true}).then(kuroResponse);
      const paths=["/aki/roleBox/akiBox/newTowerIndex","/aki/roleBox/akiBox/newTowerDetail"];
      let responses=await Promise.all(paths.map(path=>request(path).catch(e=>({ok:false,msg:kuroSafeText(e.message)}))));
      if(responses.some(r=>Number(r.code)===10900) && current()){
        ROLE_ACCESS=null;access=await roleAccess(binding);
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
    finally{if(current()){ACCOUNT_MATRIX.busy=false;ACCOUNT_MATRIX.pending=null;renderAccountMatrix();}}
  })();
  ACCOUNT_MATRIX.pending=task;renderAccountMatrix();return task;
}
function renderAccountMatrix(){
  const box=document.getElementById("accountMatrixBody");if(!box)return;
  const m=ACCOUNT_MATRIX,data=m.account===roleAccountKey()?m.data:null,mode=data?.mode;
  const value=n=>n==null?"—":fmt(n);
  const time=data?.endTime?new Date(data.endTime*(data.endTime>1e12?1:1000)).toLocaleDateString("zh-CN",{timeZone:"Asia/Hong_Kong"}):"";
  const teams=mode?.teams||[];
  const summary=document.querySelector("#accountMatrixSection > summary");
  if(summary)summary.textContent="库街区 · 实战矩阵"+(mode?.score!=null?" · "+fmt(mode.score)+" 分":"");
  box.innerHTML=`<div class="account-matrix-tools"><span>${m.at&&data?"读取于 "+new Date(m.at).toLocaleTimeString("zh-CN",{timeZone:"Asia/Hong_Kong",hour:"2-digit",minute:"2-digit"}):"奇点扩张 · 官方战绩"}</span><button class="btn" id="matrixRead" ${m.busy?"disabled":""}>${m.busy?"读取中…":KURO_CRED.token?"↻ 读取矩阵":"登录后读取"}</button></div>
    ${m.error?`<p class="matrix-read-error" role="status">${esc(m.error)}</p>`:""}
    ${!data?`<p class="matrix-empty">${m.busy?"正在读取当前账号的矩阵战绩…":"登录库街区可读取实战得分、队伍与增幅回路。"}</p>`:
      !data.isUnlock || mode?.isUnlock===false?'<p class="matrix-empty">库街区当前返回矩阵未解锁，暂无可读取的实战记录。</p>':
      !mode?.hasRecord?'<p class="matrix-empty">当前期次暂无奇点扩张实战记录。</p>':
      `<div class="matrix-real-stats"><div><small>实战得分</small><b>${value(mode.score)}</b></div><div><small>已击破</small><b>${value(mode.passBoss)}${mode.bossCount!=null?" / "+value(mode.bossCount):""}</b></div><div><small>到达轮次</small><b>${mode.round!=null?"R"+mode.round:"—"}</b></div>${mode.rank>0?`<div><small>排名</small><b>${value(mode.rank)}</b></div>`:""}</div>
       <div class="matrix-real-meta">${time?"结束日期 "+esc(time):""}${data.reward!=null&&data.totalReward!=null?" · 奖励 "+value(data.reward)+" / "+value(data.totalReward):""}</div>
       <div class="matrix-real-teams">${teams.map((team,i)=>`<details class="matrix-real-team"><summary><span>队伍 ${i+1}</span><b>${value(team.score)} 分</b><span class="matrix-team-chevron">⌄</span></summary><div class="matrix-team-content"><div class="matrix-real-roles">${team.roles.map(r=>{const c=CH_INDEX[r.id];return `<div>${avatarHTML(c?charIcon(c):r.icon,c?characterLabel(c):"角色未识别")}<span>${esc(c?characterLabel(c):"角色未识别")}</span></div>`;}).join("")}</div><div class="matrix-team-meta">${team.round!=null?"R"+team.round+" · ":""}击破 ${value(team.passBoss)}${team.bossCount!=null?" / "+value(team.bossCount):""}</div><div class="matrix-real-buffs">${team.buffs.map(b=>`<span title="${esc(b.description)}">${b.icon?`<img src="${esc(b.icon)}" alt="" loading="lazy" onerror="this.hidden=true">`:""}${esc(b.name||"增幅回路")}</span>`).join("")}</div></div></details>`).join("")}</div><p class="matrix-record-note">实战战绩独立展示，当前编排与血量推演保持原样。</p>`}`;
  document.getElementById("matrixRead").onclick=()=>{
    if(!KURO_CRED.token || !KURO.user){setKuroOpen(true);return;}
    readAccountMatrix(true).catch(()=>{});
  };
}
