/**
 * Ashwanth Crackers - Festive Particles & Fireworks Engine
 * Lightweight, high-performance canvas animation
 */

class FestiveParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.fireworks = [];
    this.running = false;
    this.colors = ['#ff6f61', '#ac332a', '#ffe16d', '#ffffff', '#d4af37', '#ff8175'];

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.createAmbientParticles();
    this.start();

    // Occasional subtle fireworks burst
    setInterval(() => {
      if (document.visibilityState === 'visible' && this.fireworks.length < 4) {
        this.addFirework(
          Math.random() * this.width * 0.8 + this.width * 0.1,
          Math.random() * this.height * 0.5 + 50
        );
      }
    }, 2800);
  }

  resize() {
    this.width = this.canvas.parentElement.clientWidth || window.innerWidth;
    this.height = this.canvas.parentElement.clientHeight || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  createAmbientParticles() {
    const count = Math.min(Math.floor(this.width / 25), 45);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 2.5 + 1,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        vx: (Math.random() - 0.5) * 0.6,
        vy: -Math.random() * 0.8 - 0.2,
        alpha: Math.random() * 0.6 + 0.2,
        pulse: Math.random() * 0.05
      });
    }
  }

  addFirework(x, y) {
    const burstColor = this.colors[Math.floor(Math.random() * this.colors.length)];
    const sparkCount = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 / sparkCount) * i + (Math.random() * 0.2);
      const speed = Math.random() * 3 + 2;
      this.fireworks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2 + 1,
        color: burstColor,
        alpha: 1,
        decay: Math.random() * 0.02 + 0.015,
        gravity: 0.04
      });
    }
  }

  start() {
    if (!this.running) {
      this.running = true;
      this.animate();
    }
  }

  animate() {
    if (!this.running) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // Render Ambient Floating Sparks
    for (let p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha += Math.sin(Date.now() * 0.003) * p.pulse;

      if (p.y < 0) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0.1, Math.min(0.9, p.alpha));
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Render Fireworks Bursts
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const f = this.fireworks[i];
      f.x += f.vx;
      f.y += f.vy;
      f.vy += f.gravity;
      f.vx *= 0.98;
      f.alpha -= f.decay;

      if (f.alpha <= 0) {
        this.fireworks.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = f.alpha;
      this.ctx.fillStyle = f.color;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = f.color;
      this.ctx.beginPath();
      this.ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    requestAnimationFrame(() => this.animate());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('particles-canvas')) {
    new FestiveParticles('particles-canvas');
  }
});
