import React from 'react';
import Svg, { G, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export default function PaddleIcon({ size = 22, color = '#0a84ff' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Back paddle: top-left to bottom-right */}
      <G rotation={45} originX={12} originY={12}>
        <Rect x="2.5" y="11.2" width="19" height="1.6" rx="0.8" fill={color} opacity={0.55} />
        <Rect x="0" y="9.5" width="5.5" height="5" rx="2" fill={color} opacity={0.55} />
        <Rect x="18.5" y="9.5" width="5.5" height="5" rx="2" fill={color} opacity={0.55} />
      </G>
      {/* Front paddle: top-right to bottom-left */}
      <G rotation={-45} originX={12} originY={12}>
        <Rect x="2.5" y="11.2" width="19" height="1.6" rx="0.8" fill={color} />
        <Rect x="0" y="9.5" width="5.5" height="5" rx="2" fill={color} />
        <Rect x="18.5" y="9.5" width="5.5" height="5" rx="2" fill={color} />
      </G>
    </Svg>
  );
}
