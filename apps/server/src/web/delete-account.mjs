// Account deletion from the web, for people who no longer have the app.
// The password is stretched here in the browser; only the derived login secret is sent.
import sodium from '/static/sodium/libsodium-wrappers.mjs';
import { deriveAuthSecret } from '/static/derive.mjs';

const form = document.getElementById('delete-form');
const status = document.getElementById('status');
const button = form.querySelector('button');

const say = (text, kind = '') => {
  status.textContent = text;
  status.className = `status ${kind}`;
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!form.confirm.checked) return say('Please tick the box to confirm.', 'error');
  button.disabled = true;
  try {
    say('Checking your password…');
    await sodium.ready;
    const authSecret = deriveAuthSecret(sodium, email, password);
    const login = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, authSecret }),
    });
    const body = await login.json().catch(() => ({}));
    if (!login.ok) throw new Error(body.error || 'Wrong email or password');
    say('Deleting your account…');
    const del = await fetch('/me', { method: 'DELETE', headers: { authorization: `Bearer ${body.token}` } });
    if (!del.ok) throw new Error('Something went wrong. Please try again, or email us.');
    form.reset();
    form.hidden = true;
    say('Your account and its data have been deleted. Sorry to see you go 💛', 'done');
  } catch (err) {
    say(err.message, 'error');
  } finally {
    button.disabled = false;
  }
});
