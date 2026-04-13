/* =========================================================
   SCENES.JS — 20 crafted visual scenes for Dimensions view
   ---------------------------------------------------------
   Each scene has:
   - createParticles(w, h) → persistent particle state
   - drawMini(ctx, w, h, col, t, parts, bass, mid) → tile thumbnail
   - drawFull(ctx, w, h, col, t, parts, bass, mid, treble) → expanded

   Every scene is a COMPOSITION, not just shapes floating around.
   Detailed silhouettes, layered depth, atmospheric effects.
   ========================================================= */

window.SCENE_DEFS = (function () {
  function rgba(hex, a) {
    return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Shared drawing helpers for complex silhouettes
  function drawMountainRange(ctx, w, h, baseY, peaks, color, alpha) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 2) {
      let y = baseY;
      for (const p of peaks) y -= Math.max(0, p.h * Math.exp(-((x / w - p.x) ** 2) / (p.w ** 2)));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = rgba(color, alpha); ctx.fill();
  }

  function drawTree(ctx, x, y, h, detail, color) {
    // trunk
    ctx.fillStyle = rgba(color, 0.8);
    ctx.fillRect(x - 2, y, 4, h * 0.3);
    // canopy layers
    for (let i = 0; i < 3; i++) {
      const ly = y - h * (0.1 + i * 0.25);
      const lw = h * (0.35 - i * 0.08);
      ctx.beginPath();
      ctx.moveTo(x - lw, ly + h * 0.15);
      ctx.lineTo(x, ly);
      ctx.lineTo(x + lw, ly + h * 0.15);
      ctx.closePath();
      ctx.fillStyle = rgba(color, 0.6 - i * 0.1);
      ctx.fill();
    }
  }

  function drawPineTree(ctx, x, baseY, h, color, alpha) {
    ctx.fillStyle = rgba(color, alpha * 0.9);
    ctx.fillRect(x - 1.5, baseY - h * 0.15, 3, h * 0.15);
    for (let i = 0; i < 4; i++) {
      const ly = baseY - h * (0.15 + i * 0.2);
      const lw = h * (0.18 - i * 0.03);
      ctx.beginPath();
      ctx.moveTo(x - lw, ly + h * 0.12);
      ctx.lineTo(x, ly);
      ctx.lineTo(x + lw, ly + h * 0.12);
      ctx.closePath();
      ctx.fillStyle = rgba(color, alpha * (0.7 - i * 0.08));
      ctx.fill();
    }
  }

  function drawBuilding(ctx, x, w, baseY, h, windowRows, windowCols, wallColor, lightColor, lightAlpha, t) {
    ctx.fillStyle = wallColor;
    ctx.fillRect(x, baseY - h, w, h);
    // windows
    const ww = (w - 6) / windowCols;
    const wh = (h - 10) / windowRows;
    for (let r = 0; r < windowRows; r++) {
      for (let c = 0; c < windowCols; c++) {
        const lit = Math.sin(t * 0.05 + r * 3.7 + c * 2.3 + x * 0.1) > -0.2;
        ctx.fillStyle = lit ? rgba(lightColor, lightAlpha) : 'rgba(15,15,25,0.4)';
        ctx.fillRect(x + 3 + c * ww, baseY - h + 5 + r * wh, ww * 0.65, wh * 0.55);
      }
    }
  }

  // ================================================================
  // SCENE 0: TOKYO RAIN
  // ================================================================
  const tokyoRain = {
    create(w, h) {
      const p = { buildings: [], signs: [], rain: [], umbrellas: [], steam: [], puddles: [] };
      // buildings with varied heights and rooflines
      for (let i = 0; i < 10; i++) {
        const bx = (i / 10) * w + (Math.random() - 0.5) * w * 0.05;
        p.buildings.push({ x: bx, w: w * 0.06 + Math.random() * w * 0.06, h: h * (0.25 + Math.random() * 0.35),
          rows: 4 + Math.floor(Math.random() * 8), cols: 2 + Math.floor(Math.random() * 3),
          antenna: Math.random() > 0.6, acUnit: Math.random() > 0.5 });
      }
      // neon signs with kanji-like shapes
      for (let i = 0; i < 6; i++) {
        p.signs.push({ x: 0.08 + Math.random() * 0.84, y: 0.2 + Math.random() * 0.3,
          w: 0.03 + Math.random() * 0.05, h: 0.04 + Math.random() * 0.08,
          hue: [0, 280, 180, 330, 50, 200][i], flicker: Math.random() * 6.28,
          vertical: Math.random() > 0.4, chars: 2 + Math.floor(Math.random() * 4) });
      }
      // rain
      for (let i = 0; i < 150; i++) p.rain.push({ x: Math.random(), y: Math.random(), vy: 0.006 + Math.random() * 0.008, len: 8 + Math.random() * 15 });
      // umbrella silhouettes
      for (let i = 0; i < 5; i++) p.umbrellas.push({ x: Math.random(), vx: (Math.random() - 0.5) * 0.0008, y: 0.78 + Math.random() * 0.08, size: 8 + Math.random() * 5 });
      // steam vents
      for (let i = 0; i < 4; i++) p.steam.push({ x: Math.random(), particles: [] });
      // puddle ripples
      for (let i = 0; i < 8; i++) p.puddles.push({ x: Math.random(), y: 0.88 + Math.random() * 0.08, phase: Math.random() * 6.28, rate: 0.5 + Math.random() });
      return p;
    },
    drawMini(ctx, w, h, col, t, p, bass, mid) {
      // dark sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      sky.addColorStop(0, 'rgba(8,5,15,0.8)'); sky.addColorStop(1, 'rgba(15,10,25,0.4)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // buildings
      for (const b of p.buildings) {
        ctx.fillStyle = 'rgba(12,10,18,0.85)';
        ctx.fillRect(b.x, h * 0.85 - b.h * 0.5, b.w * 0.5, b.h * 0.5);
        // couple of lit windows
        for (let r = 0; r < 3; r++) {
          if (Math.sin(t * 0.05 + r + b.x) > 0) {
            ctx.fillStyle = rgba(col[0], 0.15);
            ctx.fillRect(b.x + 2, h * 0.85 - b.h * 0.5 + 3 + r * 8, b.w * 0.3, 3);
          }
        }
      }
      // neon sign glow
      for (const s of p.signs) {
        const flk = Math.sin(t * 2.5 + s.flicker) > -0.15 ? 1 : 0.15;
        ctx.fillStyle = `hsla(${s.hue},80%,60%,${0.12 * flk})`;
        ctx.fillRect(s.x * w, s.y * h, s.w * w, s.h * h);
        // glow halo
        ctx.shadowBlur = 8; ctx.shadowColor = `hsl(${s.hue},80%,60%)`;
        ctx.fillRect(s.x * w, s.y * h, s.w * w, s.h * h);
        ctx.shadowBlur = 0;
      }
      // wet street
      ctx.fillStyle = rgba(col[0], 0.04 + bass * 0.03);
      ctx.fillRect(0, h * 0.85, w, h * 0.15);
      // rain
      ctx.strokeStyle = 'rgba(180,190,210,0.08)'; ctx.lineWidth = 0.4;
      for (let i = 0; i < 30; i++) {
        const r = p.rain[i]; r.y += r.vy * 0.7;
        if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); }
        ctx.beginPath(); ctx.moveTo(r.x * w, r.y * h); ctx.lineTo(r.x * w - 0.3, r.y * h + r.len * 0.4); ctx.stroke();
      }
    },
    drawFull(ctx, w, h, col, t, p, bass, mid, treble) {
      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      sky.addColorStop(0, 'rgba(5,3,12,0.9)'); sky.addColorStop(1, 'rgba(15,10,25,0.5)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      // power lines
      ctx.strokeStyle = 'rgba(30,30,40,0.4)'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ly = h * (0.12 + i * 0.05);
        ctx.beginPath(); ctx.moveTo(0, ly);
        for (let x = 0; x <= w; x += w / 4) ctx.lineTo(x, ly + Math.sin(x * 0.005 + i) * 8);
        ctx.stroke();
      }

      // buildings (back layer — taller, darker)
      const streetY = h * 0.82;
      for (const b of p.buildings) {
        drawBuilding(ctx, b.x, b.w, streetY, b.h, b.rows, b.cols,
          'rgba(10,8,16,0.9)', col[0], 0.12 + mid * 0.08, t);
        // antenna
        if (b.antenna) {
          ctx.strokeStyle = 'rgba(40,40,50,0.5)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, streetY - b.h); ctx.lineTo(b.x + b.w / 2, streetY - b.h - 20); ctx.stroke();
          // blinking red light
          if (Math.sin(t * 2) > 0.5) {
            ctx.beginPath(); ctx.arc(b.x + b.w / 2, streetY - b.h - 20, 2, 0, 6.28);
            ctx.fillStyle = 'rgba(255,50,50,0.6)'; ctx.fill();
          }
        }
        // AC units on side
        if (b.acUnit) {
          ctx.fillStyle = 'rgba(20,20,25,0.7)';
          ctx.fillRect(b.x + b.w - 8, streetY - b.h * 0.4, 10, 7);
        }
      }

      // neon signs — detailed with glow halos
      for (const s of p.signs) {
        const flk = Math.sin(t * 2.5 + s.flicker) > -0.15 ? 1 : 0.15;
        const sx = s.x * w, sy = s.y * h, sw = s.w * w, sh = s.h * h;
        // sign backing
        ctx.fillStyle = `rgba(0,0,0,0.5)`;
        ctx.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);
        // neon glow
        const glowR = Math.max(sw, sh) * 1.5;
        const glow = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, 0, sx + sw / 2, sy + sh / 2, glowR);
        glow.addColorStop(0, `hsla(${s.hue},80%,60%,${0.1 * flk + bass * 0.05})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sx - glowR, sy - glowR, glowR * 2 + sw, glowR * 2 + sh);
        // sign face — kanji-like bars
        if (s.vertical) {
          for (let c = 0; c < s.chars; c++) {
            const cy = sy + c * (sh / s.chars);
            // simplified kanji: horizontal bar + vertical stroke
            ctx.fillStyle = `hsla(${s.hue},80%,60%,${(0.3 + mid * 0.2) * flk})`;
            ctx.fillRect(sx + 2, cy + 2, sw - 4, sh / s.chars * 0.3);
            ctx.fillRect(sx + sw * 0.3, cy, sw * 0.15, sh / s.chars * 0.8);
          }
        } else {
          ctx.fillStyle = `hsla(${s.hue},80%,60%,${(0.25 + mid * 0.2) * flk})`;
          ctx.fillRect(sx, sy, sw, sh);
        }
      }

      // wet street — reflections
      ctx.fillStyle = 'rgba(5,5,10,0.7)'; ctx.fillRect(0, streetY, w, h - streetY);
      // reflected neon on wet ground
      ctx.save(); ctx.globalAlpha = 0.06 + bass * 0.03;
      ctx.scale(1, -0.25); ctx.translate(0, -streetY * 5.5);
      for (const s of p.signs) {
        const flk = Math.sin(t * 2.5 + s.flicker) > -0.15 ? 1 : 0.15;
        ctx.fillStyle = `hsla(${s.hue},80%,50%,${0.15 * flk})`;
        ctx.fillRect(s.x * w, s.y * h, s.w * w, s.h * h * 3);
      }
      ctx.restore();

      // umbrella silhouettes
      for (const u of p.umbrellas) {
        u.x += u.vx;
        if (u.x > 1.1) u.x = -0.1; if (u.x < -0.1) u.x = 1.1;
        const ux = u.x * w, uy = u.y * h;
        // umbrella arc
        ctx.beginPath();
        ctx.arc(ux, uy - u.size, u.size, Math.PI, 0);
        ctx.fillStyle = 'rgba(15,12,20,0.7)';
        ctx.fill();
        // person body (stick figure silhouette)
        ctx.fillStyle = 'rgba(15,12,20,0.6)';
        ctx.fillRect(ux - 1.5, uy - u.size + 2, 3, u.size + 5);
        // legs
        ctx.beginPath(); ctx.moveTo(ux, uy + 7); ctx.lineTo(ux - 3, uy + 14); ctx.moveTo(ux, uy + 7); ctx.lineTo(ux + 3, uy + 14);
        ctx.strokeStyle = 'rgba(15,12,20,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // steam from grates
      for (const s of p.steam) {
        if (Math.random() < 0.15) {
          s.particles.push({ x: s.x * w + (Math.random() - 0.5) * 10, y: streetY, vy: -0.5 - Math.random() * 1.5, life: 0, size: 3 + Math.random() * 8 });
        }
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const sp = s.particles[i];
          sp.y += sp.vy; sp.life += 0.01; sp.x += (Math.random() - 0.5) * 0.5;
          if (sp.life > 1) { s.particles.splice(i, 1); continue; }
          ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.size * (1 + sp.life), 0, 6.28);
          ctx.fillStyle = `rgba(180,180,200,${0.04 * (1 - sp.life)})`;
          ctx.fill();
        }
      }

      // rain
      ctx.strokeStyle = 'rgba(180,190,220,0.1)'; ctx.lineWidth = 0.6;
      for (const r of p.rain) {
        r.y += r.vy * (1 + bass * 0.5);
        if (r.y > 1.05) { r.y = -0.1; r.x = Math.random(); }
        ctx.beginPath();
        ctx.moveTo(r.x * w + Math.sin(t * 0.3) * 2, r.y * h);
        ctx.lineTo(r.x * w + Math.sin(t * 0.3) * 2 - 0.5, r.y * h + r.len);
        ctx.stroke();
      }

      // puddle ripples
      for (const pd of p.puddles) {
        pd.phase += pd.rate * 0.02;
        const ring = (Math.sin(pd.phase) * 0.5 + 0.5) * 12;
        ctx.beginPath(); ctx.arc(pd.x * w, pd.y * h, ring, 0, 6.28);
        ctx.strokeStyle = `rgba(180,190,220,${0.05 * (1 - ring / 12)})`;
        ctx.lineWidth = 0.5; ctx.stroke();
      }
    }
  };

  // ================================================================
  // SCENE 1: OCEAN ABYSS
  // ================================================================
  const oceanAbyss = {
    create(w, h) {
      return {
        jellyfish: Array.from({length: 4}, () => ({ x: Math.random(), y: 0.2 + Math.random() * 0.5, phase: Math.random() * 6.28, size: 15 + Math.random() * 25, tentacles: 5 + Math.floor(Math.random() * 4), drift: (Math.random() - 0.5) * 0.0003 })),
        whale: { x: -0.3, y: 0.35 + Math.random() * 0.2, vx: 0.0002, size: 0.15 },
        kelp: Array.from({length: 8}, () => ({ x: Math.random(), segments: 8 + Math.floor(Math.random() * 6), sway: Math.random() * 6.28 })),
        biolum: Array.from({length: 40}, () => ({ x: Math.random(), y: Math.random(), pulse: Math.random() * 6.28, size: 1 + Math.random() * 3 })),
        rays: Array.from({length: 5}, () => ({ x: Math.random(), w: 15 + Math.random() * 25, sway: Math.random() * 6.28 })),
        particles: Array.from({length: 60}, () => ({ x: Math.random(), y: Math.random(), vy: -0.0002 - Math.random() * 0.0005, size: 0.5 + Math.random() * 1.5 })),
      };
    },
    drawMini(ctx, w, h, col, t, p, bass, mid) {
      const dg = ctx.createLinearGradient(0, 0, 0, h);
      dg.addColorStop(0, rgba(col[0], 0.06)); dg.addColorStop(0.4, 'rgba(5,10,30,0.5)'); dg.addColorStop(1, 'rgba(2,5,15,0.8)');
      ctx.fillStyle = dg; ctx.fillRect(0, 0, w, h);
      // light rays
      for (let i = 0; i < 3; i++) { const rx = w * (0.2 + i * 0.25) + Math.sin(t * 0.2 + i) * 10; ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx - 10, 0); ctx.lineTo(rx + 30, h); ctx.lineTo(rx + 50, h); ctx.closePath(); ctx.fillStyle = rgba(col[0], 0.02); ctx.fill(); }
      // jellyfish
      for (const j of p.jellyfish) {
        const jx = j.x * w, jy = j.y * h + Math.sin(t * 0.5 + j.phase) * 8;
        const jr = j.size * 0.3;
        ctx.beginPath(); ctx.arc(jx, jy, jr, Math.PI, 0); ctx.fillStyle = rgba(col[0], 0.2); ctx.fill();
        for (let tn = 0; tn < 3; tn++) {
          ctx.beginPath(); ctx.moveTo(jx - jr + tn * jr, jy);
          ctx.quadraticCurveTo(jx - jr + tn * jr + Math.sin(t + tn + j.phase) * 4, jy + jr * 1.5, jx - jr + tn * jr + Math.sin(t * 0.7 + tn) * 3, jy + jr * 2.5);
          ctx.strokeStyle = rgba(col[0], 0.12); ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      // bioluminescence
      for (let i = 0; i < 15; i++) { const b = p.biolum[i]; b.pulse += 0.01; const glow = 0.3 + 0.7 * Math.sin(b.pulse); ctx.beginPath(); ctx.arc(b.x * w, b.y * h, b.size, 0, 6.28); ctx.fillStyle = rgba(col[0], 0.15 * glow); ctx.fill(); }
    },
    drawFull(ctx, w, h, col, t, p, bass, mid, treble) {
      // deep gradient
      const dg = ctx.createLinearGradient(0, 0, 0, h);
      dg.addColorStop(0, rgba(col[0], 0.05)); dg.addColorStop(0.15, 'rgba(5,15,40,0.6)');
      dg.addColorStop(0.5, 'rgba(3,8,25,0.8)'); dg.addColorStop(1, 'rgba(1,3,10,0.95)');
      ctx.fillStyle = dg; ctx.fillRect(0, 0, w, h);

      // light rays from surface
      for (const ray of p.rays) {
        const rx = ray.x * w + Math.sin(t * 0.15 + ray.sway) * 40;
        const rw = ray.w + Math.sin(t * 0.3 + ray.sway) * 8 + bass * 15;
        ctx.beginPath();
        ctx.moveTo(rx, 0); ctx.lineTo(rx + rw, 0);
        ctx.lineTo(rx + rw * 3, h); ctx.lineTo(rx - rw * 0.5, h);
        ctx.closePath();
        ctx.fillStyle = rgba(col[0], 0.015 + bass * 0.01);
        ctx.fill();
      }

      // kelp forest (background)
      for (const k of p.kelp) {
        ctx.beginPath();
        let kx = k.x * w, ky = h;
        ctx.moveTo(kx, ky);
        for (let s = 0; s < k.segments; s++) {
          ky -= h * 0.04;
          kx += Math.sin(t * 0.6 + k.sway + s * 0.4) * 6;
          ctx.lineTo(kx, ky);
        }
        ctx.strokeStyle = rgba(col[0], 0.08 + mid * 0.04);
        ctx.lineWidth = 2.5; ctx.stroke();
        // leaf blobs along the stalk
        for (let s = 0; s < k.segments; s += 2) {
          const ly = h - s * h * 0.04;
          const lx = k.x * w + Math.sin(t * 0.6 + k.sway + s * 0.4) * 6 * (s / k.segments);
          ctx.beginPath();
          ctx.ellipse(lx + 5, ly, 6, 3, Math.sin(t * 0.3 + s) * 0.3, 0, 6.28);
          ctx.fillStyle = rgba(col[0], 0.05);
          ctx.fill();
        }
      }

      // whale silhouette
      const wh = p.whale;
      wh.x += wh.vx;
      if (wh.x > 1.4) wh.x = -0.4;
      const wx = wh.x * w, wy = wh.y * h, ws = wh.size * w;
      ctx.beginPath();
      ctx.ellipse(wx, wy, ws, ws * 0.25, 0, 0, 6.28);
      ctx.fillStyle = 'rgba(8,15,30,0.3)';
      ctx.fill();
      // tail fluke
      ctx.beginPath();
      ctx.moveTo(wx - ws, wy);
      ctx.quadraticCurveTo(wx - ws * 1.2, wy - ws * 0.15, wx - ws * 1.35, wy - ws * 0.2);
      ctx.quadraticCurveTo(wx - ws * 1.2, wy, wx - ws * 1.35, wy + ws * 0.2);
      ctx.fillStyle = 'rgba(8,15,30,0.25)';
      ctx.fill();

      // jellyfish (detailed)
      for (const j of p.jellyfish) {
        j.x += j.drift;
        if (j.x > 1.15) j.x = -0.15;
        if (j.x < -0.15) j.x = 1.15;
        const jx = j.x * w, jy = j.y * h + Math.sin(t * 0.4 + j.phase) * 15;
        const jr = j.size;
        // bell (dome)
        ctx.beginPath();
        ctx.ellipse(jx, jy, jr, jr * 0.6, 0, Math.PI, 0);
        const jg = ctx.createRadialGradient(jx, jy - jr * 0.2, 0, jx, jy, jr);
        jg.addColorStop(0, rgba(col[0], 0.25 + mid * 0.1));
        jg.addColorStop(1, rgba(col[0], 0.05));
        ctx.fillStyle = jg; ctx.fill();
        // bell edge
        ctx.beginPath();
        for (let a = Math.PI; a >= 0; a -= 0.1) {
          const scallop = 1 + Math.sin(a * 8) * 0.08;
          ctx.lineTo(jx + Math.cos(a) * jr * scallop, jy + Math.sin(a) * jr * 0.6 * scallop);
        }
        ctx.strokeStyle = rgba(col[0], 0.2); ctx.lineWidth = 1; ctx.stroke();
        // tentacles
        for (let tn = 0; tn < j.tentacles; tn++) {
          const tx = jx - jr * 0.7 + (tn / j.tentacles) * jr * 1.4;
          ctx.beginPath(); ctx.moveTo(tx, jy);
          let ty = jy;
          for (let s = 0; s < 6; s++) {
            ty += jr * 0.35;
            const sx = tx + Math.sin(t * 0.5 + tn * 1.3 + s * 0.8 + j.phase) * (5 + s * 2);
            ctx.lineTo(sx, ty);
          }
          ctx.strokeStyle = rgba(col[0], 0.1 - tn * 0.01);
          ctx.lineWidth = 0.8; ctx.stroke();
        }
        // inner glow
        ctx.beginPath(); ctx.arc(jx, jy - jr * 0.15, jr * 0.3, 0, 6.28);
        ctx.fillStyle = rgba(col[0], 0.08 + bass * 0.05); ctx.fill();
      }

      // bioluminescent particles
      for (const b of p.biolum) {
        b.pulse += 0.008 + mid * 0.005;
        const glow = 0.3 + 0.7 * Math.sin(b.pulse);
        ctx.beginPath(); ctx.arc(b.x * w, b.y * h, b.size + mid * 2, 0, 6.28);
        ctx.shadowBlur = 6 + mid * 6; ctx.shadowColor = col[0];
        ctx.fillStyle = rgba(col[0], 0.12 * glow);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // marine snow (tiny particles drifting up)
      for (const mp of p.particles) {
        mp.y += mp.vy;
        if (mp.y < -0.05) { mp.y = 1.05; mp.x = Math.random(); }
        ctx.beginPath(); ctx.arc(mp.x * w, mp.y * h, mp.size, 0, 6.28);
        ctx.fillStyle = 'rgba(180,200,220,0.06)'; ctx.fill();
      }
    }
  };

  // ================================================================
  // SCENE 2: CAMPFIRE
  // ================================================================
  const campfire = {
    create(w, h) {
      return {
        embers: Array.from({length: 30}, () => ({ x: 0.48 + Math.random() * 0.04, y: 0.65, vx: (Math.random() - 0.5) * 0.002, vy: -0.001 - Math.random() * 0.004, life: Math.random(), size: 1 + Math.random() * 2.5 })),
        smoke: Array.from({length: 15}, () => ({ x: 0.5, y: 0.55, vx: (Math.random() - 0.5) * 0.001, vy: -0.0005 - Math.random() * 0.002, life: Math.random(), size: 8 + Math.random() * 20 })),
        stars: Array.from({length: 60}, () => ({ x: Math.random(), y: Math.random() * 0.4, tw: Math.random() * 6.28, r: 0.3 + Math.random() * 1.2 })),
        trees: Array.from({length: 6}, () => ({ x: Math.random(), h: 0.2 + Math.random() * 0.25, type: Math.floor(Math.random() * 2) })),
        logs: [{ angle: -0.3 }, { angle: 0.3 }, { angle: 0.05 }],
      };
    },
    drawMini(ctx, w, h, col, t, p, bass, mid) {
      // dark sky
      ctx.fillStyle = 'rgba(5,3,8,0.6)'; ctx.fillRect(0, 0, w, h);
      // stars
      for (let i = 0; i < 15; i++) { const s = p.stars[i]; const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.tw); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r * 0.6, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.4})`; ctx.fill(); }
      // tree silhouettes
      for (const tr of p.trees) drawPineTree(ctx, tr.x * w, h * 0.65, tr.h * h * 0.5, '#080510', 0.6);
      // fire glow
      const fg = ctx.createRadialGradient(w / 2, h * 0.65, 0, w / 2, h * 0.65, w * 0.35);
      fg.addColorStop(0, 'rgba(255,120,20,0.15)'); fg.addColorStop(0.5, 'rgba(255,60,10,0.05)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, w, h);
      // flame shapes
      for (let i = 0; i < 3; i++) {
        const fx = w / 2 + (i - 1) * 4, fy = h * 0.65;
        const fh = 10 + Math.sin(t * 3 + i * 2) * 4 + bass * 5;
        ctx.beginPath(); ctx.moveTo(fx - 3, fy); ctx.quadraticCurveTo(fx + Math.sin(t * 4 + i) * 3, fy - fh, fx + 3, fy); ctx.fillStyle = `rgba(255,${100 + i * 40},10,0.3)`; ctx.fill();
      }
      // embers
      for (let i = 0; i < 8; i++) { const e = p.embers[i]; e.y += e.vy * 0.3; e.x += e.vx * 0.3; if (e.life > 1) { e.y = 0.65; e.x = 0.48 + Math.random() * 0.04; e.life = 0; } e.life += 0.008; ctx.beginPath(); ctx.arc(e.x * w, e.y * h, e.size * 0.5 * (1 - e.life), 0, 6.28); ctx.fillStyle = `rgba(255,${150 + Math.floor(e.life * 100)},20,${0.4 * (1 - e.life)})`; ctx.fill(); }
    },
    drawFull(ctx, w, h, col, t, p, bass, mid, treble) {
      // night sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      sky.addColorStop(0, 'rgba(3,2,8,0.9)'); sky.addColorStop(1, 'rgba(8,5,15,0.5)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      // stars
      for (const s of p.stars) {
        const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.tw);
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 6.28);
        ctx.fillStyle = `rgba(255,255,255,${tw * 0.5})`; ctx.fill();
      }

      // ground
      ctx.fillStyle = 'rgba(10,8,5,0.4)'; ctx.fillRect(0, h * 0.72, w, h * 0.28);

      // tree silhouettes (background)
      for (const tr of p.trees) {
        drawPineTree(ctx, tr.x * w, h * 0.72, tr.h * h, '#060410', 0.7);
      }

      // fire glow on surroundings
      const glowR = w * 0.35 + bass * 40;
      const fg = ctx.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, glowR);
      fg.addColorStop(0, 'rgba(255,100,20,0.12)');
      fg.addColorStop(0.4, 'rgba(255,50,10,0.04)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, w, h);

      // logs
      for (const log of p.logs) {
        ctx.save();
        ctx.translate(w / 2, h * 0.73);
        ctx.rotate(log.angle);
        ctx.fillStyle = 'rgba(40,20,10,0.7)';
        ctx.fillRect(-25, -3, 50, 6);
        ctx.restore();
      }

      // flames (layered, organic shapes)
      for (let layer = 0; layer < 4; layer++) {
        const layerH = (25 + layer * 12 + Math.sin(t * (3 + layer) + layer) * 8 + bass * 20) * (1 - layer * 0.15);
        const layerW = 8 + layer * 4;
        const colors = ['rgba(255,220,80,0.35)', 'rgba(255,150,30,0.3)', 'rgba(255,80,10,0.25)', 'rgba(200,30,5,0.2)'];
        ctx.beginPath();
        ctx.moveTo(w / 2 - layerW, h * 0.72);
        ctx.quadraticCurveTo(
          w / 2 - layerW * 0.5 + Math.sin(t * 5 + layer * 1.5) * 6,
          h * 0.72 - layerH * 0.6,
          w / 2 + Math.sin(t * 4 + layer) * 4,
          h * 0.72 - layerH
        );
        ctx.quadraticCurveTo(
          w / 2 + layerW * 0.5 + Math.sin(t * 4.5 + layer * 2) * 6,
          h * 0.72 - layerH * 0.6,
          w / 2 + layerW, h * 0.72
        );
        ctx.fillStyle = colors[layer];
        ctx.fill();
      }

      // embers rising
      for (const e of p.embers) {
        e.x += e.vx; e.y += e.vy; e.life += 0.005;
        if (e.life > 1) { e.x = 0.48 + Math.random() * 0.04; e.y = 0.7; e.life = 0; e.vx = (Math.random() - 0.5) * 0.002; }
        const fade = 1 - e.life;
        ctx.beginPath(); ctx.arc(e.x * w, e.y * h, e.size * fade, 0, 6.28);
        ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(255,150,20,0.5)';
        ctx.fillStyle = `rgba(255,${120 + Math.floor(e.life * 130)},20,${0.5 * fade})`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // smoke
      for (const s of p.smoke) {
        s.x += s.vx + (Math.random() - 0.5) * 0.0003;
        s.y += s.vy; s.life += 0.003;
        if (s.life > 1) { s.x = 0.49 + Math.random() * 0.02; s.y = 0.6; s.life = 0; s.size = 8 + Math.random() * 20; }
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size * (0.5 + s.life * 1.5), 0, 6.28);
        ctx.fillStyle = `rgba(60,50,45,${0.03 * (1 - s.life)})`;
        ctx.fill();
      }
    }
  };

  // ================================================================
  // SCENE 3: NORTHERN LIGHTS
  // ================================================================
  const northernLights = {
    create(w, h) {
      return {
        ribbons: Array.from({length: 5}, (_, i) => ({ y: 0.1 + i * 0.06, hue: [120, 150, 180, 280, 320][i], speed: 0.15 + Math.random() * 0.2, amp: 0.04 + Math.random() * 0.06, offset: Math.random() * 6.28 })),
        snow: Array.from({length: 80}, () => ({ x: Math.random(), y: Math.random(), vx: 0.0002 + Math.random() * 0.0004, vy: 0.0002 + Math.random() * 0.0008, size: 1 + Math.random() * 2 })),
        treeline: Array.from({length: 25}, (_, i) => ({ x: i / 25 + (Math.random() - 0.5) * 0.03, h: 0.06 + Math.random() * 0.1 })),
        stars: Array.from({length: 80}, () => ({ x: Math.random(), y: Math.random() * 0.5, tw: Math.random() * 6.28, r: 0.3 + Math.random() * 1 })),
      };
    },
    drawMini(ctx, w, h, col, t, p, bass, mid) {
      ctx.fillStyle = 'rgba(3,5,12,0.5)'; ctx.fillRect(0, 0, w, h);
      for (const r of p.ribbons) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y = r.y * h + Math.sin(x / w * 4 + t * r.speed + r.offset) * r.amp * h + Math.sin(x / w * 9 + t * r.speed * 1.3) * r.amp * h * 0.3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, r.y * h + 25); ctx.lineTo(0, r.y * h + 25); ctx.closePath();
        ctx.fillStyle = `hsla(${r.hue},60%,50%,0.06)`; ctx.fill();
      }
      // tree line
      ctx.fillStyle = 'rgba(3,5,8,0.7)';
      ctx.beginPath(); ctx.moveTo(0, h);
      for (const tr of p.treeline) { ctx.lineTo(tr.x * w, h * (0.82 - tr.h)); ctx.lineTo(tr.x * w + 3, h * 0.82); }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
    },
    drawFull(ctx, w, h, col, t, p, bass, mid, treble) {
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      sky.addColorStop(0, 'rgba(2,3,10,0.9)'); sky.addColorStop(1, 'rgba(5,8,18,0.5)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      // stars
      for (const s of p.stars) { const tw = 0.3 + 0.7 * Math.sin(t * 1.3 + s.tw); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.5})`; ctx.fill(); }

      // aurora ribbons — flowing curtains
      for (const r of p.ribbons) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const nx = x / w;
          const y = r.y * h
            + Math.sin(nx * 5 + t * r.speed + r.offset) * r.amp * h
            + Math.sin(nx * 12 + t * r.speed * 1.5) * r.amp * h * 0.35
            + Math.sin(nx * 3 + t * r.speed * 0.7) * r.amp * h * 0.5
            + bass * 20;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, r.y * h + h * 0.12);
        ctx.lineTo(0, r.y * h + h * 0.12);
        ctx.closePath();
        const ag = ctx.createLinearGradient(0, r.y * h - r.amp * h, 0, r.y * h + h * 0.12);
        ag.addColorStop(0, `hsla(${r.hue},65%,55%,${0.08 + mid * 0.06})`);
        ag.addColorStop(0.7, `hsla(${r.hue},60%,50%,${0.03})`);
        ag.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ag; ctx.fill();
      }

      // frozen lake reflection
      const lakeY = h * 0.82;
      ctx.fillStyle = 'rgba(5,8,20,0.3)'; ctx.fillRect(0, lakeY, w, h - lakeY);
      ctx.save(); ctx.globalAlpha = 0.03;
      ctx.scale(1, -0.15); ctx.translate(0, -lakeY * 7.5);
      for (const r of p.ribbons) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 5) {
          const y = r.y * h + Math.sin(x / w * 5 + t * r.speed + r.offset) * r.amp * h;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(w, r.y * h + 50); ctx.lineTo(0, r.y * h + 50); ctx.closePath();
        ctx.fillStyle = `hsla(${r.hue},60%,50%,0.2)`;
        ctx.fill();
      }
      ctx.restore();

      // tree line silhouette
      const groundY = h * 0.8;
      ctx.fillStyle = 'rgba(3,5,8,0.85)';
      ctx.fillRect(0, groundY, w, h * 0.02);
      for (const tr of p.treeline) {
        drawPineTree(ctx, tr.x * w, groundY, tr.h * h, '#030508', 0.85);
      }
      // snow ground
      ctx.fillStyle = 'rgba(20,25,35,0.5)'; ctx.fillRect(0, groundY, w, 3);

      // snow
      for (const s of p.snow) {
        s.x += s.vx + Math.sin(t * 0.3 + s.y * 10) * 0.0002;
        s.y += s.vy;
        if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
        if (s.x > 1.05) s.x = -0.05;
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size, 0, 6.28);
        ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.15})`; ctx.fill();
      }
    }
  };

  // ================================================================
  // SCENES 4-19: Simplified but each with real composition
  // Each has create/drawMini/drawFull
  // ================================================================

  // Generic scene builder for scenes that share similar structure
  function makeSimpleScene(bgDraw, fgDraw) {
    return {
      create(w, h) {
        return {
          particles: Array.from({length: 50}, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.001, vy: (Math.random() - 0.5) * 0.001, size: 1 + Math.random() * 2, phase: Math.random() * 6.28, hue: Math.random() * 360 })),
          elements: Array.from({length: 10}, () => ({ x: Math.random(), y: Math.random(), size: 5 + Math.random() * 20, phase: Math.random() * 6.28, speed: 0.2 + Math.random() * 0.5 })),
        };
      },
      drawMini(ctx, w, h, col, t, p, bass, mid) { bgDraw(ctx, w, h, col, t, p, bass, mid, false); },
      drawFull(ctx, w, h, col, t, p, bass, mid, treble) { bgDraw(ctx, w, h, col, t, p, bass, mid, true); if (fgDraw) fgDraw(ctx, w, h, col, t, p, bass, mid, treble); },
    };
  }

  // 4: Desert Dunes
  const desertDunes = {
    create(w, h) {
      return {
        dunes: Array.from({length: 5}, (_, i) => ({ depth: i, y: 0.5 + i * 0.08, amp: 0.03 + i * 0.015, freq: 1.5 + Math.random() * 0.5, color: i * 0.03 })),
        dust: Array.from({length: 40}, () => ({ x: Math.random(), y: 0.5 + Math.random() * 0.4, vx: 0.0003 + Math.random() * 0.0006, size: 0.5 + Math.random() * 2 })),
        stars: Array.from({length: 60}, () => ({ x: Math.random(), y: Math.random() * 0.45, tw: Math.random() * 6.28, r: 0.3 + Math.random() * 1 })),
        caravan: Array.from({length: 3}, (_, i) => ({ x: 0.6 + i * 0.04, y: 0 })),
      };
    },
    drawMini(ctx, w, h, col, t, p, bass, mid) {
      // warm sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      sky.addColorStop(0, 'rgba(5,3,15,0.7)'); sky.addColorStop(1, rgba(col[0], 0.08));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // moon
      ctx.beginPath(); ctx.arc(w * 0.75, h * 0.2, 10, 0, 6.28);
      ctx.fillStyle = 'rgba(255,240,200,0.4)'; ctx.fill();
      // dunes
      for (const d of p.dunes) {
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 2) {
          const y = d.y * h + Math.sin(x / w * d.freq * 3 + d.depth * 0.5) * d.amp * h;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = `rgba(${60 + d.depth * 15},${40 + d.depth * 10},${20 + d.depth * 5},${0.3 + d.depth * 0.08})`;
        ctx.fill();
      }
    },
    drawFull(ctx, w, h, col, t, p, bass, mid, treble) {
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      sky.addColorStop(0, 'rgba(3,2,12,0.9)'); sky.addColorStop(0.7, rgba(col[0], 0.06)); sky.addColorStop(1, 'rgba(40,25,15,0.15)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // stars
      for (const s of p.stars) { const tw = 0.3 + 0.7 * Math.sin(t * 1.3 + s.tw); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.45})`; ctx.fill(); }
      // massive moon
      const moonX = w * 0.72, moonY = h * 0.18, moonR = 45;
      const mg = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 3);
      mg.addColorStop(0, 'rgba(255,240,200,0.15)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, 6.28);
      ctx.fillStyle = 'rgba(255,235,190,0.6)'; ctx.fill();
      // craters
      ctx.beginPath(); ctx.arc(moonX - 10, moonY - 5, 6, 0, 6.28); ctx.fillStyle = 'rgba(200,190,150,0.15)'; ctx.fill();
      ctx.beginPath(); ctx.arc(moonX + 12, moonY + 8, 4, 0, 6.28); ctx.fill();

      // sand dunes (layered)
      for (const d of p.dunes) {
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 2) {
          const y = d.y * h + Math.sin(x / w * d.freq * 3 + d.depth * 0.5 + t * 0.02) * d.amp * h + Math.sin(x / w * 7 + d.depth) * d.amp * h * 0.3;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath();
        const sandColor = `rgba(${55 + d.depth * 18},${35 + d.depth * 12},${18 + d.depth * 6},${0.35 + d.depth * 0.1})`;
        ctx.fillStyle = sandColor; ctx.fill();
        // shadow on dune ridges
        if (d.depth > 1) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const y = d.y * h + Math.sin(x / w * d.freq * 3 + d.depth * 0.5 + t * 0.02) * d.amp * h;
            ctx.lineTo(x, y + 3);
          }
          ctx.strokeStyle = `rgba(20,12,5,${0.08})`; ctx.lineWidth = 2; ctx.stroke();
        }
      }

      // caravan silhouettes on a ridge
      const camelY = p.dunes[2].y * h + Math.sin(0.6 * p.dunes[2].freq * 3 + 2 * 0.5) * p.dunes[2].amp * h - 8;
      for (const c of p.caravan) {
        const cx = c.x * w + t * 2, cy = camelY;
        // camel body
        ctx.fillStyle = 'rgba(20,12,5,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 5, 0, 0, 6.28); ctx.fill();
        // hump
        ctx.beginPath(); ctx.arc(cx - 2, cy - 5, 4, Math.PI, 0); ctx.fill();
        // legs
        ctx.fillRect(cx - 5, cy + 3, 1.5, 6);
        ctx.fillRect(cx + 3, cy + 3, 1.5, 6);
        // neck + head
        ctx.beginPath(); ctx.moveTo(cx + 6, cy - 2); ctx.lineTo(cx + 10, cy - 8); ctx.lineTo(cx + 13, cy - 7);
        ctx.strokeStyle = 'rgba(20,12,5,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // dust particles
      for (const d of p.dust) {
        d.x += d.vx;
        if (d.x > 1.1) d.x = -0.1;
        ctx.beginPath(); ctx.arc(d.x * w, d.y * h + Math.sin(t * 0.3 + d.x * 10) * 5, d.size, 0, 6.28);
        ctx.fillStyle = 'rgba(180,150,100,0.06)'; ctx.fill();
      }
    }
  };

  // Build remaining scenes as simpler but still composed scenes
  // Each uses the same create/drawMini/drawFull pattern

  function makeQuickScene(name, drawFn) {
    return {
      create(w, h) {
        return {
          p1: Array.from({length: 60}, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.001, vy: (Math.random() - 0.5) * 0.001, size: 1 + Math.random() * 3, phase: Math.random() * 6.28, life: Math.random(), hue: Math.random() * 360, r: 0.3 + Math.random() * 1.5 })),
          p2: Array.from({length: 30}, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.001, vy: (Math.random() - 0.5) * 0.001, size: 2 + Math.random() * 8, phase: Math.random() * 6.28, speed: 0.3 + Math.random() * 0.5, hue: Math.random() * 360 })),
          extra: { angle: 0, val: 0, trail: [] },
        };
      },
      drawMini(ctx, w, h, col, t, p, bass, mid) { drawFn(ctx, w, h, col, t, p, bass, mid, 0, false); },
      drawFull(ctx, w, h, col, t, p, bass, mid, treble) { drawFn(ctx, w, h, col, t, p, bass, mid, treble, true); },
    };
  }

  // 5-19: Each scene with a custom draw function
  const scenes5to19 = [
    // 5: Lightning Storm
    makeQuickScene('Lightning Storm', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // clouds
      for (let i = 0; i < (full ? 5 : 3); i++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) { const y = 10 + i * (full ? 30 : 15) + Math.sin(x * 0.005 + t * 0.2 + i) * 20 + Math.sin(x * 0.012 + t * 0.5) * 10; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath();
        ctx.fillStyle = rgba(col[1], 0.04 + i * 0.015); ctx.fill();
      }
      // rain
      ctx.strokeStyle = rgba(col[0], full ? 0.1 : 0.06); ctx.lineWidth = full ? 0.6 : 0.4;
      for (let i = 0; i < (full ? 50 : 20); i++) {
        const r = p.p1[i]; r.y += 0.008 * (1 + bass);
        if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); }
        ctx.beginPath(); ctx.moveTo(r.x * w, r.y * h); ctx.lineTo(r.x * w - 0.5, r.y * h + (full ? 18 : 8)); ctx.stroke();
      }
      // wind-bent trees (full only)
      if (full) {
        for (let i = 0; i < 4; i++) {
          const tx = w * (0.1 + i * 0.25), ty = h * 0.75;
          const bend = Math.sin(t * 0.5 + i) * 8;
          ctx.beginPath(); ctx.moveTo(tx, ty + 30); ctx.quadraticCurveTo(tx + bend, ty, tx + bend * 1.5, ty - 25);
          ctx.strokeStyle = 'rgba(15,20,15,0.4)'; ctx.lineWidth = 3; ctx.stroke();
          // canopy
          ctx.beginPath(); ctx.ellipse(tx + bend * 1.5, ty - 30, 18 + bend, 12, bend * 0.02, 0, 6.28);
          ctx.fillStyle = 'rgba(10,15,10,0.3)'; ctx.fill();
        }
      }
      // lightning bolt
      const e = p.extra;
      e.val -= 0.04; if (e.val < 0) e.val = 0;
      if (Math.random() < (bass > 0.3 ? 0.06 : 0.01) && e.val <= 0) {
        e.trail = []; let lx = w * (0.2 + Math.random() * 0.6), ly = 0;
        while (ly < h * 0.8) { const nx = lx + (Math.random() - 0.5) * (full ? 60 : 25), ny = ly + 10 + Math.random() * 30; e.trail.push([lx, ly, nx, ny]); if (Math.random() < 0.3) e.trail.push([nx, ny, nx + (Math.random() - 0.5) * 50, ny + 15 + Math.random() * 30]); lx = nx; ly = ny; }
        e.val = 1;
      }
      if (e.val > 0) {
        ctx.strokeStyle = rgba(col[0], e.val * 0.7); ctx.lineWidth = (full ? 3 : 1.5) * e.val;
        ctx.shadowBlur = 20 * e.val; ctx.shadowColor = col[0];
        for (const s of e.trail) { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); }
        ctx.shadowBlur = 0;
        if (e.val > 0.7) { ctx.fillStyle = rgba(col[0], (e.val - 0.7) * 0.1); ctx.fillRect(0, 0, w, h); }
      }
      // ground
      ctx.fillStyle = 'rgba(8,10,8,0.3)'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
    }),
    // 6: Snowy Cabin
    makeQuickScene('Snowy Cabin', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      ctx.fillStyle = 'rgba(8,10,18,0.3)'; ctx.fillRect(0, 0, w, h);
      // stars
      for (let i = 0; i < (full ? 40 : 12); i++) { const s = p.p1[i]; const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.phase); ctx.beginPath(); ctx.arc(s.x * w, s.y * h * 0.5, s.r * (full ? 1 : 0.6), 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.4})`; ctx.fill(); }
      // snow ground
      const groundY = h * (full ? 0.72 : 0.75);
      ctx.fillStyle = 'rgba(35,40,55,0.3)'; ctx.fillRect(0, groundY, w, h - groundY);
      // pine trees
      for (let i = 0; i < (full ? 8 : 4); i++) {
        const tx = w * (0.05 + i * (full ? 0.12 : 0.22));
        drawPineTree(ctx, tx, groundY, h * (0.12 + Math.sin(i * 2.3) * 0.04), '#0a0f15', full ? 0.6 : 0.4);
        // snow on branches
        if (full) { for (let j = 0; j < 3; j++) { ctx.fillStyle = 'rgba(180,190,210,0.08)'; ctx.fillRect(tx - 10 + j * 6, groundY - h * (0.1 + j * 0.03), 8, 2); } }
      }
      // cabin
      const cx = w * 0.55, cy = groundY, cw = full ? 80 : 35, ch = full ? 50 : 22;
      ctx.fillStyle = 'rgba(30,20,15,0.6)'; ctx.fillRect(cx, cy - ch, cw, ch);
      // roof
      ctx.beginPath(); ctx.moveTo(cx - 5, cy - ch); ctx.lineTo(cx + cw / 2, cy - ch - (full ? 25 : 12)); ctx.lineTo(cx + cw + 5, cy - ch); ctx.closePath();
      ctx.fillStyle = 'rgba(25,18,12,0.7)'; ctx.fill();
      // snow on roof
      ctx.beginPath(); ctx.moveTo(cx - 5, cy - ch); ctx.lineTo(cx + cw / 2, cy - ch - (full ? 25 : 12) + 3); ctx.lineTo(cx + cw + 5, cy - ch); ctx.closePath();
      ctx.fillStyle = 'rgba(180,190,210,0.1)'; ctx.fill();
      // warm window glow
      const winGlow = ctx.createRadialGradient(cx + cw * 0.35, cy - ch * 0.5, 0, cx + cw * 0.35, cy - ch * 0.5, full ? 60 : 25);
      winGlow.addColorStop(0, 'rgba(255,180,80,0.1)'); winGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = winGlow; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,200,100,0.25)'; ctx.fillRect(cx + cw * 0.2, cy - ch * 0.7, cw * 0.25, ch * 0.35);
      ctx.fillStyle = 'rgba(255,200,100,0.2)'; ctx.fillRect(cx + cw * 0.55, cy - ch * 0.7, cw * 0.25, ch * 0.35);
      // chimney + smoke
      ctx.fillStyle = 'rgba(35,25,18,0.6)'; ctx.fillRect(cx + cw * 0.7, cy - ch - (full ? 20 : 10), full ? 10 : 5, full ? 15 : 8);
      // smoke
      for (let i = 0; i < 4; i++) { const sx = cx + cw * 0.73 + Math.sin(t * 0.3 + i * 1.5) * (full ? 15 : 5); const sy = cy - ch - (full ? 30 : 14) - i * (full ? 15 : 6); ctx.beginPath(); ctx.arc(sx, sy, (full ? 6 : 3) + i * (full ? 4 : 1.5), 0, 6.28); ctx.fillStyle = `rgba(150,160,180,${0.03 - i * 0.005})`; ctx.fill(); }
      // snow
      for (let i = 0; i < (full ? 50 : 15); i++) {
        const s = p.p2[i % p.p2.length]; s.y += 0.0005 + s.size * 0.0001; s.x += Math.sin(t * 0.3 + s.phase) * 0.0002;
        if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size * (full ? 0.5 : 0.3), 0, 6.28);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
      }
    }),
    // 7: Beach Sunset
    makeQuickScene('Beach Sunset', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, 'rgba(20,5,40,0.6)'); sky.addColorStop(0.3, rgba(col[0], 0.2)); sky.addColorStop(0.6, 'rgba(255,100,40,0.2)'); sky.addColorStop(1, 'rgba(255,180,60,0.15)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // sun
      const sunY = h * 0.48, sunR = full ? 40 : 15;
      const sg = ctx.createRadialGradient(w * 0.5, sunY, sunR * 0.5, w * 0.5, sunY, sunR * 3);
      sg.addColorStop(0, 'rgba(255,200,80,0.4)'); sg.addColorStop(0.3, 'rgba(255,120,40,0.15)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      ctx.beginPath(); ctx.arc(w * 0.5, sunY, sunR, 0, 6.28); ctx.fillStyle = 'rgba(255,180,60,0.6)'; ctx.fill();
      // cloud streaks
      if (full) for (let i = 0; i < 4; i++) { ctx.beginPath(); const cy = h * (0.2 + i * 0.08); for (let x = 0; x <= w; x += 3) { ctx.lineTo(x, cy + Math.sin(x * 0.008 + t * 0.1 + i) * 5); } ctx.strokeStyle = 'rgba(255,150,80,0.05)'; ctx.lineWidth = 3 + i; ctx.stroke(); }
      // ocean
      const oceanY = h * 0.58;
      ctx.fillStyle = rgba(col[1], 0.08); ctx.fillRect(0, oceanY, w, h - oceanY);
      // waves
      for (let l = 0; l < (full ? 6 : 3); l++) {
        ctx.beginPath(); const wy = oceanY + l * (full ? 15 : 8);
        for (let x = 0; x <= w; x += 3) { const y = wy + Math.sin(x * 0.01 + t * (0.6 - l * 0.08) + l) * (4 + bass * 5) + Math.sin(x * 0.025 + t * 0.3) * 2; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.strokeStyle = rgba(col[0], 0.08 - l * 0.01); ctx.lineWidth = full ? 1 : 0.6; ctx.stroke();
        // foam on wave crests
        if (full && l < 3) { for (let x = 0; x < w; x += 30 + Math.random() * 20) { const fy = wy + Math.sin(x * 0.01 + t * 0.6 + l) * 4; ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x, fy - 1, 8 + Math.random() * 8, 2); } }
      }
      // sun reflection on water
      ctx.beginPath();
      for (let y = oceanY; y < h; y += 3) { const rx = w * 0.5 + Math.sin(y * 0.04 + t) * (8 + (y - oceanY) * 0.1); ctx.moveTo(rx - 2, y); ctx.lineTo(rx + 2, y); }
      ctx.strokeStyle = 'rgba(255,180,60,0.06)'; ctx.lineWidth = 2; ctx.stroke();
      // sailboat silhouette
      if (full) { const bx = w * 0.7 + Math.sin(t * 0.1) * 20, by = oceanY + 10; ctx.fillStyle = 'rgba(15,10,20,0.3)'; ctx.fillRect(bx - 8, by, 16, 4); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 25); ctx.lineTo(bx + 12, by - 5); ctx.closePath(); ctx.fill(); }
      // wet sand
      ctx.fillStyle = 'rgba(30,25,15,0.1)'; ctx.fillRect(0, h * 0.85, w, h * 0.15);
    }),
    // 8: Space Nebula
    makeQuickScene('Space Nebula', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // nebula clouds
      for (let i = 0; i < (full ? 4 : 2); i++) {
        const nx = w * (0.3 + i * 0.15) + Math.sin(t * 0.05 + i) * 30;
        const ny = h * (0.3 + i * 0.1);
        const nr = (full ? 120 : 40) + Math.sin(t * 0.1 + i * 2) * 20;
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        ng.addColorStop(0, `hsla(${(i * 60 + t * 5) % 360},60%,40%,${0.06 + bass * 0.03})`);
        ng.addColorStop(0.5, `hsla(${(i * 60 + 30 + t * 5) % 360},50%,30%,0.02)`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng; ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
      }
      // stars
      for (let i = 0; i < (full ? 60 : 20); i++) { const s = p.p1[i]; const tw = 0.3 + 0.7 * Math.sin(t * 1.3 + s.phase); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r * (full ? 1 : 0.5), 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.5})`; ctx.fill(); }
      // planet with rings
      if (full) {
        const px = w * 0.65, py = h * 0.4, pr = 30;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.28);
        const pg = ctx.createRadialGradient(px - 5, py - 5, 0, px, py, pr);
        pg.addColorStop(0, rgba(col[0], 0.3)); pg.addColorStop(1, rgba(col[1], 0.15));
        ctx.fillStyle = pg; ctx.fill();
        // rings
        ctx.beginPath(); ctx.ellipse(px, py, pr * 1.8, pr * 0.3, -0.2, 0, 6.28);
        ctx.strokeStyle = rgba(col[0], 0.15); ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(px, py, pr * 2.1, pr * 0.35, -0.2, 0, 6.28);
        ctx.strokeStyle = rgba(col[0], 0.08); ctx.lineWidth = 2; ctx.stroke();
      }
      // comet
      const e = p.extra; e.angle += 0.002;
      const cx = w * 0.3 + Math.cos(e.angle) * w * 0.3, cy = h * 0.2 + Math.sin(e.angle) * h * 0.15;
      ctx.beginPath(); ctx.arc(cx, cy, full ? 3 : 1.5, 0, 6.28); ctx.fillStyle = 'rgba(200,220,255,0.5)'; ctx.fill();
      // comet tail
      const tailLen = full ? 60 : 20;
      const tg = ctx.createLinearGradient(cx, cy, cx - tailLen, cy + tailLen * 0.3);
      tg.addColorStop(0, 'rgba(200,220,255,0.3)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - tailLen, cy + tailLen * 0.3); ctx.lineTo(cx - tailLen * 0.8, cy + tailLen * 0.35);
      ctx.strokeStyle = tg; ctx.lineWidth = full ? 2 : 1; ctx.stroke();
    }),
    // 9: Rainy Window
    makeQuickScene('Rainy Window', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // blurred bokeh lights
      for (let i = 0; i < (full ? 15 : 6); i++) {
        const b = p.p2[i]; const br = b.size * (full ? 2.5 : 1) + mid * 5;
        const bg = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, br);
        bg.addColorStop(0, `hsla(${b.hue},60%,50%,${0.06 + bass * 0.02})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg; ctx.fillRect(b.x * w - br, b.y * h - br, br * 2, br * 2);
      }
      // glass tint
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, w, h);
      // raindrops
      for (let i = 0; i < (full ? 30 : 10); i++) {
        const d = p.p1[i]; d.y += 0.0008 + d.size * 0.00015; d.phase += 0.02;
        if (d.y > 1.1) { d.y = -0.1; d.x = Math.random(); d.size = 1 + Math.random() * 3; }
        const dx = d.x * w + Math.sin(d.phase) * 2, dy = d.y * h;
        // trail
        const trailLen = full ? 15 : 6;
        ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.sin(d.phase - 0.5) * 1, dy - trailLen * d.size);
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = d.size * (full ? 0.4 : 0.2); ctx.stroke();
        // drop head
        const dr = d.size * (full ? 0.7 : 0.4);
        ctx.beginPath(); ctx.arc(dx, dy, dr, 0, 6.28);
        ctx.fillStyle = 'rgba(200,220,255,0.1)'; ctx.fill();
        // refraction highlight
        ctx.beginPath(); ctx.arc(dx - dr * 0.2, dy - dr * 0.2, dr * 0.25, 0, 6.28);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
      }
    }),
    // 10: Forest Dawn
    makeQuickScene('Forest Dawn', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      ctx.fillStyle = rgba('#0a1208', 0.3); ctx.fillRect(0, 0, w, h);
      // golden light shafts
      for (let i = 0; i < (full ? 5 : 2); i++) {
        const sx = w * (0.15 + i * 0.18) + Math.sin(t * 0.1 + i) * 20;
        const sw = (full ? 25 : 10) + Math.sin(t * 0.2 + i * 2) * 8;
        const sg = ctx.createLinearGradient(sx, 0, sx + sw * 3, h * 0.7);
        sg.addColorStop(0, 'rgba(255,220,120,0.04)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + sw, 0); ctx.lineTo(sx + sw * 3, h * 0.7); ctx.lineTo(sx - sw, h * 0.7); ctx.closePath(); ctx.fill();
      }
      // fog bank
      if (full) { ctx.fillStyle = 'rgba(180,200,160,0.02)'; for (let i = 0; i < 3; i++) { const fy = h * (0.45 + i * 0.08) + Math.sin(t * 0.15 + i) * 10; ctx.fillRect(0, fy, w, 20); } }
      // tree trunks + canopy layers
      for (let i = 0; i < (full ? 6 : 3); i++) {
        const tx = w * (0.08 + i * (full ? 0.15 : 0.28));
        ctx.fillStyle = 'rgba(20,12,8,0.3)'; ctx.fillRect(tx - 3, 0, 6 + i, h);
        // canopy blobs at different heights
        for (let j = 0; j < (full ? 4 : 2); j++) {
          ctx.beginPath(); ctx.ellipse(tx + Math.sin(t * 0.1 + i + j) * 5, h * (0.05 + j * 0.12), full ? 25 : 12, full ? 12 : 6, 0, 0, 6.28);
          ctx.fillStyle = rgba(col[0], 0.04 + j * 0.01); ctx.fill();
        }
      }
      // deer silhouette (full only)
      if (full) {
        const dx = w * 0.65 + Math.sin(t * 0.08) * 10, dy = h * 0.62;
        ctx.fillStyle = 'rgba(15,10,8,0.25)';
        ctx.beginPath(); ctx.ellipse(dx, dy, 18, 10, 0, 0, 6.28); ctx.fill(); // body
        ctx.fillRect(dx - 10, dy + 6, 2, 12); ctx.fillRect(dx + 6, dy + 6, 2, 12); // legs
        ctx.beginPath(); ctx.ellipse(dx + 18, dy - 5, 6, 5, 0.3, 0, 6.28); ctx.fill(); // head
        // antlers
        ctx.beginPath(); ctx.moveTo(dx + 20, dy - 9); ctx.lineTo(dx + 25, dy - 22); ctx.moveTo(dx + 23, dy - 16); ctx.lineTo(dx + 28, dy - 18);
        ctx.strokeStyle = 'rgba(15,10,8,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // fireflies
      for (let i = 0; i < (full ? 20 : 8); i++) { const f = p.p1[i]; f.phase += 0.012; const glow = 0.5 + 0.5 * Math.sin(f.phase); ctx.beginPath(); ctx.arc(f.x * w, f.y * h, (full ? 2 : 1) + mid, 0, 6.28); ctx.shadowBlur = full ? 8 : 4; ctx.shadowColor = '#aaff44'; ctx.fillStyle = `rgba(170,255,68,${0.3 * glow})`; ctx.fill(); }
      ctx.shadowBlur = 0;
      // stream
      if (full) { ctx.beginPath(); for (let x = 0; x <= w; x += 3) { ctx.lineTo(x, h * 0.78 + Math.sin(x * 0.02 + t * 0.5) * 3); } ctx.strokeStyle = 'rgba(100,150,200,0.06)'; ctx.lineWidth = 8; ctx.stroke(); }
    }),
    // 11: Midnight Drive
    makeQuickScene('Midnight Drive', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // road ahead (perspective)
      const vp = h * 0.38;
      ctx.beginPath(); ctx.moveTo(w * 0.35, vp); ctx.lineTo(0, h); ctx.lineTo(w, h); ctx.lineTo(w * 0.65, vp); ctx.closePath();
      ctx.fillStyle = 'rgba(18,16,22,0.5)'; ctx.fill();
      // center line dashes (scrolling)
      for (let i = 0; i < 12; i++) {
        const f = i / 12; const dy = vp + f * f * (h - vp); const dw = 1 + f * 3;
        const so = (t * 60 + i * 25) % (h * 0.06);
        ctx.fillStyle = `rgba(255,200,50,${0.15 * f})`; ctx.fillRect(w / 2 - dw / 2, dy + so, dw, 6 * f);
      }
      // streetlights passing
      for (let i = 0; i < (full ? 6 : 3); i++) {
        const sf = ((t * 0.5 + i * 0.4) % 2) / 2; // 0→1 cycle
        const sx = lerp(w * 0.62, w * 0.85, sf);
        const sy = lerp(vp + 10, h * 0.6, sf * sf);
        const sr = lerp(2, 8, sf);
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * (full ? 8 : 4));
        sg.addColorStop(0, `rgba(255,200,100,${0.08 * sf})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg; ctx.fillRect(sx - sr * 8, sy - sr * 8, sr * 16, sr * 16);
        ctx.beginPath(); ctx.arc(sx, sy, sr * 0.5, 0, 6.28); ctx.fillStyle = `rgba(255,200,100,${0.4 * sf})`; ctx.fill();
      }
      // dashboard glow
      ctx.fillStyle = rgba(col[0], 0.02); ctx.fillRect(0, h * 0.85, w, h * 0.15);
      // rain on windshield (full)
      if (full) { for (let i = 0; i < 20; i++) { const r = p.p1[i]; r.y += 0.004; if (r.y > 1) { r.y = 0; r.x = Math.random(); } ctx.beginPath(); ctx.arc(r.x * w, r.y * h, 1.5, 0, 6.28); ctx.fillStyle = 'rgba(200,220,255,0.06)'; ctx.fill(); } }
      // distant city glow on horizon
      const cg = ctx.createRadialGradient(w * 0.5, vp, 0, w * 0.5, vp, full ? 150 : 50);
      cg.addColorStop(0, rgba(col[0], 0.06)); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
    }),
    // 12: Synthwave
    makeQuickScene('Synthwave', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // gradient sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      sky.addColorStop(0, 'rgba(10,0,30,0.7)'); sky.addColorStop(0.5, 'rgba(60,0,80,0.3)'); sky.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // chrome sun — semicircle sitting on the horizon
      const sunY = h * 0.55, sunR = full ? 65 : 24;
      // sun glow halo
      const sunGlow = ctx.createRadialGradient(w / 2, sunY, sunR * 0.5, w / 2, sunY, sunR * 3);
      sunGlow.addColorStop(0, 'rgba(255,80,180,0.15)'); sunGlow.addColorStop(0.5, 'rgba(255,40,100,0.05)'); sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunGlow; ctx.fillRect(0, sunY - sunR * 3, w, sunR * 4);
      // sun disk (top half only)
      ctx.beginPath(); ctx.arc(w / 2, sunY, sunR, Math.PI, 0);
      const sg = ctx.createLinearGradient(w / 2, sunY - sunR, w / 2, sunY);
      sg.addColorStop(0, 'rgba(255,220,80,0.7)'); sg.addColorStop(0.4, 'rgba(255,100,150,0.6)'); sg.addColorStop(1, 'rgba(200,50,120,0.5)');
      ctx.fillStyle = sg; ctx.fill();
      // sun stripe cutouts (getting wider toward bottom for that classic synthwave look)
      for (let i = 0; i < 6; i++) { const sy = sunY - sunR + sunR * 0.35 + i * sunR * 0.12; const sw = Math.sqrt(Math.max(0, sunR * sunR - (sy - sunY) * (sy - sunY))) * 2; ctx.fillStyle = 'rgba(5,0,15,0.6)'; ctx.fillRect(w / 2 - sw / 2, sy, sw, (full ? 2 : 1) + i * (full ? 0.8 : 0.3)); }
      // mountain wireframe
      ctx.beginPath(); ctx.moveTo(0, h * 0.55);
      for (let x = 0; x <= w; x += (full ? 15 : 8)) {
        const y = h * 0.55 - Math.abs(Math.sin(x / w * 3.14)) * h * 0.15 - Math.sin(x / w * 6 + 1) * h * 0.03;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(col[0], 0.2); ctx.lineWidth = full ? 1.5 : 0.8; ctx.stroke();
      // retro grid floor
      const gridTop = h * 0.55;
      ctx.strokeStyle = rgba(col[0], 0.12 + bass * 0.08); ctx.lineWidth = full ? 0.6 : 0.3;
      for (let i = 1; i <= (full ? 20 : 10); i++) { const f = i / 20; const y = gridTop + f * f * (h - gridTop); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(w / 2, gridTop); ctx.lineTo(w / 2 + i * (w / 10), h); ctx.stroke(); }
      // scrolling grid
      const gridScroll = (t * 40) % (h * 0.05);
      for (let i = 0; i < 4; i++) { const y = gridTop + gridScroll + i * h * 0.05; if (y > gridTop && y < h) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.strokeStyle = rgba(col[0], 0.05); ctx.stroke(); } }
      // palm silhouettes
      if (full) for (let i = 0; i < 3; i++) {
        const px = w * [0.08, 0.88, 0.15][i], py = h * 0.55;
        ctx.strokeStyle = 'rgba(10,0,20,0.6)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px, py + 50); ctx.quadraticCurveTo(px + (i === 1 ? -5 : 5), py, px + (i === 1 ? -8 : 8), py - 30); ctx.stroke();
        for (let f = 0; f < 5; f++) { const fa = (f / 5) * 6.28 + t * 0.03; ctx.beginPath(); ctx.moveTo(px + (i === 1 ? -8 : 8), py - 30); ctx.lineTo(px + (i === 1 ? -8 : 8) + Math.cos(fa) * 25, py - 30 + Math.sin(fa) * 12 + Math.abs(Math.cos(fa)) * 10); ctx.strokeStyle = 'rgba(10,0,20,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }),
    // 13: Underwater Reef
    makeQuickScene('Underwater Reef', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      ctx.fillStyle = rgba('#061830', full ? 0.2 : 0.15); ctx.fillRect(0, 0, w, h);
      // light shafts
      for (let i = 0; i < (full ? 4 : 2); i++) { const sx = w * (0.15 + i * 0.22) + Math.sin(t * 0.15 + i) * 25; const sw = 15 + Math.sin(t * 0.25 + i * 2) * 8; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + sw, 0); ctx.lineTo(sx + sw * 3, h); ctx.lineTo(sx - sw, h); ctx.closePath(); ctx.fillStyle = rgba(col[0], 0.015 + bass * 0.01); ctx.fill(); }
      // coral formations (detailed shapes)
      for (let i = 0; i < (full ? 6 : 3); i++) {
        const cx = w * (0.08 + i * (full ? 0.15 : 0.3)), cy = h * 0.85;
        // branching coral
        ctx.strokeStyle = `hsla(${300 + i * 20},60%,45%,0.15)`; ctx.lineWidth = full ? 2 : 1;
        for (let b = 0; b < 3; b++) { const ba = -Math.PI / 2 + (b - 1) * 0.5; ctx.beginPath(); ctx.moveTo(cx, cy); let bx = cx, by = cy; for (let s = 0; s < 4; s++) { bx += Math.cos(ba + Math.sin(t * 0.3 + b + s) * 0.15) * (full ? 12 : 5); by += Math.sin(ba) * (full ? 12 : 5); ctx.lineTo(bx, by); } ctx.stroke(); }
      }
      // fish school (detailed)
      for (let i = 0; i < (full ? 12 : 5); i++) {
        const f = p.p1[i]; f.x += f.vx; if (f.x > 1.1) f.x = -0.1; if (f.x < -0.1) f.x = 1.1;
        const fx = f.x * w, fy = f.y * h * 0.7 + h * 0.15 + Math.sin(t * 0.4 + f.phase) * (full ? 15 : 5);
        const dir = f.vx > 0 ? 1 : -1; const fs = f.r * (full ? 3 : 1.5);
        ctx.beginPath(); ctx.ellipse(fx, fy, fs, fs * 0.4, 0, 0, 6.28);
        ctx.fillStyle = rgba(col[0], 0.2); ctx.fill();
        // tail
        ctx.beginPath(); ctx.moveTo(fx - dir * fs, fy); ctx.lineTo(fx - dir * (fs + 4), fy - 2); ctx.lineTo(fx - dir * (fs + 4), fy + 2); ctx.closePath(); ctx.fill();
        // eye
        ctx.beginPath(); ctx.arc(fx + dir * fs * 0.5, fy - 1, 0.8, 0, 6.28); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
      }
      // sea turtle (full only)
      if (full) {
        const tx = (t * 8) % (w + 200) - 100, ty = h * 0.4 + Math.sin(t * 0.3) * 20;
        ctx.beginPath(); ctx.ellipse(tx, ty, 20, 12, 0, 0, 6.28);
        ctx.fillStyle = 'rgba(40,80,50,0.2)'; ctx.fill();
        // flippers
        ctx.beginPath(); ctx.ellipse(tx - 8, ty + 8, 12, 3, 0.5 + Math.sin(t * 1.5) * 0.3, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.ellipse(tx + 8, ty + 8, 12, 3, -0.5 - Math.sin(t * 1.5) * 0.3, 0, 6.28); ctx.fill();
        // head
        ctx.beginPath(); ctx.ellipse(tx + 18, ty - 2, 5, 4, 0.2, 0, 6.28); ctx.fill();
      }
      // bubbles
      for (let i = 0; i < (full ? 20 : 8); i++) { const b = p.p2[i]; b.y -= 0.001; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } ctx.beginPath(); ctx.arc(b.x * w + Math.sin(t * 0.5 + b.phase) * 5, b.y * h, b.size * 0.5, 0, 6.28); ctx.strokeStyle = 'rgba(150,200,255,0.08)'; ctx.lineWidth = 0.5; ctx.stroke(); }
    }),
    // 14: Volcano
    makeQuickScene('Volcano', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // red sky glow
      const skyG = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      skyG.addColorStop(0, 'rgba(30,5,5,0.5)'); skyG.addColorStop(1, 'rgba(60,15,5,0.15)');
      ctx.fillStyle = skyG; ctx.fillRect(0, 0, w, h);
      // mountain silhouette
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.15, h * 0.6); ctx.lineTo(w * 0.35, h * 0.55);
      ctx.lineTo(w * 0.43, h * 0.3); ctx.lineTo(w * 0.47, h * 0.28); ctx.lineTo(w * 0.53, h * 0.28);
      ctx.lineTo(w * 0.57, h * 0.3); ctx.lineTo(w * 0.65, h * 0.55); ctx.lineTo(w * 0.85, h * 0.6);
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = 'rgba(20,10,8,0.7)'; ctx.fill();
      // crater glow
      const cg = ctx.createRadialGradient(w / 2, h * 0.26, 0, w / 2, h * 0.26, full ? 50 : 20);
      cg.addColorStop(0, `rgba(255,80,20,${0.2 + bass * 0.15})`); cg.addColorStop(0.5, 'rgba(255,40,5,0.05)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
      // lava flows (streaks down the mountain)
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let lx = w * (0.47 + i * 0.03), ly = h * 0.3;
        ctx.moveTo(lx, ly);
        for (let s = 0; s < 8; s++) { lx += (Math.random() - 0.5 + i * 0.2 - 0.2) * (full ? 15 : 5); ly += (full ? 20 : 8); ctx.lineTo(lx, ly); }
        ctx.strokeStyle = `rgba(255,${60 + i * 30},0,0.15)`; ctx.lineWidth = full ? 3 : 1.5; ctx.stroke();
        // glow along flow
        ctx.shadowBlur = full ? 8 : 3; ctx.shadowColor = 'rgba(255,80,0,0.3)'; ctx.stroke(); ctx.shadowBlur = 0;
      }
      // embers rising
      for (let i = 0; i < (full ? 25 : 8); i++) {
        const e = p.p1[i]; e.y -= 0.002; e.x += (Math.random() - 0.5) * 0.001; e.life += 0.005;
        if (e.life > 1 || e.y < 0) { e.x = 0.45 + Math.random() * 0.1; e.y = 0.28; e.life = 0; }
        ctx.beginPath(); ctx.arc(e.x * w, e.y * h, e.r * (1 - e.life), 0, 6.28);
        ctx.fillStyle = `rgba(255,${100 + Math.floor(e.life * 100)},20,${0.4 * (1 - e.life)})`;
        ctx.fill();
      }
      // ash clouds at top
      for (let i = 0; i < (full ? 6 : 2); i++) {
        const ax = w / 2 + Math.sin(t * 0.1 + i * 2) * (full ? 50 : 15), ay = h * (0.1 + i * 0.04);
        ctx.beginPath(); ctx.arc(ax, ay, (full ? 30 : 10) + i * 5, 0, 6.28);
        ctx.fillStyle = `rgba(40,30,25,${0.03 - i * 0.004})`; ctx.fill();
      }
    }),
    // 15-19: More scenes using the same pattern
    // 15: City Rooftop
    makeQuickScene('City Rooftop', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      sky.addColorStop(0, 'rgba(3,3,12,0.7)'); sky.addColorStop(1, rgba(col[1], 0.04));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // stars
      for (let i = 0; i < (full ? 50 : 15); i++) { const s = p.p1[i]; const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.phase); ctx.beginPath(); ctx.arc(s.x * w, s.y * h * 0.5, s.r * (full ? 1 : 0.5), 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.4})`; ctx.fill(); }
      // skyline
      const skylineY = h * 0.55;
      for (let i = 0; i < (full ? 15 : 6); i++) {
        const bx = w * (i / (full ? 15 : 6)), bw = w / (full ? 15 : 6) - 2;
        const bh = h * (0.08 + Math.sin(i * 2.7) * 0.12 + Math.random() * 0.05);
        drawBuilding(ctx, bx, bw, skylineY, bh, Math.floor(bh / 10), 2, 'rgba(8,8,14,0.8)', col[0], 0.08 + mid * 0.05, t + i);
      }
      // water tower
      if (full) { const wtx = w * 0.3; ctx.fillStyle = 'rgba(20,20,25,0.6)'; ctx.fillRect(wtx - 2, skylineY - 35, 2, 35); ctx.fillRect(wtx + 10, skylineY - 35, 2, 35); ctx.beginPath(); ctx.ellipse(wtx + 5, skylineY - 40, 10, 14, 0, 0, 6.28); ctx.fillStyle = 'rgba(25,25,30,0.6)'; ctx.fill(); }
      // rooftop surface
      ctx.fillStyle = 'rgba(12,12,16,0.4)'; ctx.fillRect(0, skylineY, w, h - skylineY);
      // traffic glow
      for (let i = 0; i < 3; i++) { const gx = w * (0.2 + i * 0.3); const tg = ctx.createRadialGradient(gx, skylineY, 0, gx, skylineY, full ? 50 : 20); tg.addColorStop(0, rgba(col[0], 0.04 + bass * 0.02)); tg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = tg; ctx.fillRect(gx - 60, skylineY - 20, 120, 40); }
      // airplane
      const apX = (t * 12) % (w + 200) - 100; if (Math.sin(t * 2) > 0.7) { ctx.beginPath(); ctx.arc(apX, h * 0.08, 1.5, 0, 6.28); ctx.fillStyle = 'rgba(255,50,50,0.5)'; ctx.fill(); }
    }),
    // 16: Vinyl Session
    makeQuickScene('Vinyl Session', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // warm ambient
      ctx.fillStyle = 'rgba(15,10,5,0.2)'; ctx.fillRect(0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.48, mr = Math.min(w, h) * (full ? 0.32 : 0.35);
      p.extra.angle += 0.006 + bass * 0.008;
      // record
      ctx.beginPath(); ctx.arc(cx, cy, mr, 0, 6.28);
      const rg = ctx.createRadialGradient(cx, cy, mr * 0.15, cx, cy, mr);
      rg.addColorStop(0, 'rgba(5,5,5,0.9)'); rg.addColorStop(0.15, 'rgba(15,15,15,0.9)'); rg.addColorStop(1, 'rgba(10,10,10,0.9)');
      ctx.fillStyle = rg; ctx.fill();
      // grooves
      for (let r = mr * 0.2; r < mr * 0.95; r += (full ? 2.5 : 3.5)) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28);
        ctx.strokeStyle = `rgba(35,35,35,${0.04 + Math.sin(r * 0.5 + t * 2) * 0.02 + mid * 0.03})`;
        ctx.lineWidth = 0.4; ctx.stroke();
      }
      // label
      ctx.beginPath(); ctx.arc(cx, cy, mr * 0.15, 0, 6.28); ctx.fillStyle = rgba(col[0], 0.35); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, mr * 0.03, 0, 6.28); ctx.fillStyle = 'rgba(25,25,25,0.9)'; ctx.fill();
      // light reflection
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(p.extra.angle);
      const lg = ctx.createLinearGradient(-mr, 0, mr, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.49, 'rgba(255,255,255,0.03)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.06)'); lg.addColorStop(0.51, 'rgba(255,255,255,0.03)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg; ctx.fillRect(-mr, -mr, mr * 2, mr * 2); ctx.restore();
      // warm lamp light beam (full)
      if (full) {
        const lampX = w * 0.2, lampY = h * 0.15;
        const lb = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, 120);
        lb.addColorStop(0, 'rgba(255,200,100,0.06)'); lb.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lb; ctx.fillRect(0, 0, w, h);
        // dust motes in light
        for (let i = 0; i < 15; i++) { const d = p.p1[i]; ctx.beginPath(); ctx.arc(lampX + (d.x - 0.5) * 100, lampY + d.y * 150, 0.8, 0, 6.28); ctx.fillStyle = 'rgba(255,220,150,0.08)'; ctx.fill(); }
      }
      // tonearm
      if (full) { const ax = w * 0.75, ay = h * 0.12; ctx.save(); ctx.translate(ax, ay); ctx.rotate(-0.3 + Math.sin(t * 0.08) * 0.02); ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.2, h * 0.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.28); ctx.fillStyle = 'rgba(50,50,50,0.5)'; ctx.fill(); ctx.restore(); }
    }),
    // 17: Aquarium — big sharks, detailed reef, schools of fish
    makeQuickScene('Aquarium', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // deep blue gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, 'rgba(5,20,50,0.4)'); bg.addColorStop(0.6, 'rgba(3,12,35,0.6)'); bg.addColorStop(1, 'rgba(2,6,20,0.7)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // light shafts from above
      for (let i = 0; i < (full ? 4 : 2); i++) {
        const lx = w * (0.2 + i * 0.2) + Math.sin(t * 0.1 + i) * 20;
        const lg = ctx.createLinearGradient(lx, 0, lx + 40, h * 0.6);
        lg.addColorStop(0, 'rgba(80,150,255,0.04)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 15, 0); ctx.lineTo(lx + 50, h * 0.6); ctx.lineTo(lx - 10, h * 0.6); ctx.closePath(); ctx.fill();
      }
      // glass panel edge + slight reflection
      if (full) { ctx.strokeStyle = 'rgba(80,130,200,0.04)'; ctx.lineWidth = 3; ctx.strokeRect(15, 8, w - 30, h - 16); }
      // sandy bottom with ripple caustics
      ctx.fillStyle = 'rgba(30,25,15,0.15)'; ctx.fillRect(0, h * 0.88, w, h * 0.12);
      if (full) for (let x = 0; x < w; x += 20) { const cy = h * 0.88 + Math.sin(x * 0.05 + t * 0.5) * 2; ctx.fillStyle = 'rgba(80,150,255,0.02)'; ctx.fillRect(x, cy, 12, 1); }
      // coral reef at bottom — varied formations
      for (let i = 0; i < (full ? 10 : 4); i++) {
        const cx = w * (0.03 + i * (full ? 0.095 : 0.24)), cy = h * 0.88;
        const type = i % 4;
        if (type === 0) { // brain coral
          ctx.beginPath(); ctx.arc(cx, cy, full ? 15 : 6, Math.PI, 0);
          ctx.fillStyle = `hsla(${30 + i * 20},50%,35%,0.2)`; ctx.fill();
          if (full) { for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(cx + (j - 1.5) * 5, cy - 5, 3, 0, 6.28); ctx.strokeStyle = `hsla(${30 + i * 20},40%,40%,0.08)`; ctx.lineWidth = 0.5; ctx.stroke(); } }
        } else if (type === 1) { // fan coral
          for (let a = Math.PI; a >= 0.3; a -= 0.12) { const r = (full ? 22 : 8) + Math.sin(a * 4 + i) * 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r); ctx.strokeStyle = `hsla(${300 + i * 12},55%,50%,0.1)`; ctx.lineWidth = full ? 1 : 0.5; ctx.stroke(); }
        } else if (type === 2) { // branching coral
          for (let b = 0; b < 3; b++) { const ba = -Math.PI/2 + (b-1) * 0.6; let bx = cx, by = cy; ctx.beginPath(); ctx.moveTo(bx, by); for (let s = 0; s < 4; s++) { bx += Math.cos(ba + Math.sin(t * 0.2 + b + s) * 0.1) * (full ? 8 : 3); by += Math.sin(ba) * (full ? 8 : 3); ctx.lineTo(bx, by); } ctx.strokeStyle = `hsla(${340 + i * 10},50%,45%,0.12)`; ctx.lineWidth = full ? 2 : 1; ctx.stroke(); }
        } else { // anemone
          for (let tn = 0; tn < 8; tn++) { const ta = (tn / 8) * Math.PI; const len = (full ? 18 : 7) + Math.sin(t * 0.8 + tn) * 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * 3, cy); ctx.quadraticCurveTo(cx + Math.cos(ta) * len * 0.6, cy - len * 0.7, cx + Math.cos(ta) * len * 0.3 + Math.sin(t * 0.5 + tn) * 3, cy - len); ctx.strokeStyle = `hsla(${280 + i * 15},60%,55%,0.1)`; ctx.lineWidth = full ? 1.5 : 0.6; ctx.stroke(); }
        }
      }
      // BIG SHARK silhouette — slow, menacing
      if (full) {
        const sharkX = ((t * 15) % (w + 300)) - 150, sharkY = h * 0.3 + Math.sin(t * 0.2) * 30;
        const ss = 1; // scale
        ctx.fillStyle = 'rgba(15,25,45,0.25)';
        ctx.beginPath();
        // body
        ctx.moveTo(sharkX + 60 * ss, sharkY);
        ctx.quadraticCurveTo(sharkX + 30 * ss, sharkY - 15 * ss, sharkX - 20 * ss, sharkY - 5 * ss); // top
        ctx.quadraticCurveTo(sharkX - 50 * ss, sharkY, sharkX - 65 * ss, sharkY - 12 * ss); // tail top
        ctx.lineTo(sharkX - 55 * ss, sharkY); // tail notch
        ctx.lineTo(sharkX - 65 * ss, sharkY + 10 * ss); // tail bottom
        ctx.quadraticCurveTo(sharkX - 50 * ss, sharkY + 3 * ss, sharkX - 20 * ss, sharkY + 8 * ss); // belly
        ctx.quadraticCurveTo(sharkX + 20 * ss, sharkY + 12 * ss, sharkX + 60 * ss, sharkY); // nose
        ctx.fill();
        // dorsal fin
        ctx.beginPath(); ctx.moveTo(sharkX - 5, sharkY - 5); ctx.lineTo(sharkX - 12, sharkY - 25); ctx.lineTo(sharkX - 25, sharkY - 2); ctx.closePath(); ctx.fill();
        // pectoral fin
        ctx.beginPath(); ctx.moveTo(sharkX + 5, sharkY + 6); ctx.lineTo(sharkX - 5, sharkY + 20); ctx.lineTo(sharkX - 15, sharkY + 8); ctx.closePath(); ctx.fill();
        // eye
        ctx.beginPath(); ctx.arc(sharkX + 40, sharkY - 2, 2, 0, 6.28); ctx.fillStyle = 'rgba(200,220,255,0.15)'; ctx.fill();
        // gill slits
        for (let g = 0; g < 3; g++) { ctx.beginPath(); ctx.moveTo(sharkX + 25 - g * 5, sharkY - 3); ctx.lineTo(sharkX + 25 - g * 5, sharkY + 4); ctx.strokeStyle = 'rgba(10,20,35,0.15)'; ctx.lineWidth = 0.8; ctx.stroke(); }
      }
      // school of small fish (moving together)
      const schoolCX = (Math.sin(t * 0.15) * 0.3 + 0.5) * w, schoolCY = h * 0.45 + Math.sin(t * 0.25) * h * 0.1;
      for (let i = 0; i < (full ? 20 : 8); i++) {
        const f = p.p1[i]; f.x += f.vx;
        if (f.x > 1.1) { f.x = -0.1; f.vx = Math.abs(f.vx); } if (f.x < -0.1) { f.x = 1.1; f.vx = -Math.abs(f.vx); }
        // school cohesion: pull toward school center
        const fx = f.x * w + (schoolCX - f.x * w) * 0.002;
        const fy = f.y * h * 0.6 + h * 0.15 + (schoolCY - f.y * h * 0.6 - h * 0.15) * 0.002 + Math.sin(t * 0.5 + f.phase) * (full ? 8 : 3);
        f.x = fx / w;
        const dir = f.vx > 0 ? 1 : -1, fs = f.r * (full ? 3 : 1.5);
        ctx.beginPath(); ctx.ellipse(fx, fy, fs, fs * 0.4, 0, 0, 6.28);
        ctx.fillStyle = `hsla(${f.hue},65%,55%,0.2)`; ctx.fill();
        ctx.beginPath(); ctx.moveTo(fx - dir * fs, fy); ctx.lineTo(fx - dir * (fs + 3), fy - 2); ctx.lineTo(fx - dir * (fs + 3), fy + 2); ctx.closePath(); ctx.fill();
      }
      // jellyfish (full only)
      if (full) {
        const jx = w * 0.8 + Math.sin(t * 0.15) * 30, jy = h * 0.25 + Math.sin(t * 0.3) * 20;
        ctx.beginPath(); ctx.ellipse(jx, jy, 15, 10, 0, Math.PI, 0);
        ctx.fillStyle = 'rgba(200,150,255,0.08)'; ctx.fill();
        for (let tn = 0; tn < 5; tn++) { ctx.beginPath(); ctx.moveTo(jx - 10 + tn * 5, jy); let ty = jy; for (let s = 0; s < 4; s++) { ty += 8; ctx.lineTo(jx - 10 + tn * 5 + Math.sin(t * 0.6 + tn + s) * 4, ty); } ctx.strokeStyle = 'rgba(200,150,255,0.05)'; ctx.lineWidth = 0.6; ctx.stroke(); }
      }
      // bubbles
      for (let i = 0; i < (full ? 20 : 6); i++) {
        const b = p.p2[i]; b.y -= 0.0008; b.phase += 0.02; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); }
        const bx = b.x * w + Math.sin(b.phase) * 5;
        ctx.beginPath(); ctx.arc(bx, b.y * h, b.size * 0.5, 0, 6.28);
        ctx.strokeStyle = 'rgba(150,200,255,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(bx - b.size * 0.12, b.y * h - b.size * 0.12, b.size * 0.12, 0, 6.28);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
      }
      // ambient blue overhead light
      const al = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      al.addColorStop(0, 'rgba(40,100,200,0.04)'); al.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = al; ctx.fillRect(0, 0, w, h);
    }),
    // 18: Cyberpunk City
    makeQuickScene('Cyberpunk', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // haze
      ctx.fillStyle = 'rgba(10,5,15,0.3)'; ctx.fillRect(0, 0, w, h);
      // dense building layers
      for (let layer = 0; layer < (full ? 3 : 2); layer++) {
        const baseY = h * (0.4 + layer * 0.15);
        for (let i = 0; i < (full ? 12 : 5); i++) {
          const bx = (i / (full ? 12 : 5)) * w, bw = w / (full ? 12 : 5) - 1;
          const bh = h * (0.1 + Math.sin(i * 3.1 + layer) * 0.08 + layer * 0.05);
          ctx.fillStyle = `rgba(${8 + layer * 4},${5 + layer * 3},${15 + layer * 5},${0.7 - layer * 0.15})`;
          ctx.fillRect(bx, baseY - bh, bw, bh + h - baseY);
          // neon accent lines on buildings
          if (Math.sin(i * 2.3 + layer + t * 0.1) > 0.3) {
            ctx.fillStyle = `hsla(${(i * 60 + layer * 120) % 360},80%,60%,${0.08 + mid * 0.05})`;
            ctx.fillRect(bx + 1, baseY - bh + 5, bw - 2, 2);
          }
        }
      }
      // holographic ad (full)
      if (full) {
        const adX = w * 0.6, adY = h * 0.25, adW = 60, adH = 40;
        ctx.fillStyle = `rgba(0,255,200,${0.04 + Math.sin(t * 2) * 0.02})`; ctx.fillRect(adX, adY, adW, adH);
        // scan line across ad
        const scanY = adY + ((t * 30) % adH);
        ctx.fillStyle = 'rgba(0,255,200,0.08)'; ctx.fillRect(adX, scanY, adW, 2);
      }
      // cables between buildings
      if (full) for (let i = 0; i < 4; i++) {
        const cy = h * (0.3 + i * 0.1);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) ctx.lineTo(x, cy + Math.sin(x * 0.008 + t * 0.1 + i) * 8 + Math.sin(x * 0.02 + i) * 3);
        ctx.strokeStyle = 'rgba(30,30,40,0.2)'; ctx.lineWidth = 0.8; ctx.stroke();
      }
      // flying vehicle lights
      for (let i = 0; i < (full ? 4 : 2); i++) {
        const v = p.p2[i]; v.x += 0.002; if (v.x > 1.2) { v.x = -0.2; v.y = 0.1 + Math.random() * 0.3; }
        ctx.beginPath(); ctx.arc(v.x * w, v.y * h + Math.sin(t * 0.5 + i) * 5, full ? 2 : 1, 0, 6.28);
        ctx.fillStyle = `hsla(${v.hue},80%,60%,0.4)`; ctx.fill();
        // light trail
        ctx.beginPath(); ctx.moveTo(v.x * w, v.y * h); ctx.lineTo((v.x - 0.05) * w, v.y * h);
        ctx.strokeStyle = `hsla(${v.hue},80%,60%,0.1)`; ctx.lineWidth = 1; ctx.stroke();
      }
      // rain
      ctx.strokeStyle = rgba(col[0], 0.06); ctx.lineWidth = 0.4;
      for (let i = 0; i < (full ? 40 : 12); i++) {
        const r = p.p1[i]; r.y += 0.008; if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); }
        ctx.beginPath(); ctx.moveTo(r.x * w, r.y * h); ctx.lineTo(r.x * w, r.y * h + (full ? 10 : 4)); ctx.stroke();
      }
      // neon reflection on wet ground
      ctx.fillStyle = rgba(col[0], 0.02 + bass * 0.02); ctx.fillRect(0, h * 0.85, w, h * 0.15);
    }),
    // 19: Subway Platform
    makeQuickScene('Subway Platform', function(ctx, w, h, col, t, p, bass, mid, treble, full) {
      // tunnel perspective
      const cx = w / 2, cy = h * 0.4;
      const ow = w * 0.48, iw = w * 0.06, ih = h * 0.05;
      // ceiling
      ctx.beginPath(); ctx.moveTo(cx - ow, 0); ctx.lineTo(cx - iw, cy - ih); ctx.lineTo(cx + iw, cy - ih); ctx.lineTo(cx + ow, 0); ctx.closePath();
      ctx.fillStyle = 'rgba(15,12,18,0.5)'; ctx.fill();
      // walls
      ctx.beginPath(); ctx.moveTo(cx - ow, h); ctx.lineTo(cx - iw, cy - ih); ctx.lineTo(cx - iw, cy + ih); ctx.lineTo(cx - ow * 0.8, h); ctx.closePath();
      ctx.fillStyle = 'rgba(25,22,30,0.4)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + ow, h); ctx.lineTo(cx + iw, cy - ih); ctx.lineTo(cx + iw, cy + ih); ctx.lineTo(cx + ow * 0.8, h); ctx.closePath();
      ctx.fillStyle = 'rgba(25,22,30,0.4)'; ctx.fill();
      // tiled wall pattern (full)
      if (full) {
        ctx.strokeStyle = 'rgba(40,38,45,0.1)'; ctx.lineWidth = 0.5;
        for (let y = cy; y < h; y += 15) {
          const f = (y - cy) / (h - cy);
          const lx = lerp(cx - iw, cx - ow * 0.8, f), rx = lerp(cx + iw, cx + ow * 0.8, f);
          ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx - 3, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx + 3, y); ctx.stroke();
        }
      }
      // platform edge (yellow line)
      const platY = h * 0.75;
      ctx.fillStyle = 'rgba(200,180,50,0.12)'; ctx.fillRect(cx - ow * 0.7, platY, ow * 1.4, full ? 3 : 1.5);
      // rails
      for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(cx + ow * 0.5 * side, h); ctx.lineTo(cx + iw * 0.3 * side, cy); ctx.strokeStyle = 'rgba(60,55,65,0.25)'; ctx.lineWidth = full ? 1.5 : 0.8; ctx.stroke(); }
      // fluorescent lights
      for (let i = 0; i < (full ? 6 : 3); i++) {
        const lf = (i + 0.5) / (full ? 6 : 3);
        const ly = lerp(cy + 5, 15, lf), lw = lerp(iw * 0.4, ow * 0.3, lf);
        const flicker = Math.sin(t * 2 + i * 3) > 0.9 ? 0.15 : 1;
        ctx.fillStyle = `rgba(200,215,255,${0.06 * flicker * (0.5 + lf * 0.5)})`;
        ctx.fillRect(cx - lw, ly, lw * 2, full ? 3 : 1.5);
      }
      // approaching headlight
      const headPhase = (t * 0.3) % 4;
      if (headPhase < 2) {
        const headBright = Math.min(1, headPhase);
        const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, iw * (2 + headBright * 3));
        hg.addColorStop(0, `rgba(255,250,200,${0.15 * headBright + bass * 0.1})`);
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg; ctx.fillRect(cx - iw * 5, cy - ih * 5, iw * 10, ih * 10);
      }
      // sparks on rails
      if (Math.random() < 0.03 + bass * 0.05) {
        const sparkX = cx + (Math.random() - 0.5) * ow * 0.4;
        const sparkY = h * 0.8 + Math.random() * h * 0.1;
        ctx.beginPath(); ctx.arc(sparkX, sparkY, 2, 0, 6.28);
        ctx.fillStyle = 'rgba(255,200,50,0.4)'; ctx.fill();
      }
    }),
  ];

  // Combine all scenes into indexed array
  const allScenes = [
    tokyoRain,       // 0
    oceanAbyss,      // 1
    campfire,         // 2
    northernLights,   // 3
    desertDunes,      // 4
    ...scenes5to19,   // 5-19
  ];

  return {
    NAMES: [
      'Tokyo Rain', 'Ocean Abyss', 'Campfire', 'Northern Lights', 'Desert Dunes',
      'Lightning Storm', 'Snowy Cabin', 'Beach Sunset', 'Space Nebula', 'Rainy Window',
      'Forest Dawn', 'Midnight Drive', 'Synthwave', 'Underwater Reef', 'Volcano',
      'City Rooftop', 'Vinyl Session', 'Aquarium', 'Cyberpunk', 'Subway Platform',
    ],
    COUNT: 20,
    create(type, w, h) { return allScenes[type] ? allScenes[type].create(w, h) : allScenes[0].create(w, h); },
    drawMini(type, ctx, w, h, col, t, parts, bass, mid) {
      const s = allScenes[type] || allScenes[0];
      s.drawMini(ctx, w, h, col, t, parts, bass, mid);
    },
    drawFull(type, ctx, w, h, col, t, parts, bass, mid, treble) {
      const s = allScenes[type] || allScenes[0];
      s.drawFull(ctx, w, h, col, t, parts, bass, mid, treble);
    },
  };
})();
