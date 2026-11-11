import dns from 'node:dns/promises';

/**
 * Can this address really receive email? Checked BEFORE an account is made.
 *
 * 1. Common typos ("gmial.com") get a "Did you mean gmail.com?" suggestion.
 * 2. Throwaway inbox services are refused - nobody can be reached there later.
 * 3. The domain must exist and accept mail: it needs MX records (or, as the
 *    email standard allows, an address record), and must not publish a
 *    "null MX", which means "this domain never receives mail".
 *
 * This proves the DOMAIN can receive mail. Whether the MAILBOX exists is
 * proven by the 6-digit code we then send to it - the only reliable way.
 *
 * DNS trouble (timeouts, a resolver that is down) is NOT treated as "fake":
 * the sign-up continues, and the code still has to arrive.
 */

const TYPOS = {
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
  'gmail.in': 'gmail.com', 'gmaill.com': 'gmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com', 'outllook.com': 'outlook.com',
  'rediffmail.co': 'rediffmail.com', 'redifmail.com': 'rediffmail.com', 'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com',
};

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'grr.la', '10minutemail.com',
  'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'yopmail.com', 'yopmail.net', 'trashmail.com',
  'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com',
  'mailnesia.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'mailcatch.com', 'spamgourmet.com',
  'tempinbox.com', 'burnermail.io', 'moakt.com', 'tmail.ws', 'mail.tm', 'tmpmail.org', 'mytemp.email',
]);

// Swappable so tests can answer DNS questions without a network.
let resolver = { resolveMx: (d) => dns.resolveMx(d), resolve4: (d) => dns.resolve4(d) };
export const setDnsResolver = (r) => { resolver = r; };

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);

const DEFINITELY_MISSING = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

/** @returns {Promise<{ ok: true } | { ok: false, message: string }>} */
export const checkEmailAddress = async (email) => {
  const domain = String(email).split('@')[1]?.toLowerCase();
  if (!domain) return { ok: false, message: 'Enter a valid email address' };

  if (TYPOS[domain]) {
    const fixed = `${email.split('@')[0]}@${TYPOS[domain]}`;
    return { ok: false, message: `Did you mean ${fixed}? "${domain}" looks like a typo.`, suggestion: fixed };
  }
  if (DISPOSABLE.has(domain)) {
    return { ok: false, message: 'Temporary email addresses cannot be used. Please use your own email.' };
  }
  if (process.env.EMAIL_DOMAIN_CHECK === 'false') return { ok: true };

  try {
    const mx = await withTimeout(resolver.resolveMx(domain), 5000);
    // RFC 7505 "null MX": the domain says it accepts no mail at all.
    if (mx.length && mx.every((r) => !r.exchange || r.exchange === '.')) {
      return { ok: false, message: `${domain} does not accept email. Please use another address.` };
    }
    if (mx.length) return { ok: true };
  } catch (err) {
    if (!DEFINITELY_MISSING.has(err.code)) return { ok: true }; // DNS trouble - let the code decide
  }
  // No MX records: mail can still go to the domain's own address record.
  try {
    const a = await withTimeout(resolver.resolve4(domain), 5000);
    if (a.length) return { ok: true };
  } catch (err) {
    if (!DEFINITELY_MISSING.has(err.code)) return { ok: true };
  }
  return { ok: false, message: `We could not find the email domain "${domain}". Please check the address.` };
};
