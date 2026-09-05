// Browser ML Web Worker
// Loads ONNX models via Transformers.js and runs inference off the main thread.
//
// Messages in:
//   { type: "load", model: string, task: string }
//   { type: "inference", id: string, input: string, task: string, options?: object }
//   { type: "unload" }
//
// Messages out:
//   { type: "loaded", model: string }
//   { type: "result", id: string, output: object }
//   { type: "error", id: string, error: string }
//   { type: "unloaded" }

let pipeline = null;
let currentModel = null;
 
let _currentTask = null;

self.onmessage = async function (event) {
  const { type } = event.data;

  try {
    switch (type) {
      case "load": {
        const { model, task } = event.data;

        // Unload previous model if different
        if (pipeline && currentModel !== model) {
          pipeline = null;
          currentModel = null;
        _currentTask = null;
        }

        // Lazy-load Transformers.js
        const { pipeline: loadPipeline } = await import("@huggingface/transformers");

        // Load model with task-specific pipeline
        pipeline = await loadPipeline(task, model, {
          progress_callback: (progress) => {
            self.postMessage({ type: "progress", ...progress });
          },
        });

        currentModel = model;
        _currentTask = task;

        self.postMessage({ type: "loaded", model });
        break;
      }

      case "inference": {
 
        const { id, input, _task, options } = event.data;

        if (!pipeline) {
          self.postMessage({
            type: "error",
            id,
            error: "No model loaded. Send { type: 'load' } first.",
          });
          return;
        }

        // Run inference
        const result = await pipeline(input, options || {});

        self.postMessage({
          type: "result",
          id,
          output: result,
        });
        break;
      }

      case "unload": {
        pipeline = null;
        currentModel = null;
        currentTask = null;
        self.postMessage({ type: "unloaded" });
        break;
      }

      default:
        self.postMessage({
          type: "error",
          error: `Unknown message type: ${type}`,
        });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      id: event.data.id || null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
