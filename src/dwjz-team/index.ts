import './style.css';

(function(){
  /* ===== 工具 ===== */
  function esc(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  /* ===== 好感度区间 → 百分比 ===== */
  var FAVOR_MAP = {
    '厌恶':5,'警惕':12,'冷漠':22,'中立':32,'好感':45,
    '信任':58,'亲密':70,'挚友':82,'崇拜':92,'归属':100
  };
  function favorPct(text){
    if(!text) return 0;
    for(var k in FAVOR_MAP){ if(text.indexOf(k)!==-1) return FAVOR_MAP[k]; }
    var m = text.match(/\d+/); return m ? Math.min(100,parseInt(m[0])) : 30;
  }

  /* ===== 状态 → CSS类 ===== */
  function statusClass(s){
    if(!s) return 's-other';
    if(/战斗|战|敌/.test(s)) return 's-battle';
    if(/休息|睡|恢复|静/.test(s)) return 's-rest';
    if(/正常|健康|待机/.test(s)) return 's-normal';
    return 's-other';
  }

  /* ===== 解析一行 ===== */
  function parseLine(line){
    var m = line.match(/\[([^\]]+)\]/);
    if(!m) return null;
    var parts = m[1].split('|').map(function(p){ return p.replace(/\{\{|\}\}/g,'').trim(); });
    if(parts.length < 2) return null;
    return {
      name:    parts[0]||'未知',
      gender:  parts[1]||'',
      rank:    parts[2]||'',
      faction: parts[3]||'',
      enhance: parts[4]||'',
      favor:   parts[5]||'',
      location:parts[6]||'',
      status:  parts[7]||''
    };
  }

  /* ===== 渲染单卡 ===== */
  function renderCard(p){
    var pct = favorPct(p.favor);
    var sc  = statusClass(p.status);
    return '<div class="neb-card" data-faction="'+esc(p.faction)+'">' +
      '<div class="neb-card-head">' +
        '<span class="neb-card-name">'+esc(p.name)+'</span>' +
        '<span class="neb-card-gender">'+esc(p.gender)+'</span>' +
      '</div>' +
      row('阶　　位', '<span class="neb-badge">'+esc(p.rank)+'</span>') +
      row('阵　　营', esc(p.faction)) +
      row('强化等级', esc(p.enhance)) +
      '<div class="neb-row"><span class="k">主神好感</span>' +
        '<div class="neb-bar-wrap">' +
          '<span class="v">'+esc(p.favor)+'</span>' +
          '<div class="neb-bar"><i style="width:'+pct+'%"></i></div>' +
        '</div></div>' +
      '<div class="neb-row"><span class="k">当前位置</span>' +
        '<span class="neb-location">📍 '+esc(p.location)+'</span></div>' +
      '<div class="neb-row"><span class="k">当前状态</span>' +
        '<span class="v"><i class="neb-status-dot '+sc+'"></i>'+esc(p.status)+'</span></div>' +
    '</div>';
  }
  function row(k,v){
    return '<div class="neb-row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>';
  }

  /* ===== 主逻辑 ===== */
  function init(){
    var raw = (document.getElementById('stu-raw')||{}).textContent||'';
    var lines = raw.split('\n');
    var persons = [];
    lines.forEach(function(line){
      var p = parseLine(line.trim());
      if(p) persons.push(p);
    });

    var summary = document.getElementById('neb-summary');
    var filtersEl = document.getElementById('neb-filters');
    var grid = document.getElementById('neb-grid');

    if(!persons.length){
      summary.textContent = '暂无轮回者数据';
      grid.innerHTML = '<div class="neb-empty">矩阵中未检测到轮回者信息</div>';
      return;
    }

    /* 统计 */
    var factionSet = {};
    persons.forEach(function(p){ factionSet[p.faction] = (factionSet[p.faction]||0)+1; });
    var factionNames = Object.keys(factionSet);

    summary.innerHTML =
      '<span><i class="neb-led"></i>轮回者总数: <b>'+persons.length+'</b></span>' +
      factionNames.map(function(f){
        return '<span>'+esc(f)+': <b>'+factionSet[f]+'</b></span>';
      }).join('');

    /* 筛选按钮 */
    var currentFilter = 'all';
    function buildFilters(){
      var html = '<button class="neb-filter-btn active" data-f="all">全部</button>';
      factionNames.forEach(function(f){
        html += '<button class="neb-filter-btn" data-f="'+esc(f)+'">'+esc(f)+'</button>';
      });
      filtersEl.innerHTML = html;
      filtersEl.querySelectorAll('.neb-filter-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          currentFilter = btn.dataset.f;
          filtersEl.querySelectorAll('.neb-filter-btn').forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
          applyFilter();
        });
      });
    }

    function applyFilter(){
      grid.querySelectorAll('.neb-card').forEach(function(card){
        var show = currentFilter==='all' || card.dataset.faction===currentFilter;
        card.style.display = show ? '' : 'none';
      });
    }

    /* 渲染卡片 */
    grid.innerHTML = persons.map(renderCard).join('');
    buildFilters();

    /* 折叠按钮 */
    document.getElementById('neb-collapse-btn').addEventListener('click', function(){
      document.getElementById('nebula-hud').classList.toggle('collapsed');
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
