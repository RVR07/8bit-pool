var GameGui = function () {
  var btn_ball = document.getElementById('btn_ball');
  var strength = document.getElementById('range_strength');
  var readout = document.getElementById('power_readout');
  function paintStrengthTrack() {
    var min = Number(strength.min);
    var max = Number(strength.max);
    var pct = ((Number(strength.value) - min) / (max - min)) * 100;
    strength.style.setProperty('--fill', pct + '%');
  }
  paintStrengthTrack();
  strength.addEventListener('input', function () {
    if (readout) readout.textContent = strength.value;
    if (game && game.balls[0]) {
      game.balls[0].cueStrength = Number(strength.value);
    }
    paintStrengthTrack();
    if (typeof Live !== 'undefined' && gui && gui.live && gui.live.on && gui.live.myTurn() && game && game.balls[0]) {
      Live.noteAim(game.balls[0].aimAngle, Number(strength.value));
    }
  });
  btn_ball.onclick = function () {
    if (typeof Sound !== 'undefined') Sound.ensure();
    eightballgame.hitButtonClicked(Number(strength.value));
  };
  var cards = document.querySelectorAll('#lobby .city-card');
  var self = this;
  var row = document.querySelector('.city-row');
  var drag = { active: false, x: 0, left: 0, moved: false };
  row.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return;
    drag.active = true;
    drag.moved = false;
    drag.x = event.clientX;
    drag.left = row.scrollLeft;
  });
  row.addEventListener('pointermove', function (event) {
    if (!drag.active) return;
    var dx = event.clientX - drag.x;
    if (Math.abs(dx) < 10) return;
    if (!drag.moved) {
      drag.moved = true;
      row.classList.add('is-dragging');
      try { row.setPointerCapture(event.pointerId); } catch (err) {}
    }
    row.scrollLeft = drag.left - dx;
  });
  function endDrag() {
    drag.active = false;
    row.classList.remove('is-dragging');
    if (drag.moved) {
      setTimeout(function () { drag.moved = false; }, 0);
    }
  }
  row.addEventListener('pointerup', endDrag);
  row.addEventListener('pointercancel', endDrag);
  var navs = document.querySelectorAll('.carousel-nav');
  for (var n = 0; n < navs.length; n++) {
    navs[n].addEventListener('click', function () {
      if (typeof Sound !== 'undefined') Sound.select();
      var card = row.querySelector('.city-card');
      var gap = parseFloat(window.getComputedStyle(row).columnGap) || 0;
      var step = card.offsetWidth + gap;
      row.scrollBy({ left: Number(this.getAttribute('data-dir')) * step, behavior: 'smooth' });
    });
  }
  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener('click', function (event) {
      if (drag.moved) {
        drag.moved = false;
        return;
      }
      self.pickCity(event.currentTarget.getAttribute('data-city'));
    });
  }
  if (debug) document.getElementById('fps_stats_container').appendChild( stats.domElement );
  this.loadProfile();
  this.buildCueSelect();
  var cueBtn = document.getElementById('cue_btn');
  var cueBack = document.getElementById('cue_back');
  if (cueBtn) cueBtn.addEventListener('click', function () { self.openCues(); });
  if (cueBack) cueBack.addEventListener('click', function () { self.closeCues(); });
  var walletBtn = document.getElementById('wallet_btn');
  var avatar = document.getElementById('profile_avatar');
  if (walletBtn) walletBtn.addEventListener('click', function () { self.toggleWallet(); });
  if (avatar) avatar.addEventListener('click', function () {
    if (typeof Wallet !== 'undefined' && Wallet.account) self.toggleWallet();
  });
  var cancelSearch = document.getElementById('matchSearchCancel');
  if (cancelSearch) cancelSearch.addEventListener('click', function () { self.cancelMatch(); });
  if (typeof Wallet !== 'undefined') {
    Wallet.listen(function () { self.renderProfile(); });
    Wallet.restore().then(function () { self.renderProfile(); });
  }
};

