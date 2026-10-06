/* SPDX-License-Identifier: GPL-3.0-only
 * Adapted from WutheringWavesUID/utils/calculate.py (CM-Edelweiss and contributors).
 * JavaScript port, data validation and UI integration, 2026-10-05.
 * Current weights: XutheringWavesUID public resource rules.
 * Sources and limitations: third_party/XutheringWavesUID/NOTICE.md.
 */
const ECHO_SCORE_GRADES = ["C","B","A","S","SS","SSS"];
const ECHO_SCORE_SKILLS = ["普攻伤害加成","重击伤害加成","共鸣技能伤害加成","共鸣解放伤害加成"];

// Python round(x, 1): round the exact binary float to the nearest tenth, ties to even.
function echoRound1(value){
  if(!Number.isFinite(value) || value===0) return value;
  if(value<0) return -echoRound1(-value);
  const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value);
  const bits=view.getBigUint64(0),exponent=Number((bits>>52n)&2047n);
  const mantissa=(bits&((1n<<52n)-1n))+(exponent?1n<<52n:0n);
  const shift=(exponent?exponent-1023:-1022)-52;
  let numerator=mantissa*10n,denominator=1n;
  if(shift>=0) numerator<<=BigInt(shift);else denominator<<=BigInt(-shift);
  let rounded=numerator/denominator;
  const remainder=numerator%denominator;
  if(remainder*2n>denominator || (remainder*2n===denominator && rounded%2n===1n)) rounded++;
  return Number(rounded)/10;
}
function echoGrade(ratio,thresholds){
  let grade=0;
  (thresholds||[]).forEach((n,i)=>{if(ratio>=n) grade=i;});
  return ECHO_SCORE_GRADES[Math.min(grade,ECHO_SCORE_GRADES.length-1)];
}
function echoScoreCondition(rule,values){
  if(rule.op==="&&") return Array.isArray(rule.sub) && rule.sub.every(r=>echoScoreCondition(r,values));
  if(rule.op==="||") return Array.isArray(rule.sub) && rule.sub.some(r=>echoScoreCondition(r,values));
  const current=values[rule.key];
  if(rule.op==="=") return current===rule.value;
  if(rule.op==="in") return Array.isArray(current) && Array.isArray(rule.value) && current.some(v=>rule.value.includes(v));
  return false;
}
function echoScoreProfile(character,echoes,modal){
  const key=String(character.id||""),generic=!Object.prototype.hasOwnProperty.call(ECHO_SCORE_RULES,key);
  const files=ECHO_SCORE_RULES[generic?"default":key];
  let filename="calc.json",note=generic?"上游未收录该角色 ID，使用通用权重。":"";
  const sets=new Map();(echoes||[]).forEach(e=>{if(e.set) sets.set(e.set,(sets.get(e.set)||0)+1);});
  const values={sonata_5:[...sets].filter(([,n])=>n>=5).map(([name])=>name),modal:modal||(key==="1109"?"phantom":"")};
  const match=(files["condition.json"]||[]).find(rule=>echoScoreCondition(rule,values));
  if(match){
    if(files[match.choose]) filename=match.choose;
    else note="上游未提供当前条件对应的规则，使用该角色通用方案。";
  }
  if(key==="1109" && !modal) note="未选择模态，按上游默认的声骸模态评分；可切换为霜渐。";
  return {map:files[filename],key,filename,generic,note,element:character.element||"",name:generic?"通用权重":files[filename].name};
}
function echoScoreProp(prop,isMain,cost,profile){
  const text=String(prop.value??"").trim().replace(/％/g,"%");
  if(!/^\d+(?:\.\d+)?%?$/.test(text)) return null;
  const value=Number(text.replace("%",""));
  if(!Number.isFinite(value)) return null;
  let key=String(prop.name||"").replace(/百分比/g,"");
  if(key==="暴击率") key="暴击";
  if(["攻击","生命","防御"].includes(key) && text.includes("%")) key+="%";
  const rule=profile.map,weights=isMain?rule.main_props[String(cost)]:rule.sub_props;
  if(!weights) return null;
  let weight=weights[key]||0;
  const skillIndex=ECHO_SCORE_SKILLS.indexOf(key);
  if(skillIndex>=0) weight=(weights["技能伤害加成"]||0)*(rule.skill_weight||[])[skillIndex]||0;
  else if(/^(冷凝|衍射|导电|热熔|气动|湮灭)/.test(key))
    weight=(!profile.element || key.startsWith(profile.element)) ? weights["属性伤害加成"]||0 : 0;
  const raw=weight*value;
  const index=cost===1?0:cost===3?1:2;
  const denominator=rule.score_max[index];
  if(!Number.isFinite(raw) || !(denominator>0)) return null;
  let importance="";
  if(weight>0){
    const name=String(prop.name||"").replace("暴击率","暴击");
    for(const [group,label] of [["valid_s","high"],["valid_a","medium"],["valid_b","low"]])
      if((rule.grade[group]||[]).includes(name)) importance=label;
  }
  return {name:prop.name,value:prop.value,isMain,weight,raw,score:echoRound1(raw/denominator*50),importance};
}
function echoScoreOne(echo,profile){
  const cost=Number(echo.cost);
  const unavailable=reason=>({ready:false,reason,score:null,grade:"",entries:[]});
  if(![1,3,4].includes(cost)) return unavailable("COST 未完整返回，暂不评分");
  if(echo.mainAvailable===false || !Array.isArray(echo.main) || echo.main.length!==2)
    return unavailable("主词条未完整返回，暂不评分");
  if(echo.subAvailable===false || !Array.isArray(echo.sub)) return unavailable("副词条未完整返回，暂不评分");
  const entries=[...echo.main.map(p=>echoScoreProp(p,true,cost,profile)),...echo.sub.map(p=>echoScoreProp(p,false,cost,profile))];
  if(entries.some(p=>!p)) return unavailable("词条数值未完整返回，暂不评分");
  const raw=entries.reduce((sum,p)=>sum+p.raw,0),index=cost===1?0:cost===3?1:2;
  const ratio=raw/profile.map.score_max[index];
  const rounded=echoRound1(ratio*50),score=rounded>49.95?50:rounded;
  return {ready:true,score,grade:echoGrade(ratio,profile.map.props_grade[index]),entries};
}
function echoScoreRole(character,detail){
  const echoes=detail.echoes||[],profile=echoScoreProfile(character,echoes,detail.echoModal);
  const items=echoes.map(e=>echoScoreOne(e,profile));
  const ready=items.length>0 && items.every(i=>i.ready);
  const sum=ready?items.reduce((total,i)=>total+i.score,0):null;
  const total=ready?echoRound1(sum):null;
  return {ready,profile,items,total,grade:ready?echoGrade(sum/250,profile.map.total_grade):"",count:echoes.length};
}
function roleEchoesHTML(character,detail){
  const echoes=detail.echoes||[];
  if(!echoes.length) return `<div class="role-empty">${detail.id?"已读取的配置中没有装备声骸。":"尚未读取到已装备声骸。登录库街区后可自动读取，或点击「读取账号配置」重试。"}</div>`;
  const scored=echoScoreRole(character,detail),profile=scored.profile;
  const badge=(grade,score)=>`<span class="echo-grade grade-${grade.toLowerCase()}">${grade}</span><b>${score.toFixed(1)}<small>分</small></b>`;
  const modal=String(character.id)==="1109"?`<label class="echo-modal-select">评分模态 <select data-role-field="echoModal"><option value="phantom" ${detail.echoModal!=="frost"?"selected":""}>声骸</option><option value="frost" ${detail.echoModal==="frost"?"selected":""}>霜渐</option></select></label>`:"";
  const overview=modal+`<div class="echo-score-overview"><div><span class="echo-score-eyebrow">ECHO RATING / 声骸总评</span><h3>${esc(profile.name)}</h3><p>已装备 ${scored.count}/5 件 · 单件以 50 分折算，五件以 250 分折算</p></div><div class="echo-total">${scored.ready?badge(scored.grade,scored.total):'<span class="echo-unavailable">词条不完整，暂不总评</span>'}</div></div>${profile.note?`<p class="echo-rule-note">${esc(profile.note)}</p>`:""}`;
  const cards=echoes.map((echo,i)=>{
    const score=scored.items[i];
    const props=score.ready?score.entries:[...echo.main.map(p=>({...p,isMain:true})),...echo.sub];
    const entries=props.map(p=>`<span class="${p.isMain?"main":""} ${p.importance?"echo-valid-"+p.importance:""}">${esc(p.name)} <b>${esc(p.value)}</b>${score.ready?`<small>+${p.score.toFixed(1)}</small>`:""}</span>`).join("");
    return `<article>${(typeof localEchoIcon==="function"?localEchoIcon(echo.id,echo.icon):echo.icon)?`<img src="${esc(typeof localEchoIcon==="function"?localEchoIcon(echo.id,echo.icon):echo.icon)}" alt="" loading="lazy" onerror="this.hidden=true">`:'<span class="echo-placeholder">◇</span>'}<div><div class="echo-heading"><div><h3>${esc(echo.name||"声骸")}</h3><p>Lv. ${echo.level??"—"} · COST ${echo.cost??"—"} · ${esc(echo.set||"合鸣未提供")}</p></div><div class="echo-single">${score.ready?badge(score.grade,score.score):'<span class="echo-unavailable">暂不评分</span>'}</div></div>${score.ready?`<div class="echo-score-track" aria-hidden="true"><i class="grade-${score.grade.toLowerCase()}" style="width:${Math.max(0,Math.min(100,score.score*2))}%"></i></div>`:`<p class="echo-rule-note">${esc(score.reason)}</p>`}<div class="echo-props">${entries}</div></div></article>`;
  }).join("");
  return overview+`<div class="role-echoes">${cards}</div><details class="echo-score-help"><summary>评分依据与来源</summary><p>使用 XutheringWavesUID 公开角色权重：主副词条加权和 ÷ 当前 COST 的参考值 × 50。词条旁的数字为该词条的得分贡献，分别显示一位小数；单件总分按未舍入的加权和计算。</p><p>档位：C &lt;24，B ≥24，A ≥30，S ≥35，SS ≥39，SSS ≥42；总评使用五件合计对应的比例。少于五件时不提高参考分母。未解锁的副词条不贡献分数。</p><p>这是公开规则的本地适配，尚未与上游当前编译核心校验一致性。只计对应角色属性的伤害词条；单件超过 49.95 时按 50 分展示。评分反映词条质量，不用于计算队伍伤害或 DPS。<a href="https://github.com/${ECHO_SCORE_META.repo}/blob/${ECHO_SCORE_META.commit}/XutheringWavesUID/utils/calculate.py" target="_blank" rel="noopener">查看上游评分入口</a></p></details>`;
}
