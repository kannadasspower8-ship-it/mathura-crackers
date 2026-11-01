/**
 * Mathura Crackers - Cinematic Real-Time Fireworks Engine
 * Continuous, Multi-Stage Canvas Pyrotechnic Experience
 * Realistic Ascension, Luminous Trails, Radial Bursts, Falling Sparks, and Golden Willows
 */
(function () {
  'use strict';

  // Dynamic canvas elements
  let canvas = null;
  let heroSection = null;
  let ctx = null;

  function ensureCanvas() {
    canvas = document.getElementById('hero-fireworks-canvas');
    if (!canvas) {
      heroSection = null;
      ctx = null;
      return false;
    }
    heroSection = document.getElementById('hero') || canvas.closest('.hero-section') || canvas.parentElement;
    try {
      ctx = canvas.getContext('2d', { alpha: true });
    } catch (e) {
      ctx = null;
    }
    return !!ctx;
  }

  // Accessibility check - gentle mode rather than complete shutdown
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // State variables
  let width = 0;
  let height = 0;
  let dpr = 1;
  let isRunning = false;
  let isPageVisible = true;
  let isScrolledIntoView = true;
  let animationFrameId = null;
  let lastLaunchTime = 0;
  let nextLaunchDelay = 500;

  // Active Pyrotechnic Entity Arrays
  const rockets = [];
  const particles = [];
  const flashes = [];
  const ambientSparks = [];

  // Authentic Sivakasi Pyrotechnic Color Themes (Adapted to Golden Sunrise Atmosphere)
  const THEMES = [
    {
      name: 'imperial-gold',
      weight: 0.40,
      core: '#ffffff',
      glow: '#F5C542',
      trail: '#E5A000',
      colors: ['#FFF0B3', '#F5C542', '#E5A000', '#FFD54F', '#ffffff', '#FFCA28']
    },
    {
      name: 'festive-amber',
      weight: 0.30,
      core: '#FFF8E7',
      glow: '#E5A000',
      trail: '#F5C542',
      colors: ['#E5A000', '#F5C542', '#FFA000', '#FFB74D', '#FF8F00', '#ffffff']
    },
    {
      name: 'sivakasi-ruby-gold',
      weight: 0.18,
      core: '#ffffff',
      glow: '#8F1D14',
      trail: '#E5A000',
      colors: ['#8F1D14', '#F5C542', '#D32F2F', '#E5A000', '#FF8A80', '#ffffff']
    },
    {
      name: 'champagne-sunburst',
      weight: 0.12,
      core: '#ffffff',
      glow: '#FFF8E7',
      trail: '#F5C542',
      colors: ['#ffffff', '#FFF8E7', '#F5C542', '#FFF59D', '#FFE082', '#ffffff']
    }
  ];

  function pickTheme() {
    const r = Math.random();
    let acc = 0;
    for (const t of THEMES) {
      acc += t.weight;
      if (r <= acc) return t;
    }
    return THEMES[0];
  }

  // =========================================================================
  // 1. SKY FLASH (Atmospheric cloud illumination on burst)
  // =========================================================================
  class SkyFlash {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.radius = width < 768 ? 130 : 240;
      this.alpha = prefersReduced ? 0.10 : 0.28;
      this.decay = 0.045;
    }
    update() {
      this.alpha -= this.decay;
    }
    draw(c) {
      if (this.alpha <= 0) return;
      c.save();
      c.globalAlpha = Math.max(0, this.alpha);
      const grad = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, this.color);
      grad.addColorStop(0.35, this.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // =========================================================================
  // 2. ROCKET (Ascending Firework Projectile with Sparkling Trail)
  // =========================================================================
  class Rocket {
    constructor(startX, startY, targetX, targetY, theme, isLarge = false) {
      this.x = startX;
      this.y = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      this.theme = theme;
      this.isLarge = isLarge;

      // Calculate ballistic trajectory towards target apex
      const dx = targetX - startX;
      const dy = targetY - startY;
      const distY = Math.abs(dy);

      this.gravity = 0.13;
      // Initial vertical velocity calculated so apex occurs near targetY
      const targetSpeedY = Math.sqrt(2 * this.gravity * Math.max(120, distY));
      this.vy = -targetSpeedY * (0.97 + Math.random() * 0.06);

      // Horizontal velocity proportional to travel time to reach apex
      const flightFrames = Math.max(25, targetSpeedY / this.gravity);
      this.vx = dx / flightFrames + (Math.random() - 0.5) * 0.4;

      this.trail = [];
      this.maxTrail = isLarge ? 22 : 16;
      this.sparks = []; // Dropped trailing exhaust sparks
      this.alive = true;
    }

    update() {
      // Record current position for luminous trail line
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) {
        this.trail.shift();
      }

      // Drop falling exhaust sparks along the ascending flight path
      if (Math.random() < 0.65) {
        this.sparks.push({
          x: this.x + (Math.random() - 0.5) * 3,
          y: this.y + (Math.random() * 4 + 2),
          vx: (Math.random() - 0.5) * 0.8,
          vy: Math.random() * 1.4 + 0.6,
          alpha: 1.0,
          decay: 0.06 + Math.random() * 0.04,
          size: Math.random() * 1.8 + 1.0
        });
      }

      // Update falling exhaust sparks
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= s.decay;
        if (s.alpha <= 0) {
          this.sparks.splice(i, 1);
        }
      }

      // Physics
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;

      // Detonate when vertical speed stalls near apex or passes target
      if (this.vy >= -0.7 || this.y <= this.targetY) {
        this.alive = false;
        createExplosion(this.x, this.y, this.theme, this.isLarge);
      }
    }

    draw(c) {
      c.save();

      // 1. Draw falling exhaust sparks
      for (let i = 0; i < this.sparks.length; i++) {
        const s = this.sparks[i];
        c.globalAlpha = Math.max(0, s.alpha);
        c.fillStyle = this.theme.trail;
        c.beginPath();
        c.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        c.fill();
      }

      // 2. Draw continuous tapered glowing rocket trail
      if (this.trail.length > 1) {
        for (let i = 0; i < this.trail.length - 1; i++) {
          const pt = this.trail[i];
          const next = this.trail[i + 1];
          const ratio = (i + 1) / this.trail.length;

          c.beginPath();
          c.moveTo(pt.x, pt.y);
          c.lineTo(next.x, next.y);
          c.strokeStyle = this.theme.trail;
          c.globalAlpha = ratio * 0.95;
          c.lineWidth = ratio * (this.isLarge ? 4.2 : 3.0);
          c.lineCap = 'round';
          c.stroke();
        }
      }

      // 3. Draw luminous ascending projectile head
      const headRadius = this.isLarge ? 4.0 : 2.8;

      // Outer vibrant colored halo
      c.globalAlpha = 1.0;
      c.fillStyle = this.theme.glow;
      c.shadowColor = this.theme.glow;
      c.shadowBlur = 18;
      c.beginPath();
      c.arc(this.x, this.y, headRadius, 0, Math.PI * 2);
      c.fill();

      // Intense incandescent white core
      c.fillStyle = '#ffffff';
      c.shadowBlur = 6;
      c.beginPath();
      c.arc(this.x, this.y, headRadius * 0.55, 0, Math.PI * 2);
      c.fill();

      c.restore();
    }
  }

  // =========================================================================
  // 3. PARTICLE (Explosion Spark with Gravity, Drag, Trail & Shimmer)
  // =========================================================================
  class Particle {
    constructor(x, y, vx, vy, color, style = 'peony', isLarge = false) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.style = style; // 'willow', 'peony', 'crackle', 'ring'
      this.isLarge = isLarge;
      this.alpha = 1.0;

      // Style-tailored physics
      if (style === 'willow') {
        // Lingers long, cascades downward in golden weep
        this.gravity = 0.055;
        this.friction = 0.976;
        this.decay = prefersReduced ? 0.016 : (0.007 + Math.random() * 0.005);
        this.maxTrail = 10;
        this.radius = isLarge ? 2.8 : 2.2;
      } else if (style === 'crackle') {
        // Snappy spark with popping micro-flashes
        this.gravity = 0.075;
        this.friction = 0.962;
        this.decay = prefersReduced ? 0.020 : (0.012 + Math.random() * 0.009);
        this.maxTrail = 6;
        this.radius = isLarge ? 3.0 : 2.4;
      } else {
        // Classic Peony & Crown
        this.gravity = 0.068;
        this.friction = 0.968;
        this.decay = prefersReduced ? 0.018 : (0.009 + Math.random() * 0.008);
        this.maxTrail = 7;
        this.radius = isLarge ? 3.2 : 2.5;
      }

      this.trail = [];
      this.hasCrackled = false;
      this.flickerSpeed = Math.random() * 0.25 + 0.15;
    }

    update() {
      // Record position for glowing streak trail
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) {
        this.trail.shift();
      }

      // Air resistance and gravitational acceleration
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= this.decay;

      // Secondary micro-spark flash for crackle bursts
      if (!this.hasCrackled && this.style === 'crackle' && this.alpha < 0.50 && Math.random() < 0.20) {
        this.hasCrackled = true;
        this.alpha = Math.min(1.0, this.alpha + 0.38); // sudden pop flash
      }
    }

    draw(c) {
      if (this.alpha <= 0) return;
      c.save();

      let currentAlpha = this.alpha;
      if (this.style === 'crackle' && this.alpha < 0.65) {
        currentAlpha = Math.sin(Date.now() * this.flickerSpeed) > 0 ? this.alpha : this.alpha * 0.35;
      }
      currentAlpha = Math.max(0, Math.min(1.0, currentAlpha));

      // 1. Draw glowing spark trail behind particle
      if (this.trail.length > 1) {
        for (let i = 0; i < this.trail.length - 1; i++) {
          const pt = this.trail[i];
          const next = this.trail[i + 1];
          const ratio = (i + 1) / this.trail.length;

          c.beginPath();
          c.moveTo(pt.x, pt.y);
          c.lineTo(next.x, next.y);
          c.strokeStyle = this.color;
          c.globalAlpha = ratio * currentAlpha * 0.85;
          c.lineWidth = ratio * this.radius * (currentAlpha > 0.4 ? 1.2 : 0.8);
          c.lineCap = 'round';
          c.stroke();
        }
      }

      // 2. Draw glowing spark head
      c.globalAlpha = currentAlpha;
      c.fillStyle = this.color;
      c.shadowColor = this.color;
      c.shadowBlur = currentAlpha > 0.45 ? 14 : 6;
      c.beginPath();
      c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      c.fill();

      // 3. Intense white-hot center core
      if (currentAlpha > 0.35) {
        c.fillStyle = '#ffffff';
        c.shadowBlur = 3;
        c.beginPath();
        c.arc(this.x, this.y, this.radius * 0.48, 0, Math.PI * 2);
        c.fill();
      }

      c.restore();
    }
  }

  // =========================================================================
  // 4. AMBIENT DRIFTING EMBERS (Gentle Warm Starry Glow)
  // =========================================================================
  class AmbientSpark {
    constructor() {
      this.reset(true);
    }
    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : height + 10;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = -(Math.random() * 0.4 + 0.2);
      this.radius = Math.random() * 1.6 + 0.8;
      this.alpha = Math.random() * 0.45 + 0.2;
      this.life = 0;
      this.maxLife = Math.random() * 320 + 200;
      this.color = Math.random() > 0.3 ? '#ffd700' : '#f59e0b';
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life++;
      if (this.y < -10 || this.life >= this.maxLife) {
        this.reset();
      }
    }
    draw(c) {
      c.save();
      const flicker = 0.7 + 0.3 * Math.sin(this.life * 0.06);
      c.globalAlpha = Math.max(0, Math.min(1, this.alpha * flicker));
      c.fillStyle = this.color;
      c.shadowColor = this.color;
      c.shadowBlur = 6;
      c.beginPath();
      c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // =========================================================================
  // 5. EXPLOSION GENERATOR (Multi-style Radial Bursts)
  // =========================================================================
  function createExplosion(x, y, theme, isLarge = false) {
    const isMobile = width < 768;

    // Atmospheric cloud illumination flash
    flashes.push(new SkyFlash(x, y, theme.glow));

    // Choose burst style: willow (cascading gold), peony (radial), crackle (spark pop), ring
    const styles = ['willow', 'peony', 'crackle', 'ring'];
    const style = styles[Math.floor(Math.random() * styles.length)];

    let count;
    if (prefersReduced) {
      count = isMobile ? 24 : 45;
    } else if (isLarge) {
      count = isMobile ? 65 : 125;
    } else {
      count = isMobile ? (35 + Math.floor(Math.random() * 18)) : (65 + Math.floor(Math.random() * 35));
    }

    const baseVelocity = isLarge ? (isMobile ? 6.2 : 8.4) : (isMobile ? 4.8 : 6.4);

    if (style === 'ring') {
      // Concentric Expanding Ring
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const speed = baseVelocity * (0.88 + Math.random() * 0.24);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const color = theme.colors[i % theme.colors.length];
        particles.push(new Particle(x, y, vx, vy, color, 'peony', isLarge));
      }
    } else {
      // Spherical 3D Radial Explosion with randomized depth and velocity
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.35;
        const speed = baseVelocity * (0.35 + Math.random() * 0.85);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const color = theme.colors[Math.floor(Math.random() * theme.colors.length)];
        particles.push(new Particle(x, y, vx, vy, color, style, isLarge));
      }
    }
  }

  // =========================================================================
  // 6. STRATEGIC FIREWORK LAUNCH SCHEDULER
  // Launches into the open night sky (above headings, center sky, above photo)
  // =========================================================================
  function launchFirework(targetXCoord = null, targetYCoord = null) {
    const isMobile = width < 768;

    // 1. Determine Target Apex Coordinates (Open Visible Night Sky)
    let targetX = targetXCoord;
    if (targetX === null) {
      if (isMobile) {
        // Mobile: spread across top 15% to 85% of width
        targetX = width * (0.15 + Math.random() * 0.70);
      } else {
        // Desktop: target open visible sky corridors away from left headline text
        // Area 1 (Center sky corridor above clouds): 40% - 64% width
        // Area 2 (Upper right sky above and around image card): 64% - 88% width
        const zone = Math.random();
        if (zone < 0.45) {
          targetX = width * (0.40 + Math.random() * 0.24);
        } else {
          targetX = width * (0.64 + Math.random() * 0.24);
        }
      }
    }

    let targetY = targetYCoord;
    if (targetY === null) {
      // Explode high in the open starry sky
      targetY = isMobile
        ? height * (0.10 + Math.random() * 0.32)
        : height * (0.08 + Math.random() * 0.34);
    }

    // 2. Launch Origin: Lower visible area above bottom strip
    const startX = targetX + (Math.random() - 0.5) * (width * 0.18);
    const startY = height * (0.80 + Math.random() * 0.10);

    const theme = pickTheme();
    const isLarge = Math.random() < 0.32;
    rockets.push(new Rocket(startX, startY, targetX, targetY, theme, isLarge));

    // 3. Set randomized delay to next launch (rapid, continuous, festive cadence)
    nextLaunchDelay = isMobile
      ? (prefersReduced ? 1800 : (750 + Math.random() * 950))
      : (prefersReduced ? 1400 : (450 + Math.random() * 700));
  }

  // =========================================================================
  // 7. CANVAS SIZING & RESOLUTION
  // =========================================================================
  function resize() {
    if (!canvas || !ctx || !heroSection) {
      if (!ensureCanvas()) return;
    }
    const rect = heroSection.getBoundingClientRect();

    width = Math.max(320, Math.floor(rect.width || window.innerWidth));
    height = Math.max(400, Math.floor(rect.height || window.innerHeight));
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Populate ambient spark count based on viewport
    ambientSparks.length = 0;
    const sparkCount = width < 768 ? 16 : 30;
    for (let i = 0; i < sparkCount; i++) {
      ambientSparks.push(new AmbientSpark());
    }
  }

  // =========================================================================
  // 8. MASTER ANIMATION LOOP
  // =========================================================================
  function updateAndDraw(now) {
    if (!isRunning || !ctx || !canvas || !canvas.isConnected) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      return;
    }

    // 1. Crystal-clear frame wipe (preserves 100% 4K quality of background image)
    ctx.clearRect(0, 0, width, height);

    // 2. Draw atmospheric cloud illumination flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.update();
      if (f.alpha <= 0) {
        flashes.splice(i, 1);
      } else {
        f.draw(ctx);
      }
    }

    // 3. Draw ambient festive embers drifting upward
    for (let i = 0; i < ambientSparks.length; i++) {
      ambientSparks[i].update();
      ambientSparks[i].draw(ctx);
    }

    // 4. Continuous rocket launch scheduler (maintains multiple fireworks in flight)
    if (now - lastLaunchTime > nextLaunchDelay) {
      const maxActiveParticles = width < 768 ? 190 : 450;
      if (particles.length < maxActiveParticles) {
        launchFirework();
        lastLaunchTime = now;
      }
    }

    // 5. Update and draw ascending rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.update();
      if (!r.alive) {
        rockets.splice(i, 1);
      } else {
        r.draw(ctx);
      }
    }

    // 6. Update and draw bursting particles and falling spark trails
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      if (p.alpha <= 0) {
        particles.splice(i, 1);
      } else {
        p.draw(ctx);
      }
    }

    // Schedule next frame
    animationFrameId = requestAnimationFrame(updateAndDraw);
  }

  // =========================================================================
  // 9. LIFECYCLE MANAGEMENT
  // =========================================================================
  function start() {
    if (isRunning) return;
    isRunning = true;
    lastLaunchTime = performance.now();

    // Staggered immediate launch burst so fireworks are VISIBLE IMMEDIATELY
    launchFirework(width * 0.35, height * 0.22);
    setTimeout(() => {
      if (isRunning) launchFirework(width * 0.72, height * 0.16);
    }, 220);
    setTimeout(() => {
      if (isRunning) launchFirework(width * 0.50, height * 0.28);
    }, 550);

    animationFrameId = requestAnimationFrame(updateAndDraw);
  }

  function stop() {
    isRunning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Interactive Click / Tap on Hero to Launch Instant Firework
  document.addEventListener('click', (e) => {
    if (!heroSection || !canvas) return;
    const hero = e.target.closest('#hero');
    if (!hero) return;
    if (e.target.closest('a, button, input, .hero-actions, .site-header, .hero-feature-strip')) return;
    const rect = hero.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = Math.max(height * 0.08, e.clientY - rect.top);
    launchFirework(clickX, clickY);
  }, { passive: true });

  let listenersBound = false;
  function bindGlobalListenersOnce() {
    if (listenersBound) return;
    listenersBound = true;

    let resizeTimeout = null;
    window.addEventListener('resize', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (canvas) resize();
      }, 100);
    }, { passive: true });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => { if (canvas) resize(); }, 200);
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isPageVisible = false;
        stop();
      } else {
        isPageVisible = true;
        if (isScrolledIntoView && canvas) {
          lastLaunchTime = performance.now();
          start();
        }
      }
    });

    window.addEventListener('scroll', () => {
      if (!canvas || !heroSection) return;
      const heroHeight = heroSection.offsetHeight || 800;
      const isHeroInView = window.scrollY < (heroHeight + 100);

      if (isHeroInView && !isScrolledIntoView) {
        isScrolledIntoView = true;
        if (isPageVisible) {
          lastLaunchTime = performance.now();
          start();
        }
      } else if (!isHeroInView && isScrolledIntoView) {
        isScrolledIntoView = false;
        stop();
      }
    }, { passive: true });
  }

  // Public lifecycle API for SPA navigation
  window.initHeroFireworks = function () {
    bindGlobalListenersOnce();
    if (!ensureCanvas()) {
      stop();
      return;
    }

    resize();
    rockets.length = 0;
    particles.length = 0;
    flashes.length = 0;
    ambientSparks.length = 0;

    const introOverlay = document.getElementById('brand-intro');
    const isIntroActive = introOverlay && !introOverlay.classList.contains('intro-hidden') && introOverlay.style.display !== 'none';

    if (isIntroActive) {
      window.addEventListener('brand-intro-complete', () => {
        setTimeout(() => {
          if (isScrolledIntoView && isPageVisible) start();
        }, 300);
      }, { once: true });
    } else {
      if (isScrolledIntoView && isPageVisible) start();
    }
  };

  window.destroyHeroFireworks = function () {
    stop();
    canvas = null;
    ctx = null;
    heroSection = null;
  };

  // Initialization
  function init() {
    window.initHeroFireworks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', () => {
    if (ensureCanvas()) {
      resize();
      const introOverlay = document.getElementById('brand-intro');
      const isIntroActive = introOverlay && !introOverlay.classList.contains('intro-hidden') && introOverlay.style.display !== 'none';
      if (!isRunning && isPageVisible && !isIntroActive) {
        start();
      }
    }
  });
})();