GameGui.CITIES = {
  lisbon: { prize: 45, entry: 25 },
  cairo: { prize: 180, entry: 100 },
  venice: { prize: 450, entry: 250 },
  paris: { prize: 900, entry: 500 },
  london: { prize: 1200, entry: 700 },
  tokyo: { prize: 1800, entry: 1000 },
  monaco: { prize: 9000, entry: 5000 }
};

GameGui.formatAmount = function (n) {
  return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

GameGui.prototype.setupGameHud = function() {
  var menu = document.getElementById('mainMenu');
  var lobby = document.getElementById('lobby');
  var hud = document.getElementById('controlsHud');
  GameGui.addClass(menu, 'is-leaving');
  this.hide(lobby);
  this.hide(document.getElementById('cueMenu'));
  GameGui.removeClass(document.getElementById('mainMenu'), 'is-cue');
  if (game && game.balls && game.balls[0] && game.balls[0].hideCueOverlay) game.balls[0].hideCueOverlay();
  this.hide(document.getElementById('profile'));
  GameGui.removeClass(document.getElementById('cue_btn'), 'is-open');
  this.show(hud);
  this.paintMatchPlayers();
  var self = this;
  setTimeout(function () {
    self.hide(menu);
    GameGui.removeClass(menu, 'is-leaving');
  }, 700);
};

GameGui.prototype.openLobby = function () {
  var menu = document.getElementById('mainMenu');
  var lobby = document.getElementById('lobby');
  this.hide(document.getElementById('cueMenu'));
  GameGui.removeClass(document.getElementById('cue_btn'), 'is-open');
  GameGui.removeClass(menu, 'is-cue');
  if (game && game.balls && game.balls[0] && game.balls[0].hideCueOverlay) game.balls[0].hideCueOverlay();
  GameGui.addClass(menu, 'is-leaving');
  GameGui.removeClass(lobby, 'is-entering');
  this.show(lobby);
  void lobby.offsetWidth;
  GameGui.addClass(lobby, 'is-entering');
  var self = this;
  setTimeout(function () {
    self.hide(menu);
    GameGui.removeClass(menu, 'is-leaving');
  }, 700);
};

GameGui.prototype.closeLobby = function () {
  var menu = document.getElementById('mainMenu');
  var lobby = document.getElementById('lobby');
  this.cancelMatch();
  GameGui.removeClass(menu, 'is-leaving');
  GameGui.removeClass(lobby, 'is-entering');
  this.hide(lobby);
  this.show(menu);
};

GameGui.CITY_NAMES = {
  lisbon: 'Lisbon',
  cairo: 'Cairo',
  venice: 'Venice',
  paris: 'Paris',
  london: 'London',
  tokyo: 'Tokyo',
  monaco: 'Monaco'
};

GameGui.prototype.pickCity = function (id) {
  if (id === 'bot') {
    this.startBot();
    return;
  }
  if (!GameGui.CITIES[id]) return;
  if (typeof Wallet === 'undefined' || !Wallet.account) {
    this.pendingCity = id;
    this.toggleWallet();
    return;
  }
  this.queueMatch(id);
};

GameGui.prototype.queueMatch = function (id) {
  var self = this;
  var address = Wallet.account;
  this.matchCity = id;
  this.matchToken = (this.matchToken || 0) + 1;
  var token = this.matchToken;
  var title = document.getElementById('matchSearchTitle');
  var status = document.getElementById('matchSearchStatus');
  if (title) title.textContent = GameGui.CITY_NAMES[id] || id;
  if (status) status.textContent = 'Looking for a connected player';
  this.show(document.getElementById('matchSearch'));
  function poll() {
    if (self.matchToken !== token) return;
    fetch('/api/match?address=' + encodeURIComponent(address) + '&city=' + encodeURIComponent(id))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (self.matchToken !== token) return;
        if (data.status === 'matched' && data.opponent) {
          self.finishSearch(id, data.opponent, data.opponentCue, data.sessionId, data.seat);
          return;
        }
        if (data.status !== 'waiting') {
          return fetch('/api/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: address, city: id, cue: self.myCue() })
          }).then(function (res) { return res.json(); }).then(function (joined) {
            if (self.matchToken !== token) return;
            if (joined.status === 'matched' && joined.opponent) {
              self.finishSearch(id, joined.opponent, joined.opponentCue, joined.sessionId, joined.seat);
            }
          });
        }
      })
      .catch(function () {
        if (status && self.matchToken === token) status.textContent = 'Still looking';
      });
  }
  fetch('/api/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: address, city: id, cue: self.myCue() })
  }).then(function (res) { return res.json(); }).then(function (joined) {
    if (self.matchToken !== token) return;
    if (joined.status === 'matched' && joined.opponent) {
      self.finishSearch(id, joined.opponent, joined.opponentCue, joined.sessionId, joined.seat);
      return;
    }
    self.matchTimer = setInterval(poll, 1500);
  }).catch(function () {
    if (status) status.textContent = 'Could not reach matchmaking';
  });
};

