/* Reusable <sinc-wave>: fixed-axis, spring-driven source and outward-growing DSP samples. */
(() => {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const sinc = (x) => Math.abs(x) < 1e-8 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);

  class SincWave extends HTMLElement {
    connectedCallback() {
      this.innerHTML = `
        <section class="signal-domain signal-domain--time" aria-label="Time domain">
          <div class="domain-heading"><span>Time domain</span><span class="domain-equation time-equation"></span></div>
          <canvas class="time-canvas" aria-hidden="true"></canvas>
        </section>
        <section class="signal-domain signal-domain--frequency" aria-label="Frequency domain">
          <div class="domain-heading"><span>Frequency domain</span><span class="domain-equation frequency-equation"></span></div>
          <canvas class="frequency-canvas" aria-hidden="true"></canvas>
        </section>`;
      this.canvas = this.querySelector('canvas');
      this.context = this.canvas.getContext('2d');
      this.frequencyCanvas = this.querySelector('.frequency-canvas');
      this.frequencyContext = this.frequencyCanvas.getContext('2d');
      if (!this.context) return;
      this.targetCenterX = this.currentCenterX = 0.5;
      this.targetCursorY = this.currentCursorY = 0.08;
      this.velocityX = this.velocityY = 0;
      this.targetCenterFrequency = 0;
      this.frequencyVelocity = 0;
      this.time = this.lastEmission = 0;
      this.emissionX = this.currentCenterX;
      this.propagationRadius = 0;
      this.fronts = [0];
      this.samples = [];
      this.frame = 0;
      this.resettingBandwidth = false;
      this.filterState = { amplitude: 0.84, timeShift: 0, bandwidth: 1, centerFrequency: 0, controlMode: 'time' };
      this.spectrum = new window.SpectrumRenderer();
      this.drag = null;
      this.coarsePointer = matchMedia('(pointer: coarse)');
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.events = new AbortController();
      const options = { signal: this.events.signal };
      this.equation = this.querySelector('.time-equation');
      this.frequencyEquation = this.querySelector('.frequency-equation');
      const control = this.closest('.hero-wave')?.querySelector('.frequency-control');
      if (control) {
        const slider = control.querySelector('input');
        const output = control.querySelector('output');
        this.syncBandwidthControl = () => {
          this.setAttribute('data-control-mode', this.filterState.controlMode);
          const current = this.filterState.bandwidth;
          slider.min = '0.5';
          slider.max = '2.5';
          slider.value = String(current);
          output.value = `${current.toFixed(2)}×`;
          control.querySelector('label').textContent = 'Bandwidth';
          slider.setAttribute('aria-valuetext', `${current.toFixed(2)} times bandwidth`);
          slider.style.setProperty('--fill', `${(current - Number(slider.min)) / (Number(slider.max) - Number(slider.min)) * 100}%`);
          this.closest('.hero-wave').querySelectorAll('button[data-control-mode]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.controlMode === this.filterState.controlMode));
          });
        };
        control.querySelector('.signal-reset').addEventListener('click', () => this.reset(), options);
        slider.addEventListener('input', () => {
          this.resettingBandwidth = false;
          this.filterState.bandwidth = clamp(Number(slider.value), 0.5, 2.5);
          this.syncBandwidthControl();
          this.animate();
        }, options);
        this.closest('.hero-wave').querySelectorAll('button[data-control-mode]').forEach(button => {
          button.addEventListener('click', () => {
            this.endDrag();
            this.filterState.controlMode = button.dataset.controlMode;
            this.syncBandwidthControl();
          }, options);
        });
        this.syncBandwidthControl();
      }
      const move = (event) => {
        if (event.isPrimary === false || this.filterState.controlMode !== 'time') return;
        const point = this.pointerPosition(event, this.canvas);
        if (!point) return;
        this.targetCenterX = point.x;
        this.targetCursorY = point.y;
        this.animate();
      };
      const moveFrequency = (event) => {
        if (event.isPrimary === false || this.filterState.controlMode !== 'frequency') return;
        const point = this.pointerPosition(event, this.frequencyCanvas);
        if (!point) return;
        const { x, y } = point;
        this.targetCenterFrequency = (x - 0.5) * 4;
        // Normalized gain occupies the space above the fixed 90% baseline.
        // A/B is the exact Fourier gain; B-normalized display height avoids clipping.
        const amplitude = clamp((0.9 - y) / 0.8, 0, 1);
        this.targetCursorY = (1 - amplitude) / 2;
        this.animate();
      };
      this.bindPlotPointer(this.frequencyCanvas, 'frequency', moveFrequency, options);
      const reset = () => {
        this.targetCenterX = 0.5;
        this.targetCursorY = 0.08;
        this.animate();
      };
      this.bindPlotPointer(this.canvas, 'time', move, options);
      window.addEventListener('blur', () => { this.endDrag(); reset(); }, options);
      this.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home') return this.reset();
        if (this.filterState.controlMode === 'frequency') {
          this.targetCenterFrequency = clamp(this.targetCenterFrequency + (event.key === 'ArrowLeft' ? -0.1 : event.key === 'ArrowRight' ? 0.1 : 0), -2, 2);
          this.targetCursorY = clamp(this.targetCursorY + (event.key === 'ArrowUp' ? -0.025 : event.key === 'ArrowDown' ? 0.025 : 0), 0, 0.5);
          this.animate();
          return;
        }
        this.targetCursorY = clamp(this.targetCursorY + (event.key === 'ArrowUp' ? -0.035 : event.key === 'ArrowDown' ? 0.035 : 0), 0, 1);
        this.targetCenterX = clamp(this.targetCenterX + (event.key === 'ArrowLeft' ? -0.035 : event.key === 'ArrowRight' ? 0.035 : 0), 0, 1);
        this.animate();
      }, options);
      this.motion.addEventListener('change', () => this.animate(), options);
      window.addEventListener('resize', () => this.measure(), options);
      this.resize = new ResizeObserver(() => this.measure());
      this.resize.observe(this);
      this.measure();
    }

    pointerPosition(event, plot) {
      const rect = plot.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const touch = this.drag?.touch && this.drag.pointerId === event.pointerId;
      const point = {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top - (touch ? 26 : 0)) / rect.height, 0, 1),
      };
      if (touch) this.drag.point = point;
      return point;
    }

    bindPlotPointer(plot, domain, move, options) {
      plot.addEventListener('pointerdown', event => {
        if (event.isPrimary === false || event.button > 0 || this.drag || this.filterState.controlMode !== domain) return;
        this.drag = {
          plot, pointerId: event.pointerId,
          touch: event.pointerType === 'touch' || (event.pointerType !== 'mouse' && this.coarsePointer.matches),
        };
        plot.setPointerCapture(event.pointerId);
        move(event);
      }, options);
      plot.addEventListener('pointermove', event => {
        if (this.drag && (this.drag.plot !== plot || this.drag.pointerId !== event.pointerId)) return;
        // Mouse hover stays interactive; touch/pen move only during their capture.
        if (!this.drag && event.pointerType !== 'mouse') return;
        move(event);
      }, options);
      const finish = event => {
        if (this.drag?.plot !== plot || this.drag.pointerId !== event.pointerId) return;
        if (event.type === 'pointerup') move(event);
        this.endDrag();
        this.animate();
      };
      plot.addEventListener('pointerup', finish, options);
      plot.addEventListener('pointercancel', finish, options);
      plot.addEventListener('lostpointercapture', finish, options);
    }

    endDrag() {
      const drag = this.drag;
      this.drag = null;
      if (drag?.plot.hasPointerCapture(drag.pointerId)) drag.plot.releasePointerCapture(drag.pointerId);
    }

    reset() {
      this.endDrag();
      this.targetCenterFrequency = 0;
      this.frequencyVelocity = 0;
      this.targetCenterX = 0.5;
      this.targetCursorY = 0.08;
      this.velocityX = this.velocityY = 0;
      this.resettingBandwidth = true;
      this.time = this.lastEmission = 0;
      this.emissionX = this.currentCenterX;
      this.propagationRadius = 0;
      this.fronts = [0];
      for (const sample of this.samples) sample.born = null;
      this.spectrum.noiseClock = 0;
      this.spectrum.revealTime = 0;
      for (const bin of this.spectrum.bins) {
        bin.velocity = 0;
        bin.noiseTarget = 0.009;
      }
      this.animate();
    }

    measure() {
      const { width, height } = this.canvas.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = window.devicePixelRatio || 1;
      if (width === this.width && height === this.height && dpr === this.dpr) return;
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.timeGlow = null;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.frequencyCanvas.width = this.canvas.width;
      this.frequencyCanvas.height = this.canvas.height;
      this.frequencyContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Six mathematical units per side: five side lobes and the central peak.
      // Keep 4–8 distinct stems per lobe, including an exact sample at the source.
      this.perLobe = clamp(Math.round(width / 80), 10, 16);
      this.spacing = width / (12 * this.perLobe);
      this.spectrum.resize(width);
      const old = new Map(this.samples.map(sample => [sample.index, sample]));
      this.samples = [];
      for (let index = -12 * this.perLobe; index <= 12 * this.perLobe; index++) {
        this.samples.push(old.get(index) || { index, growth: 0, born: this.fronts.length ? null : this.time });
      }
      this.animate();
    }

    update(dt) {
      this.time += dt;
      const reduced = this.motion.matches;
      if (this.resettingBandwidth) {
        this.filterState.bandwidth += (1 - this.filterState.bandwidth) * (1 - Math.exp(-dt * 12));
        if (reduced || Math.abs(this.filterState.bandwidth - 1) < 0.001) {
          this.filterState.bandwidth = 1;
          this.resettingBandwidth = false;
        }
        this.syncBandwidthControl?.();
      }
      if (reduced) {
        this.filterState.centerFrequency = this.targetCenterFrequency;
        this.frequencyVelocity = 0;
        this.currentCenterX = this.targetCenterX;
        this.currentCursorY = this.targetCursorY;
        this.velocityX = this.velocityY = 0;
        this.fronts = [];
      } else {
        // Small integration steps keep the damped spring stable on slower frames.
        const steps = Math.ceil(dt / (1 / 120));
        const step = dt / steps;
        const stiffness = this.drag?.touch ? 420 : 190;
        const damping = this.drag?.touch ? 38 : 25;
        for (let i = 0; i < steps; i++) {
          this.frequencyVelocity += ((this.targetCenterFrequency - this.filterState.centerFrequency) * stiffness - this.frequencyVelocity * damping) * step;
          this.filterState.centerFrequency += this.frequencyVelocity * step;
          this.velocityX += ((this.targetCenterX - this.currentCenterX) * stiffness - this.velocityX * damping) * step;
          this.currentCenterX += this.velocityX * step;
          this.velocityY += ((this.targetCursorY - this.currentCursorY) * stiffness - this.velocityY * damping) * step;
          this.currentCursorY += this.velocityY * step;
        }
        const traveled = Math.abs((this.currentCenterX - this.emissionX) * this.width);
        if (traveled > this.spacing * 1.5 && this.time - this.lastEmission > 0.26) {
          this.fronts.push(this.time);
          this.lastEmission = this.time;
          this.emissionX = this.currentCenterX;
        }
      }
      const speed = this.width / 0.85;
      this.propagationRadius = reduced ? this.width : (this.time - this.lastEmission) * speed;
      let growing = false;
      for (const sample of this.samples) {
        const distance = Math.abs(sample.index * this.spacing);
        // Each front travels independently in BOTH directions; moving never clears samples.
        for (const emitted of this.fronts) {
          const arrival = emitted + distance / speed;
          if (arrival <= this.time && (sample.born === null || arrival > sample.born)) sample.born = arrival;
        }
        const age = sample.born === null ? 0 : this.time - sample.born;
        const progress = clamp(age / 0.2, 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        // First arrival grows from zero. Later fronts only breathe by 8%, so the
        // signal stays legible and its central peak never collapses while tracking.
        const target = reduced ? 1 : sample.established
          ? (sample.index === 0 ? 1 : 0.92 + 0.08 * eased) : eased;
        sample.growth += (target - sample.growth) * (1 - Math.exp(-dt * 28));
        if (reduced || Math.abs(target - sample.growth) < 0.001) sample.growth = target;
        if (sample.growth >= 0.999) sample.established = true;
        if (sample.growth !== target || (sample.born !== null && progress < 1)) growing = true;
      }
      this.fronts = this.fronts.filter(emitted => this.time - emitted <= 0.85);
      const moving = Math.abs((this.targetCenterX - this.currentCenterX) * this.width) > 0.05 ||
        Math.abs(this.velocityX * this.width) > 0.05 ||
        Math.abs((this.targetCursorY - this.currentCursorY) * this.height) > 0.05 ||
        Math.abs(this.velocityY * this.height) > 0.05;
      if (!moving) {
        this.currentCenterX = this.targetCenterX;
        this.currentCursorY = this.targetCursorY;
        this.velocityX = this.velocityY = 0;
      }
      const frequencyMoving = Math.abs(this.targetCenterFrequency - this.filterState.centerFrequency) > 0.0001 || Math.abs(this.frequencyVelocity) > 0.0001;
      if (!frequencyMoving) { this.filterState.centerFrequency = this.targetCenterFrequency; this.frequencyVelocity = 0; }
      this.filterState.amplitude = 1 - 2 * this.currentCursorY;
      this.filterState.timeShift = (this.currentCenterX - 0.5) * 12;
      const spectrumActive = this.spectrum.update(dt, this.filterState, reduced);
      return frequencyMoving || moving || growing || this.fronts.length > 0 || spectrumActive || this.resettingBandwidth;
    }

    updateEquation() {
      if (!this.equation) return;
      const format = (value, digits = 2) => {
        const rounded = Number(value.toFixed(digits));
        return (Object.is(rounded, -0) ? 0 : rounded).toFixed(digits);
      };
      let text;
      {
        // Time spans [-6, 6]; amplitude is normalized to half the canvas height.
        const amplitude = this.filterState.amplitude;
        const shift = this.filterState.timeShift;
        const sign = Number(shift.toFixed(2)) < 0 ? '+' : '−';
        text = `Re h(t) = ${format(amplitude)} · sinc(${format(this.filterState.bandwidth)}(t ${sign} ${format(Math.abs(shift))}))`;
      }
      if (Math.abs(this.filterState.centerFrequency) > 0.0001) {
        const shift = this.filterState.timeShift;
        text += ` · cos(2π · ${format(this.filterState.centerFrequency)}(t ${shift < 0 ? '+' : '−'} ${format(Math.abs(shift))}))`;
      }
      const gain = Math.abs(this.filterState.amplitude) / this.filterState.bandwidth;
      const frequencyText = `|H(f)| = ${format(gain)} · rect((f − ${format(this.filterState.centerFrequency)}) / ${format(this.filterState.bandwidth)})`;
      if (this.frequencyEquation.textContent !== frequencyText) this.frequencyEquation.textContent = frequencyText;
      // Avoid replacing text unless the visible, rounded parameters changed.
      if (this.equation.textContent !== text) this.equation.textContent = text;
    }

    render() {
      this.updateEquation();
      this.context.clearRect(0, 0, this.width, this.height);
      this.renderTime(1);
      this.frequencyContext.clearRect(0, 0, this.width, this.height);
      this.spectrum.render(this.frequencyContext, this.width, this.height, 1);
      if (this.drag?.touch && this.drag.point) {
        const ctx = this.drag.plot === this.canvas ? this.context : this.frequencyContext;
        const { x, y } = this.drag.point;
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#ffc1ac';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x * this.width, y * this.height, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    renderTime(opacity) {
      const ctx = this.context;
      const sourceX = (this.filterState.timeShift / 12 + 0.5) * this.width;
      // The axis stays fixed; signed amplitude makes the center sample reach cursor Y.
      const baseline = this.height * 0.5;
      const amplitude = this.filterState.amplitude * this.height / 2;
      ctx.globalAlpha = opacity;
      // Canvas coordinates remain CSS pixels; only the backing store uses DPR.
      if (!this.timeGlow || this.glowX !== sourceX) {
        this.timeGlow = ctx.createRadialGradient(sourceX, baseline, 0, sourceX, baseline, this.height * 0.65);
        this.timeGlow.addColorStop(0, 'rgba(255, 77, 112, 0.085)');
        this.timeGlow.addColorStop(0.4, 'rgba(202, 55, 83, 0.035)');
        this.timeGlow.addColorStop(1, 'rgba(110, 30, 55, 0)');
        this.glowX = sourceX;
      }
      ctx.fillStyle = this.timeGlow;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.strokeStyle = '#c5a7b6';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.16 * opacity;
      ctx.beginPath();
      ctx.moveTo(0, baseline);
      ctx.lineTo(this.width, baseline);
      ctx.stroke();
      for (const sample of this.samples) {
        const x = sourceX + sample.index * this.spacing;
        if (x < -2 || x > this.width + 2 || sample.growth < 0.001) continue;
        // Recalculate the actual function about the smoothed pointer origin.
        const t = (x - sourceX) * this.filterState.bandwidth / (this.width / 12);
        const carrier = Math.cos(2 * Math.PI * this.filterState.centerFrequency * (x - sourceX) / (this.width / 12));
        const y = baseline - amplitude * sinc(t) * carrier * sample.growth;
        // A soft edge treatment keeps the signal open and borderless.
        const edge = sample.index === 0 ? 1 : clamp(Math.min(x, this.width - x) / 24, 0.25, 1);
        const distance = Math.abs(t);
        const warmth = clamp(distance / 4, 0, 1);
        const color = `rgb(255, ${Math.round(91 + warmth * 57)}, ${Math.round(128 - warmth * 31)})`;
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.globalAlpha = (0.8 - 0.3 * clamp(distance / 8, 0, 1)) * edge * opacity;
        ctx.beginPath();
        ctx.moveTo(x, baseline);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 0.85 * edge * opacity;
        ctx.shadowColor = color;
        ctx.shadowBlur = sample.index === 0 ? 9 : 3;
        ctx.beginPath();
        ctx.arc(x, y, sample.index === 0 ? 2.2 : 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    animate() {
      if (this.frame || !this.width) return;
      let previous;
      const tick = (time) => {
        const dt = previous === undefined ? 1 / 60 : clamp((time - previous) / 1000, 0.001, 0.04);
        previous = time;
        const active = this.update(dt);
        this.render();
        this.frame = active ? requestAnimationFrame(tick) : 0;
      };
      this.frame = requestAnimationFrame(tick);
    }

    disconnectedCallback() {
      this.endDrag();
      cancelAnimationFrame(this.frame);
      this.resize?.disconnect();
      this.events?.abort();
    }
  }
  customElements.define('sinc-wave', SincWave);
})();
