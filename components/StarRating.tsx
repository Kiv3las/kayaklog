import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const STAR_PATH = 'M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z';

interface Props {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}

export default function StarRating({ value, onChange, size = 18 }: Props) {
  function handlePress(i: number) {
    onChange(value === i ? 0 : i);
  }

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handlePress(i)}
            accessibilityLabel={`${i} estrella${i > 1 ? 's' : ''}`}
            style={{ marginRight: 2 }}
          >
            <Svg width={size} height={size} viewBox="0 0 24 24">
              <Path
                d={STAR_PATH}
                fill={i <= value ? '#ffb800' : '#fff'}
                stroke={i <= value ? '#e09e00' : '#9a9a9a'}
                strokeWidth={1.5}
              />
            </Svg>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.counter}>{value}/5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: '100%',
    backgroundColor: '#fff',
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counter: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
});
