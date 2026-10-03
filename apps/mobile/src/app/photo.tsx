import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { themed } from '../theme';

export default function Photo() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  return (
    <View style={styles.container}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
      <SafeAreaView edges={['top']} style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Icon name="close" color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0809' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
