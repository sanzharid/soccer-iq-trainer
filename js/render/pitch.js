// Top-down 2D pitch renderer. Coordinates are normalized 0..1 (x: own goal -> opponent goal).
export const TEAM_RED = 'red';
export const TEAM_BLUE = 'blue';

const COLORS = {
  grassA: '#2f9e44', grassB: '#2b8a3e',
  line: 'rgba(255,255,255,.85)',
  red: '#e53935', blue: '#1e88e5',
  ball: '#ffffff',
};

export class Pitch {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.playerRadius = 0.035; // in normalized x-units
    this.onTap = null;
    canvas.addEventListener('pointerdown', (e) => this._tap(e));
    this.scene = null;
  }

  resize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    const h = Math.round(w * 0.62);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
  }

  // scene: { players: [{x,y,team,number,hasBall}], highlight?: index|null }
  draw(scene) {
    this.scene = scene;
    const { ctx, w, h } = this;
    // grass stripes
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? COLORS.grassB : COLORS.grassA;
      ctx.fillRect((w / stripes) * i, 0, w / stripes + 1, h);
    }
    // lines
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.strokeRect(w * 0.03, h * 0.05, w * 0.94, h * 0.9);
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.05); ctx.lineTo(w / 2, h * 0.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.14, 0, Math.PI * 2); ctx.stroke();
    // penalty boxes
    ctx.strokeRect(w * 0.03, h * 0.28, w * 0.13, h * 0.44);
    ctx.strokeRect(w * 0.84, h * 0.28, w * 0.13, h * 0.44);

    // players
    const r = this.playerRadius * w;
    scene.players.forEach((p, i) => {
      const px = p.x * w, py = p.y * h;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[p.team];
      ctx.fill();
      if (scene.highlight === i) {
        ctx.lineWidth = r * 0.25;
        ctx.strokeStyle = '#fff59d';
        ctx.stroke();
      } else {
        ctx.lineWidth = r * 0.12;
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.stroke();
      }
      if (p.number != null) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(p.number), px, py);
      }
      if (p.hasBall) {
        ctx.beginPath();
        ctx.arc(px + r * 0.9, py + r * 0.9, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.ball;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        ctx.stroke();
      }
    });
  }

  // Returns scene player index hit by a tap, or -1.
  _tap(e) {
    if (!this.onTap || !this.scene) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const r = this.playerRadius * 1.8; // generous touch target
    let best = -1, bestD = Infinity;
    this.scene.players.forEach((p, i) => {
      const d = Math.hypot(p.x - x, (p.y - y) * (this.h / this.w));
      if (d < r && d < bestD) { best = i; bestD = d; }
    });
    this.onTap(best, x, y);
  }
}
