import { pyWrapperCode } from './pyWrapperCode';

class PyodideEngine {
    private pyodide: any = null;
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    // Cached Python function proxies to prevent reference leaks and MemoryError
    private pyInitializePlayer: any = null;
    private pyBuildGame: any = null;
    private pyStartGame: any = null;
    private pyRunGameStep: any = null;
    private pyGetValidActions: any = null;
    private pyTrainingStart: any = null;
    private pyTrainingStep: any = null;

    public async init(): Promise<void> {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            // Check if loadPyodide is available in window
            if (typeof window === 'undefined' || !(window as any).loadPyodide) {
                throw new Error("Pyodide CDN script is not loaded. Make sure the script is included.");
            }

            // Initialize Pyodide
            this.pyodide = await (window as any).loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/"
            });

            // Create the virtual backend directory
            this.pyodide.FS.mkdir('/home/pyodide/backend');

            // Fetch the python files
            const [graphPy, gamePy] = await Promise.all([
                fetch('/api/py-source?file=graph').then(res => {
                    if (!res.ok) throw new Error("Failed to load graph.py");
                    return res.text();
                }),
                fetch('/api/py-source?file=game').then(res => {
                    if (!res.ok) throw new Error("Failed to load game.py");
                    return res.text();
                })
            ]);

            // Write files to virtual FS
            this.pyodide.FS.writeFile('/home/pyodide/backend/graph.py', graphPy);
            this.pyodide.FS.writeFile('/home/pyodide/backend/game.py', gamePy);

            // Run the Python initialization wrapper
            await this.pyodide.runPythonAsync(pyWrapperCode);

            // Cache all global Python functions to prevent memory leaks from globals.get()
            this.pyInitializePlayer = this.pyodide.globals.get('initialize_player');
            this.pyBuildGame = this.pyodide.globals.get('build_game');
            this.pyStartGame = this.pyodide.globals.get('start_game');
            this.pyRunGameStep = this.pyodide.globals.get('run_game_step');
            this.pyGetValidActions = this.pyodide.globals.get('get_valid_actions');
            this.pyTrainingStart = this.pyodide.globals.get('training_start');
            this.pyTrainingStep = this.pyodide.globals.get('training_step');

            this.isInitialized = true;
        })();

        return this.initPromise;
    }

    public async initializePlayer(): Promise<any> {
        await this.init();
        const res = this.pyInitializePlayer();
        return JSON.parse(res);
    }

    public async buildGame(payload: any): Promise<any> {
        await this.init();
        const res = this.pyBuildGame(JSON.stringify(payload));
        return JSON.parse(res);
    }

    public async startGame(payload: any): Promise<any> {
        await this.init();
        const res = this.pyStartGame(JSON.stringify(payload));
        return JSON.parse(res);
    }

    public async runGameStep(payload: any): Promise<any> {
        await this.init();
        const res = this.pyRunGameStep(JSON.stringify(payload));
        return JSON.parse(res);
    }

    public async getValidActions(role: number): Promise<any> {
        await this.init();
        const res = this.pyGetValidActions(role);
        return JSON.parse(res);
    }

    public trainingStart(payload: any): any {
        if (!this.isInitialized) {
            throw new Error("PyodideEngine is not initialized. Call init() first.");
        }
        const jsonStr = this.pyTrainingStart(JSON.stringify(payload));
        return JSON.parse(jsonStr);
    }

    public trainingStep(actionType: number, unitId: number | null, unitType: number): any {
        if (!this.isInitialized) {
            throw new Error("PyodideEngine is not initialized. Call init() first.");
        }
        const jsonStr = this.pyTrainingStep(actionType, unitId, unitType);
        return JSON.parse(jsonStr);
    }
}

export const pyodideEngine = new PyodideEngine();
