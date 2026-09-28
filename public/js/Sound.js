var Sound = {
  ctx: null,
  master: null,
  buffers: null,

  ensure: function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      var comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 4;
      comp.attack.value = 0.002;
      comp.release.value = 0.08;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.buffers = {
        cue: this.makeHit(170, 0.11, 0.42, 0.018),
        click: this.makeHit(2400, 0.02, 0.85, 0.003),
        ball: this.makeHit(980, 0.055, 0.62, 0.007),
        eight: this.makeHit(210, 0.16, 0.28, 0.032),
        eightClick: this.makeHit(640, 0.04, 0.5, 0.008),
        ui: this.makeHit(1480, 0.045, 0.12, 0.01)
      };
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  makeHit: function (freq, dur, noiseMix, decay) {
    var rate = this.ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * dur));
    var buffer = this.ctx.createBuffer(1, len, rate);
    var data = buffer.getChannelData(0);
    var phase = 0;
    var step = (Math.PI * 2 * freq) / rate;
    for (var i = 0; i < len; i++) {
      var env = Math.exp(-(i / rate) / decay);
      phase += step;
      var tone = Math.sin(phase);
      var noise = Math.random() * 2 - 1;
      data[i] = (tone * (1 - noiseMix) + noise * noiseMix) * env;
    }
    return buffer;
  },

  play: function (buffer, gain, rate) {
    if (!buffer || !this.ctx) return;
    var src = this.ctx.createBufferSource();
    var amp = this.ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate || 1;
    amp.gain.value = gain;
    src.connect(amp);
    amp.connect(this.master);
    src.start();
  },

  cue: function (strength) {
    if (!this.ensure()) return;
    var amount = (Number(strength) - 10) / 90;
    if (amount < 0) amount = 0;
    if (amount > 1) amount = 1;
    var gain = 0.35 + amount * 0.65;
    this.play(this.buffers.cue, gain, 0.92 + amount * 0.2);
    this.play(this.buffers.click, gain * 0.55, 1.1 + amount * 0.35);
  },

  balls: function (speed, eight) {
    if (!this.ensure()) return;
    var t = speed / 200;
    if (t < 0.04) return;
    if (t > 1) t = 1;
    var gain = 0.18 + t * 0.82;
    if (eight) {
      this.play(this.buffers.eight, gain * 0.95, 0.86 + t * 0.22);
      this.play(this.buffers.eightClick, gain * 0.4, 0.9 + t * 0.2);
      return;
    }
    this.play(this.buffers.ball, gain * 0.75, 0.82 + t * 0.55);
    this.play(this.buffers.click, gain * 0.28, 1.2 + t * 0.4);
  },

  select: function () {
    if (!this.ensure()) return;
    this.play(this.buffers.ui, 0.22, 1);
    var self = this;
    setTimeout(function () {
      if (self.ctx) self.play(self.buffers.ui, 0.1, 1.35);
    }, 28);
  }
};

document.addEventListener('pointerdown', function () {
  Sound.ensure();
});
