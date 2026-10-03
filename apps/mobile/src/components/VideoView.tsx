import type { StyleProp, ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import type { Stream } from '../lib/calls';

export function VideoView({ stream, mirror, muted: _muted, style }: { stream: Stream; mirror?: boolean; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  return <RTCView streamURL={(stream as unknown as { toURL(): string }).toURL()} mirror={mirror} objectFit="cover" style={style} />;
}
