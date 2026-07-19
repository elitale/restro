"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pickHindiVoice } from "@/lib/announce";

const STORAGE_KEY = "restro.announce";

/** Distinct alert tones used when speech synthesis is unavailable. */
export type AlertTone = "beep" | "boop";

type AudioCtor = typeof AudioContext;

interface TonePulse {
  readonly freq: number;
  readonly start: number;
  readonly duration: number;
}

// Web Audio fallback recipes: short, distinct patterns per role.
const TONE_PULSES: Record<AlertTone, readonly TonePulse[]> = {
  // Kitchen: two bright pulses that read as "new order".
  beep: [
    { freq: 880, start: 0, duration: 0.14 },
    { freq: 880, start: 0.2, duration: 0.14 },
  ],
  // Waiter: a soft falling two-note that reads as "ready".
  boop: [
    { freq: 520, start: 0, duration: 0.16 },
    { freq: 392, start: 0.17, duration: 0.22 },
  ],
};

const getAudioCtor = (): AudioCtor | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext
  );
};

/**
 * Hindi voice announcements via the browser's built-in Speech Synthesis engine,
 * with a Web Audio beep/boop fallback when no speech voice is available. On by
 * default (persisted) and primed on the first user gesture, since browsers
 * block audio until the user interacts with the page.
 */
export function useAnnouncer(): {
  readonly supported: boolean;
  readonly enabled: boolean;
  readonly toggle: () => void;
  readonly announce: (text: string, tone: AlertTone) => void;
} {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const hasVoicesRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  // Chrome garbage-collects an unreferenced utterance mid-speech (it then goes
  // silent with no events); keep the active one alive here.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const playTone = useCallback((tone: AlertTone): void => {
    const Ctor = getAudioCtor();
    if (!Ctor) {
      return;
    }
    const ctx = audioRef.current ?? (audioRef.current = new Ctor());
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const start = ctx.currentTime;
    for (const pulse of TONE_PULSES[tone]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = pulse.freq;
      const t0 = start + pulse.start;
      const t1 = t0 + pulse.duration;
      // Short attack/release envelope so the tone doesn't click.
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }, []);

  const speak = useCallback((text: string): void => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    if (voiceRef.current) {
      // A real Hindi voice exists (e.g. Safari's local voices) — use it.
      utterance.voice = voiceRef.current;
      utterance.lang = voiceRef.current.lang;
    }
    // No Hindi voice (common in Chrome, whose only hi-IN is a network voice
    // that is often absent in incognito): leave lang unset so the browser uses
    // its default voice. Forcing lang="hi-IN" makes Chrome reject it as
    // "language-unavailable" and stay silent; the romanized text is still
    // intelligible read by an English voice.
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        console.warn("[announce] speech failed:", event.error);
      }
    };
    utteranceRef.current = utterance;
    // Clear any stale/stuck queue, un-pause if Chrome parked the engine, then
    // speak. (An unconditional resume() can double-fire, so guard on paused.)
    synth.cancel();
    if (synth.paused) {
      synth.resume();
    }
    synth.speak(utterance);
  }, []);

  // Unlock both engines inside a user gesture (browsers block audio until then).
  const prime = useCallback((): void => {
    const Ctor = getAudioCtor();
    if (Ctor) {
      const ctx = audioRef.current ?? (audioRef.current = new Ctor());
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hasSpeech = "speechSynthesis" in window;
    const hasAudio = getAudioCtor() !== undefined;

    let stopVoices: (() => void) | undefined;
    if (hasSpeech) {
      const synth = window.speechSynthesis;
      const loadVoices = (): void => {
        const voices = synth.getVoices();
        hasVoicesRef.current = voices.length > 0;
        voiceRef.current = pickHindiVoice(voices);
      };
      loadVoices();
      synth.addEventListener("voiceschanged", loadVoices);
      stopVoices = () => synth.removeEventListener("voiceschanged", loadVoices);
    }

    // Prime on the first real interaction so sound works when enabled by
    // default, before the user ever taps the speaker button.
    const onGesture = (): void => prime();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });

    // Reflect client-only capabilities after mount (avoids SSR/hydration reads).
    const raf = requestAnimationFrame(() => {
      setSpeechSupported(hasSpeech);
      setAudioSupported(hasAudio);
      // Enabled by default; only an explicit opt-out ("0") turns it off.
      setEnabled(window.localStorage.getItem(STORAGE_KEY) !== "0");
    });

    return () => {
      cancelAnimationFrame(raf);
      stopVoices?.();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [prime]);

  const toggle = useCallback((): void => {
    setEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      if (next) {
        prime();
        if ("speechSynthesis" in window && hasVoicesRef.current) {
          speak("Awaaz chalu");
        } else {
          playTone("beep");
        }
      } else if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, [prime, speak, playTone]);

  const announce = useCallback(
    (text: string, tone: AlertTone): void => {
      if (!enabled) {
        return;
      }
      // Prefer speech only when a voice is actually available; otherwise the
      // hi-IN utterance would be silent, so fall back to the tone.
      if (speechSupported && hasVoicesRef.current) {
        speak(text);
      } else if (audioSupported) {
        playTone(tone);
      }
    },
    [enabled, speechSupported, audioSupported, speak, playTone],
  );

  return {
    supported: speechSupported || audioSupported,
    enabled,
    toggle,
    announce,
  };
}
