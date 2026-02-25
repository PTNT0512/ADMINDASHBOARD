const os = require('os');

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

class StartupManager {
  constructor(opts = {}) {
    this.queue = [];
    this.stagger = Number(opts.stagger) || 2000; // ms between starts
    this.defaultMinFreeMB = Number(opts.minFreeMB) || 150; // require this much free memory
    this.running = false;
  }

  schedule(name, fn, opts = {}) {
    this.queue.push({ name, fn, delay: Number(opts.delay) || 0, minFreeMB: opts.minFreeMB !== undefined ? Number(opts.minFreeMB) : this.defaultMinFreeMB });
  }

  async runAll() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      try {
        // wait item-specific delay first
        if (item.delay > 0) await wait(item.delay);

        // check free memory
        const freeMB = Math.floor(os.freemem() / 1024 / 1024);
        if (item.minFreeMB && freeMB < item.minFreeMB) {
          console.warn(`[StartupManager] Skipping ${item.name}: freeMB=${freeMB} < minFreeMB=${item.minFreeMB}. Retrying later.`);
          // re-schedule to retry after a longer wait
          this.queue.push({ ...item, delay: Math.max(5000, this.stagger) });
        } else {
          try {
            await Promise.resolve(item.fn());
            console.log(`[StartupManager] Started ${item.name}`);
          } catch (e) {
            console.warn(`[StartupManager] Failed to start ${item.name}:`, e && e.message ? e.message : e);
          }
        }
      } catch (e) {
        console.warn('[StartupManager] Unexpected error:', e && e.message ? e.message : e);
      }

      // stagger between items
      await wait(this.stagger);
    }
    this.running = false;
  }

  // allow manual immediate start
  async startNow(name) {
    const idx = this.queue.findIndex(q => q.name === name);
    if (idx === -1) return false;
    const item = this.queue.splice(idx, 1)[0];
    try { await Promise.resolve(item.fn()); console.log(`[StartupManager] startNow ${name} executed`); return true; } catch (e) { return false; }
  }
}

module.exports = StartupManager;