GameGui.prototype.myCue = function () {
  var saved = 'classic';
  try { saved = localStorage.getItem('billiards-cue') || 'classic'; } catch (err) {}
  if (typeof WhiteBall === 'undefined') return saved;
  return WhiteBall.cueById(saved).id;
};

GameGui.prototype.otherCue = function () {
  var mine = this.myCue();
  if (typeof WhiteBall === 'undefined') return 'ebony';
  var cues = WhiteBall.CUES;
  for (var i = 0; i < cues.length; i++) {
    if (cues[i].id === mine) return cues[(i + 1) % cues.length].id;
  }
  return cues[0].id;
};

GameGui.prototype.finishSearch = function (id, opponent, opponentCue, sessionId, seat) {
  this.matchToken = (this.matchToken || 0) + 1;
  if (this.matchTimer) {
    clearInterval(this.matchTimer);
    this.matchTimer = null;
  }
  this.hide(document.getElementById('matchSearch'));
  this.startCity(id, opponent, opponentCue, sessionId, seat);
};

GameGui.prototype.cancelMatch = function () {
  this.matchToken = (this.matchToken || 0) + 1;
  if (this.matchTimer) {
    clearInterval(this.matchTimer);
    this.matchTimer = null;
  }
  this.hide(document.getElementById('matchSearch'));
  if (typeof Wallet !== 'undefined' && Wallet.account) {
    fetch('/api/match?address=' + encodeURIComponent(Wallet.account), { method: 'DELETE' }).catch(function () {});
  }
};

GameGui.prototype.startBot = function () {
  if (typeof Live !== 'undefined') Live.stop();
  this.versus = 'bot';
  this.opponent = null;
  this.sessionId = null;
  this.showSession(null);
  this.playerCues = { player1: this.myCue(), player2: this.otherCue() };
  this.city = null;
  var matchPot = document.querySelector('#controlsHud .pot-label');
  var endPot = document.querySelector('#gameover .pot-label');
  if (matchPot) matchPot.textContent = 'Practice';
  if (endPot) endPot.textContent = 'Practice';
  if (typeof Table !== 'undefined') {
    Table.city = null;
    if (Table.feltMesh) Table.feltMesh.material.color.setHex(0x3c424a);
    if (Table.edgeMesh) Table.edgeMesh.material.color.setHex(0x16181c);
  }
  this.play8BallClicked();
};

GameGui.prototype.buildCueSelect = function () {
  this.cueIndex = 0;
  var saved = 'classic';
  try { saved = localStorage.getItem('billiards-cue') || 'classic'; } catch (err) {}
  if (typeof WhiteBall !== 'undefined') {
    for (var i = 0; i < WhiteBall.CUES.length; i++) {
      if (WhiteBall.CUES[i].id === saved) this.cueIndex = i;
    }
  }
  this.renderCueName();
  var arrows = document.querySelectorAll('.cue-arrow');
  var self = this;
  for (var a = 0; a < arrows.length; a++) {
    arrows[a].addEventListener('click', function () {
      self.stepCue(Number(this.getAttribute('data-dir')));
    });
  }
};

