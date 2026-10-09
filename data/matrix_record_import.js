/* Import normalized official teams without changing source records or guessing identities. */
const MATRIX_IMPORT_BACKUP_KEY='wuwa-matrix-import-backup-v1';
function prepareMatrixTeamImport(){
  const data=ACCOUNT_MATRIX.account===roleAccountKey()?ACCOUNT_MATRIX.data:null,mode=data?.mode;
  if(!data?.isUnlock||mode?.isUnlock===false||!mode?.hasRecord||!mode.teams?.length)throw Error('暂无可导入的实战队伍');
  if(ACCOUNT_MATRIX.busy)throw Error('请等待战绩同步完成');
  if(!MX_STAGES[String(state.stageId)]||state.mode!=='singularity')throw Error('请先选择奇点扩张期次');
  if(mode.teams.length>64)throw Error('一次最多导入 64 支队伍');
  let unknown=0,missingScores=0,unmatchedBuffs=0,known=0;
  const teams=mode.teams.map(record=>{
    const members=[0,1,2].map(i=>{const role=record.roles?.[i];if(role&&CH_INDEX[role.id]){known++;return String(role.id);}if(role)unknown++;return null;});
    const candidates=new Set();
    for(const buff of record.buffs||[]){
      const id=state.buffs.find(b=>String(b.id)===String(buff.id)&&(!buff.name||b.name.trim()===buff.name.trim()));
      const matches=id?[id]:buff.name?state.buffs.filter(b=>b.name.trim()===buff.name.trim()):[];
      if(matches.length===1)candidates.add(matches[0].id);
    }
    const buff=candidates.size===1?[...candidates][0]:'';
    if((record.buffs||[]).length&&!buff)unmatchedBuffs++;
    const score=matrixNumber(record.score);if(score==null)missingScores++;
    const roleConfigs={};
    if(ROLE_CACHE.account===roleAccountKey())members.filter(Boolean).forEach(id=>{if(ROLE_CACHE.roles[id])roleConfigs[id]={snapshot:roleSnapshot(ROLE_CACHE.roles[id],id)};});
    return {members,roleConfigs,buff,score:score??0};
  });
  if(!known)throw Error('实战记录没有可识别的角色 ID，暂不能自动导入');
  return {teams,unknown,missingScores,unmatchedBuffs};
}
function matrixImportBackup(){
  try{const saved=JSON.parse(localStorage.getItem(MATRIX_IMPORT_BACKUP_KEY)||'null'),p=saved?.payload;
    return p&&MX_STAGES[String(p.stageId)]?.mode==='singularity'&&Array.isArray(p.teams)&&p.teams.length&&Array.isArray(p.waves)?saved:null;
  }catch(e){return null;}
}
function importMatrixTeams(){
  const proposal=prepareMatrixTeamImport(),period=state.period.label||'当前期次';
  const warnings=[proposal.unknown?proposal.unknown+' 个角色未识别，将保留空槽':'',proposal.unmatchedBuffs?proposal.unmatchedBuffs+' 队回路无法唯一匹配，将留空':'',proposal.missingScores?proposal.missingScores+' 队未提供得分，将填 0':''].filter(Boolean);
  if(!confirm('将 '+proposal.teams.length+' 支实战队伍按原上场顺序导入「'+period+'」，替换当前编排，并备份当前方案。\n请确认实战记录与目标期次一致。\n实战分将作为预估得分参考，含奇藏等加分时可自行调整。'+(warnings.length?'\n'+warnings.join('；'):'')+'\n是否继续？'))return false;
  const previousState=JSON.parse(JSON.stringify(state)),previousRaw=localStorage.getItem(LS_KEY),previousBackup=localStorage.getItem(MATRIX_IMPORT_BACKUP_KEY);
  const payload=exportPayload();
  try{
    localStorage.setItem(MATRIX_IMPORT_BACKUP_KEY,JSON.stringify({at:Date.now(),payload}));
    const teams=proposal.teams.map((t,i)=>({...defaultTeam(i),members:t.members.map(id=>id?CH_INDEX[id]:null),roleConfigs:t.roleConfigs,buff:t.buff,score:t.score,on:true}));
    state={...state,teams,popTeam:null,hoverTeam:null,openRound:{},openWave:{}};
    autoSplitWaves();syncTeamNames();
    localStorage.setItem(LS_KEY,JSON.stringify(exportPayload()));
  }catch(e){
    state=previousState;
    try{if(previousRaw==null)localStorage.removeItem(LS_KEY);else localStorage.setItem(LS_KEY,previousRaw);if(previousBackup==null)localStorage.removeItem(MATRIX_IMPORT_BACKUP_KEY);else localStorage.setItem(MATRIX_IMPORT_BACKUP_KEY,previousBackup);}catch(ignored){}
    throw Error('导入未完成，本机编排已保留：'+(e.message||'本地保存失败'));
  }
  closeTeamPop();if(ROLE_DIALOG)closeRoleDialog();setPoolOpen(false);pickedChar=null;
  renderAll();renderSettings();syncModeTabs();
  if(typeof window.matrixNavigate==='function')window.matrixNavigate('planner');
  toast('已按实战顺序导入 '+proposal.teams.length+' 队，实战分作为估分参考');
  return true;
}
function restoreMatrixTeamImport(){
  const backup=matrixImportBackup();if(!backup)throw Error('没有可恢复的导入前编排');
  if(!confirm('恢复导入前的本机编排？这会替换当前队伍和波次。'))return false;
  const previousState=JSON.parse(JSON.stringify(state)),previousRaw=localStorage.getItem(LS_KEY);
  try{
    localStorage.setItem(LS_KEY,JSON.stringify(backup.payload));
    if(!load())throw Error('备份内容无法载入');
    localStorage.setItem(LS_KEY,JSON.stringify(exportPayload()));
  }catch(e){state=previousState;try{if(previousRaw==null)localStorage.removeItem(LS_KEY);else localStorage.setItem(LS_KEY,previousRaw);}catch(ignored){}throw e;}
  closeTeamPop();if(ROLE_DIALOG)closeRoleDialog();setPoolOpen(false);pickedChar=null;
  renderAll();renderSettings();syncModeTabs();
  if(typeof window.matrixNavigate==='function')window.matrixNavigate('planner');
  toast('已恢复导入前编排');return true;
}
