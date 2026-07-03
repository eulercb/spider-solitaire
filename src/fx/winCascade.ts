import {
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Texture,
  type Ticker,
} from 'pixi.js';
import { SUIT_PATHS } from '../view/cards';
import { createOverlay } from './pixiOverlay';

export interface CascadeColors {
  accent: string;
  ivory: string;
  cardFace: string;
  backField: string;
}

interface Body {
  particle: Particle;
  vx: number;
  vy: number;
  vr: number;
  bounces: number;
  dead: boolean;
}

const GRAVITY = 0.34;
const FLOOR_BOUNCE = 0.62;
const SPAWN_SECONDS = 7;
const TOTAL_SECONDS = 13;

/**
 * The showpiece: a fountain of little cards and suit sparks streaming and
 * bouncing across the baize, with fading phosphor trails. Pure decoration —
 * resolves to null (caller falls back to CSS) when WebGL isn't available.
 */
export async function playWinCascade(colors: CascadeColors): Promise<(() => void) | null> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const overlay = await createOverlay();
  if (!overlay) return null;
  const { app } = overlay;

  // --- Texture atlas: one canvas, many frames, so ParticleContainer is happy.
  const CELL = 64;
  const atlas = document.createElement('canvas');
  atlas.width = CELL * 6;
  atlas.height = CELL;
  const ctx = atlas.getContext('2d');
  if (!ctx) {
    overlay.destroy();
    return null;
  }
  // Frames 0–3: suit glyphs. Frame 4: sparkle. Frame 5: mini card.
  ([0, 1, 2, 3] as const).forEach((suit) => {
    ctx.save();
    ctx.translate(suit * CELL + 8, 8);
    ctx.scale((CELL - 16) / 100, (CELL - 16) / 100);
    ctx.fillStyle = suit % 3 === 0 ? colors.ivory : colors.accent;
    ctx.fill(new Path2D(SUIT_PATHS[suit]));
    ctx.restore();
  });
  ctx.save();
  ctx.translate(4 * CELL + CELL / 2, CELL / 2);
  const spark = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
  spark.addColorStop(0, colors.ivory);
  spark.addColorStop(0.4, colors.accent);
  spark.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spark;
  ctx.fillRect(-20, -20, 40, 40);
  ctx.restore();
  ctx.save();
  ctx.translate(5 * CELL + 12, 6);
  const cw = 40;
  const ch = 52;
  ctx.fillStyle = colors.cardFace;
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, 5);
  ctx.fill();
  ctx.fillStyle = colors.backField;
  ctx.beginPath();
  ctx.roundRect(3.5, 3.5, cw - 7, ch - 7, 3);
  ctx.fill();
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(6, 6, cw - 12, ch - 12, 2);
  ctx.stroke();
  ctx.restore();

  const base = Texture.from(atlas);
  const frame = (i: number, w = CELL, h = CELL): Texture =>
    new Texture({ source: base.source, frame: new Rectangle(i * CELL, 0, w, h) });
  const suitTextures = [frame(0), frame(1), frame(2), frame(3)];
  const sparkTexture = frame(4);
  const cardTexture = frame(5);

  // --- Scene: erase-rect (fades last frame), then two particle containers.
  const fade = new Graphics();
  const paintFade = (): void => {
    fade.clear();
    fade.rect(0, 0, app.renderer.width, app.renderer.height).fill({
      color: 0xffffff,
      alpha: 0.16,
    });
  };
  paintFade();
  fade.blendMode = 'erase';
  app.stage.addChild(fade);

  const sparks = new ParticleContainer({
    dynamicProperties: { position: true, rotation: true, scale: false, color: true },
  });
  const cards = new ParticleContainer({
    dynamicProperties: { position: true, rotation: true, scale: false, color: false },
  });
  app.stage.addChild(sparks, cards);

  const bodies: Body[] = [];
  const width = (): number => app.renderer.width / app.renderer.resolution;
  const height = (): number => app.renderer.height / app.renderer.resolution;

  const spawnCard = (): void => {
    // Fountain from the lower corners, arcing inward like a thrown deck.
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -30 : width() + 30;
    const y = height() * (0.55 + Math.random() * 0.3);
    const particle = new Particle({
      texture: cardTexture,
      x,
      y,
      anchorX: 0.5,
      anchorY: 0.5,
      rotation: Math.random() * Math.PI,
      scaleX: 0.9 + Math.random() * 0.5,
      scaleY: 0.9 + Math.random() * 0.5,
    });
    cards.addParticle(particle);
    bodies.push({
      particle,
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 6),
      vy: -(9 + Math.random() * 7),
      vr: (Math.random() - 0.5) * 0.25,
      bounces: 0,
      dead: false,
    });
  };

  const spawnSpark = (): void => {
    const suitIsh = Math.random();
    const texture =
      suitIsh < 0.55 ? sparkTexture : suitTextures[Math.floor(Math.random() * 4)];
    const x = width() * (0.2 + Math.random() * 0.6);
    const particle = new Particle({
      texture,
      x,
      y: height() * 0.15,
      anchorX: 0.5,
      anchorY: 0.5,
      rotation: Math.random() * Math.PI,
      scaleX: 0.28 + Math.random() * 0.35,
      scaleY: 0.28 + Math.random() * 0.35,
      alpha: 0.9,
    });
    sparks.addParticle(particle);
    bodies.push({
      particle,
      vx: (Math.random() - 0.5) * 7,
      vy: -(2 + Math.random() * 5),
      vr: (Math.random() - 0.5) * 0.4,
      bounces: 2, // sparks don't bounce, they drift through the floor
      dead: false,
    });
  };

  let elapsed = 0;
  let stopped = false;
  const tick = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaTime, 3);
    elapsed += ticker.deltaMS / 1000;
    paintFade();

    if (!stopped && elapsed < SPAWN_SECONDS) {
      if (bodies.length < 260) {
        if (Math.random() < 0.5) spawnCard();
        for (let i = 0; i < 3; i++) spawnSpark();
      }
    }

    const floor = height() * 0.96;
    for (const body of bodies) {
      if (body.dead) continue;
      body.vy += GRAVITY * dt;
      body.particle.x += body.vx * dt;
      body.particle.y += body.vy * dt;
      body.particle.rotation += body.vr * dt;
      if (body.particle.y > floor && body.vy > 0 && body.bounces < 2) {
        body.vy = -body.vy * FLOOR_BOUNCE;
        body.vx *= 0.85;
        body.bounces++;
      }
      if (
        body.particle.y > height() + 80 ||
        body.particle.x < -120 ||
        body.particle.x > width() + 120
      ) {
        body.dead = true;
        body.particle.alpha = 0;
      }
    }

    if (elapsed > TOTAL_SECONDS || (stopped && elapsed > 1.2)) {
      finish();
    }
  };

  const finish = (): void => {
    app.ticker.remove(tick);
    overlay.destroy();
  };
  app.ticker.add(tick);

  return () => {
    // Caller closed the win screen: stop spawning, let trails fade, tear down.
    if (stopped) return;
    stopped = true;
    elapsed = Math.max(elapsed, TOTAL_SECONDS - 1.2);
  };
}