GameGui.prototype.stepCue = function (dir) {
  if (typeof WhiteBall === 'undefined' || !WhiteBall.CUES.length) return;
  if (typeof Sound !== 'undefined') Sound.select();
  var count = WhiteBall.CUES.length;
  this.cueIndex = (this.cueIndex + dir + count) % count;
  this.playerCues = this.playerCues || { player1: this.myCue(), player2: this.otherCue() };
  this.playerCues.player1 = WhiteBall.CUES[this.cueIndex].id;
  this.selectCue(this.playerCues.player1);
};

GameGui.prototype.renderCueName = function () {
  var name = document.getElementById('cue_name');
  if (!name || typeof WhiteBall === 'undefined') return;
  var cue = WhiteBall.CUES[this.cueIndex] || WhiteBall.CUES[0];
  name.textContent = cue.name;
};

GameGui.prototype.selectCue = function (id) {
  if (typeof WhiteBall !== 'undefined') {
    for (var i = 0; i < WhiteBall.CUES.length; i++) {
      if (WhiteBall.CUES[i].id === id) this.cueIndex = i;
    }
  }
  this.renderCueName();
  if (game && game.balls && game.balls[0]) game.balls[0].applyCue(id);
};

GameGui.prototype.openCues = function () {
  var menu = document.getElementById('mainMenu');
  var lobby = document.getElementById('lobby');
  var panel = document.getElementById('cueMenu');
  var button = document.getElementById('cue_btn');
  this.hide(lobby);
  GameGui.removeClass(panel, 'is-entering');
  this.show(panel);
  void panel.offsetWidth;
  GameGui.addClass(panel, 'is-entering');
  GameGui.addClass(button, 'is-open');
  GameGui.removeClass(menu, 'is-leaving');
  GameGui.removeClass(menu, 'hide');
  GameGui.addClass(menu, 'is-cue');
  if (game && game.balls && game.balls[0] && game.balls[0].showCueOverlay) {
    game.balls[0].showCueOverlay();
  }
};

GameGui.prototype.closeCues = function () {
  var menu = document.getElementById('mainMenu');
  var panel = document.getElementById('cueMenu');
  var button = document.getElementById('cue_btn');
  GameGui.removeClass(button, 'is-open');
  GameGui.removeClass(panel, 'is-entering');
  this.hide(panel);
  GameGui.removeClass(menu, 'is-cue');
  GameGui.removeClass(menu, 'is-leaving');
  this.show(menu);
  if (game && game.balls && game.balls[0] && game.balls[0].hideCueOverlay) {
    game.balls[0].hideCueOverlay();
  }
};

GameGui.prototype.startCity = function (id, opponent, opponentCue, sessionId, seat) {
  var city = GameGui.CITIES[id];
  if (!city) return;
  var matchPot = document.querySelector('#controlsHud .pot-label');
  var endPot = document.querySelector('#gameover .pot-label');
  var amount = GameGui.formatAmount(city.prize);
  if (matchPot) matchPot.textContent = amount;
  if (endPot) endPot.textContent = 'Pot ' + amount;
  this.versus = 'player';
  this.opponent = opponent || null;
  this.sessionId = sessionId || null;
  seat = seat === 'player2' ? 'player2' : 'player1';
  var mine = this.myCue();
  var theirs = opponentCue && typeof WhiteBall !== 'undefined' ? WhiteBall.cueById(opponentCue).id : this.otherCue();
  this.playerCues = seat === 'player2'
    ? { player1: theirs, player2: mine }
    : { player1: mine, player2: theirs };
  this.city = city;
  this.balance = Math.max(0, this.balance - city.entry);
  this.saveProfile();
  this.renderProfile();
  this.showSession(sessionId);
  if (typeof Table !== 'undefined' && Table.setCity) Table.setCity(id);
  if (sessionId && typeof Live !== 'undefined') Live.prepare(sessionId, seat);
  this.play8BallClicked();
};

GameGui.prototype.showSession = function (id) {
  var node = document.getElementById('session_id');
  if (!node) return;
  if (!id) {
    node.textContent = '';
    GameGui.addClass(node, 'hide');
    return;
  }
  node.textContent = id;
  GameGui.removeClass(node, 'hide');
};

