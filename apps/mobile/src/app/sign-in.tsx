import { useState } from 'react';
import { AuthForm } from '../components/AuthForm';
import { Button, ErrorText, Field } from '../components/ui';
import { useSession } from '../lib/session';

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <AuthForm title="Welcome back" subtitle="Your messages unlock with your password.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      <ErrorText>{error}</ErrorText>
      <Button title="Sign in" onPress={submit} loading={busy} />
    </AuthForm>
  );
}
