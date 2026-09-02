// useSpeechRecognition — Speech-to-text hook using Web Speech API.
//
// Allows users to speak to agents instead of typing.
// Uses browser's built-in speech recognition (Chrome/Edge/Safari).
// Falls back gracefully when not supported.
//
// Usage:
//   const { transcript, isListening, start, stop, isSupported, error } = useSpeechRecognition();
//   // User speaks → transcript updates (accumulated) → send to chat

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// Web Speech API types (not in TypeScript lib)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// Extend Window to include webkit prefix for Safari/older browsers
type WindowWithWebkit = Window & {
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export interface UseSpeechRecognitionReturn {
  /** Accumulated transcript (final + current interim) — updates in real-time */
  transcript: string;
  /** Whether the microphone is currently active */
  isListening: boolean;
  /** Whether Speech Recognition is supported in this browser */
  isSupported: boolean;
  /** Start listening */
  start: () => void;
  /** Stop listening and get final result */
  stop: () => void;
  /** Abort without getting result */
  abort: () => void;
  /** Clear transcript */
  clearTranscript: () => void;
  /** Current error message (null if no error) */
  error: string | null;
}

/**
 * Get the Speech Recognition constructor (cross-browser).
 */
function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;

  // Check standard API
  if ("SpeechRecognition" in window) {
    return window.SpeechRecognition;
  }

  // Check webkit prefix (Safari, older Chrome)
  const win = window as WindowWithWebkit;
  if (win.webkitSpeechRecognition) {
    return win.webkitSpeechRecognition;
  }

  return null;
}

export function useSpeechRecognition(
  options?: {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
  }
): UseSpeechRecognitionReturn {
  // transcript = accumulated final text + current interim text
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid stale closures in recognition callbacks
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTextRef = useRef(""); // Accumulated final text

  const lang = options?.lang || "es-ES";
  const continuous = options?.continuous ?? false;
  const interimResults = options?.interimResults ?? true;

  // Check support
  const isSupported = typeof window !== "undefined" && getSpeechRecognitionConstructor() !== null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    // Clean up previous instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setError(null);
    accumulatedTextRef.current = "";
    setTranscript("");

    const SpeechRecognition = getSpeechRecognitionConstructor()!;
    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Process ALL results from resultIndex onwards
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Final result — accumulate it
          accumulatedTextRef.current += result[0].transcript;
        } else {
          // Interim result — show it after accumulated text
          interimText += result[0].transcript;
        }
      }

      // Update transcript: accumulated final + current interim
      setTranscript(accumulatedTextRef.current + interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" is normal — user just didn't say anything
      if (event.error === "no-speech") {
        setError(null);
        return;
      }

      // "aborted" is normal — we called stop()
      if (event.error === "aborted") {
        return;
      }

      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      // Auto-restart if continuous mode and not manually stopped
      if (continuous && recognitionRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Ignore restart errors
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setError(`Failed to start speech recognition: ${err instanceof Error ? err.message : String(err)}`);
      setIsListening(false);
    }
  }, [isSupported, lang, continuous, interimResults]);

  const stop = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setIsListening(false);
  }, []);

  const abort = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setIsListening(false);
    accumulatedTextRef.current = "";
    setTranscript("");
  }, []);

  const clearTranscript = useCallback(() => {
    accumulatedTextRef.current = "";
    setTranscript("");
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    start,
    stop,
    abort,
    clearTranscript,
    error,
  };
}