GameGui.prototype.loadProfile = function () {
  this.wins = 0;
  this.balance = 2500;
  try {
    var savedWins = localStorage.getItem('billiards-wins');
    var savedBalance = localStorage.getItem('billiards-balance');
    if (savedWins !== null) this.wins = Number(savedWins) || 0;
    if (savedBalance !== null) this.balance = Number(savedBalance) || 0;
  } catch (err) {}
  this.renderProfile();
};

GameGui.prototype.saveProfile = function () {
  try {
    localStorage.setItem('billiards-wins', String(this.wins));
    localStorage.setItem('billiards-balance', String(this.balance));
  } catch (err) {}
};

GameGui.prototype.toggleWallet = function () {
  var self = this;
  var btn = document.getElementById('wallet_btn');
  if (typeof Wallet === 'undefined') return;
  if (Wallet.account) {
    Wallet.disconnect();
    this.renderProfile();
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = '...';
  }
  Wallet.connect().then(function () {
    self.renderProfile();
    if (self.pendingCity && Wallet.account) {
      var city = self.pendingCity;
      self.pendingCity = null;
      self.queueMatch(city);
    }
  }).catch(function (err) {
    if (Wallet.account) {
      self.renderProfile();
      if (self.pendingCity) {
        var city = self.pendingCity;
        self.pendingCity = null;
        self.queueMatch(city);
      }
      return;
    }
    self.pendingCity = null;
    var code = Wallet.codeOf(err);
    var label = 'Try again';
    if (!Wallet.provider()) label = 'Install MetaMask';
    else if (code === 4001) label = 'Rejected';
    else if (code === -32002) label = 'Check MetaMask';
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
      btn.title = (err && err.message) ? err.message : label;
    }
  });
};

GameGui.prototype.renderProfile = function () {
  var wins = document.getElementById('profile_wins');
  var name = document.getElementById('profile_name');
  var balance = document.getElementById('profile_balance');
  var walletBtn = document.getElementById('wallet_btn');
  var avatar = document.getElementById('profile_avatar');
  if (wins) wins.textContent = this.wins + (this.wins === 1 ? ' win' : ' wins');
  var linked = typeof Wallet !== 'undefined' && Wallet.account;
  if (typeof Wallet !== 'undefined') Wallet.paint(linked ? Wallet.account : null);
  if (name) {
    name.textContent = linked ? Wallet.short(Wallet.account) : '';
    if (linked) GameGui.removeClass(name, 'hide');
    else GameGui.addClass(name, 'hide');
  }
  if (avatar) {
    avatar.title = linked ? (Wallet.raw === null ? 'Switch MetaMask to Base Sepolia' : 'Disconnect') : '';
    if (linked) GameGui.addClass(avatar, 'is-linked');
    else GameGui.removeClass(avatar, 'is-linked');
  }
  if (balance) {
    if (linked && Wallet.notice && Wallet.raw === null) balance.textContent = Wallet.notice;
    else balance.textContent = linked ? Wallet.format(Wallet.raw) : GameGui.formatAmount(this.balance);
  }
  if (walletBtn) {
    walletBtn.disabled = false;
    if (linked) {
      GameGui.addClass(walletBtn, 'hide');
    } else {
      GameGui.removeClass(walletBtn, 'hide');
      walletBtn.textContent = 'Connect';
      walletBtn.title = 'Connect MetaMask on Base Sepolia';
      walletBtn.classList.remove('is-on');
    }
  }
  this.paintMatchPlayers();
};

