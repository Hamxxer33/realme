import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type ReportReason } from '../lib/api';
import { notify } from '../lib/confirm';
import { colors, fonts, radius, space, themed } from '../theme';
import { Body, Button, Field } from './ui';

const REASONS: Array<{ id: ReportReason; label: string }> = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'inappropriate', label: 'Sexual or violent content' },
  { id: 'impersonation', label: 'Pretending to be someone' },
  { id: 'underage', label: 'May be under 18' },
  { id: 'other', label: 'Something else' },
];

export interface ReportTarget {
  userId?: string;
  postId?: string;
  commentId?: string;
  conversationId?: string;
  label: string; // "@ben", "this post"…
}

export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setReason(null);
    setDetails('');
    onClose();
  };

  const submit = async () => {
    if (!target || !reason) return;
    setBusy(true);
    try {
      const { label: _label, ...ids } = target;
      await api('POST', '/reports', { reason, details, ...ids });
      close();
      notify('Thanks for telling us', "We'll review it. You can also block them so they can't reach you.");
    } catch (e) {
      notify("Couldn't send report", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>Report {target?.label}</Text>
          {target?.conversationId ? (
            <Body muted style={styles.small}>
              Chats are end-to-end encrypted, so we can't see them. If you want us to see what was said, paste it below.
            </Body>
          ) : null}
          <View style={{ gap: space.xs }}>
            {REASONS.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: reason === r.id }}
                onPress={() => setReason(r.id)}
                style={[styles.option, reason === r.id && styles.optionOn]}
              >
                <View style={[styles.radio, reason === r.id && styles.radioOn]} />
                <Text style={styles.optionText}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={2000} style={{ minHeight: 90, paddingTop: 14, textAlignVertical: 'top' }} />
          <Button title="Send report" onPress={submit} loading={busy} disabled={!reason} />
          <Button title="Cancel" variant="ghost" onPress={close} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
  },
  title: { fontFamily: fonts.heavy, fontSize: 22, color: colors.ink },
  small: { fontSize: 14, lineHeight: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  optionOn: { backgroundColor: colors.roseTint },
  optionText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.inkMuted },
  radioOn: { borderColor: colors.rose, backgroundColor: colors.roseFill },
}));
