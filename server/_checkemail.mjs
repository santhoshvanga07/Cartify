import 'dotenv/config';
import { isEmailConfigured, getTransporter } from './src/services/email.service.js';

/**
 * Checks the SMTP settings in server/.env and sends one test email.
 * Run with:  npm run check:email                 (sends to SMTP_USER)
 *       or:  npm run check:email -- you@mail.com (sends to that address)
 *
 * Like check:cloudinary it sets process.exitCode instead of calling
 * process.exit(), so open sockets can close cleanly on Windows.
 */

const line = (label, value) => console.log(`  ${label.padEnd(12)} ${value}`);

const explain = (err) => {
  console.log(`\n  FAILED: ${err.message}\n`);
  console.log('  HOW TO FIX');
  if (err.code === 'EAUTH' || err.responseCode === 535 || err.responseCode === 534) {
    console.log('    The mail server rejected the username/password.');
    console.log('    For Gmail you CANNOT use your normal password:');
    console.log('      1. Turn on 2-Step Verification for the Google account.');
    console.log('      2. Open https://myaccount.google.com/apppasswords and create an app password.');
    console.log('      3. Put the 16-letter code (without spaces) in SMTP_PASS.');
    console.log('    SMTP_USER must be the full address, e.g. yourname@gmail.com.');
  } else if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'EDNS'].includes(err.code)) {
    console.log('    Could not reach the mail server.');
    console.log('    Check SMTP_HOST and SMTP_PORT (Gmail: smtp.gmail.com, port 587).');
    console.log('    Some networks and hosting plans block outgoing SMTP ports -');
    console.log('    try port 465, or another network.');
  } else if (/certificate/i.test(err.message)) {
    console.log('    The secure connection failed - often antivirus or a proxy');
    console.log('    intercepting mail traffic. Try another network.');
  } else {
    console.log('    Compare SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in server/.env');
    console.log("    with your mail provider's SMTP settings.");
  }
  process.exitCode = 1;
};

const main = async () => {
  console.log('\nCartify email (SMTP) check\n');
  line('SMTP_HOST', process.env.SMTP_HOST || 'smtp.gmail.com (default)');
  line('SMTP_PORT', process.env.SMTP_PORT || '587 (default)');
  line('SMTP_USER', process.env.SMTP_USER || '(not set)');
  line('SMTP_PASS', process.env.SMTP_PASS ? `set (${process.env.SMTP_PASS.length} characters)` : '(not set)');
  line('EMAIL_FROM', process.env.EMAIL_FROM || 'Cartify <no-reply@cartify.com> (default)');

  if (!isEmailConfigured()) {
    console.log('\n  Email is OFF: SMTP_USER and SMTP_PASS are both needed.');
    console.log('  Until then, emails (including reset links) are printed to the server console.');
    console.log('  Fill them in server/.env and run this again.');
    process.exitCode = 1;
    return;
  }

  const transport = getTransporter();
  try {
    await transport.verify();
    console.log('\n  OK  Signed in to the mail server.');
  } catch (err) {
    explain(err);
    return;
  }

  const to = process.argv.slice(2).find((a) => a.includes('@')) || process.env.SMTP_USER;
  try {
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'Cartify <no-reply@cartify.com>',
      to,
      subject: 'Cartify test email',
      text: 'If you can read this, Cartify can send email. Order, password reset and refund emails will now go out.',
    });
    console.log(`  OK  Test email sent to ${to} (${info.messageId}).`);
    console.log('      Check the inbox - and the spam folder the first time.\n');
  } catch (err) {
    explain(err);
  } finally {
    transport.close();
  }
};

main();
