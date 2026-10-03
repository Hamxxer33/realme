import { useState } from 'react';
import { AuthForm } from '../components/AuthForm';
import { Body, Button, ErrorText, Field } from '../components/ui';
import { useSession } from '../lib/session';

const MIN_PASSWORD = 10;

export default function SignUp() {
  const { signUp } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!displayName.trim()) return setError('What should your partner call you?');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    setBusy(true);
    try {
      await signUp({ email: email.trim(), password, displayName: displayName.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <AuthForm title="Create your account" subtitle="Then invite your person to join you.">
      <Field label="Your name" value={displayName} onChangeText={setDisplayName} autoComplete="given-name" textContentType="givenName" maxLength={40} />
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
