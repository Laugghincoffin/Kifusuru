(function(){
  "use strict";

  /* ============ CHAT BOT ============ */
  var chatBotState = {
    apiKey: 'API-HERE',
    connected: true,
    open: true
  };

  function escapeHtml(text){
    return String(text).replace(/[&<>"']/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function appendChatBubble(role, text){
    var list = document.getElementById('chatbotMessages');
    if(!list) return;
    var item = document.createElement('div');
    item.className = 'chatbot-bubble ' + (role === 'user' ? 'user' : 'assistant');
    item.innerHTML = '<strong>' + (role === 'user' ? 'Kamu' : 'Kifu') + '</strong><p>' + escapeHtml(text) + '</p>';
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
  }

  function setChatStatus(text, isError){
    var status = document.getElementById('chatbotStatus');
    if(!status) return;
    status.textContent = text;
    status.classList.toggle('error', !!isError);
  }

  function buildChatPrompt(message){
    var days = Math.max(0, Math.floor(runwayDays()));
    var selected = STRATEGIES.filter(function(st){ return state.selected.has(st.id); }).map(function(st){ return st.title; });
    var selectedText = selected.length ? selected.join(', ') : 'belum ada';
    return [
      'Kamu adalah asisten finansial yang ramah dan praktis untuk pengguna di Indonesia.',
      'Jawab dalam bahasa Indonesia, singkat, empatik, dan fokus pada langkah praktis.',
      'Konteks pengguna:',
      '- Penghasilan bulanan: ' + fmtMoney(state.income),
      '- Pengeluaran pokok bulanan: ' + fmtMoney(state.expenses),
      '- Uang tunai saat ini: ' + fmtMoney(state.savings),
      '- Ketahanan hari ini: ' + days + ' hari',
      '- Strategi yang sudah dipilih: ' + selectedText,
      'Pertanyaan pengguna: ' + message
    ].join('\n');
  }

  async function askGemini(message){
    var key = (chatBotState.apiKey || '').trim();
    if(!key || key.indexOf('PASTE_YOUR_GEMINI_API_KEY_HERE') >= 0){
      setChatStatus('API key Gemini belum diisi oleh developer.', true);
      appendChatBubble('assistant', 'API key Gemini belum diisi di kode developer. Silakan isi dulu sebelum chat dipakai.');
      return;
    }

    setChatStatus('Menghubungi Gemini 3 flash preview…');
    appendChatBubble('assistant', 'Saya sedang menyiapkan jawaban…');

    try{
      var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + encodeURIComponent(key);
      var payload = {
        contents: [{ role:'user', parts:[{ text: buildChatPrompt(message) }] }],
        generationConfig: { temperature:0.7, maxOutputTokens:500 }
      };

      var response = await fetch(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });

      if(!response.ok){
        var errData;
        try { errData = await response.json(); } catch(e) { errData = null; }
        throw new Error(errData && errData.error && errData.error.message ? errData.error.message : 'Gagal menghubungi Gemini.');
      }

      var data = await response.json();
      var reply = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text ?
        data.candidates[0].content.parts[0].text :
        'Saya belum bisa merespons saat ini.';

      var lastAssistant = document.querySelector('#chatbotMessages .chatbot-bubble.assistant:last-child');
      if(lastAssistant) lastAssistant.remove();

      appendChatBubble('assistant', reply.replace(/\n{2,}/g, '\n').trim());
      setChatStatus('Siap. Anda bisa terus bertanya.');
      chatBotState.connected = true;
    } catch(err){
      var lastAssistant2 = document.querySelector('#chatbotMessages .chatbot-bubble.assistant:last-child');
      if(lastAssistant2) lastAssistant2.remove();
      appendChatBubble('assistant', 'Maaf, ada masalah saat menghubungi Gemini: ' + err.message);
      setChatStatus('Gagal terhubung. Periksa API key dan coba lagi.', true);
    }
  }

  function setupChatbot(){
    var fab = document.getElementById('chatbotFab');
    var panel = document.getElementById('chatbotPanel');
    var closeBtn = document.getElementById('chatbotCloseBtn');
    var form = document.getElementById('chatbotForm');
    var input = document.getElementById('chatbotInput');
    if(!fab || !panel || !closeBtn || !form || !input) return;

    function setPanelOpen(isOpen){
      chatBotState.open = isOpen;
      panel.classList.toggle('open', isOpen);
      fab.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if(isOpen){ input.focus(); }
    }

    fab.addEventListener('click', function(){ setPanelOpen(!chatBotState.open); });
    fab.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setPanelOpen(!chatBotState.open); } });
    closeBtn.addEventListener('click', function(){ setPanelOpen(false); });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var message = input.value.trim();
      if(!message) return;
      setPanelOpen(true);
      appendChatBubble('user', message);
      input.value = '';
      askGemini(message);
    });

    appendChatBubble('assistant', 'Halo! Saya bisa bantu melihat apakah jaring pengamanmu cukup kuat. Klik tombol ini untuk mulai ngobrol.');
    setChatStatus('Siap. Saya siap membantu.');
  }

  /* ============ DATA ============ */

  var SHOCKS = [
    { id:'motor', label:'Motor mogok / rusak', avg:750000, range:'Rp300rb – Rp1,5jt', note:'Servis besar, ganti ban, atau komponen mendadak.',
      icon:'<path d="M3 15l2-6a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 6"/><path d="M3 15h18v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z"/><circle cx="7.5" cy="15" r="1.4"/><circle cx="16.5" cy="15" r="1.4"/>' },
    { id:'medical', label:'Biaya sakit / ke dokter gigi', avg:3000000, range:'Rp1jt – Rp5jt', note:'Rawat inap singkat atau tindakan darurat tanpa BPJS aktif.',
      icon:'<path d="M12 21s-7-4.35-9.5-8.5C.7 9 2.5 5 6.5 5c2 0 3.3 1.1 5.5 3.2C14.2 6.1 15.5 5 17.5 5 21.5 5 23.3 9 21.5 12.5 19 16.65 12 21 12 21z"/><path d="M9 11h2.2l1-2 1.6 4 1-2H17"/>' },
    { id:'home', label:'Rumah atau alat rusak', avg:1000000, range:'Rp300rb – Rp2jt', note:'Pompa air, kompor gas, atau atap bocor mendadak.',
      icon:'<path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>' },
    { id:'job', label:'Penghasilan terhenti', avg:null, range:'Minggu – bulan', note:'Jam kerja berkurang, PHK, atau jeda antar pekerjaan.',
      icon:'<path d="M4 7h16v12H4z"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M4 12h16"/><path d="M10.5 12v2h3v-2"/>' }
  ];

  // patch 0..8 maps to a position in the 3x3 net grid, top-left to bottom-right, row-major
  var STRATEGIES = [
    { patch:0, id:'bansos', title:'Cek bantuan sosial', tag:'10 menit',
      tagline:'Bantuan yang tidak diklaim tetaplah bantuan.',
      detail:'Banyak keluarga yang sebenarnya berhak atas PKH, BPNT (Kartu Sembako), atau bantuan iuran BPJS Kesehatan (PBI-JK) tidak pernah mengecek karena tidak tahu caranya.',
      first:'Cek statusmu di cekbansos.kemensos.go.id pakai NIK, atau tanya langsung ke Dinas Sosial/kelurahan setempat.',
      icon:'<path d="M5 3h10l4 4v14H5z"/><path d="M9 12l2 2 4-4"/>' },
    { patch:1, id:'arisan', title:'Arisan', tag:'Berbasis komunitas',
      tagline:'Kumpulan kepercayaan, bukan bunga.',
      detail:'Sekelompok orang menyetor jumlah tetap setiap periode, dan satu anggota mendapat giliran menerima seluruh dana \u2014 dipraktikkan turun-temurun untuk mendapat dana besar tanpa pinjaman berbunga.',
      first:'Ajak tetangga, keluarga, atau rekan kerja yang kamu percaya, lalu sepakati jumlah, giliran, dan aturan secara tertulis.',
      icon:'<circle cx="12" cy="5" r="2"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M12 7L7.5 15.3M12 7L16.5 15.3M8 17h8"/>' },
    { patch:2, id:'koperasi', title:'Pinjaman koperasi', tag:'Bunga rendah',
      tagline:'Tempat pinjam yang aman, sebelum krisis memaksamu ke tempat yang lebih buruk.',
      detail:'Koperasi simpan pinjam atau BMT berbasis anggota biasanya memberi bunga jauh lebih rendah daripada pinjol, dengan asas kekeluargaan.',
      first:'Cari koperasi simpan pinjam atau BMT terdekat sebelum benar-benar butuh, dan tanyakan syarat keanggotaannya.',
      icon:'<circle cx="12" cy="14" r="6"/><path d="M12 11v6M9.5 13.5L12 11l2.5 2.5"/><path d="M12 2v4"/>' },
    { patch:3, id:'negosiasi', title:'Negosiasi keringanan tagihan', tag:'Gratis, cukup telepon',
      tagline:'Tanya sebelum telat bayar, bukan sesudahnya.',
      detail:'PLN, PDAM, pemilik kontrakan, dan leasing sering punya opsi keringanan atau cicilan ulang \u2014 tapi biasanya hanya untuk yang bertanya.',
      first:'Hubungi pihak penagih sebelum jatuh tempo dan tanyakan langsung: "Ada keringanan apa untuk situasi saya?"',
      icon:'<path d="M4 4h16v11H10l-4 4V4z"/><path d="M8 8h8M8 11h5"/>' },
    { patch:4, id:'danadarurat', title:'Dana darurat mikro', tag:'Gratis memulai', anchor:true,
      tagline:'Mulai sekecil apa pun \u2014 punya cadangan lebih baik daripada tidak sama sekali.',
      detail:'Menyisihkan Rp5.000\u2013Rp10.000 seminggu pun bisa membangun bantalan yang mencegah kejutan kecil berubah jadi utang.',
      first:'Buka rekening tabungan terpisah dan atur transfer otomatis kecil tiap gajian, mulai dari Rp10.000.',
      icon:'<path d="M6 9h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"/><path d="M6 9V6h12v3"/><path d="M10 3v3M14 3v3"/>' },
    { patch:5, id:'pegadaian', title:'Gadai di Pegadaian', tag:'Bunga diatur',
      tagline:'Alternatif legal saat pinjol menjanjikan yang lebih cepat tapi lebih berbahaya.',
      detail:'Pegadaian, BUMN yang diawasi OJK, memberi pinjaman cepat berjaminan barang (emas, elektronik, BPKB) dengan bunga yang jelas \u2014 jauh lebih aman daripada pinjol ilegal.',
      first:'Bawa KTP dan barang berharga ke outlet Pegadaian terdekat, atau cek dulu lewat aplikasi Pegadaian Digital.',
      icon:'<path d="M3 20h18"/><path d="M5 20v-8M9 20v-8M13 20v-8M17 20v-8"/><path d="M2 10l10-6 10 6z"/>' },
    { patch:6, id:'autosave', title:'Tabungan otomatis', tag:'Atur sekali, lupakan',
      tagline:'Menabung uang yang bahkan tidak perlu kamu putuskan untuk ditabung.',
      detail:'Banyak bank digital dan e-wallet punya fitur bulatkan-otomatis atau nabung-otomatis yang menyisihkan kembalian dari tiap transaksi.',
      first:'Aktifkan fitur tabungan otomatis di bank digital atau e-wallet yang kamu pakai, dan pastikan ke mana uangnya masuk.',
      icon:'<path d="M4 17h4v-4h4v-4h4v-4h4"/>' },
    { patch:7, id:'sampingan', title:'Penghasilan tambahan fleksibel', tag:'Fleksibel',
      tagline:'Aliran kecil kedua yang bisa kamu besarkan saat dibutuhkan.',
      detail:'Keahlian atau kerja sampingan yang bisa ditingkatkan sementara \u2014 ojek online, jualan online, jasa titip \u2014 memberi tuas yang tidak dimiliki tabungan saja.',
      first:'Pilih satu keahlian yang bisa kamu tawarkan bulan ini, dan pasang di satu tempat: grup WhatsApp, marketplace, atau aplikasi ojek/jasa.',
      icon:'<path d="M5 20V10a5 5 0 0 1 5-5h6"/><path d="M13 2l3 3-3 3"/>' },
    { patch:8, id:'kerjasama', title:'Dana darurat dari tempat kerja', tag:'Tanya HRD',
      tagline:'Tempatmu bekerja mungkin sudah punya ini.',
      detail:'Sebagian perusahaan atau koperasi karyawan menyediakan pinjaman lunak, kasbon, atau dana bantuan untuk karyawan yang sedang kesulitan.',
      first:'Tanyakan ke HRD atau atasan, secara rahasia, apakah ada koperasi karyawan atau dana bantuan darurat.',
      icon:'<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v7a2 2 0 0 1-4 0"/><path d="M12 3v2"/>' }
  ];

  /* ============ STATE ============ */

  var state = {
    income: 3000000,
    expenses: 2500000,
    savings: 500000,
    activeShock: null,
    selected: new Set(),
    started: new Set()
  };

  function fmtMoney(n){
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
  }

  function runwayDays(){
    if(state.income <= 0 || state.expenses <= 0 || state.savings <= 0) return 0;
    var dailyBurn = state.expenses / 30;
    if(dailyBurn <= 0) return 0;
    return state.savings / dailyBurn;
  }

  function runwayBand(days){
    if(days < 7) return {label:'Rentan', color:'var(--coral)'};
    if(days < 30) return {label:'Tipis', color:'var(--gold-soft)'};
    if(days < 90) return {label:'Bertumbuh', color:'var(--gold)'};
    return {label:'Tangguh', color:'var(--teal)'};
  }

  function score(){
    var days = Math.min(runwayDays(), 90);
    var runwayComponent = (days/90) * 40;
    var strategyComponent = (state.selected.size/9) * 60;
    return Math.round(Math.min(100, runwayComponent + strategyComponent));
  }

  function scoreBand(s){
    if(s < 25) return {label:'Rentan', color:'var(--coral)'};
    if(s < 50) return {label:'Tipis', color:'var(--gold-soft)'};
    if(s < 75) return {label:'Menguat', color:'var(--gold)'};
    return {label:'Tangguh', color:'var(--teal)'};
  }

  /* ============ NET SVG ============ */

  var NET = { cols:3, rows:3, pw:150, ph:130, gap:18, margin:20, nodeCols:4, nodeRows:4 };

  function pr(n){ var x = Math.sin(n*12.9898)*43758.5453; return x - Math.floor(x); }

  function buildNet(svg){
    var ns = 'http://www.w3.org/2000/svg';
    var W = NET.margin*2 + NET.pw*NET.cols + NET.gap*(NET.cols-1);
    var H = NET.margin*2 + NET.ph*NET.rows + NET.gap*(NET.rows-1);

    // frame ropes
    var top = document.createElementNS(ns,'line');
    top.setAttribute('x1', NET.margin); top.setAttribute('y1', 6);
    top.setAttribute('x2', W-NET.margin); top.setAttribute('y2', 6);
    top.setAttribute('class','frame-rope');
    svg.appendChild(top);
    [NET.margin, W-NET.margin].forEach(function(x){
      var l = document.createElementNS(ns,'line');
      l.setAttribute('x1', x); l.setAttribute('y1', 6);
      l.setAttribute('x2', x); l.setAttribute('y2', NET.margin);
      l.setAttribute('class','frame-rope');
      svg.appendChild(l);
    });

    for(var patchIndex=0; patchIndex<9; patchIndex++){
      var col = patchIndex % NET.cols;
      var row = Math.floor(patchIndex / NET.cols);
      var originX = NET.margin + col*(NET.pw+NET.gap);
      var originY = NET.margin + row*(NET.ph+NET.gap);

      var g = document.createElementNS(ns,'g');
      g.setAttribute('class','patch');
      g.setAttribute('data-patch', patchIndex);

      var nodes = [];
      for(var r=0;r<NET.nodeRows;r++){
        var rowArr = [];
        for(var c=0;c<NET.nodeCols;c++){
          var localX = c*(NET.pw/(NET.nodeCols-1));
          var localY = r*(NET.ph/(NET.nodeRows-1));
          var seed = patchIndex*137 + r*11 + c*7;
          var jx = (pr(seed) - 0.5) * 6;
          var jy = (pr(seed+1) - 0.5) * 6;
          rowArr.push([originX+localX+jx, originY+localY+jy]);
        }
        nodes.push(rowArr);
      }

      for(r=0;r<NET.nodeRows-1;r++){
        for(c=0;c<NET.nodeCols-1;c++){
          var tl=nodes[r][c], tr=nodes[r][c+1], bl=nodes[r+1][c], br=nodes[r+1][c+1];
          var delay = ((r+c) * 35) + 'ms';
          g.appendChild(makeLine(ns, tl, br, delay));
          g.appendChild(makeLine(ns, tr, bl, delay));
        }
      }
      for(r=0;r<NET.nodeRows;r++){
        for(c=0;c<NET.nodeCols;c++){
          g.appendChild(makeKnot(ns, nodes[r][c], ((r+c)*35)+'ms'));
        }
      }
      svg.appendChild(g);
    }
  }

  function makeLine(ns, a, b, delay){
    var l = document.createElementNS(ns,'line');
    l.setAttribute('x1',a[0]); l.setAttribute('y1',a[1]);
    l.setAttribute('x2',b[0]); l.setAttribute('y2',b[1]);
    l.setAttribute('class','net-line');
    l.style.transitionDelay = delay;
    return l;
  }
  function makeKnot(ns, p, delay){
    var c = document.createElementNS(ns,'circle');
    c.setAttribute('cx',p[0]); c.setAttribute('cy',p[1]); c.setAttribute('r',2.6);
    c.setAttribute('class','net-knot');
    c.style.transitionDelay = delay;
    return c;
  }

  function updateNetVisual(){
    var svg = document.getElementById('netSvg');
    if(svg){
      STRATEGIES.forEach(function(s){
        var g = svg.querySelector('.patch[data-patch="'+s.patch+'"]');
        if(g) g.classList.toggle('woven', state.selected.has(s.id));
      });
    }
    var strandCount = document.getElementById('strandCount');
    if(strandCount){ strandCount.textContent = state.selected.size; }
  }

  /* ============ RENDER: shocks ============ */

  function iconSvg(pathData, size){
    size = size || 24;
    return '<svg class="icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+pathData+'</svg>';
  }

  function renderShocks(){
    var grid = document.getElementById('shockGrid');
    grid.innerHTML = SHOCKS.map(function(s){
      return '<button class="shock-card" data-shock="'+s.id+'" type="button">'+
        iconSvg(s.icon, 26) +
        '<h4>'+s.label+'</h4>'+
        '<span class="range mono">'+s.range+'</span>'+
        '<p class="note">'+s.note+'</p>'+
      '</button>';
    }).join('');

    grid.querySelectorAll('.shock-card').forEach(function(btn){
      btn.addEventListener('click', function(){
        selectShock(btn.getAttribute('data-shock'));
      });
    });
  }

  function selectShock(id){
    state.activeShock = id;
    document.querySelectorAll('.shock-card').forEach(function(el){
      el.classList.toggle('active', el.getAttribute('data-shock') === id);
    });
    renderVerdict();
    document.getElementById('stressHint').textContent = 'Ketuk kartu lain untuk membandingkan.';
  }

  function renderVerdict(){
    var panel = document.getElementById('verdict');
    var titleEl = document.getElementById('verdictTitle');
    var bodyEl = document.getElementById('verdictBody');
    if(!state.activeShock){ panel.classList.remove('show'); return; }

    var shock = SHOCKS.filter(function(s){return s.id===state.activeShock;})[0];
    var days = runwayDays();
    var color, title, body;

    if(shock.id === 'job'){
      if(days >= 90){ color='var(--teal)'; title='Kamu bisa bertahan'; body='Dengan uang tunai hari ini, kamu bisa menutup sekitar '+Math.floor(days)+' hari tanpa penghasilan sama sekali \u2014 tiga bulan lebih.'; }
      else if(days >= 30){ color='var(--gold)'; title='Kamu punya sedikit ruang'; body='Kamu bisa menutup sekitar '+Math.floor(days)+' hari tanpa penghasilan. Cukup waktu, tapi jeda yang lebih panjang kemungkinan butuh bantuan lain.'; }
      else { color='var(--coral)'; title='Ini celah terbesarmu'; body='Dengan uang tunai hari ini, kamu akan kehabisan dalam sekitar '+Math.max(0,Math.floor(days))+' hari. Inilah jenis guncangan yang bisa ditahan oleh kifu suru yang lebih beragam \u2014 lanjutkan ke bawah.'; }
    } else {
      var remaining = state.savings - shock.avg;
      var daysAfter = remaining > 0 ? (remaining / (state.expenses/30 || 1)) : 0;
      if(remaining >= 0 && daysAfter >= 30){ color='var(--teal)'; title='Kifu surumu menahan'; body='Guncangan seperti '+shock.label.toLowerCase()+' (sekitar '+fmtMoney(shock.avg)+') masih menyisakan '+fmtMoney(remaining)+' dan sekitar '+Math.floor(daysAfter)+' hari ketahanan.'; }
      else if(remaining >= 0){ color='var(--gold)'; title='Kamu bisa menutupnya \u2014 tapi pas-pasan'; body='Guncangan seperti '+shock.label.toLowerCase()+' (sekitar '+fmtMoney(shock.avg)+') hanya menyisakan '+fmtMoney(remaining)+', dan cadanganmu akan cepat menipis.'; }
      else { color='var(--coral)'; title='Ini akan menjebol cadanganmu'; body='Guncangan seperti '+shock.label.toLowerCase()+' (sekitar '+fmtMoney(shock.avg)+') akan menghabiskan tabunganmu dan membuatmu kurang sekitar '+fmtMoney(Math.abs(remaining))+' \u2014 kemungkinan besar berarti utang, pinjaman, atau pilihan yang berat.'; }
    }

    titleEl.textContent = title;
    titleEl.style.color = color;
    bodyEl.textContent = body;
    panel.classList.add('show');
  }

  /* ============ RENDER: strategies ============ */

  function renderStrategies(){
    var grid = document.getElementById('strategyGrid');
    if(!grid) return;
    grid.innerHTML = STRATEGIES.map(function(s){
      return '<button class="strategy-card'+(s.anchor?' anchor':'')+'" data-id="'+s.id+'" type="button" aria-pressed="false">'+
        '<span class="check">'+iconSvg('<path d="M5 12l5 5L19 7"/>', 12)+'</span>'+
        (s.anchor ? '<span class="anchor-badge">Titik awal yang baik</span>' : '') +
        iconSvg(s.icon, 26) +
        '<h4>'+s.title+'</h4>'+
        '<p class="tagline">'+s.tagline+'</p>'+
        '<span class="tag">'+s.tag+'</span>'+
      '</button>';
    }).join('');

    grid.querySelectorAll('.strategy-card').forEach(function(card){
      card.addEventListener('click', function(){
        var id = card.getAttribute('data-id');
        if(state.selected.has(id)){ state.selected.delete(id); }
        else { state.selected.add(id); }
        card.classList.toggle('selected');
        card.setAttribute('aria-pressed', state.selected.has(id) ? 'true' : 'false');
        refreshAll();
      });
    });
  }

  /* ============ RENDER: plan ============ */

  function renderPlan(){
    var list = document.getElementById('planList');
    if(!list) return;
    var chosen = STRATEGIES.filter(function(s){ return state.selected.has(s.id); });

    if(chosen.length === 0){
      list.innerHTML = '<div class="plan-empty">Belum ada yang teranyam. Pilih satu-dua strategi di atas \u2014 satu saja sudah mengubah bentuk kifu surumu.</div>';
      return;
    }

    list.innerHTML = chosen.map(function(s){
      var started = state.started.has(s.id);
      return '<div class="plan-item'+(started?' started':'')+'" data-id="'+s.id+'">'+
        '<button class="pcheck" type="button" aria-label="Tandai sudah dimulai">'+(started?iconSvg('<path d="M5 12l5 5L19 7"/>',12):'')+'</button>'+
        '<div><h5>'+s.title+'</h5><p><span>Langkah pertama </span>&mdash; '+s.first+'</p></div>'+
      '</div>';
    }).join('');

    list.querySelectorAll('.pcheck').forEach(function(btn){
      btn.addEventListener('click', function(){
        var item = btn.closest('.plan-item');
        var id = item.getAttribute('data-id');
        if(state.started.has(id)) state.started.delete(id); else state.started.add(id);
        renderPlan();
      });
    });
  }

  /* ============ HUD / GAUGE / RUNWAY ============ */

  function syncSavingsLimit(){
    var incomeEl = document.getElementById('income');
    var savingsEl = document.getElementById('savings');
    if(!incomeEl || !savingsEl) return;

    var maxSavings = Math.max(0, Number(incomeEl.value) || 0);
    savingsEl.setAttribute('max', String(maxSavings));

    if(state.savings > maxSavings){
      state.savings = maxSavings;
      savingsEl.value = String(maxSavings);
      var savingsOut = document.getElementById('savingsOut');
      if(savingsOut){ savingsOut.textContent = fmtMoney(state.savings); }
    }
  }

  function refreshAll(){
    var days = runwayDays();
    var band = runwayBand(days);
    var s = score();
    var sb = scoreBand(s);
    var daysText = Math.max(0, Math.floor(days));

    syncSavingsLimit();

    // runway panel
    var incomeOut = document.getElementById('incomeOut');
    if(incomeOut){ incomeOut.textContent = fmtMoney(state.income); }
    var expensesOut = document.getElementById('expensesOut');
    if(expensesOut){ expensesOut.textContent = fmtMoney(state.expenses); }
    var savingsOut = document.getElementById('savingsOut');
    if(savingsOut){ savingsOut.textContent = fmtMoney(state.savings); }
    var runwayDaysEl = document.getElementById('runwayDays');
    if(runwayDaysEl){ runwayDaysEl.textContent = daysText; }
    var skullEl = document.getElementById('runwaySkull');
    if(skullEl){
      var iconMap = { Rentan:'☠️', Tipis:'🧻', Bertumbuh:'🌳', Tangguh:'💪' };
      skullEl.textContent = iconMap[band.label] || '☠️';
      skullEl.classList.add('show');
    }
    var bandEl = document.getElementById('runwayBand');
    if(bandEl){
      bandEl.textContent = band.label;
      bandEl.style.background = band.color;
      bandEl.style.color = 'var(--ink-900)';
    }
    var pct = Math.min(100, (days/120)*100);
    var fill = document.getElementById('runwayFill');
    if(fill){
      fill.style.width = pct + '%';
      fill.style.background = band.color;
    }
    var runwayNote = document.getElementById('runwayNote');
    if(runwayNote){ runwayNote.textContent =
      'Sebagai pembanding: data OJK yang dikutip GoodStats menemukan hanya 29% orang Indonesia menabung secara konsisten tiap bulan — artinya lebih dari 70% hidup tanpa dana darurat.';
    }

    // HUD ring
    var hudNumber = document.getElementById('hudNumber');
    var hudLabel = document.getElementById('hudLabel');
    if(hudNumber){ hudNumber.textContent = s; }
    if(hudLabel){ hudLabel.textContent = sb.label; }
    var ring = document.getElementById('hudRing');
    if(ring){
      var circumference = 100.53;
      ring.style.strokeDashoffset = circumference * (1 - s/100);
      ring.style.stroke = sb.color;
    }

    // gauge
    var gaugeNum = document.getElementById('gaugeNum');
    var gaugeLbl = document.getElementById('gaugeLbl');
    var gaugeRunway = document.getElementById('gaugeRunway');
    var gaugeStrands = document.getElementById('gaugeStrands');
    if(gaugeNum){ gaugeNum.textContent = s; }
    if(gaugeLbl){ gaugeLbl.textContent = sb.label; }
    if(gaugeRunway){ gaugeRunway.textContent = daysText + ' hari'; }
    if(gaugeStrands){ gaugeStrands.textContent = state.selected.size; }
    var gaugeFg = document.getElementById('gaugeFg');
    if(gaugeFg){
      var gaugeCirc = 263.9;
      gaugeFg.style.strokeDashoffset = gaugeCirc * (1 - s/100);
      gaugeFg.style.stroke = sb.color;
    }

    updateNetVisual();
    renderPlan();
    if(state.activeShock) renderVerdict();
  }

  /* ============ COPY PLAN ============ */

  function buildPlanText(){
    var days = Math.max(0, Math.floor(runwayDays()));
    var s = score();
    var sb = scoreBand(s);
    var chosen = STRATEGIES.filter(function(st){ return state.selected.has(st.id); });
    var lines = [];
    lines.push('RENCANA KIFU SURUKU');
    lines.push('Ketahanan hari ini: ' + days + ' hari pengeluaran pokok tertutup uang tunai.');
    lines.push('Skor ketangguhan: ' + s + '/100 (' + sb.label + ')');
    lines.push('');
    lines.push('Strategi yang sedang kubangun:');
    if(chosen.length === 0){
      lines.push('  (belum ada yang dipilih)');
    } else {
      chosen.forEach(function(st, i){
        lines.push((i+1) + '. ' + st.title);
        lines.push('   Langkah pertama: ' + st.first);
      });
    }
    lines.push('');
    lines.push('Dibuat dengan Kifusuru \u2014 alat edukasi, bukan nasihat keuangan.');
    return lines.join('\n');
  }

  function copyPlan(){
    var text = buildPlanText();
    var feedback = document.getElementById('copyFeedback');
    var fallback = document.getElementById('copyFallback');

    function showFeedback(){
      feedback.classList.add('show');
      setTimeout(function(){ feedback.classList.remove('show'); }, 2200);
    }

    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){
        fallback.classList.remove('show');
        showFeedback();
      }).catch(function(){
        fallback.value = text;
        fallback.classList.add('show');
        fallback.select();
      });
    } else {
      fallback.value = text;
      fallback.classList.add('show');
      fallback.select();
    }
  }

  /* ============ INIT ============ */

  function init(){
    setupChatbot();

    var netSvg = document.getElementById('netSvg');
    if(netSvg){ buildNet(netSvg); }

    var shockGrid = document.getElementById('shockGrid');
    if(shockGrid){ renderShocks(); }

    var strategyGrid = document.getElementById('strategyGrid');
    if(strategyGrid){ renderStrategies(); }

    if(document.getElementById('income') && document.getElementById('expenses') && document.getElementById('savings')){
      refreshAll();
      document.getElementById('income').addEventListener('input', function(e){ state.income = +e.target.value; syncSavingsLimit(); refreshAll(); });
      document.getElementById('expenses').addEventListener('input', function(e){ state.expenses = +e.target.value; refreshAll(); });
      document.getElementById('savings').addEventListener('input', function(e){ state.savings = +e.target.value; refreshAll(); });
    }

    var surpriseBtn = document.getElementById('surpriseBtn');
    if(surpriseBtn){
      surpriseBtn.addEventListener('click', function(){
        var pick = SHOCKS[Math.floor(Math.random()*SHOCKS.length)];
        selectShock(pick.id);
      });
    }

    var copyPlanBtn = document.getElementById('copyPlanBtn');
    if(copyPlanBtn){ copyPlanBtn.addEventListener('click', copyPlan); }

    var resetBtn = document.getElementById('resetBtn');
    if(resetBtn){
      resetBtn.addEventListener('click', function(){
        state.selected.clear();
        state.started.clear();
        state.activeShock = null;
        document.querySelectorAll('.strategy-card').forEach(function(c){ c.classList.remove('selected'); c.setAttribute('aria-pressed','false'); });
        document.querySelectorAll('.shock-card').forEach(function(c){ c.classList.remove('active'); });
        var verdict = document.getElementById('verdict');
        if(verdict){ verdict.classList.remove('show'); }
        var copyFallback = document.getElementById('copyFallback');
        if(copyFallback){ copyFallback.classList.remove('show'); }
        refreshAll();
        window.scrollTo({top:0, behavior:'smooth'});
      });
    }

    if(!document.getElementById('income') || !document.getElementById('expenses') || !document.getElementById('savings')){
      refreshAll();
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
