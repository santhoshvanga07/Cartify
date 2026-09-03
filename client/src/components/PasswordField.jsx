import { useState } from 'react';

/* Simple inline icons - no icon library needed for two glyphs. */
const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosed = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M3 3l18 18" strokeLinecap="round" />
    <path
      d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.2 6.3A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * A password input with a reveal toggle.
 *
 * Two details that matter:
 *  - type="button" on the toggle. A <button> inside a <form> defaults to
 *    type="submit", so without this, clicking the eye would submit the form.
 *  - The toggle only swaps the input's type. The value never leaves the input,
 *    so nothing about how the password is handled or sent changes.
 */
const PasswordField = ({ label = 'Password', hint, ...inputProps }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="label">{label}</label>

      <div className="relative">
        <input
          {...inputProps}
          type={visible ? 'text' : 'password'}
          className="field pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
        >
          {visible ? <EyeClosed /> : <EyeOpen />}
        </button>
      </div>

      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
};

export default PasswordField;
