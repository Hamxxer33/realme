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
  search: 'M10.5 5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM15 15l4.5 4.5',
  chat: 'M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16h0A1.5 1.5 0 0 1 5 14.5v-8Z',
  feed: 'M4.5 5.5h15M4.5 12h15M4.5 18.5h9',
  user: 'M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM5 19.5c.8-3.2 3.6-5 7-5s6.2 1.8 7 5',
  users: 'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM3.5 18.5c.7-2.8 2.9-4.5 5.5-4.5s4.8 1.7 5.5 4.5M15.5 5.3a3 3 0 0 1 0 5.4M17 14.3c1.8.5 3 2 3.5 4.2',
  comment: 'M20 11.5c0 3.9-3.6 7-8 7-1.2 0-2.4-.2-3.4-.7L4 19l1.3-3.6A6.6 6.6 0 0 1 4 11.5c0-3.9 3.6-7 8-7s8 3.1 8 7Z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  flag: 'M6 20.5V4.5M6 5h10.5l-2 3.75 2 3.75H6',
  block: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM6.5 6.5l11 11',
  inbox: 'M4.5 13.5 6.8 6A1.5 1.5 0 0 1 8.2 5h7.6a1.5 1.5 0 0 1 1.4 1l2.3 7.5M4.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-4.5M4.5 13.5h4l1 2h5l1-2h4',
  edit: 'M14.5 6.5l3 3M5 19l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L9 18l-4 1Z',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5ZM10 20.5h4',
  bellOff: 'M6.5 16.5V11c0-1 .3-2 .8-2.8M9.5 6.1A5.5 5.5 0 0 1 17.5 11v4M18 18H5l1.5-1.5M10 20.5h4M4.5 4.5l15 15',
  userPlus: 'M10 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM3.5 19.5c.8-3.2 3.3-5 6.5-5 1.2 0 2.3.3 3.2.8M18 13.5v6M15 16.5h6',
  eraser: 'M14.5 5.5l4 4-8.5 8.5H6l-2-2a1.4 1.4 0 0 1 0-2l10.5-10.5ZM9 11l4 4M10 18.5h9.5',
  logout: 'M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14M10 8l-4 4 4 4M6 12h9',
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
