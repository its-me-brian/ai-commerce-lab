// MicrophoneButton — Voice input button for chat.
//
// Shows a microphone icon that toggles speech recognition.
// When active, shows a pulsing red indicator.
// Writes transcribed text DIRECTLY to the textarea via ref (bypasses React state).

"use client";

import React, { useCallback, useRef, useEffect } from "react";

// Web Speech API types
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

type WindowWithWebkit = Window & {
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  if ("SpeechRecognition" in window) return window.SpeechRecognition;
  const win = window as WindowWithWebkit;
  if (win.webkitSpeechRecognition) return win.webkitSpeechRecognition;
  return null;
}

interface MicrophoneButtonProps {
  /** Ref to the textarea to write transcribed text into */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Called after text is inserted (for React state sync) */
  onTextInserted?: (text: string) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Language for recognition (default: es-ES) */
  lang?: string;
}

export function MicrophoneButton({
  textareaRef,
  onTextInserted,
  disabled = false,
  lang = "es-ES",
}: MicrophoneButtonProps) {
  const [isListening, setIsListening] = React.useState(false);
  const [isSupported] = React.useState(() => getSpeechRecognition() !== null);
  const [error, setError] = React.useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  /**
   * Write text DIRECTLY to the textarea DOM element.
   * This bypasses React state and guarantees the text appears.
   */
  const writeToTextarea = useCallback((text: string) => {
    const el = textareaRef?.current;
    if (!el) return;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, "value"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, text);
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    // eslint-disable-next-line react-hooks/immutability -- Direct DOM write required for speech recognition
    el.scrollTop = el.scrollHeight;
  }, [textareaRef]);

  const start = useCallback(async () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError("Speech recognition not supported");
      return;
    }

    // Stop previous instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setError(null);
    accumulatedRef.current = "";

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          accumulatedRef.current += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      const fullText = accumulatedRef.current + interimText;

      // WRITE DIRECTLY TO TEXTAREA
      writeToTextarea(fullText);

      if (onTextInserted) {
        onTextInserted(fullText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" = user didn't speak fast enough → auto-restart
      if (event.error === "no-speech") {
        setTimeout(() => {
          if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch { /* already running */ }
          }
        }, 500);
        return;
      }
      if (event.error === "aborted") return;
      setError(`Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if we're still in "listening" mode
      setIsListening(prev => {
        if (prev) {
          setTimeout(() => {
            if (recognitionRef.current) {
              try { recognitionRef.current.start(); } catch { /* already running */ }
            }
          }, 300);
        }
        return prev;
      });
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setError(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [lang, writeToTextarea, onTextInserted]);

  const stop = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  if (!isSupported) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 relative"
        style={{
          background: isListening ? "#ef4444" : "var(--border-subtle)",
          color: isListening ? "#ffffff" : "var(--text-tertiary)",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.3 : 1,
        }}
        title={isListening ? "Stop recording" : "Start voice input"}
      >
        {isListening ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}

        {isListening && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
            style={{ background: "#ef4444", animation: "pulse 1.5s infinite" }}
          />
        )}
      </button>

      {error && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 rounded-lg text-xs whitespace-nowrap z-50"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          {error}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