GameGui.prototype.paintMatchPlayers = function () {
  var linked = typeof Wallet !== 'undefined' && Wallet.account;
  var p1Name = document.getElementById('p1_name');
  var p2Name = document.getElementById('p2_name');
  var p1Face = document.getElementById('p1_face');
  var p2Face = document.getElementById('p2_face');
  var p1Mark = document.querySelector('#p1_avatar .avatar-mark');
  var p2Mark = document.querySelector('#p2_avatar .avatar-mark');
  var p2Opp = document.querySelector('#p2_avatar .avatar-opponent');
  var p1Avatar = document.getElementById('p1_avatar');
  var p2Avatar = document.getElementById('p2_avatar');
  if (p2Face) GameGui.addClass(p2Face, 'hide');
  if (this.versus === 'bot') {
    if (p1Face) GameGui.addClass(p1Face, 'hide');
    if (p1Mark) GameGui.removeClass(p1Mark, 'hide');
    if (p1Avatar) GameGui.removeClass(p1Avatar, 'is-face');
    if (linked) {
      Wallet.drawFace(p1Face, Wallet.account);
      if (p1Face) GameGui.removeClass(p1Face, 'hide');
      if (p1Mark) GameGui.addClass(p1Mark, 'hide');
      if (p1Avatar) GameGui.addClass(p1Avatar, 'is-face');
    }
    if (p1Name) p1Name.textContent = linked ? Wallet.short(Wallet.account) : 'You';
    if (p2Name) p2Name.textContent = 'Bot';
    if (p2Mark) GameGui.addClass(p2Mark, 'hide');
    if (p2Opp) GameGui.removeClass(p2Opp, 'hide');
    if (p2Avatar) GameGui.addClass(p2Avatar, 'is-opponent');
    return;
  }
  if (linked && this.versus === 'player' && this.opponent) {
    var leftAddr = Wallet.account;
    var rightAddr = this.opponent;
    if (this.live && this.live.seat === 'player2') {
      leftAddr = this.opponent;
      rightAddr = Wallet.account;
    }
    Wallet.drawFace(p1Face, leftAddr);
    Wallet.drawFace(p2Face, rightAddr);
    if (p1Face) GameGui.removeClass(p1Face, 'hide');
    if (p2Face) GameGui.removeClass(p2Face, 'hide');
    if (p1Mark) GameGui.addClass(p1Mark, 'hide');
    if (p2Mark) GameGui.addClass(p2Mark, 'hide');
    if (p2Opp) GameGui.addClass(p2Opp, 'hide');
    if (p1Avatar) GameGui.addClass(p1Avatar, 'is-face');
    if (p2Avatar) {
      GameGui.addClass(p2Avatar, 'is-face');
      GameGui.removeClass(p2Avatar, 'is-opponent');
    }
    if (p1Name) p1Name.textContent = Wallet.short(leftAddr);
    if (p2Name) p2Name.textContent = Wallet.short(rightAddr);
    return;
  }
  if (linked) {
    Wallet.drawFace(p1Face, Wallet.account);
    if (p1Face) GameGui.removeClass(p1Face, 'hide');
    if (p1Mark) GameGui.addClass(p1Mark, 'hide');
    if (p1Avatar) GameGui.addClass(p1Avatar, 'is-face');
    if (p1Name) p1Name.textContent = Wallet.short(Wallet.account);
    if (p2Name) p2Name.textContent = 'Opponent';
    if (p2Mark) GameGui.addClass(p2Mark, 'hide');
    if (p2Opp) GameGui.removeClass(p2Opp, 'hide');
    if (p2Avatar) GameGui.addClass(p2Avatar, 'is-opponent');
  } else {
    if (p1Face) GameGui.addClass(p1Face, 'hide');
    if (p1Mark) GameGui.removeClass(p1Mark, 'hide');
    if (p1Avatar) GameGui.removeClass(p1Avatar, 'is-face');
    if (p1Name) p1Name.textContent = 'Player 1';
    if (p2Name) p2Name.textContent = 'Player 2';
    if (p2Mark) GameGui.removeClass(p2Mark, 'hide');
    if (p2Opp) GameGui.addClass(p2Opp, 'hide');
    if (p2Avatar) GameGui.removeClass(p2Avatar, 'is-opponent');
  }
};

GameGui.addClass = function (el, className) {
  if (el.classList) {
    el.classList.add(className);
  } else {
    el.className += ' ' + className;
  }
};

GameGui.removeClass = function (el, className) {
  if (el.classList) {
    el.classList.remove(className);
  } else {
    el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }
};

GameGui.prototype.show = function (node) {
  GameGui.removeClass(node, 'hide');
};

GameGui.prototype.hide = function (node) {
  GameGui.addClass(node, 'hide');
};

GameGui.prototype.play8BallClicked = function () {
  if (game && game.restorePlayPose) game.restorePlayPose();
  eightballgame = new EightBallGame();
};

