import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

// Thin-stroke icons drawn locally (no icon font, no emoji-as-icon).
const paths = {
  heart: 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z',
  send: 'M4.5 12h11M11 6.5l5.5 5.5-5.5 5.5',
  image: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9ZM4.5 16l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5',
  mic: 'M12 4a2.75 2.75 0 0 1 2.75 2.75v4.5a2.75 2.75 0 0 1-5.5 0v-4.5A2.75 2.75 0 0 1 12 4ZM6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20',
  play: 'M8.5 6.5v11l9-5.5-9-5.5Z',
  pause: 'M9 6.5v11M15 6.5v11',
  back: 'M14.5 6l-6 6 6 6',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  settings: 'M5 7h9M18 7h1M5 17h1M10 17h9M16 5v4M8 15v4',
  album: 'M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11ZM8.5 9.5h7M8.5 12.5h7M8.5 15.5h4',
  plus: 'M12 5.5v13M5.5 12h13',
  lock: 'M7 11V8.5a5 5 0 0 1 10 0V11M6.5 11h11v8.5h-11V11Z',
  trash: 'M5.5 7h13M10 7V5h4v2M7.5 7l.8 12h7.4l.8-12',
  alert: 'M12 8v5M12 16.5v.01M12 3.5 21 19.5H3L12 3.5Z',
  check: 'M5.5 12.5l4 4 9-9',
  checks: 'M3.5 12.5l4 4 9-9M11 16.5l1 1 9-9',
} as const;

export type IconName = keyof typeof paths | 'stop';

export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 1.6, filled = false }: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'stop' ? (
        <Rect x={7} y={7} width={10} height={10} rx={2.5} fill={color} />
      ) : (
        <Path
          d={paths[name]}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={filled ? color : 'none'}
        />
      )}
    </Svg>
  );
}
