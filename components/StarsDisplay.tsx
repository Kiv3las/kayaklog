import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const STAR_PATH = 'M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z';

interface Props {
  value: number;
  size?: number;
}

export default function StarsDisplay({ value, size = 13 }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 1 }}>
          <Path
            d={STAR_PATH}
            fill={i <= value ? '#ffb800' : '#fff'}
            stroke={i <= value ? '#e09e00' : '#9a9a9a'}
            strokeWidth={1.5}
          />
        </Svg>
      ))}
    </View>
  );
}