GameGui.prototype.UpdateTimer = function(timerVal) {
  this.paintClock(timerVal);
};

GameGui.prototype.paintClock = function (timerVal) {
  var shown = Math.max(0, Math.ceil(Number(timerVal) || 0));
  var node = document.querySelector('#controlsHud .clock .timer');
  if (node) node.textContent = shown;
  var wraps = document.querySelectorAll('#controlsHud .avatar-wrap');
  var active = document.querySelector('#controlsHud .player.active .avatar-wrap');
  for (var i = 0; i < wraps.length; i++) {
    wraps[i].style.setProperty('--remain', wraps[i] === active ? Math.max(Number(timerVal) || 0, 0) / 30 : 1);
  }
};

GameGui.prototype.log = function(str) {
  var node = document.createElement('li');
  node.textContent = str;
  document.getElementsByClassName('gamelog')[0].appendChild(node);
};

GameGui.prototype.updateTurn = function(str) {
  GameGui.removeClass(document.getElementsByClassName('player1')[0], 'active');
  GameGui.removeClass(document.getElementsByClassName('player2')[0], 'active');
  GameGui.addClass(document.getElementsByClassName(str)[0], 'active');
  var cues = this.playerCues || { player1: this.myCue(), player2: this.otherCue() };
  var id = str === 'player2' ? cues.player2 : cues.player1;
  if (game && game.balls && game.balls[0] && id) game.balls[0].applyCue(id, false);
  this.syncHitButton();
};

GameGui.prototype.syncHitButton = function () {
  var btn = document.getElementById('btn_ball');
  var power = document.querySelector('#controlsHud .power');
  if (!btn) return;
  var live = this.live && this.live.on;
  var gameOn = typeof eightballgame !== 'undefined' && eightballgame;
  var mySeat = !live || !gameOn || this.live.seat === eightballgame.turn;
  var mine = !live || (gameOn && this.live.myTurn());
  if (power) {
    if (mySeat) GameGui.removeClass(power, 'hide');
    else GameGui.addClass(power, 'hide');
  }
  if (!mine) {
    btn.disabled = true;
    btn.textContent = 'Wait';
    return;
  }
  btn.textContent = 'Hit';
  if (game && game.balls[0] && game.balls[0].aimBlocked) return;
  btn.disabled = false;
};

GameGui.prototype.updateBalls = function(ballArr, p1side, p2side) {
  p1side = p1side == '?' ? 'unknown' : p1side;
  p2side = p2side == '?' ? 'unknown' : p2side;

  GameGui.removeClass(document.getElementsByClassName('player1')[0], 'solid');
  GameGui.removeClass(document.getElementsByClassName('player2')[0], 'solid');
  GameGui.removeClass(document.getElementsByClassName('player1')[0], 'striped');
  GameGui.removeClass(document.getElementsByClassName('player2')[0], 'striped');
  GameGui.removeClass(document.getElementsByClassName('player1')[0], 'unknown');
  GameGui.removeClass(document.getElementsByClassName('player2')[0], 'unknown');
  GameGui.addClass(document.getElementsByClassName('player1')[0], p1side);
  GameGui.addClass(document.getElementsByClassName('player2')[0], p2side);

  var p1Score = document.querySelector('.player1 .score');
  var p2Score = document.querySelector('.player2 .score');
  if (p1side == 'unknown') {
    if (p1Score) p1Score.textContent = '0';
    if (p2Score) p2Score.textContent = '0';
    this.fillBallRow('player1', [], ballArr);
    this.fillBallRow('player2', [], ballArr);
    return;
  }

  var solidPocketed = 0;
  var stripePocketed = 0;
  for (var n = 1; n < 8; n++) {
    if (ballArr.indexOf(n) === -1) solidPocketed++;
  }
  for (var m = 9; m < 16; m++) {
    if (ballArr.indexOf(m) === -1) stripePocketed++;
  }
  if (p1Score && p2Score) {
    p1Score.textContent = p1side == 'solid' ? solidPocketed : stripePocketed;
    p2Score.textContent = p1side == 'solid' ? stripePocketed : solidPocketed;
  }

  var solidNumbers = [1, 2, 3, 4, 5, 6, 7];
  var stripeNumbers = [9, 10, 11, 12, 13, 14, 15];
  var missing = false;
  missing = this.fillBallRow(p1side == 'solid' ? 'player1' : 'player2', solidNumbers, ballArr) || missing;
  missing = this.fillBallRow(p1side == 'striped' ? 'player1' : 'player2', stripeNumbers, ballArr) || missing;

  if (missing && GameGui.iconRetries < 25) {
    GameGui.iconRetries++;
    var self = this;
    setTimeout(function () {
      self.updateBalls(ballArr, p1side, p2side);
    }, 200);
  }
};

