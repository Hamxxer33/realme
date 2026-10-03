import { useEffect, useRef } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import type { Stream } from '../lib/calls';

/** A <video> element; also plays the remote audio, so keep it mounted for voice calls too. */
export function VideoView({ stream, mirror, muted, style }: { stream: Stream; mirror?: boolean; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream as unknown as MediaStream;
  }, [stream]);
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : undefined }}
      />
    </View>
  );
}
