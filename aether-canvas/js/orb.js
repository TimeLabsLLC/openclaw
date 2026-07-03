/**
 * BIOS AI Status Orb
 * Lightweight state holder for agent activity status.
 * No longer renders a separate minimized HUD — the viewport IS the main surface.
 */
export class BiosStatusOrb {
  constructor(app) {
    this.app = app;
    this.state = "idle"; // 'idle', 'thinking', 'acting'
    this.autonomousMode = false;
  }

  setState(state) {
    this.state = state;
  }

  setAutonomousMode(active) {
    this.autonomousMode = active;
  }

  updateStatus(text) {
    // Status is now routed through the viewport topbar
  }

  show() {}
  hide() {}
  playAudio() {}
  stopAudio() {}
}
