import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Ellipse, G, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface Props {
  size?: number;
}

// In-app reproduction of the app icon: white kayak silhouette (top-down) on
// a vertical blue gradient, clipped to a rounded square with the same corner
// ratio iOS uses for its app icons (~22%). Shared by the login screen and
// any other "branded" surfaces that want the real mark instead of an emoji.
export default function KayakLogo({ size = 88 }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        overflow: 'hidden',
        shadowColor: '#0a5dd1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id="kayakLogoBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3eb1ff" />
            <Stop offset="1" stopColor="#0a5dd1" />
          </LinearGradient>
        </Defs>
        <Rect width={1024} height={1024} fill="url(#kayakLogoBg)" />
        <G x={512} y={512}>
          <Path
            d="M 0 -420 C 70 -420 120 -300 130 -150 C 135 -50 135 50 130 150 C 120 300 70 420 0 420 C -70 420 -120 300 -130 150 C -135 50 -135 -50 -130 -150 C -120 -300 -70 -420 0 -420 Z"
            fill="#ffffff"
          />
          <Ellipse cx={0} cy={0} rx={80} ry={160} fill="#0a5dd1" />
          <Ellipse cx={0} cy={0} rx={80} ry={160} fill="none" stroke="#ffffff" strokeWidth={6} />
        </G>
      </Svg>
    </View>
  );
}
