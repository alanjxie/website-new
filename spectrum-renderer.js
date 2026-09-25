/* Analytic Fourier magnitude of A sinc(B(t−τ)): |A|/B rect(f/B).
   Frequency coordinates span [-2, 2]. Noise is a separate display layer. */
window.SpectrumRenderer = class SpectrumRenderer {
  constructor() { this.bins = []; this.noiseClock = 0; this.revealTime = 0; }
  resize(width) {
    this.glow = null;
    const count = Math.max(49, Math.min(201, Math.round(width / 8) | 1));
    const old = this.bins;
    this.bins = Array.from({ length: count }, (_, i) => ({
      x: (i + 0.5) / count,
      frequency: ((i + 0.5) / count - 0.5) * 4,
      magnitude: old[Math.floor(i * old.length / count)]?.magnitude || 0,
      velocity: 0,
      noiseCurrent: 0.009,
      noiseTarget: 0.005 + Math.random() * 0.009,
    }));
  }
  begin() {
    this.revealTime = 0;
    for (const bin of this.bins) { bin.magnitude = 0; bin.velocity = 0; }
  }
  update(dt, filter, reduced) {
    this.revealTime += dt;
    this.noiseClock += reduced ? 0 : dt;
    if (this.noiseClock >= 0.24) {
      this.noiseClock %= 0.24;
      for (const bin of this.bins) bin.noiseTarget = 0.005 + Math.random() * 0.009;
    }
    this.displayBandwidth = filter.bandwidth;
    const gain = Math.abs(filter.amplitude) / filter.bandwidth;
    const steps = Math.ceil(dt / (1 / 120));
    const step = dt / steps;
    for (const bin of this.bins) {
      if (!reduced) bin.noiseCurrent += (bin.noiseTarget - bin.noiseCurrent) * (1 - Math.exp(-dt * 5));
      const distance = Math.abs(bin.frequency - filter.centerFrequency);
      const edge = filter.bandwidth / 2;
      bin.idealMagnitude = distance < edge ? gain : Math.abs(distance - edge) < 1e-9 ? gain / 2 : 0;
      // A symmetric generation front traverses the largest possible passband
      // in 250 ms. The spring supplies the remaining gentle growth and decay.
      const revealed = reduced || this.revealTime >= distance / 5;
      bin.target = revealed ? bin.idealMagnitude : 0;
      if (reduced) { bin.magnitude = bin.target; bin.velocity = 0; }
      else for (let i = 0; i < steps; i++) {
        bin.velocity += ((bin.target - bin.magnitude) * 240 - bin.velocity * 31) * step;
        bin.magnitude += bin.velocity * step;
      }
    }
    return !reduced;
  }
  render(ctx, width, height, opacity) {
    const baseline = height * 0.9;
    if (!this.glow || this.glowHeight !== height || this.glowWidth !== width) {
      this.glow = ctx.createRadialGradient(width / 2, baseline, 0, width / 2, baseline, height * 0.65);
      this.glow.addColorStop(0, 'rgba(255, 77, 112, 0.07)');
      this.glow.addColorStop(1, 'rgba(110, 30, 55, 0)');
      this.glowHeight = height;
      this.glowWidth = width;
    }
    ctx.globalAlpha = opacity;
    ctx.fillStyle = this.glow; ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = opacity * 0.16;
    ctx.strokeStyle = '#c5a7b6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, baseline); ctx.lineTo(width, baseline); ctx.stroke();
    for (const bin of this.bins) {
      const x = bin.x * width;
      // B-normalized height keeps gain bounded across bandwidth settings.
      const magnitude = Math.max(0, Math.min(2.05, bin.magnitude + bin.noiseCurrent));
      const y = baseline - Math.min(1.02, magnitude * (this.displayBandwidth || 1)) * height * 0.8;
      const brightness = Math.min(1, bin.magnitude / 2);
      const color = `rgb(255, ${Math.round(91 + brightness * 74)}, ${Math.round(128 - brightness * 17)})`;
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.globalAlpha = opacity * (bin.idealMagnitude > 0 ? 0.82 : 0.4);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, baseline); ctx.lineTo(x, y); ctx.stroke();
      ctx.shadowColor = color; ctx.shadowBlur = bin.idealMagnitude > 0 ? 4 : 0;
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
};
