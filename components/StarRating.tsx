import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';

const STAR_PATH = 'M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z';

interface Props {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      width: '100%',
      backgroundColor: c.cardBg,
    },
    stars: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    counter: {
      fontSize: 12,
      color: c.textSecondary,
      fontWeight: '600',
    },
  });
}

export default function StarRating({ value, onChange, size = 18 }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
            accessibilityLabel={t('stars.label', { count: i })}
            style={{ marginRight: 2 }}
          >
            <Svg width={size} height={size} viewBox="0 0 24 24">
              <Path
                d={STAR_PATH}
                fill={i <= value ? '#ffb800' : colors.cardBg}
                stroke={i <= value ? '#e09e00' : colors.textTertiary}
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
