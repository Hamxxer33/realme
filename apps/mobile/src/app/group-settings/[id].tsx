import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Icon } from '../../components/Icon';
import { Section } from '../../components/SettingsList';
import { Screen } from '../../components/ui';
import { api, type ConversationView } from '../../lib/api';
import { notify } from '../../lib/confirm';
import { upsert, useConversation } from '../../lib/conversations';
import { colors, fonts, space, themed } from '../../theme';

type Setting = 'adminsOnlyMessages' | 'adminsOnlyEdit';

/** Admin-only: who can send messages, and who can edit the group's name and description. */
export default function GroupSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id);
  if (!conv) return <Screen><BackHeader title="Group settings" /></Screen>;

  const set = async (key: Setting, value: boolean) => {
    if (conv[key] === value) return;
    upsert({ ...conv, [key]: value });
    try {
      const { conversation } = await api<{ conversation: ConversationView }>('PATCH', `/conversations/${conv.id}`, { [key]: value });
      upsert(conversation);
    } catch (e) {
      upsert(conv);
      notify("Couldn't change setting", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <Screen>
      <BackHeader title="Group settings" />
      <ScrollView contentContainerStyle={styles.container}>
        <Choice
          title="Send messages"
          hint="Choose who can send messages to this group."
          value={conv.adminsOnlyMessages}
          onChange={(v) => void set('adminsOnlyMessages', v)}
        />
        <Choice
          title="Edit group info"
          hint="Choose who can change this group's name and description."
          value={conv.adminsOnlyEdit}
          onChange={(v) => void set('adminsOnlyEdit', v)}
        />
        <Text style={styles.note}>Admins can always add and remove people. Every change shows up in the chat.</Text>
      </ScrollView>
    </Screen>
  );
}

function Choice({ title, hint, value, onChange }: { title: string; hint: string; value: boolean; onChange: (adminsOnly: boolean) => void }) {
  return (
    <Section title={title}>
      <Text style={styles.hint}>{hint}</Text>
      {([false, true] as const).map((adminsOnly) => {
        const on = value === adminsOnly;
        const label = adminsOnly ? 'Only admins' : 'All members';
        return (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${title}: ${label}`}
            onPress={() => onChange(adminsOnly)}
            style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceMuted }]}
          >
            <Text style={styles.optionTitle}>{label}</Text>
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <Icon name="check" color={colors.onRose} size={14} strokeWidth={2.6} /> : null}
            </View>
          </Pressable>
        );
      })}
    </Section>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.lg },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.inkMuted, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 14 },
  optionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.roseFill, borderColor: colors.roseFill },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted, paddingHorizontal: space.md },
}));
