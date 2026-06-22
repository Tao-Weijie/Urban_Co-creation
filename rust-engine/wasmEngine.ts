// @ts-ignore
import init, {
  initialize_player,
  build_game,
  start_game,
  run_game_step,
  get_valid_actions,
  training_start,
  training_step
} from './pkg/urban_cocreation.js';

class WasmEngine {
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Fetch the binary file dynamically at runtime from the Next.js public directory
      await init('/wasm/urban_cocreation_bg.wasm');
      this.isInitialized = true;
      console.log("[WASM] Rust Game Engine successfully loaded and initialized!");
    })();

    return this.initPromise;
  }

  public async initializePlayer(): Promise<any> {
    await this.init();
    const res = initialize_player();
    return JSON.parse(res);
  }

  public async buildGame(payload: any): Promise<any> {
    await this.init();
    const res = build_game(JSON.stringify(payload));
    return JSON.parse(res);
  }

  public async startGame(payload: any): Promise<any> {
    await this.init();
    const res = start_game(JSON.stringify(payload));
    return JSON.parse(res);
  }

  public async runGameStep(payload: any): Promise<any> {
    await this.init();
    const res = run_game_step(JSON.stringify(payload));
    return JSON.parse(res);
  }

  public async getValidActions(role: number): Promise<any> {
    await this.init();
    const res = get_valid_actions(role);
    return JSON.parse(res);
  }

  public trainingStart(payload: any): any {
    if (!this.isInitialized) {
      throw new Error("WasmEngine is not initialized. Call init() first.");
    }
    const res = training_start(JSON.stringify(payload));
    return JSON.parse(res);
  }

  public trainingStep(actionType: number, unitId: number | null, unitType: number): any {
    if (!this.isInitialized) {
      throw new Error("WasmEngine is not initialized. Call init() first.");
    }
    const res = training_step(actionType, unitId, unitType);
    return JSON.parse(res);
  }
}

export const wasmEngine = new WasmEngine();
