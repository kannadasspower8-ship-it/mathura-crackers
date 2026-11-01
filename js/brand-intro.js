/**
 * MATHURA CRACKERS - Cinematic Interactive Brand Intro ("Ignite the Wonder")
 * 
 * Timeline:
 *  0.0s - 0.55s: The Spark (Midnight darkness, central glowing spark, delicate drifting embers, tap to ignite)
 *  0.55s - 1.25s: The Burst (Ascending spark, radial firework burst, ambient dark illumination)
 *  1.25s - 2.05s: The Brand Reveal (Particles curve inward into an orbital ring, authentic logo & tagline reveal)
 *  2.05s - 2.75s: The Transition (Particles disperse into stardust, golden light sweep, smooth fade into homepage)
 */

(function () {
  'use strict';

  // URL parameters (e.g. ?skipIntro=1 if explicitly requested)
  const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const skipExplicitly = urlParams.get('skipIntro') === '1';

  let overlay = null;
  let canvas = null;
  let ctx = null;
  let skipBtn = null;
  let sparkTarget = null;
  let revealContainer = null;
  let hintText = null;
  let isListenersBound = false;

  function ensureElements() {
    if (typeof document === 'undefined') return false;

    overlay = document.getElementById('brand-intro');
    if (!overlay && document.body) {
      overlay = document.createElement('aside');
      overlay.id = 'brand-intro';
      overlay.className = 'brand-intro-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Mathura Crackers Brand Introduction');
      overlay.style.cssText = 'position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 100000;';
      overlay.innerHTML = `
        <canvas id="brand-intro-canvas" class="brand-intro-canvas"></canvas>
        <div class="brand-intro-light-sweep" aria-hidden="true"></div>

        <button id="brand-intro-skip" class="brand-intro-skip-btn" type="button" aria-label="Skip Introduction">
          <span>Skip</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>

        <div class="brand-intro-center">
          <div id="brand-intro-spark-target" class="brand-intro-spark-target" title="Tap to ignite spark"></div>

          <div id="brand-intro-reveal" class="brand-intro-reveal" aria-hidden="true">
            <div class="brand-intro-emblem-wrap">
              <div class="brand-intro-radiance" aria-hidden="true"></div>
              <div class="brand-intro-ring-glow"></div>
              <div class="brand-intro-emblem">
                <img src="images/logo.webp" alt="Mathura Crackers" class="brand-intro-logo-img" width="120" height="80" />
                <div class="brand-intro-logo-shine" aria-hidden="true"></div>
              </div>
            </div>

            <div class="brand-intro-tagline">
              <span>SIVAKASI</span>
              <span class="brand-intro-dot">•</span>
              <span>DIRECT FACTORY ORDERS</span>
            </div>
          </div>

          <div id="brand-intro-hint" class="brand-intro-hint">
            Tap to ignite
          </div>
        </div>
      `;
      document.body.prepend(overlay);
    }

    if (!overlay) return false;

    canvas = document.getElementById('brand-intro-canvas');
    skipBtn = document.getElementById('brand-intro-skip');
    sparkTarget = document.getElementById('brand-intro-spark-target');
    revealContainer = document.getElementById('brand-intro-reveal');
    hintText = document.getElementById('brand-intro-hint');

    if (!canvas || !revealContainer) return false;

    if (typeof canvas.getContext === 'function') {
      ctx = canvas.getContext('2d');
    }
    if (!ctx) return false;

    bindListeners();
    return true;
  }

  // Viewport & DPR setup
  let width = 0;
  let height = 0;
  let dpr = 1;
  let centerX = 0;
  let centerY = 0;

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    width = (typeof window !== 'undefined' && window.innerWidth) || 1024;
    height = (typeof window !== 'undefined' && window.innerHeight) || 768;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    centerX = width / 2;
    centerY = height / 2;
  }

  // Get dynamic emblem center for particle ring alignment
  function getEmblemCenter() {
    const emblem = document.querySelector('.brand-intro-emblem');
    if (emblem) {
      const rect = emblem.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
    }
    return { x: centerX, y: centerY - 42 };
  }

  // Animation State
  let animFrameId = null;
  let startTime = null;
  let isFinished = false;
  let hasBursted = false;
  let burstTime = 0.85; // seconds into timeline when burst naturally occurs
  let burstTriggeredAt = null;

  // Mouse interaction
  let mouseX = -1000;
  let mouseY = -1000;
  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  // Fallback safety timeout: guarantee homepage is reachable
  let fallbackTimer = null;
  function resetFallbackTimer() {
    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (!urlParams.get('stage')) {
      fallbackTimer = setTimeout(() => {
        if (!isFinished) finishIntro();
      }, 5800);
    }
  }
  resetFallbackTimer();

  // Spark, Burst and Ambient Particle Systems
  const sparkEmbers = [];
  const burstParticles = [];
  const ambientStardust = [];
  let flashAlpha = 0;

  // Golden color palette
  const GOLD_PALETTE = [
    { r: 255, g: 250, b: 220 }, // Incandescent white-gold
    { r: 252, g: 211, b: 77 },  // Warm yellow-gold
    { r: 229, g: 184, b: 56 },  // Authentic Mathura Gold
    { r: 245, g: 158, b: 11 },  // Vibrant amber
    { r: 217, g: 119, b: 6 }    // Deep copper spark
  ];

  function initAmbientStardust() {
    ambientStardust.length = 0;
    const count = 38;
    for (let i = 0; i < count; i++) {
      ambientStardust.push({
        x: Math.random() * (width || 1024),
        y: Math.random() * (height || 768),
        speed: 0.2 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.6,
        baseAlpha: 0.25 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)]
      });
    }
  }
  initAmbientStardust();

  function createSparkEmber(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 1.2;
    const color = GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)];
    return {
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.3,
      size: 1.2 + Math.random() * 1.6,
      color: color,
      life: 0.3 + Math.random() * 0.4,
      age: 0
    };
  }

  function triggerBurst(atSec) {
    if (hasBursted) return;
    hasBursted = true;
    burstTriggeredAt = atSec;
    flashAlpha = 0.5;

    if (hintText) {
      hintText.style.opacity = '0';
    }

    if (navigator.vibrate) {
      try { navigator.vibrate(25); } catch (e) { /* ignore */ }
    }

    const count = 42; // Controlled, elegant symmetrical count
    const emblemPt = getEmblemCenter();
    const burstOriginY = emblemPt.y;

    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.12;
      const speed = 3.8 + Math.random() * 2.2;
      const color = GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)];

      burstParticles.push({
        index: i,
        x: emblemPt.x,
        y: burstOriginY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.8 + Math.random() * 1.5,
        color: color,
        trail: [],
        baseAngle: baseAngle,
        alpha: 1
      });
    }
  }

  function bindListeners() {
    if (isListenersBound) return;
    isListenersBound = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resizeCanvas, { passive: true });
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('keydown', (e) => {
        if (!isFinished && (e.key === 'Escape' || e.key === ' ')) {
          finishIntro();
        }
      });
    }

    if (sparkTarget) {
      sparkTarget.addEventListener('click', onSparkTap);
      sparkTarget.addEventListener('touchstart', onSparkTap, { passive: false });
    }

    if (overlay && overlay.addEventListener) {
      overlay.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('#brand-intro-skip')) return;
        onSparkTap(e);
      });
      overlay.addEventListener('touchstart', (e) => {
        if (e.target && e.target.closest && e.target.closest('#brand-intro-skip')) return;
        onSparkTap(e);
      }, { passive: true });
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', onSkip);
    }
  }

  // Early tap/click interaction on spark
  function onSparkTap(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!hasBursted && startTime !== null) {
      const elapsed = (performance.now() - startTime) / 1000;
      triggerBurst(elapsed);
    }
  }

  // Skip button click
  function onSkip(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    finishIntro();
  }

  // Finish intro, transition cleanly to homepage
  function finishIntro() {
    if (isFinished) return;
    isFinished = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // Fade out overlay
    if (overlay) {
      overlay.classList.add('intro-hidden');
    }
    if (document.body && document.body.classList) {
      document.body.classList.remove('intro-active');
    }

    // Notify document that intro has finished
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('brand-intro-complete'));
    }

    // Clean up visibility after transition (preserved in DOM for replay capability)
    setTimeout(() => {
      if (overlay) {
        overlay.style.display = 'none';
      }
    }, 850);
  }

  // Expose global replay function
  window.playBrandIntro = function () {
    if (!ensureElements()) return;
    isFinished = false;
    hasBursted = false;
    startTime = null;
    burstTriggeredAt = null;
    sparkEmbers.length = 0;
    burstParticles.length = 0;
    flashAlpha = 0;

    overlay.style.display = 'flex';
    overlay.classList.remove('intro-hidden', 'sweep-active');
    if (document.body && document.body.classList) {
      document.body.classList.add('intro-active');
    }

    if (revealContainer) {
      revealContainer.classList.remove('reveal-visible');
    }
    if (hintText) {
      hintText.style.opacity = '1';
    }

    resizeCanvas();
    resetFallbackTimer();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(render);
  };

  const stageParam = urlParams.get('stage'); // 'spark', 'burst', 'reveal'

  // Main Render Loop
  function render(timestamp) {
    if (isFinished) return;

    if (!startTime) startTime = timestamp;
    let elapsed = (timestamp - startTime) / 1000; // seconds

    if (stageParam === 'spark') {
      elapsed = 0.25;
    } else if (stageParam === 'burst') {
      if (!hasBursted) triggerBurst(0.55);
      elapsed = 0.55 + 0.35;
    } else if (stageParam === 'reveal') {
      if (!hasBursted) triggerBurst(0.55);
      elapsed = 0.55 + 0.95;
    }

    ctx.clearRect(0, 0, width, height);

    // Subtle dark radial vignette
    const bgGrad = ctx.createRadialGradient(centerX, centerY, 40, centerX, centerY, Math.max(width, height) * 0.7);
    bgGrad.addColorStop(0, 'rgba(16, 18, 28, 0.4)');
    bgGrad.addColorStop(1, 'rgba(8, 9, 13, 0.9)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const emblemPt = getEmblemCenter();

    // Render and update ambient floating golden stardust
    for (let i = 0; i < ambientStardust.length; i++) {
      const s = ambientStardust[i];
      s.y -= s.speed;
      s.x += Math.sin(elapsed * 1.6 + s.phase) * 0.32;
      if (s.y < -10) {
        s.y = height + 10;
        s.x = Math.random() * width;
      }
      const twinkle = s.baseAlpha * (0.55 + 0.45 * Math.sin(elapsed * 2.8 + s.phase));
      ctx.fillStyle = `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // =========================================================================
    // PHASE 1: THE SPARK (0.0s - 0.55s)
    // =========================================================================
    if (!hasBursted && elapsed < burstTime) {
      // Spark position: starts at emblem center, gently rises by 15px towards 0.55s
      const ascentProgress = Math.max(0, (elapsed - 0.3) / (burstTime - 0.3));
      const sparkY = emblemPt.y - (ascentProgress * 15);
      const sparkX = emblemPt.x;

      // Draw glowing aura
      const pulse = 1 + 0.25 * Math.sin(elapsed * 18);
      const auraGrad = ctx.createRadialGradient(sparkX, sparkY, 1, sparkX, sparkY, 28 * pulse);
      auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      auraGrad.addColorStop(0.25, 'rgba(252, 211, 77, 0.85)');
      auraGrad.addColorStop(0.6, 'rgba(229, 184, 56, 0.3)');
      auraGrad.addColorStop(1, 'rgba(229, 184, 56, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 28 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Spark core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 3.2 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Spawn drifting spark embers
      if (Math.random() < 0.6) {
        sparkEmbers.push(createSparkEmber(sparkX, sparkY));
      }

      // Update and draw spark embers
      for (let i = sparkEmbers.length - 1; i >= 0; i--) {
        const ember = sparkEmbers[i];
        ember.age += 0.016;
        if (ember.age >= ember.life) {
          sparkEmbers.splice(i, 1);
          continue;
        }

        ember.x += ember.vx;
        ember.y += ember.vy;
        ember.vy += 0.02; // slight gravity

        const alpha = Math.max(0, 1 - ember.age / ember.life);
        ctx.fillStyle = `rgba(${ember.color.r}, ${ember.color.g}, ${ember.color.b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, ember.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Trigger natural burst at 0.55s
    if (!hasBursted && elapsed >= burstTime) {
      triggerBurst(elapsed);
    }

    // =========================================================================
    // PHASE 2 & 3: THE BURST, AMBIENT ILLUMINATION & CONVERGENCE (0.55s - 2.05s)
    // =========================================================================
    if (hasBursted) {
      const burstAge = elapsed - burstTriggeredAt;

      // Ambient flash illumination on surrounding darkness
      if (flashAlpha > 0.01) {
        flashAlpha *= 0.92;
        const flashGrad = ctx.createRadialGradient(emblemPt.x, emblemPt.y, 20, emblemPt.x, emblemPt.y, 200);
        flashGrad.addColorStop(0, `rgba(229, 184, 56, ${flashAlpha * 0.5})`);
        flashGrad.addColorStop(0.5, `rgba(245, 158, 11, ${flashAlpha * 0.22})`);
        flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(emblemPt.x, emblemPt.y, 200, 0, Math.PI * 2);
        ctx.fill();
      }

      // Timeline checkpoints (Tuned for 2.0s luxury presentation):
      // At burstAge ~0.35s (around 0.70s total): start converging into orbital ring
      // At burstAge ~0.38s: reveal the authentic brand mark & tagline
      // At burstAge ~1.10s: disperse particles, trigger golden sweep
      // Timeline checkpoints (Majestic Luxury Presentation):
      // At burstAge ~0.35s: start converging into radiant orbital ring
      // At burstAge ~0.40s: reveal the authentic Mathura brand emblem & tagline
      // At burstAge ~1.35s: trigger golden lens-flare light sweep across emblem
      // At burstAge ~1.60s: start smooth dissolve into hero section
      // At burstAge ~2.30s: finish intro and hand off to background fireworks

      const shouldConverge = burstAge >= 0.35 && burstAge < 2.80;
      const shouldDisperse = burstAge >= 2.80;

      // Reveal brand elements
      if (burstAge >= 0.45 && !revealContainer.classList.contains('reveal-visible')) {
        revealContainer.classList.add('reveal-visible');
      }

      // Golden light sweep across emblem
      if (burstAge >= 2.00 && !overlay.classList.contains('sweep-active')) {
        overlay.classList.add('sweep-active');
      }

      // Fade out overlay into homepage
      if (burstAge >= 3.40 && !overlay.classList.contains('intro-hidden')) {
        overlay.classList.add('intro-hidden');
      }

      // Complete transition
      if (burstAge >= 4.25) {
        finishIntro();
        return;
      }

      // Target ring dimensions (encircles the brand logo emblem)
      const ringRadius = width < 768 ? 95 : 125;
      const ringRotation = burstAge * 0.85;

      // Render and update burst particles
      for (let i = 0; i < burstParticles.length; i++) {
        const p = burstParticles[i];

        // Store trail
        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > 5) p.trail.pop();

        if (shouldDisperse) {
          // Phase 4: Disperse outward into gentle sparks
          p.x += p.vx * 1.05;
          p.y += p.vy * 1.05 + 0.15;
          p.alpha = Math.max(0, p.alpha * 0.93);
        } else if (shouldConverge) {
          // Phase 3: Curve inward and form symmetrical glowing ring frame
          const targetAngle = p.baseAngle + ringRotation;
          const targetX = emblemPt.x + Math.cos(targetAngle) * ringRadius;
          const targetY = emblemPt.y + Math.sin(targetAngle) * ringRadius;

          // Gentle spring physics toward ring target
          const dx = targetX - p.x;
          const dy = targetY - p.y;
          p.vx = (p.vx + dx * 0.08) * 0.86;
          p.vy = (p.vy + dy * 0.08) * 0.86;

          p.x += p.vx;
          p.y += p.vy;
          p.alpha = 0.95;
        } else {
          // Phase 2: Symmetrical radial expansion with air drag
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.vy += 0.04; // subtle gravity

          // Slight mouse repulsion on desktop
          if (mouseX > 0) {
            const mdx = p.x - mouseX;
            const mdy = p.y - mouseY;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 75 && mdist > 0) {
              const force = (1 - mdist / 75) * 1.2;
              p.x += (mdx / mdist) * force;
              p.y += (mdy / mdist) * force;
            }
          }

          p.x += p.vx;
          p.y += p.vy;
        }

        // Draw particle trail
        if (p.trail.length > 1 && !shouldDisperse) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha * 0.3})`;
          ctx.lineWidth = p.size * 0.7;
          ctx.stroke();
        }

        // Draw particle glowing core
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (shouldConverge ? 1.25 : 1), 0, Math.PI * 2);
        ctx.fill();

        // Shimmer halo for ring particles
        if (shouldConverge && i % 3 === 0) {
          const haloGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8);
          haloGrad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha * 0.65})`);
          haloGrad.addColorStop(1, 'rgba(229, 184, 56, 0)');
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    animFrameId = requestAnimationFrame(render);
  }

  // Auto-play on homepage or if explicit query parameter is provided
  if (skipExplicitly) {
    if (ensureElements()) {
      overlay.style.display = 'none';
      overlay.classList.add('intro-hidden');
    }
    if (document.body && document.body.classList) {
      document.body.classList.remove('intro-active');
    }
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('brand-intro-complete'));
    }
  } else {
    const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const isHomePage = pathname.endsWith('index.html') || pathname.endsWith('/') || pathname === '';
    const shouldAutoPlay = (isHomePage || urlParams.get('playIntro') === '1' || urlParams.get('intro') === '1');

    if (shouldAutoPlay) {
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          window.playBrandIntro();
        });
      } else {
        window.playBrandIntro();
      }
    }
  }

})();
