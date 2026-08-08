import './style.css';

(function(){
  if(window.__nebulaHudInit) return;
  window.__nebulaHudInit = true;

  function getValue(data, path, def){
    if(def===undefined) def='-';
    if(!data) return def;
    try{
      var keys=String(path).split('.'), cur=data;
      for(var i=0;i<keys.length;i++){
        if(cur===null||typeof cur!=='object') return def;
        var idx=parseInt(keys[i],10);
        cur=(Array.isArray(cur)&&!isNaN(idx))?cur[idx]:cur[keys[i]];
      }
      if(Array.isArray(cur)&&cur.length>0 &&
         path.indexOf('列表')===-1 && path.indexOf('目标')===-1 &&
         path.indexOf('分组')===-1 && path.indexOf('分类')===-1){
        return cur[0];
      }
      return (cur!==undefined&&cur!==null)?cur:def;
    }catch(e){ return def; }
  }
  function getRaw(data, path, d){
    if(d===undefined) d=null;
    if(!data) return d;
    try{
      var keys=String(path).split('.'), cur=data;
      for(var i=0;i<keys.length;i++){
        if(cur===null||typeof cur!=='object') return d;
        var idx=parseInt(keys[i],10);
        cur=(Array.isArray(cur)&&!isNaN(idx))?cur[idx]:cur[keys[i]];
      }
      return (cur!==undefined&&cur!==null)?cur:d;
    }catch(e){ return d; }
  }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function num(v,d){ var n=parseFloat(v); return isNaN(n)?(d||0):n; }

  window.nebFill=function(text){
    try{
      var ta=document.querySelector('#send_textarea')||
        (window.parent&&window.parent.document.querySelector('#send_textarea'));
      if(ta){ ta.value=text; ta.dispatchEvent(new Event('input',{bubbles:true})); ta.focus(); }
    }catch(e){ console.error(e); }
  };

  function kv(k,v){ return '<div class="neb-kv"><span class="k">'+esc(k)+'</span><span class="v">'+esc(v)+'</span></div>'; }
  function stat(n,l){ return '<div class="neb-stat"><div class="num">'+esc(n)+'</div><div class="label">'+esc(l)+'</div></div>'; }
  function attr(n,v){ return '<div class="neb-attr"><div class="an">'+esc(n)+'</div><div class="av">'+esc(v)+'</div></div>'; }
  function bar(pct,neg){ pct=Math.max(0,Math.min(100,pct)); return '<div class="neb-bar'+(neg?' neg':'')+'"><i style="width:'+pct+'%"></i></div>'; }

  /* ===== 主页 ===== */
  function renderHome(d){
    var avatar=getValue(d,'主页.头像','');
    var favNum=getValue(d,'主页.所属主神好感度.数值',0);
    var favTxt=getValue(d,'主页.所属主神好感度.文本','');
    var kpi=num(getValue(d,'主页.KPI进度.百分比',0));
    var kpiTime=getValue(d,'主页.KPI进度.剩余时间描述','');
    var groups=getRaw(d,'任务与日志.任务列表.分组',[]);
    var qc=0;
    if(Array.isArray(groups)) groups.forEach(function(g){ var it=getRaw(g,'条目',[]); if(Array.isArray(it)) qc+=it.length; });
    var status=getValue(d,'主页.当前状态','健康');
    var led=status==='健康'?'led-green':(status==='危险'?'led-red':'led-yellow');
    var avatarTag=(avatar&&avatar!=='-')?'<img class="neb-avatar-lg" src="'+esc(avatar)+'" alt="">':'<div class="neb-avatar-lg"></div>';

    // 第一个卡片：左侧每项一行，右侧大头像
    var head='<div class="neb-card"><div class="neb-home-head"><div class="neb-home-info">'+
      kv('代号',getValue(d,'主页.代号'))+
      kv('姓名',getValue(d,'主页.姓名'))+
      kv('阶位',getValue(d,'主页.阶位'))+
      kv('强化等级',getValue(d,'主页.强化等级'))+
      kv('阵营',getValue(d,'主页.阵营'))+
      kv('主神好感',favNum+' ['+favTxt+']')+
      '</div>'+avatarTag+'</div></div>';

    // KPI 卡片可翻转，背面显示剩余时间描述
    var kpiCard='<div class="neb-flip neb-stat-flip neb-foldable neb-kpi"><div class="neb-flip-inner">'+
      '<div class="neb-flip-face neb-flip-front"><div class="num">'+kpi+'%</div><div class="label">KPI进度</div></div>'+
      '<div class="neb-flip-face neb-flip-back"><div class="num">'+esc(kpiTime||'暂无')+'</div><div class="label">剩余时间</div></div>'+
    '</div></div>';

    return head+
      '<div class="neb-grid4">'+
        stat(getValue(d,'主页.积分余额',0),'积分余额')+
        kpiCard+
        stat(qc,'当前任务')+
        stat(getValue(d,'个人档案.履历数据.通关副本数',0),'通关副本')+
      '</div>'+
      '<div class="neb-statusbar">'+
        '<span class="neb-pill"><i class="neb-led '+led+'"></i>状态: '+esc(status)+'</span>'+
      '</div>';
  }

  /* ===== 个人档案 ===== */
  function renderProfile(d){
    var infoTable='<table class="neb-itable"><tr><th>性别</th><th>年龄</th><th>所在地</th></tr>'+
      '<tr><td>'+esc(getValue(d,'个人档案.基础信息.性别'))+'</td>'+
      '<td>'+esc(getValue(d,'个人档案.基础信息.年龄'))+'</td>'+
      '<td>'+esc(getValue(d,'个人档案.基础信息.现实世界所在地'))+'</td></tr></table>'+
      '<div class="neb-iblock"><div class="ib-label">首次进入矩阵时间</div>'+
      '<div class="ib-val">'+esc(getValue(d,'个人档案.基础信息.首次进入矩阵时间'))+'</div></div>';

    var attrs=['力量','敏捷','体质','智力','精神','魅力'];
    var attrHtml=attrs.map(function(a){ return attr(a,getValue(d,'个人档案.战斗属性.'+a,0)); }).join('');

    var hpCur=num(getValue(d,'个人档案.衍生属性.生命值.当前',0));
    var hpMax=num(getValue(d,'个人档案.衍生属性.生命值.最大',0),0);
    var epCur=num(getValue(d,'个人档案.衍生属性.能量值.当前',0));
    var epMax=num(getValue(d,'个人档案.衍生属性.能量值.最大',1),1);
    var epType=getValue(d,'个人档案.衍生属性.能量值.类型','能量');

    var cStr=num(getValue(d,'个人档案.战斗属性.力量',10));
    var cAgi=num(getValue(d,'个人档案.战斗属性.敏捷',10));
    var cCon=num(getValue(d,'个人档案.战斗属性.体质',10));
    var cInt=num(getValue(d,'个人档案.战斗属性.智力',10));
    var cSpi=num(getValue(d,'个人档案.战斗属性.精神',10));
    var calcPhysDef=Math.floor(cCon/2);
    var calcMystDef=Math.floor(cSpi/2);
    var calcCrit=5;
    var calcMove=Math.floor(cAgi/5);
    var calcEpMax=num(getValue(d,'个人档案.衍生属性.能量值.最大',0),0); if(calcEpMax<1) calcEpMax=num(cSpi,1);

    var skills=getRaw(d,'个人档案.强化与技能.技能列表',{});
    var skillHtml='';
    if(skills&&typeof skills==='object'){
      Object.keys(skills).forEach(function(name){
        var s=skills[name];
        skillHtml+='<div class="neb-flip neb-skill neb-foldable"><div class="neb-flip-inner">'+
          '<div class="neb-flip-face neb-flip-front"><div class="sn">'+esc(name)+'</div>'+
            '<div class="sl">'+esc(getValue(s,'等级',''))+'</div></div>'+
          '<div class="neb-flip-face neb-flip-back"><b>'+esc(name)+'</b>'+
            '<div style="margin-top:4px">'+esc(getValue(s,'描述',''))+'</div>'+
            '<div style="margin-top:4px;color:var(--neb-text-soft)">'+esc(getValue(s,'冷却/消耗',''))+'</div></div>'+
        '</div></div>';
      });
    }
    if(!skillHtml) skillHtml='<div class="neb-empty">暂无技能</div>';

    return '<div class="neb-card"><div class="neb-card-title">基础信息</div>'+infoTable+'</div>'+
      '<div class="neb-card"><div class="neb-card-title">战斗属性</div><div class="neb-attr-grid">'+attrHtml+'</div></div>'+
      '<div class="neb-card"><div class="neb-card-title">衍生属性 <span style="font-size:11px;font-weight:400;color:var(--neb-text-soft)">（公式自算）</span></div>'+
        '<div class="neb-kv"><span class="k">生命值(耐力)</span><span class="v">'+hpCur+'/'+hpMax+'</span>'+bar(hpCur/hpMax*100)+'</div>'+
        '<div class="neb-kv" style="margin-top:10px"><span class="k">能量('+esc(epType)+')</span><span class="v">'+epCur+'/'+calcEpMax+'</span>'+bar(calcEpMax>0?epCur/calcEpMax*100:0)+'</div>'+
        '<div class="neb-attr-grid" style="margin-top:14px">'+
          attr('物理防御',calcPhysDef+'')+
          attr('神秘防御',calcMystDef+'')+
          attr('暴击率',calcCrit+'%')+
          attr('移动速度',calcMove+'m')+
        '</div>'+
        '<div style="font-size:10px;color:var(--neb-text-soft);margin-top:8px;line-height:1.6">'+
          '物防=体质÷2 ('+cCon+'÷2='+calcPhysDef+') · '+
          '神防=精神÷2 ('+cSpi+'÷2='+calcMystDef+') · '+
          '暴击=5%基础 · '+
          '移速=敏捷÷5 ('+cAgi+'÷5='+calcMove+'m) · '+
          '能量上限=精神 ('+cSpi+')'+
        '</div></div>'+
      '<div class="neb-card"><div class="neb-card-title">强化与技能</div>'+
        kv('主强化类型',getValue(d,'个人档案.强化与技能.主强化类型'))+
        kv('强化名称',getValue(d,'个人档案.强化与技能.强化名称'))+
        kv('强化等级',getValue(d,'个人档案.强化与技能.强化等级'))+
        kv('洗点冷却剩余',getValue(d,'个人档案.强化与技能.洗点冷却剩余'))+
        '<div class="neb-skill-grid" style="margin-top:12px">'+skillHtml+'</div></div>'+
      '<div class="neb-card"><div class="neb-card-title">履历数据</div><div class="neb-attr-grid">'+
        attr('完成任务',getValue(d,'个人档案.履历数据.总完成任务数',0))+
        attr('击杀轮回者',getValue(d,'个人档案.履历数据.总击杀轮回者数',0))+
        attr('累计积分',getValue(d,'个人档案.履历数据.总获得积分',0))+
        attr('死亡次数',getValue(d,'个人档案.履历数据.死亡次数',0))+
        attr('主神保人',getValue(d,'个人档案.履历数据.主神保人次数',0))+
        attr('通关副本',getValue(d,'个人档案.履历数据.通关副本数',0))+
      '</div></div>';
  }

  /* ===== 任务 ===== */
  var questState={ list:[] };
  function renderQuest(d){
    var groups=getRaw(d,'任务与日志.任务列表.分组',[]);
    questState.list=[];
    var groupHtml='';
    if(Array.isArray(groups)){
      groups.forEach(function(g,gi){
        var gname=getValue(g,'组名','任务');
        var items=getRaw(g,'条目',[]);
        var inner='';
        if(Array.isArray(items)&&items.length){
          items.forEach(function(it){
            var idx=questState.list.length; questState.list.push(it);
            inner+='<div class="neb-list-item neb-quest-item" data-q="'+idx+'">'+
              '<b>'+esc(getValue(it,'任务名称','未命名'))+'</b> <span class="neb-badge">'+esc(getValue(it,'难度','-'))+'</span>'+
              '<div class="neb-empty" style="padding:2px 0">进度 '+esc(getValue(it,'进度百分比','0%'))+'</div></div>';
          });
        } else { inner='<div class="neb-empty">（空）</div>'; }
        groupHtml+='<div class="neb-group'+(gi===0?' open':'')+'"><div class="neb-group-head neb-qgroup">'+
          '<span class="arrow">▶</span>'+esc(gname)+' <span style="color:var(--neb-text-soft);font-weight:400">('+(Array.isArray(items)?items.length:0)+')</span></div>'+
          '<div class="neb-group-body">'+inner+'</div></div>';
      });
    }
    if(!groupHtml) groupHtml='<div class="neb-empty">暂无任务</div>';

    return '<div class="neb-card"><div class="neb-card-title">任务列表</div>'+groupHtml+'</div>'+
      '<div class="neb-card neb-detail" id="neb-quest-detail"></div>';
  }
  function questItemCard(it){
    return '<button class="neb-detail-close" id="neb-quest-close">×</button>'+
      '<div class="neb-card-title">任务详情</div>'+
      kv('任务名称',getValue(it,'任务名称'))+
      kv('难度',getValue(it,'难度'))+
      kv('进度',getValue(it,'进度百分比'));
  }

  /* ===== 任务世界 ===== */
  function renderWorld(d){
    var w='任务与日志.任务世界.';
    return '<div class="neb-card"><div class="neb-card-title">世界概况</div>'+
        kv('世界名称',getValue(d,w+'世界名称'))+
        kv('世界类型',getValue(d,w+'世界类型'))+
        kv('阵营倾向',getValue(d,w+'阵营倾向'))+
        kv('当前难度等级',getValue(d,w+'当前难度等级'))+
        kv('时间流速',getValue(d,w+'时间流速'))+
        kv('世界意志状态',getValue(d,w+'世界意志状态'))+
      '</div>'+
      '<div class="neb-card"><div class="neb-card-title">主线与掌控</div>'+
        kv('主线任务提示',getValue(d,w+'主线任务提示'))+
        kv('掌控度描述',getValue(d,w+'掌控度描述'))+
      '</div>'+
      '<div class="neb-card"><div class="neb-card-title">世界描述</div>'+
        '<div style="font-size:13px;line-height:1.8">'+esc(getValue(d,w+'世界描述'))+'</div>'+
      '</div>';
  }

  /* ===== 日志情报 ===== */
  function renderLog(d){
    var subs=getRaw(d,'任务与日志.日志情报.子页面',[]);
    var html='';
    if(Array.isArray(subs)){
      subs.forEach(function(sp){
        var name=getValue(sp,'名称','记录');
        var list=getRaw(sp,'内容列表',null);
        var cats=getRaw(sp,'按世界分类',null);
        var body='';
        if(Array.isArray(list)&&list.length){
          list.forEach(function(x){ body+='<div class="neb-list-item">'+esc(typeof x==='object'?JSON.stringify(x):x)+'</div>'; });
        } else if(Array.isArray(cats)&&cats.length){
          cats.forEach(function(x){ body+='<div class="neb-list-item">'+esc(typeof x==='object'?JSON.stringify(x):x)+'</div>'; });
        } else { body='<div class="neb-empty">暂无记录</div>'; }
        html+='<div class="neb-card"><div class="neb-card-title">'+esc(name)+'</div><div class="neb-list">'+body+'</div></div>';
      });
    }
    if(!html) html='<div class="neb-card"><div class="neb-empty">暂无日志情报</div></div>';
    return html;
  }

  /* ===== 阵营关系 ===== */
  function renderFaction(d){
    var favRaw=getRaw(d,'阵营关系.轮回者与其他阵营好感度',{});
    var facHtml='';
    if(favRaw&&typeof favRaw==='object'){
      Object.keys(favRaw).forEach(function(name){
        var v=favRaw[name], n=num(v,0);
        facHtml+='<div class="neb-fac"><div class="fn"><span>'+esc(name)+'</span><span class="v">'+esc(v)+'</span></div>'+
          bar(Math.min(100,Math.abs(n)), n<0)+'</div>';
      });
    }
    if(!facHtml) facHtml='<div class="neb-empty">暂无数据</div>';

    var rels=getRaw(d,'阵营关系.阵营之间的关系（矩阵公开情报）',[]);
    var relHtml='';
    if(Array.isArray(rels)) rels.forEach(function(r){
      relHtml+='<div class="neb-list-item"><b>'+esc(getValue(r,'阵营A'))+'</b> ←'+esc(getValue(r,'关系状态'))+'→ <b>'+esc(getValue(r,'阵营B'))+'</b>'+
        '<div class="neb-empty" style="padding:2px 0">'+esc(getValue(r,'备注',''))+'</div></div>';
    });
    if(!relHtml) relHtml='<div class="neb-empty">暂无公开情报</div>';

    var marks=getRaw(d,'阵营关系.当前主神标记与仇恨.被哪些主神标记',[]);
    var markTxt=(Array.isArray(marks)&&marks.length)?marks.join('、'):'无';
    var hunted=getValue(d,'阵营关系.当前主神标记与仇恨.被追杀状态','否');

    return '<div class="neb-card"><div class="neb-card-title">阵营好感度</div><div class="neb-fac-grid">'+facHtml+'</div></div>'+
      '<div class="neb-card"><div class="neb-card-title">阵营之间关系</div><div class="neb-list">'+relHtml+'</div></div>'+
      '<div class="neb-card"><div class="neb-card-title">主神标记与仇恨</div>'+
        kv('被标记主神',markTxt)+
        kv('标记效果',getValue(d,'阵营关系.当前主神标记与仇恨.标记效果'))+
        '<div class="neb-kv"><span class="k">追杀状态</span><span class="v '+(hunted!=='否'?'neb-warn':'')+'">'+esc(hunted)+'</span></div></div>';
  }

  /* ===== 背包 ===== */
  var bagState={ list:[] };
  function renderBag(d){
    var items=getRaw(d,'背包与商城.背包.物品列表',{});
    bagState.list=[];
    var listHtml='';
    if(items&&typeof items==='object'&&Object.keys(items).length){
      Object.keys(items).forEach(function(name){
        var idx=bagState.list.length; bagState.list.push({name:name,info:items[name]});
        listHtml+='<div class="neb-list-item neb-bag-item" data-b="'+idx+'"><b>'+esc(name)+'</b></div>';
      });
    } else { listHtml='<div class="neb-empty">背包空空如也</div>'; }
    var cap=getValue(d,'背包与商城.背包.容量','0 / 20');

    var quick=getRaw(d,'背包与商城.背包.快捷栏',{});
    var slotHtml='';
    for(var i=1;i<=6;i++){ var v=getValue(quick,String(i),''); slotHtml+='<div class="neb-slot">'+(v&&v!=='-'?esc(v):i)+'</div>'; }

    return '<div class="neb-card"><div class="neb-card-title">快捷栏</div><div class="neb-slots">'+slotHtml+'</div></div>'+
      '<div class="neb-split">'+
        '<div><div class="neb-list" id="neb-bag-list">'+listHtml+'</div>'+
          '<div class="neb-empty" style="margin-top:10px">容量: '+esc(cap)+'</div></div>'+
        '<div class="neb-card neb-detail" id="neb-bag-detail"></div>'+
      '</div>';
  }
  function bagDetailCard(item){
    var info=item.info||{};
    return '<button class="neb-detail-close" id="neb-bag-close">×</button>'+
      '<div class="neb-card-title">物品详情</div>'+
      kv('名称',item.name)+kv('类型',getValue(info,'类型'))+
      kv('价格',getValue(info,'价格'))+kv('限制',getValue(info,'限制'))+
      kv('描述',getValue(info,'描述'))+
      '<div class="neb-actions">'+
        '<button class="neb-btn" onclick="nebFill(\'使用 '+esc(item.name)+'\')">使用</button>'+
        '<button class="neb-btn" onclick="nebFill(\'装备 '+esc(item.name)+'\')">装备</button>'+
        '<button class="neb-btn" onclick="nebFill(\'丢弃 '+esc(item.name)+'\')">丢弃</button>'+
      '</div>';
  }

  /* ===== 商城 ===== */
  var shopState={ list:[] };
  function renderShop(d){
    var balance=getValue(d,'背包与商城.商城.积分余额',0);

    var shop=getRaw(d,'背包与商城.商城.商品列表',{});
    shopState.list=[];
    var shopList='';
    if(shop&&typeof shop==='object'&&Object.keys(shop).length){
      Object.keys(shop).forEach(function(name){
        var idx=shopState.list.length; shopState.list.push({name:name,info:shop[name]});
        shopList+='<div class="neb-list-item neb-shop-item" data-s="'+idx+'"><b>'+esc(name)+'</b> <span class="neb-badge">'+esc(getValue(shop[name],'价格',0))+'积分</span></div>';
      });
    } else { shopList='<div class="neb-empty">暂无商品</div>'; }

    var facUnlock=getRaw(d,'背包与商城.商城.阵营商店（仅当有阵营时显示）.解锁商品列表',[]);
    var facLevel=getValue(d,'主页.所属主神好感度.文本','-');
    var facHtml='';
    if(Array.isArray(facUnlock)&&facUnlock.length){
      facUnlock.forEach(function(x){ facHtml+='<div class="neb-list-item">'+esc(typeof x==='object'?JSON.stringify(x):x)+'</div>'; });
    } else { facHtml='<div class="neb-empty">当前好感度未解锁任何商品</div>'; }

    var realHtml=kv('兑换比例',getValue(d,'背包与商城.商城.现实通道.兑换比例'))+
      kv('当前可兑换上限',getValue(d,'背包与商城.商城.现实通道.当前可兑换上限'))+
      kv('下次强制召回时间',getValue(d,'背包与商城.商城.现实通道.下次强制召回时间'))+
      '<div class="neb-actions"><button class="neb-btn" onclick="nebFill(\'兑换现实时间\')">兑换现实时间</button></div>';

    return '<div class="neb-card"><div class="neb-card-title">积分余额：'+esc(balance)+'</div>'+
      '<div class="neb-subtabs" id="neb-shop-subtabs">'+
        '<div class="neb-subtab active" data-sub="normal">普通商城</div>'+
        '<div class="neb-subtab" data-sub="faction">阵营商店</div>'+
        '<div class="neb-subtab" data-sub="real">现实通道</div>'+
      '</div>'+
      '<div class="neb-subpage active" id="sub-normal"><div class="neb-split">'+
        '<div class="neb-list" id="neb-shop-list">'+shopList+'</div>'+
        '<div class="neb-card neb-detail" id="neb-shop-detail"></div></div></div>'+
      '<div class="neb-subpage" id="sub-faction"><div style="margin-bottom:10px">当前好感度等级：<b>'+esc(facLevel)+'</b></div><div class="neb-list">'+facHtml+'</div></div>'+
      '<div class="neb-subpage" id="sub-real">'+realHtml+'</div>'+
    '</div>';
  }
  function shopDetailCard(item){
    var info=item.info||{};
    return '<button class="neb-detail-close" id="neb-shop-close">×</button>'+
      '<div class="neb-card-title">商品详情</div>'+
      kv('名称',item.name)+kv('类型',getValue(info,'类型'))+
      kv('价格',getValue(info,'价格'))+kv('限制',getValue(info,'限制'))+
      kv('描述',getValue(info,'描述'))+
      '<div class="neb-actions"><button class="neb-btn" onclick="nebFill(\'购买 '+esc(item.name)+'\')">购买</button></div>';
  }

  /* ===== 主渲染 ===== */
  function renderHud(d){
    var pages={ home:renderHome, profile:renderProfile, quest:renderQuest,
      world:renderWorld, log:renderLog, faction:renderFaction, bag:renderBag, shop:renderShop };
    Object.keys(pages).forEach(function(k){
      try{ document.getElementById('page-'+k).innerHTML=pages[k](d); }catch(e){ console.error(k,e); }
    });
    bindDynamic();
  }

  /* ===== 事件 ===== */
  function bindStatic(){
    var root=document.getElementById('nebula-hud');
    document.getElementById('neb-tabs').addEventListener('click',function(e){
      var t=e.target.closest('.neb-tab'); if(!t) return;
      document.querySelectorAll('.neb-tab').forEach(function(x){ x.classList.remove('active'); });
      document.querySelectorAll('.neb-page').forEach(function(x){ x.classList.remove('active'); });
      t.classList.add('active');
      document.getElementById('page-'+t.dataset.page).classList.add('active');
    });
    document.getElementById('neb-collapse').addEventListener('click',function(){ root.classList.toggle('collapsed'); });

    var fsBtn=document.getElementById('neb-fullscreen-toggle');
    if(fsBtn){
      var fsKey='neb_fs_default';
      try{ var ctx=(typeof getContext==='function')?getContext():{}; fsKey='neb_fs_'+((ctx.characterId||ctx.chatId||'').toString().replace(/[^a-zA-Z0-9_-]/g,'_')); }catch(e){}
      try{ if(localStorage.getItem(fsKey)==='true'){ root.classList.add('neb-fullscreen'); addFsExit(); } }catch(e){}
      fsBtn.addEventListener('click',function(){
        var isFs=root.classList.contains('neb-fullscreen');
        if(isFs){ root.classList.remove('neb-fullscreen'); var ex=root.querySelector('.neb-fullscreen-exit'); if(ex) ex.remove(); try{localStorage.setItem(fsKey,'false');}catch(e){} }
        else{ root.classList.add('neb-fullscreen'); addFsExit(); try{localStorage.setItem(fsKey,'true');}catch(e){} }
      });
      function addFsExit(){
        if(root.querySelector('.neb-fullscreen-exit')) return;
        var ex=document.createElement('button');
        ex.className='neb-fullscreen-exit'; ex.innerHTML='×';
        ex.onclick=function(e){ e.stopPropagation(); root.classList.remove('neb-fullscreen'); ex.remove(); try{localStorage.setItem(fsKey,'false');}catch(e){} };
        root.appendChild(ex);
      }
    }

    document.querySelector('.neb-body').addEventListener('click',function(e){
      var gh=e.target.closest('.neb-qgroup');
      if(gh){ gh.parentElement.classList.toggle('open'); return; }
      var flip=e.target.closest('.neb-flip');
      if(flip){ flip.classList.toggle('flipped'); return; }
      var sub=e.target.closest('.neb-subtab');
      if(sub){
        var box=sub.closest('.neb-card');
        box.querySelectorAll('.neb-subtab').forEach(function(x){ x.classList.remove('active'); });
        box.querySelectorAll('.neb-subpage').forEach(function(x){ x.classList.remove('active'); });
        sub.classList.add('active');
        box.querySelector('#sub-'+sub.dataset.sub).classList.add('active');
        return;
      }
    });
  }
  function bindDynamic(){
    var qd=document.getElementById('neb-quest-detail');
    document.getElementById('page-quest').addEventListener('click',function(e){
      var it=e.target.closest('.neb-quest-item');
      if(it){
        document.querySelectorAll('#page-quest .neb-list-item').forEach(function(x){ x.classList.remove('active'); });
        it.classList.add('active');
        qd.innerHTML=questItemCard(questState.list[+it.dataset.q]);
        qd.classList.add('show');
        return;
      }
      if(e.target.id==='neb-quest-close'){ qd.classList.remove('show'); }
    });
    var bd=document.getElementById('neb-bag-detail');
    document.getElementById('page-bag').addEventListener('click',function(e){
      var it=e.target.closest('.neb-bag-item');
      if(it){
        document.querySelectorAll('#neb-bag-list .neb-list-item').forEach(function(x){ x.classList.remove('active'); });
        it.classList.add('active');
        bd.innerHTML=bagDetailCard(bagState.list[+it.dataset.b]);
        bd.classList.add('show');
        return;
      }
      if(e.target.id==='neb-bag-close'){ bd.classList.remove('show'); }
    });
    var sd=document.getElementById('neb-shop-detail');
    document.getElementById('page-shop').addEventListener('click',function(e){
      var it=e.target.closest('.neb-shop-item');
      if(it){
        document.querySelectorAll('#neb-shop-list .neb-list-item').forEach(function(x){ x.classList.remove('active'); });
        it.classList.add('active');
        sd.innerHTML=shopDetailCard(shopState.list[+it.dataset.s]);
        sd.classList.add('show');
        return;
      }
      if(e.target.id==='neb-shop-close'){ sd.classList.remove('show'); }
    });
  }

  /* ===== 抓取 + 重试 ===== */
  function initHud(){
    var attempts=0, maxAttempts=20;
    function fetchData(){
      attempts++;
      try{
        if(typeof getChatMessages==='function'&&typeof getCurrentMessageId==='function'){
          var messages=getChatMessages(getCurrentMessageId());
          if(messages&&messages.length>0){
            for(var i=messages.length-1;i>=0;i--){
              var msg=messages[i];
              var data=(msg&&msg.data&&msg.data.stat_data)||(msg&&msg.stat_data);
              if(data){ renderHud(data); return; }
            }
          }
        }
      }catch(e){ console.error(e); }
      if(attempts<maxAttempts){ setTimeout(fetchData,200); }
      else{ document.getElementById('page-home').innerHTML='<div class="neb-card"><div class="neb-warn">数据连接超时，请刷新或重新发送消息。</div></div>'; }
    }
    setTimeout(fetchData,100);
  }

  bindStatic();
  initHud();
})();
