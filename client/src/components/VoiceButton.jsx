import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

/* Chrome, Edge and Safari ship it prefixed; Firefox does not ship it at all. */
const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const voiceSupported = Boolean(SpeechRecognition);

const ERRORS = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser to use voice search.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in your browser to use voice search.',
  'no-speech': 'Did not catch that - try again.',
  'audio-capture': 'No microphone found.',
  network: 'Voice search needs an internet connection.',
};

/**
 * Tap, speak, shop. Uses the browser's own Web Speech API - no audio is sent
 * to our server, only the recognised text.
 *
 * Renders nothing where the API is missing, so unsupported browsers simply
 * see the normal search box.
 *
 * @param onResult  called with the final transcript
 * @param onPartial optional, called with interim text while the user speaks
 */
const VoiceButton = ({ onResult, onPartial, className = '' }) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  // Stop listening if the component goes away mid-sentence.
  useEffect(() => () => recRef.current?.abort(), []);

  if (!voiceSupported) return null;

  const start = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'en-IN'; // Indian English: understands "lakh", "rupees" and local brand names better
    rec.interimResults = Boolean(onPartial);
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript.trim();
      if (result.isFinal) onResult(text);
      else onPartial?.(text);
    };
    rec.onerror = (event) => {
      if (event.error !== 'aborted') toast.error(ERRORS[event.error] || 'Voice search failed');
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button
      type="button"
      onClick={start}
      aria-label={listening ? 'Stop listening' : 'Search by voice'}
      aria-pressed={listening}
      title={listening ? 'Listening… tap to stop' : 'Search by voice'}
      className={`flex shrink-0 items-center justify-center rounded-lg transition-colors ${
        listening ? 'animate-pulse bg-accent text-white' : 'text-body hover:text-accent'
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      </svg>
    </button>
  );
};

export default VoiceButton;
