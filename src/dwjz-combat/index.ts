import './style.css';

(function(){
  /* ===== utils ===== */
  function num(v,d){ var n=parseFloat(v); return isNaN(n)?(d||0):n; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function getValue(data,path,def){
    if(def===undefined) def='-';
    if(!data) return def;
    try{
      var keys=String(path).split('.'), cur=data;
      for(var i=0;i<keys.length;i++){
        if(cur===null||typeof cur!=='object') return def;
        cur=cur[keys[i]];
      }
      return (cur!==undefined&&cur!==null)?cur:def;
    }catch(e){ return def; }
  }
  function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

  /* ===== storage ===== */
  function getCombatKey(){
    try{
      var ctx=(typeof getContext==='function')?getContext():{};
      var id=ctx.characterId||ctx.chatId||(ctx.name2||'')||'default';
      return 'neb_combat_'+String(id).replace(/[^a-zA-Z0-9_-]/g,'_');
    }catch(e){ return 'neb_combat_default'; }
  }
  function loadState(){
    try{ var s=localStorage.getItem(getCombatKey()); if(s) return JSON.parse(s); }catch(e){}
    return null;
  }
  function saveState(s){ try{ localStorage.setItem(getCombatKey(), JSON.stringify(s)); }catch(e){} }
  function clearState(){ try{ localStorage.removeItem(getCombatKey()); }catch(e){} }

  /* ===== dice engine ===== */
  function rollDie(faces){ if(faces<1) faces=1; return Math.floor(Math.random()*faces)+1; }
  var ATTRS=['力量','敏捷','体质','智力','精神','魅力'];
  function lookupDB(statVal){
    if(statVal>=31) return {dice:'d4',faces:4,bonus:5};
    if(statVal>=26) return {dice:'d4',faces:4,bonus:3};
    if(statVal>=21) return {dice:'d2',faces:2,bonus:3};
    if(statVal>=16) return {dice:'d2',faces:2,bonus:1};
    if(statVal>=11) return {dice:null,faces:0,bonus:1};
    return {dice:null,faces:0,bonus:0};
  }
  function evalTerm(token, unit, rolls, detail){
    token=token.trim();
    var m;
    m=token.match(/^r(?:d)?(力量|敏捷|体质|智力|精神|魅力)$/);
    if(m){
      var a=m[1]; var val=unit?(num(unit.eff[a],10)):10; if(val<1) val=1;
      var r=rollDie(val);
      rolls.push({die:'d'+val,faces:val,result:r});
      detail.push(token+'=[d'+val+'='+r+']');
      return r;
    }
    if(token==='DB'){
      var sv=unit?((unit.atkType==='magic')?num(unit.eff['智力'],10):num(unit.eff['力量'],10)):10;
      var db=lookupDB(sv); var sum=0;
      if(db.dice){ var r=rollDie(db.faces); rolls.push({die:db.dice,faces:db.faces,result:r}); sum+=r; detail.push('DB('+db.dice+'='+r+')'); }
      sum+=db.bonus; if(db.bonus) detail.push('DB+'+db.bonus); else if(!db.dice) detail.push('DB+0');
      return sum;
    }
    m=token.match(/^(\d+)d(\d+)$/);
    if(m){ var n=parseInt(m[1],10),f=parseInt(m[2],10); var sum=0; var rr=[];
      for(var i=0;i<n;i++){ var r=rollDie(f); rolls.push({die:'d'+f,faces:f,result:r}); sum+=r; rr.push(r); }
      detail.push(n+'d'+f+'=['+rr.join('+')+']'); return sum; }
    m=token.match(/^d(\d+)$/);
    if(m){ var f=parseInt(m[1],10); var r=rollDie(f); rolls.push({die:'d'+f,faces:f,result:r}); detail.push('d'+f+'='+r); return r; }
    m=token.match(/^(-?\d+)$/);
    if(m){ detail.push(m[1]); return parseInt(m[1],10); }
    return 0;
  }
  function evalExpr(s, unit){
    var rolls=[], detail=[], total=0;
    var parts=s.split('+');
    for(var i=0;i<parts.length;i++){ var p=parts[i].trim(); if(p) total+=evalTerm(p, unit, rolls, detail); }
    return {total:total, rolls:rolls, detail:detail.join(' ')};
  }
  function nebDice(expr, unit){
    var s=String(expr).trim();
    var adv=/取高/.test(s), dis=/取低/.test(s);
    s=s.replace(/取低|取高/g,'').trim();
    if(!s) s='d20';
    var r1=evalExpr(s, unit);
    var res;
    if(adv||dis){
      var r2=evalExpr(s, unit);
      if(adv){ res=r1.total>=r2.total?r1:r2; }
      else{ res=r1.total<=r2.total?r1:r2; }
      res.detail=r1.detail+' | '+r2.detail+' → 取'+(adv?'高':'低')+'='+res.total;
    } else { res=r1; }
    var crit=false, fumble=false;
    for(var i=0;i<res.rolls.length;i++){
      if(res.rolls[i].faces>1 && res.rolls[i].result===res.rolls[i].faces) crit=true;
      if(res.rolls[i].faces>1 && res.rolls[i].result===1) fumble=true;
    }
    if(crit&&fumble) fumble=false;
    return {expr:expr, total:res.total, rolls:res.rolls, detail:res.detail, crit:crit, fumble:fumble};
  }

  /* ===== derived calc ===== */
  function getBuffMod(unit, attr){
    var sum=0; (unit.buffs||[]).forEach(function(b){ if(b.target===attr && b.op==='+') sum+=num(b.val,0); });
    return sum;
  }
  function getBuffMult(unit, target){
    var m=1; (unit.buffs||[]).forEach(function(b){ if(b.target===target && b.op==='*') m*=num(b.val,1); });
    return m;
  }
  function calcDerived(unit){
    var eff={};
    ATTRS.forEach(function(k){ eff[k]=num(unit.attrs[k],10)+getBuffMod(unit,k); });
    unit.eff=eff;
    var d={};
    d.apMax=4+Math.floor((eff['敏捷']-10)/20); if(d.apMax<1) d.apMax=1;
    d.moveSpeed=Math.floor(eff['敏捷']/5);
    d.physDef=Math.floor(eff['体质']/2)+num(unit.equipBonus&&unit.equipBonus.physDef,0);
    d.mystDef=Math.floor(eff['精神']/2)+num(unit.equipBonus&&unit.equipBonus.mystDef,0);
    d.critRate=5+num(unit.equipBonus&&unit.equipBonus.crit,0);
    d.energyMax=Math.floor((num(eff['精神'],10)+num(unit.equipBonus&&unit.equipBonus.energy,0))*getBuffMult(unit,'能量值最大'));
    if(d.energyMax<1) d.energyMax=1;
    d.hpMax=num(unit.hpMaxBase,d.energyMax);
    if(unit.hp==null||unit.hp<0) unit.hp=d.hpMax;
    if(unit.hp>d.hpMax) unit.hp=d.hpMax;
    if(unit.energy==null||unit.energy<0) unit.energy=d.energyMax;
    if(unit.energy>d.energyMax) unit.energy=d.energyMax;
    unit.derived=d;
  }

  /* ===== stat_data fetch ===== */
  function fetchStatData(){
    try{
      if(typeof getChatMessages==='function' && typeof getCurrentMessageId==='function'){
        var msgs=getChatMessages(getCurrentMessageId());
        if(msgs&&msgs.length){
          for(var i=msgs.length-1;i>=0;i--){
            var m=msgs[i]; var d=(m&&m.data&&m.data.stat_data)||(m&&m.stat_data);
            if(d) return d;
          }
        }
      }
    }catch(e){}
    return null;
  }
  function getCurrentMsgId(){ try{ if(typeof getCurrentMessageId==='function') return getCurrentMessageId(); }catch(e){} return 0; }
  function getLatestUserMsgId(){
    try{
      if(typeof getChatMessages==='function' && typeof getCurrentMessageId==='function'){
        var msgs=getChatMessages(getCurrentMessageId());
        if(msgs){ for(var i=msgs.length-1;i>=0;i--){ if(msgs[i]&&msgs[i].is_user) return msgs[i].message_id||(msgs.length-i); } }
      }
    }catch(e){}
    return 0;
  }

  /* ===== combat state ===== */
  var state = loadState();
  if(!state) state = {turn:0, units:[], log:[], lastMsgId:0, active:false, targetIdx:1};

  function seedPlayer(data){
    return {
      id:'player', name:getValue(data,'主页.代号','')||getValue(data,'主页.姓名','玩家'),
      isPlayer:true,
      attrs:{
        '力量':getValue(data,'个人档案.战斗属性.力量',10),
        '敏捷':getValue(data,'个人档案.战斗属性.敏捷',10),
        '体质':getValue(data,'个人档案.战斗属性.体质',10),
        '智力':getValue(data,'个人档案.战斗属性.智力',10),
        '精神':getValue(data,'个人档案.战斗属性.精神',10),
        '魅力':getValue(data,'个人档案.战斗属性.魅力',10)
      },
      hpMaxBase:getValue(data,'个人档案.衍生属性.生命值.最大',0),
      hp:getValue(data,'个人档案.衍生属性.生命值.当前',0),
      energy:getValue(data,'个人档案.衍生属性.能量值.当前',0),
      energyType:getValue(data,'个人档案.衍生属性.能量值.类型','能量'),
      ap:4, buffs:[], cooldowns:{}, equipBonus:{physDef:0,mystDef:0,crit:0,energy:0},
      atkType:'phys', weaponType:'onehand'
    };
  }
  function makeEnemy(name,hp,str,agi,con,int,spi,cha){
    return {
      id:'e'+Date.now(), name:name||'敌人', isPlayer:false,
      attrs:{'力量':str||10,'敏捷':agi||10,'体质':con||10,'智力':int||10,'精神':spi||10,'魅力':cha||10},
      hpMaxBase:hp||30, hp:hp||30, energy:0, energyType:'能量',
      ap:4, buffs:[], cooldowns:{}, equipBonus:{physDef:0,mystDef:0,crit:0,energy:0},
      atkType:'phys', weaponType:'onehand'
    };
  }
  function updatePlayerFromData(p, data){
    ATTRS.forEach(function(k){ p.attrs[k]=getValue(data,'个人档案.战斗属性.'+k,p.attrs[k]); });
    var hpMaxNew=getValue(data,'个人档案.衍生属性.生命值.最大',0);
    if(hpMaxNew&&hpMaxNew>0) p.hpMaxBase=hpMaxNew;
    p.energyType=getValue(data,'个人档案.衍生属性.能量值.类型',p.energyType);
    calcDerived(p);
  }

  /* ===== tick (per player message = 1 turn) ===== */
  function tick(){
    state.turn++;
    state.units.forEach(function(u){
      Object.keys(u.cooldowns||{}).forEach(function(k){ u.cooldowns[k]--; if(u.cooldowns[k]<=0) delete u.cooldowns[k]; });
      (u.buffs||[]).forEach(function(b){ b.turns--; });
      u.buffs=(u.buffs||[]).filter(function(b){ return b.turns>0; });
      calcDerived(u);
      u.ap=u.derived.apMax;
    });
    addLog('—— 回合 '+state.turn+' —— AP恢复至满，冷却/buff递减 ——');
    saveState(state);
  }

  /* ===== log ===== */
  function addLog(text, cls){
    state.log.push({turn:state.turn, text:text, cls:cls||''});
    if(state.log.length>80) state.log.shift();
  }

  /* ===== inject to send box ===== */
  function cbFill(text){
    try{
      var ta=document.querySelector('#send_textarea')||(window.parent&&window.parent.document.querySelector('#send_textarea'));
      if(ta){ ta.value=text; ta.dispatchEvent(new Event('input',{bubbles:true})); ta.focus(); }
    }catch(e){ console.error(e); }
  }

  /* ===== actions ===== */
  function costAP(unit, ap){
    unit.ap-=ap; unit.hp-=ap*5;
    if(unit.hp<0) unit.hp=0;
  }
  function getTarget(){ return state.units[state.targetIdx]||state.units.find(function(u){return !u.isPlayer;}); }

  function doAttack(att){
    var def=getTarget(); if(!def){ return; }
    if(att.ap<2){ addLog('AP不足，无法攻击（需≥2）'); renderAll(); return; }
    var type=att.atkType||'phys';
    var hitExpr=(type==='magic')?'r智力':'r力量';
    var hit=nebDice(hitExpr, att);
    var dodge=nebDice('rd敏捷', def);
    var hitSuccess=hit.total>dodge.total;
    var apCost=(att.weaponType==='twohand')?3:2;
    var dmg=null, dmgDealt=0, hpBefore=def.hp;
    if(hitSuccess){
      var dmgExpr='d4+DB';
      dmg=nebDice(dmgExpr, att);
      dmgDealt=dmg.total;
      if(dmg.crit||hit.crit){ dmgDealt=dmg.total*2; }
      def.hp-=dmgDealt; if(def.hp<0) def.hp=0;
    }
    costAP(att, apCost);
    var txt=esc(att.name)+'('+type+') → '+esc(def.name)+'\n'+
      '命中 '+hit.detail+'='+hit.total+(hit.crit?' [大成功]':'')+(hit.fumble?' [大失败]':'')+'\n'+
      '闪避 '+dodge.detail+'='+dodge.total+(dodge.fumble?' [大失败]':'')+'\n'+
      '→ '+(hitSuccess?'<span class="cb-log-hit">命中</span>':'<span class="cb-log-miss">未命中</span>');
    if(hitSuccess){
      txt+='\n<span class="cb-log-dmg">伤害 '+dmg.detail+'='+dmg.total+(dmg.crit?' [大成功·翻倍='+dmgDealt+']':'')+'</span>\n'+
        esc(def.name)+' HP '+hpBefore+'→'+def.hp;
    }
    txt+='\n<span class="cb-log-ap">消耗 '+apCost+'AP / '+(apCost*5)+'HP(耐力) | '+esc(att.name)+' AP→'+att.ap+'</span>';
    addLog(txt, 'attack');
    var inject=att.name+'对'+def.name+'发动'+(type==='magic'?'法术':'物理')+'攻击。'+
      '命中='+hit.total+(hit.crit?'(大成功)':'')+(hit.fumble?'(大失败)':'')+
      '，闪避='+dodge.total+(dodge.fumble?'(大失败)':'')+
      '→'+(hitSuccess?'命中':'未命中');
    if(hitSuccess){ inject+='，伤害='+dmgDealt+(dmg.crit?'(大成功翻倍)':'')+'，'+def.name+' HP '+hpBefore+'→'+def.hp; }
    inject+='。请据此演绎战斗过程，不要自行计算数值。';
    cbFill(inject);
    saveState(state); renderAll();
  }

  function doDodge(unit){
    if(unit.ap<1){ addLog('AP不足（需≥1）'); renderAll(); return; }
    var r=nebDice('rd敏捷', unit);
    costAP(unit, 1);
    addLog(esc(unit.name)+' 闪避判定 '+r.detail+'='+r.total+(r.crit?' [大成功]':'')+(r.fumble?' [大失败]':'')+
      '\n<span class="cb-log-ap">消耗 1AP / 5HP(耐力) | AP→'+unit.ap+'</span>');
    cbFill(unit.name+'进行闪避判定，结果='+r.total+(r.crit?'(大成功)':'')+(r.fumble?'(大失败)':'')+'。请据此演绎。');
    saveState(state); renderAll();
  }

  function doParry(unit, ptype){
    if(unit.ap<1){ addLog('AP不足（需≥1）'); renderAll(); return; }
    var base=Math.floor((num(unit.eff['力量'],10)+num(unit.eff['敏捷'],10))/2);
    var r=rollDie(base);
    var crit=(r===base&&base>1), fumble=(r===1&&base>1);
    var threshold={weapon:5, shield2h:5, shield1h:8, barehand:8}[ptype]||5;
    var reduceRate={weapon:0, shield2h:0.4, shield1h:0.2, barehand:0.2}[ptype]||0;
    var label={weapon:'武器格挡', shield2h:'双手盾格挡', shield1h:'单手盾格挡', barehand:'空手格挡'}[ptype]||'格挡';
    costAP(unit,1);
    var txt=esc(unit.name)+' '+label+'判定 [d'+base+'='+r+']'+
      (crit?' [大成功]':'')+(fumble?' [大失败]':'')+
      '\n阈值: 格挡值>命中'+threshold+'点 → 完全格挡；否则减伤'+(reduceRate*100)+'%';
    if(ptype==='barehand') txt+='\n注: 空手格挡不能挡法术攻击';
    txt+='\n<span class="cb-log-ap">消耗 1AP / 5HP(耐力) | AP→'+unit.ap+'</span>';
    addLog(txt);
    cbFill(unit.name+'进行'+label+'，格挡值='+r+(crit?'(大成功)':'')+(fumble?'(大失败)':'')+
      '。若'+r+' > 对方命中值+'+threshold+'则完全格挡，否则减伤'+(reduceRate*100)+'%。请据此演绎。');
    saveState(state); renderAll();
  }

  function doMove(unit, mode){
    var apCost=(mode==='run')?2:1;
    if(unit.ap<apCost){ addLog('AP不足（需≥'+apCost+'）'); renderAll(); return; }
    var spd=Math.floor(num(unit.eff['敏捷'],10)/5);
    var dist=(mode==='run')?spd*3:spd;
    if(mode==='run'){ unit.hp-=40; if(unit.hp<0) unit.hp=0; }
    costAP(unit, apCost);
    var label=(mode==='run')?'跑步':'走路';
    addLog(esc(unit.name)+' '+label+' 移动'+dist+'米'+
      (mode==='run'?' (额外消耗40体能/HP)':'')+
      '\n<span class="cb-log-ap">消耗 '+apCost+'AP / '+((apCost*5)+(mode==='run'?40:0))+'HP(耐力) | AP→'+unit.ap+'</span>');
    cbFill(unit.name+label+'移动'+dist+'米。请据此演绎。');
    saveState(state); renderAll();
  }

  function doFreeRoll(expr, unit){
    if(!expr) return;
    var u=unit||state.units[0]||null;
    if(u) calcDerived(u);
    var r=nebDice(expr, u);
    var txt='自由投骰: '+esc(expr)+'\n'+r.detail+' = '+r.total+
      (r.crit?' [大成功]':'')+(r.fumble?' [大失败]':'');
    addLog(txt);
    cbFill('投骰('+expr+')='+r.total+(r.crit?'(大成功)':'')+(r.fumble?'(大失败)':'')+'。请据此演绎。');
    renderAll();
  }

  function addBuff(unit, name, turns, target, op, val){
    if(!unit.buffs) unit.buffs=[];
    unit.buffs.push({name:name, turns:turns, target:target, op:op, val:val});
    calcDerived(unit);
  }
  function removeBuff(unit, idx){
    if(unit.buffs&&unit.buffs[idx]!==undefined){ unit.buffs.splice(idx,1); calcDerived(unit); }
  }
  function adjustHP(unit, delta){
    unit.hp=clamp(unit.hp+delta, 0, unit.derived.hpMax);
    if(unit.hp<=0) addLog(esc(unit.name)+' HP归零！');
  }

  /* ===== render ===== */
  function getRoot(){
    var all=document.querySelectorAll('#combat-hud');
    return all.length?all[all.length-1]:null;
  }
  function bar(pct, cls){ pct=clamp(pct,0,100); return '<div class="cb-bar-track"><i class="cb-bar-fill '+cls+'" style="width:'+pct+'%"></i></div>'; }
  function apDots(cur, max){ var h=''; for(var i=0;i<max;i++){ h+='<span class="cb-ap-dot'+(i<cur?' on':'')+'"></span>'; } return h; }

  function renderUnit(u, idx){
    calcDerived(u);
    var hpPct=u.derived.hpMax>0?(u.hp/u.derived.hpMax*100):0;
    var enPct=u.derived.energyMax>0?(u.energy/u.derived.energyMax*100):0;
    var isTarget=(idx===state.targetIdx);
    var cls=u.isPlayer?'player':'enemy';
    var h='<div class="cb-unit '+cls+'" data-u="'+idx+'">'+
      '<div class="cb-unit-head"><span class="cb-unit-name">'+esc(u.name)+'</span>'+
        '<span class="cb-unit-tag">'+(u.isPlayer?'玩家':(isTarget?'目标':'敌人'))+'</span></div>';
    h+='<div class="cb-bar-line"><span class="cb-bar-label">HP</span>'+bar(hpPct, hpPct<30?'hp low':'hp')+
       '<span class="cb-bar-val">'+u.hp+'/'+u.derived.hpMax+
       '<span class="cb-hp-ctrl"><button data-hp="'+idx+'" data-d="-5">-</button><button data-hp="'+idx+'" data-d="5">+</button></span></span></div>';
    if(u.derived.energyMax>0){
      h+='<div class="cb-bar-line"><span class="cb-bar-label">'+esc(u.energyType||'能量').slice(0,2)+'</span>'+bar(enPct,'energy')+
         '<span class="cb-bar-val">'+u.energy+'/'+u.derived.energyMax+'</span></div>';
    }
    h+='<div class="cb-ap-row"><span class="cb-ap-label">AP</span>'+apDots(u.ap, u.derived.apMax)+
       '<span class="cb-ap-info">'+u.ap+'/'+u.derived.apMax+'</span></div>';
    h+='<div class="cb-attrs">';
    ATTRS.forEach(function(a){
      var base=num(u.attrs[a],10); var eff=num(u.eff[a],10);
      var bcls=''; if(eff>base) bcls='buffed'; else if(eff<base) bcls='debuffed';
      h+='<div class="cb-attr-chip '+bcls+'"><span class="n">'+a+'</span><span class="v">'+eff+(eff!==base?' ('+base+')':'')+'</span></div>';
    });
    h+='</div>';
    h+='<div class="cb-derived">'+
      '<div class="cb-derived-chip"><span class="n">物防</span><span class="v">'+u.derived.physDef+'</span></div>'+
      '<div class="cb-derived-chip"><span class="n">神防</span><span class="v">'+u.derived.mystDef+'</span></div>'+
      '<div class="cb-derived-chip"><span class="n">暴击</span><span class="v">'+u.derived.critRate+'%</span></div>'+
      '<div class="cb-derived-chip"><span class="n">移速</span><span class="v">'+u.derived.moveSpeed+'m</span></div>'+
      '</div>';
    if(u.buffs&&u.buffs.length){
      h+='<div class="cb-buffs">';
      u.buffs.forEach(function(b,bi){
        var isDeb=(b.op==='+'&&num(b.val,0)<0)||b.target==='';
        var chip=isDeb?'cb-chip-debuff':'cb-chip-buff';
        var lbl=b.name+' ('+b.turns+'回合)';
        if(b.target&&b.op&&b.val){ lbl+=' ['+b.op+''+b.val+' '+b.target+']'; }
        h+='<span class="'+chip+'" data-buff="'+idx+'" data-bi="'+bi+'" title="点击移除">'+esc(lbl)+'</span>';
      });
      h+='</div>';
    }
    var cds=Object.keys(u.cooldowns||{}).filter(function(k){ return u.cooldowns[k]>0; });
    if(cds.length){
      h+='<div class="cb-buffs">';
      cds.forEach(function(k){ h+='<span class="cb-chip-cooldown">'+esc(k)+' CD:'+u.cooldowns[k]+'</span>'; });
      h+='</div>';
    }
    if(!u.isPlayer){
      h+='<div style="margin-top:6px"><button class="cb-btn cb-btn-primary" data-target="'+idx+'" style="font-size:10px;padding:3px 8px;'+(isTarget?'border-color:var(--cb-gold);':'')+'">'+(isTarget?'当前目标':'设为目标')+'</button></div>';
    }
    h+='</div>';
    return h;
  }

  function renderActions(u){
    if(!u) return '';
    var h='<div class="cb-actions">';
    h+='<button class="cb-act-btn" data-act="attack" data-u="'+u.id+'">普通攻击<span class="cb-ap-cost">'+((u.weaponType==='twohand')?3:2)+'AP</span></button>';
    h+='<button class="cb-act-btn" data-act="dodge" data-u="'+u.id+'">闪避<span class="cb-ap-cost">1AP</span></button>';
    h+='<span class="cb-act-sep"></span>';
    h+='<button class="cb-act-btn" data-act="parry" data-pt="weapon">武器格挡<span class="cb-ap-cost">1AP</span></button>';
    h+='<button class="cb-act-btn" data-act="parry" data-pt="shield1h">单手盾<span class="cb-ap-cost">1AP</span></button>';
    h+='<button class="cb-act-btn" data-act="parry" data-pt="shield2h">双手盾<span class="cb-ap-cost">1AP</span></button>';
    h+='<button class="cb-act-btn" data-act="parry" data-pt="barehand">空手格挡<span class="cb-ap-cost">1AP</span></button>';
    h+='<span class="cb-act-sep"></span>';
    h+='<button class="cb-act-btn" data-act="move" data-mode="walk">走路<span class="cb-ap-cost">1AP</span></button>';
    h+='<button class="cb-act-btn" data-act="move" data-mode="run">跑步<span class="cb-ap-cost">2AP</span></button>';
    h+='<span class="cb-act-sep"></span>';
    h+='<button class="cb-act-btn" data-act="atktype">攻击类型: '+(u.atkType==='magic'?'法术(智力)':'物理(力量)')+'</button>';
    h+='<button class="cb-act-btn" data-act="wtype">武器: '+(u.weaponType==='twohand'?'双手(3AP)':'单手(2AP)')+'</button>';
    h+='</div>';
    return h;
  }

  function renderLog(){
    var h='<div class="cb-log" id="cb-log-box">';
    if(!state.log.length){ h+='<div class="cb-empty">暂无战斗记录</div>'; }
    else{
      state.log.slice(-30).forEach(function(e){
        h+='<div class="cb-log-entry">'+e.text+'</div>';
      });
    }
    h+='</div>';
    return h;
  }

  function renderAddEnemy(){
    var h='<div class="cb-add-enemy-row">'+
      '<div class="cb-add-enemy-field"><label>名称</label><input class="wide" id="cb-en-name" placeholder="哥布林" value=""></div>'+
      '<div class="cb-add-enemy-field"><label>HP</label><input id="cb-en-hp" value="30"></div>'+
      '<div class="cb-add-enemy-field"><label>力量</label><input id="cb-en-str" value="12"></div>'+
      '<div class="cb-add-enemy-field"><label>敏捷</label><input id="cb-en-agi" value="14"></div>'+
      '<div class="cb-add-enemy-field"><label>体质</label><input id="cb-en-con" value="10"></div>'+
      '<div class="cb-add-enemy-field"><label>智力</label><input id="cb-en-int" value="8"></div>'+
      '<div class="cb-add-enemy-field"><label>精神</label><input id="cb-en-spi" value="8"></div>'+
      '<button class="cb-btn cb-btn-primary" data-act="addenemy">添加敌人</button>'+
      '</div>';
    return h;
  }

  function renderConsole(data){
    var root=getRoot(); if(!root) return;
    var p=state.units.find(function(u){return u.isPlayer;});
    if(!p&&data){ p=seedPlayer(data); state.units.push(p); calcDerived(p); saveState(state); }
    if(p&&data) updatePlayerFromData(p, data);

    var h='<div class="cb-console">'+
      '<div class="cb-topbar">'+
        '<div class="cb-topbar-title">⚔ 战斗控制台 <span class="cb-turn-badge">回合 '+state.turn+'</span></div>'+
        '<div class="cb-topbar-btns">'+
          '<button class="cb-btn cb-btn-primary" data-act="nextturn">下一回合</button>'+
          '<button class="cb-btn" data-act="addbuff">施加状态</button>'+
          '<button class="cb-btn cb-btn-danger" data-act="endcombat">结束战斗</button>'+
        '</div>'+
      '</div><div class="cb-body">';

    h+='<div class="cb-unit-grid">';
    state.units.forEach(function(u,i){ h+=renderUnit(u,i); });
    h+='</div>';

    var activeUnit=state.units[0]||p;
    h+=renderActions(activeUnit);

    h+='<div class="cb-section"><div class="cb-section-title">投骰台（表达式：r力量 / rd敏捷 / d20 / 3d6 / d4+DB / 取低 / 取高）</div>'+
      '<div class="cb-dice-input"><input id="cb-dice-expr" placeholder="例如：r力量 或 d20+5 或 2d6" value="">'+
      '<button class="cb-btn cb-btn-primary" data-act="freeroll">投骰</button></div>'+
      '<div class="cb-dice-quick">'+
        '<button data-quick="r力量">r力量</button>'+
        '<button data-quick="rd敏捷">rd敏捷</button>'+
        '<button data-quick="r智力">r智力</button>'+
        '<button data-quick="d20">d20</button>'+
        '<button data-quick="d100">d100</button>'+
        '<button data-quick="3d6">3d6</button>'+
        '<button data-quick="d4+DB">d4+DB</button>'+
        '<button data-quick="r力量 取低">r力量 取低</button>'+
        '<button data-quick="r力量 取高">r力量 取高</button>'+
      '</div></div>';

    h+='<div class="cb-section"><div class="cb-section-title">添加敌人</div>'+renderAddEnemy()+'</div>';

    h+=renderLog();
    h+='</div></div>';
    root.innerHTML=h;
    var logBox=document.getElementById('cb-log-box');
    if(logBox) logBox.scrollTop=logBox.scrollHeight;
  }

  function renderBar(data){
    var root=getRoot(); if(!root) return;
    var pName='';
    if(data) pName=getValue(data,'主页.代号','')||getValue(data,'主页.姓名','')||'';
    var h='<div class="cb-bar" data-act="startcombat">'+
      '<div class="cb-bar-title">⚔ 战斗控制台'+(pName?(' · '+esc(pName)):'')+'</div>'+
      '<div class="cb-bar-sub">点击开始战斗 →</div>'+
    '</div>';
    root.innerHTML=h;
  }

  function renderAll(){
    var root=getRoot(); if(!root) return;
    var data=fetchStatData();
    if(!state.active){ renderBar(data); return; }
    renderConsole(data);
  }

  /* ===== event handling (document delegation) ===== */
  function findUnitById(id){ return state.units.find(function(u){return u.id===id;}); }
  function findUnitByAttr(attr, val){
    var el=event.target.closest('[data-'+attr+']'); if(!el) return null;
    return el.getAttribute('data-'+attr);
  }

  function handleClick(e){
    var t=e.target;
    var actEl=t.closest('[data-act]');
    if(!actEl) return;
    var act=actEl.getAttribute('data-act');

    if(act==='startcombat'){
      var data=fetchStatData();
      state={turn:1, units:[], log:[], lastMsgId:getLatestUserMsgId(), active:true, targetIdx:1};
      if(data){ var p=seedPlayer(data); calcDerived(p); state.units.push(p); }
      else { state.units.push(makeEnemy('玩家',40,12,12,12,12,12,12)); state.units[0].isPlayer=true; state.units[0].id='player'; state.units[0].name='玩家'; }
      addLog('—— 战斗开始 · 回合 1 ——');
      saveState(state); renderAll();
      return;
    }
    if(act==='endcombat'){
      addLog('—— 战斗结束 ——');
      clearState(); state={turn:0,units:[],log:[],lastMsgId:0,active:false,targetIdx:1};
      renderAll(); return;
    }
    if(act==='nextturn'){ tick(); renderAll(); return; }
    if(act==='attack'){
      var uid=actEl.getAttribute('data-u'); var u=findUnitById(uid); if(u) doAttack(u); return;
    }
    if(act==='dodge'){ var u=findUnitById(actEl.getAttribute('data-u')); if(u) doDodge(u); return; }
    if(act==='parry'){ doParry(state.units[0], actEl.getAttribute('data-pt')); return; }
    if(act==='move'){ doMove(state.units[0], actEl.getAttribute('data-mode')); return; }
    if(act==='freeroll'){
      var input=document.getElementById('cb-dice-expr');
      var expr=input?input.value:'d20';
      doFreeRoll(expr, state.units[0]); return;
    }
    if(act==='atktype'){
      var u=state.units[0]; if(u){ u.atkType=(u.atkType==='magic'?'phys':'magic'); saveState(state); renderAll(); } return;
    }
    if(act==='wtype'){
      var u=state.units[0]; if(u){ u.weaponType=(u.weaponType==='twohand'?'onehand':'twohand'); saveState(state); renderAll(); } return;
    }
    if(act==='addenemy'){
      var name=(document.getElementById('cb-en-name')||{}).value||'敌人';
      var hp=parseInt((document.getElementById('cb-en-hp')||{}).value||'30',10);
      var str=(document.getElementById('cb-en-str')||{}).value;
      var agi=(document.getElementById('cb-en-agi')||{}).value;
      var con=(document.getElementById('cb-en-con')||{}).value;
      var int=(document.getElementById('cb-en-int')||{}).value;
      var spi=(document.getElementById('cb-en-spi')||{}).value;
      var cha=(document.getElementById('cb-en-spi')||{}).value;
      var en=makeEnemy(name,hp,str,agi,con,int,spi,cha); calcDerived(en); state.units.push(en);
      state.targetIdx=state.units.length-1;
      addLog(esc(name)+' 加入战场 (HP '+hp+')');
      saveState(state); renderAll(); return;
    }
    if(act==='addbuff'){ openBuffModal(); return; }
  }

  function handleHp(e){
    var el=e.target.closest('[data-hp]'); if(!el) return;
    var idx=parseInt(el.getAttribute('data-hp'),10);
    var d=parseInt(el.getAttribute('data-d'),10);
    if(state.units[idx]){ adjustHP(state.units[idx], d); saveState(state); renderAll(); }
  }
  function handleTarget(e){
    var el=e.target.closest('[data-target]'); if(!el) return;
    state.targetIdx=parseInt(el.getAttribute('data-target'),10); saveState(state); renderAll();
  }
  function handleBuff(e){
    var el=e.target.closest('[data-buff]'); if(!el) return;
    var idx=parseInt(el.getAttribute('data-buff'),10);
    var bi=parseInt(el.getAttribute('data-bi'),10);
    if(state.units[idx]){ removeBuff(state.units[idx], bi); saveState(state); renderAll(); }
  }
  function handleQuick(e){
    var el=e.target.closest('[data-quick]'); if(!el) return;
    var expr=el.getAttribute('data-quick');
    var input=document.getElementById('cb-dice-expr'); if(input) input.value=expr;
    doFreeRoll(expr, state.units[0]);
  }

  function openBuffModal(){
    var root=getRoot(); if(!root) return;
    var overlay=document.createElement('div'); overlay.className='cb-modal-bg';
    var unitOpts=state.units.map(function(u,i){ return '<option value="'+i+'">'+esc(u.name)+'</option>'; }).join('');
    overlay.innerHTML='<div class="cb-modal">'+
      '<div class="cb-modal-title">施加 Buff / Debuff</div>'+
      '<div class="cb-modal-field"><label>目标单位</label><select id="cb-mf-unit">'+unitOpts+'</select></div>'+
      '<div class="cb-modal-field"><label>状态名称</label><input id="cb-mf-name" placeholder="如：力量增幅 / 中毒"></div>'+
      '<div class="cb-modal-field"><label>持续回合</label><input id="cb-mf-turns" value="3"></div>'+
      '<div class="cb-modal-field"><label>作用属性</label><select id="cb-mf-target">'+
        '<option value="">（仅标记，不加属性）</option>'+
        '<option value="力量">力量</option><option value="敏捷">敏捷</option>'+
        '<option value="体质">体质</option><option value="智力">智力</option>'+
        '<option value="精神">精神</option><option value="魅力">魅力</option>'+
        '<option value="能量值最大">能量值最大(×)</option>'+
        '<option value="HP">HP(直接)</option>'+
      '</select></div>'+
      '<div class="cb-modal-field"><label>运算</label><select id="cb-mf-op">'+
        '<option value="+">+ (加法，可为负)</option>'+
        '<option value="*">× (乘法，如2=翻倍)</option>'+
      '</select></div>'+
      '<div class="cb-modal-field"><label>数值</label><input id="cb-mf-val" value="10"></div>'+
      '<div class="cb-modal-btns"><button class="cb-btn" id="cb-mf-cancel">取消</button><button class="cb-btn cb-btn-primary" id="cb-mf-ok">施加</button></div>'+
    '</div>';
    root.appendChild(overlay);
    document.getElementById('cb-mf-cancel').onclick=function(){ overlay.remove(); };
    document.getElementById('cb-mf-ok').onclick=function(){
      var ui=parseInt(document.getElementById('cb-mf-unit').value,10);
      var name=document.getElementById('cb-mf-name').value||'状态';
      var turns=parseInt(document.getElementById('cb-mf-turns').value||'3',10);
      var target=document.getElementById('cb-mf-target').value;
      var op=document.getElementById('cb-mf-op').value;
      var val=document.getElementById('cb-mf-val').value;
      if(state.units[ui]){
        addBuff(state.units[ui], name, turns, target, op, val);
        addLog(esc(state.units[ui].name)+' 获得「'+esc(name)+'」('+turns+'回合)'+
          (target?(' '+op+val+' '+target):''));
        saveState(state);
      }
      overlay.remove(); renderAll();
    };
  }

  /* ===== init ===== */
  function bindOnce(){
    if(window.__cbBound) return;
    window.__cbBound=true;
    document.addEventListener('click', function(e){
      handleQuick(e); handleBuff(e); handleTarget(e); handleHp(e); handleClick(e);
    }, true);
  }

  /* ===== refresh / turn detection ===== */
  function refresh(){
    var data=fetchStatData();
    if(state.active){
      var curMsgId=getLatestUserMsgId();
      if(curMsgId>state.lastMsgId && curMsgId>0){
        tick();
        state.lastMsgId=curMsgId;
        saveState(state);
      }
    }
    renderAll();
  }

  bindOnce();
  refresh();
})();