GameGui.iconRetries = 0;

GameGui.prototype.fillBallRow = function (playerClass, numbers, ballArr) {
  var player = document.getElementsByClassName(playerClass)[0];
  var list = player.children[1];
  if (!list || list.tagName !== 'UL' || list.children.length !== 7) {
    list = document.createElement('ul');
    for (var s = 0; s < 7; s++) list.appendChild(document.createElement('li'));
    player.replaceChild(list, player.children[1]);
  }

  var missing = false;
  for (var i = 0; i < 7; i++) {
    var slot = list.children[i];
    var number = numbers[i];
    var show = !!number && ballArr.indexOf(number) !== -1;
    var face = slot.querySelector('.ball-face');

    if (!show) {
      if (face) slot.removeChild(face);
      continue;
    }

    var icon = GameGui.ballIcon(number);
    if (!icon) {
      missing = true;
      continue;
    }
    if (face && face.getAttribute('data-ball') === String(number)) continue;

    if (face) slot.removeChild(face);
    face = document.createElement('span');
    face.className = 'ball-face';
    face.setAttribute('data-ball', String(number));
    face.style.backgroundImage = 'url("' + icon + '")';
    face.style.animationDelay = (i * 45) + 'ms';
    slot.appendChild(face);
  }
  return missing;
};

GameGui.ballIcon = function (number) {
  if (GameGui.iconCache[number]) return GameGui.iconCache[number];
  if (typeof game === 'undefined' || !game || !game.balls) return '';

  var source = null;
  for (var i = 0; i < game.balls.length; i++) {
    if (game.balls[i].name === number + 'ball') source = game.balls[i];
  }
  if (!source || !source.mesh.material.map) return '';

  if (!GameGui.iconRenderer) {
    GameGui.iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    GameGui.iconRenderer.setPixelRatio(1);
    GameGui.iconRenderer.setSize(96, 96);
    GameGui.iconRenderer.setClearColor(0x000000, 0);
    GameGui.iconScene = new THREE.Scene();
    GameGui.iconCamera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    GameGui.iconCamera.position.set(0, Ball.RADIUS * 0.35, Ball.RADIUS * 4.6);
    GameGui.iconCamera.lookAt(new THREE.Vector3(0, 0, 0));
    GameGui.iconScene.add(new THREE.AmbientLight(0x9a9a9a));
    var key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(4, 8, 6);
    GameGui.iconScene.add(key);
  }

  var mesh = new THREE.Mesh(source.mesh.geometry, source.mesh.material);
  mesh.rotation.set(-0.15, 2.9, 0);
  GameGui.iconScene.add(mesh);
  GameGui.iconRenderer.render(GameGui.iconScene, GameGui.iconCamera);
  GameGui.iconCache[number] = GameGui.iconRenderer.domElement.toDataURL('image/png');
  GameGui.iconScene.remove(mesh);
  return GameGui.iconCache[number];
};

GameGui.iconCache = {};

GameGui.prototype.showEndGame = function(str) {
  var mine = 'Player 1';
  if (this.live && this.live.on) mine = this.live.seat === 'player2' ? 'Player 2' : 'Player 1';
  if (str === mine && this.city) {
    this.wins += 1;
    this.balance += this.city.prize;
    this.saveProfile();
    this.renderProfile();
  }
  document.getElementById("gameover").children[0].textContent = str + " won!";
  this.show(document.getElementById('gameover'));
}
