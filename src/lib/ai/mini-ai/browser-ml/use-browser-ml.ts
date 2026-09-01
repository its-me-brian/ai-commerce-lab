// useBrowserML — React hook for client-side ONNX inference.
//
// Provides a MiniAI-compatible interface for browser-based ML:
//   - Lazy model loading
//   - Inference with automatic fallback
//   - Loading/error states
//
// Usage:
//   const { loadModel, inference, loading, error, ready } = useBrowserML();

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getBrowserMLProvider,
  resetBrowserMLProvider,
  type BrowserMLResult,
  type BrowserMLProgress,
} from "@/lib/ai/mini-ai/browser-ml/provider";

export interface UseBrowserMLReturn {
  /** Load a model (lazy — only loads once) */
  loadModel: (model: string, task: string) => Promise<void>;
  /** Run inference on loaded model */
  inference: (input: string, options?: Record<string, unknown>) => Promise<BrowserMLResult | null>;
  /** Whether a model is currently loading */
  loading: boolean;
  /** Whether a model is loaded and ready */
  ready: boolean;
  /** Current error message (null if no error) */
  error: string | null;
  /** Model loading progress */
  progress: BrowserMLProgress | null;
  /** Currently loaded model info */
  loadedModel: { model: string; task: string } | null;
  /** Unload current model */
  unload: () => void;
}

export function useBrowserML(): UseBrowserMLReturn {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BrowserMLProgress | null>(null);
  const [loadedModel, setLoadedModel] = useState<{ model: string; task: string } | null>(null);
  const providerRef = useRef(getBrowserMLProvider());

  // Set up progress callback
  useEffect(() => {
    providerRef.current.onProgress(setProgress);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't terminate on unmount — keep model cached
      // Provider is a singleton, persists across mounts
    };
  }, []);

  const loadModel = useCallback(async (model: string, task: string) => {
    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      await providerRef.current.loadModel(model, task);
      setReady(true);
      setLoadedModel({ model, task });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setReady(false);
      setLoadedModel(null);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  const inference = useCallback(
    async (input: string, options?: Record<string, unknown>): Promise<BrowserMLResult | null> => {
      if (!ready) {
        setError("No model loaded. Call loadModel() first.");
        return null;
      }

      setError(null);

      try {
        const result = await providerRef.current.inference(input, options);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      }
    },
    [ready]
  );

  const unload = useCallback(() => {
    providerRef.current.terminate();
    setReady(false);
    setLoadedModel(null);
    setError(null);
  }, []);

  return {
    loadModel,
    inference,
    loading,
    ready,
    error,
    progress,
    loadedModel,
    unload,
  };
}
