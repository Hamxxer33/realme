import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { AuthForm } from '../components/AuthForm';
import { Body, Button, ErrorText, Field } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, fonts } from '../theme';

const MIN_PASSWORD = 10;
const USERNAME = /^[a-z0-9_]{3,20}$/;

export default function SignUp() {
  const { signUp } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const handle = username.trim().toLowerCase().replace(/^@/, '');

  // Live "is this username free?" check.
  useEffect(() => {
    setAvailable(null);
    if (!USERNAME.test(handle)) return;
    let alive = true;
    const t = setTimeout(() => {
      api<{ available: boolean }>('GET', `/auth/username-available?username=${handle}`)
        .then((r) => alive && setAvailable(r.available), () => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [handle]);

  const submit = async () => {
    setError(null);
    if (!displayName.trim()) return setError('What should people call you?');
    if (!USERNAME.test(handle)) return setError('Usernames are 3–20 letters, numbers or underscores.');
    if (available === false) return setError('That username is taken.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    setBusy(true);
    try {
      await signUp({ email: email.trim(), password, username: handle, displayName: displayName.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const hint = !handle ? null : !USERNAME.test(handle)
    ? { text: '3–20 letters, numbers or _', ok: false }
    : available === null ? null : available ? { text: `@${handle} is available`, ok: true } : { text: `@${handle} is taken`, ok: false };

  return (
    <AuthForm title="Create your account" subtitle="Pick a @username so people can find you.">
      <Field label="Your name" value={displayName} onChangeText={setDisplayName} autoComplete="name" textContentType="name" maxLength={40} />
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" maxLength={21} placeholder="@yourname" />
      {hint ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, marginTop: -8, marginLeft: 4, color: hint.ok ? colors.gold : colors.danger }}>{hint.text}</Text>
      ) : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
        Your password also locks your encryption key. If you forget it, your messages can't be recovered — not even by us.
      </Body>
      <ErrorText>{error}</ErrorText>
      <Button title="Create account" onPress={submit} loading={busy} />
    </AuthForm>
  );
}
