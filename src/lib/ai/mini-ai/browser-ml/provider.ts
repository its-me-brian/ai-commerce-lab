// Browser ML Provider
// Manages a Web Worker for client-side ONNX inference via Transformers.js.
//
// Features:
//   - Lazy model loading (only loads when first used)
//   - Model caching (keeps loaded models in memory)
//   - Automatic fallback (returns null if worker unavailable)
//   - Task support: feature-extraction, text-classification, etc.
//
// Usage:
//   const provider = getBrowserMLProvider();
//   await provider.loadModel("Xenova/all-MiniLM-L6-v2", "feature-extraction");
//   const result = await provider.inference("This is a test sentence");

"use client";

export interface BrowserMLResult {
  output: unknown;
  durationMs: number;
}

export interface BrowserMLProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

type ProgressCallback = (progress: BrowserMLProgress) => void;

class BrowserMLProvider {
  private worker: Worker | null = null;
  private loadedModel: string | null = null;
  private loadedTask: string | null = null;
  private pendingRequests: Map<
    string,
    {
      resolve: (result: BrowserMLResult) => void;
      reject: (error: Error) => void;
      startTime: number;
    }
  > = new Map();
  private requestId = 0;
  private progressCallback: ProgressCallback | null = null;

  // §45: Persist model info across page loads via localStorage
  private static STORAGE_KEY = "browser-ml-loaded-model";

  constructor() {
    // Restore previously loaded model info from localStorage
    try {
      const saved = localStorage.getItem(BrowserMLProvider.STORAGE_KEY);
      if (saved) {
        const { model, task } = JSON.parse(saved);
        this.loadedModel = model;
        this.loadedTask = task;
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Check if browser ML is available (Web Worker support).
   */
  isAvailable(): boolean {
    return typeof Worker !== "undefined";
  }

  /**
   * Set a callback for model loading progress.
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Get the underlying worker (for testing/debugging).
   */
  getWorker(): Worker | null {
    return this.worker;
  }

  /**
   * Get currently loaded model info.
   */
  getLoadedModel(): { model: string; task: string } | null {
    if (!this.loadedModel || !this.loadedTask) return null;
    return { model: this.loadedModel, task: this.loadedTask };
  }

  /**
   * Initialize the worker and load a model.
   * If a model is already loaded, it will be replaced.
   */
  async loadModel(model: string, task: string): Promise<void> {
    // If already loaded with same model, skip
    if (this.loadedModel === model && this.loadedTask === task) {
      return;
    }

    // Terminate existing worker
    this.terminate();

    if (!this.isAvailable()) {
      throw new Error("Web Workers not available in this environment");
    }

    return new Promise((resolve, reject) => {
      try {
        // Create worker from the worker.js file
        this.worker = new Worker(
          new URL("./worker.js", import.meta.url),
          { type: "module" }
        );

        this.worker.onmessage = (event) => {
          const { type } = event.data;

          switch (type) {
            case "loaded":
              this.loadedModel = model;
              this.loadedTask = task;
              // §45: Persist to localStorage for cross-page-load caching
              try {
                localStorage.setItem(
                  BrowserMLProvider.STORAGE_KEY,
                  JSON.stringify({ model, task })
                );
              } catch {
                // Ignore storage errors (private browsing, etc.)
              }
              resolve();
              break;

            case "result": {
              const pending = this.pendingRequests.get(event.data.id);
              if (pending) {
                this.pendingRequests.delete(event.data.id);
                pending.resolve({
                  output: event.data.output,
                  durationMs: Date.now() - pending.startTime,
                });
              }
              break;
            }

            case "error": {
              if (event.data.id) {
                const pending = this.pendingRequests.get(event.data.id);
                if (pending) {
                  this.pendingRequests.delete(event.data.id);
                  pending.reject(new Error(event.data.error));
                }
              } else {
                // Load error
                reject(new Error(event.data.error));
              }
              break;
            }

            case "progress":
              if (this.progressCallback) {
                this.progressCallback(event.data);
              }
              break;
          }
        };

        this.worker.onerror = (error) => {
          this.terminate();
          reject(new Error(`Worker error: ${error.message}`));
        };

        // Send load command
        this.worker.postMessage({ type: "load", model, task });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Run inference on loaded model.
   * Returns null if no model is loaded or worker is unavailable.
   */
  async inference(
    input: string,
    options?: Record<string, unknown>
  ): Promise<BrowserMLResult | null> {
    if (!this.worker || !this.loadedModel) {
      return null;
    }

    const id = String(++this.requestId);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve,
        reject,
        startTime: Date.now(),
      });

      this.worker!.postMessage({
        type: "inference",
        id,
        input,
        task: this.loadedTask,
        options,
      });
    });
  }

  /**
   * Unload the current model and terminate the worker.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.loadedModel = null;
    this.loadedTask = null;

    // §45: Clear persisted model info
    try {
      localStorage.removeItem(BrowserMLProvider.STORAGE_KEY);
    } catch {
      // Ignore
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error("Worker terminated"));
      this.pendingRequests.delete(id);
    }
  }
}

// Singleton
let instance: BrowserMLProvider | null = null;

export function getBrowserMLProvider(): BrowserMLProvider {
  if (!instance) {
    instance = new BrowserMLProvider();
  }
  return instance;
}

export function resetBrowserMLProvider(): void {
  if (instance) {
    instance.terminate();
    instance = null;
  }
}
