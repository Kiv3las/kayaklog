import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

// Feedback táctil: la tarjeta se hunde levemente al presionar (resorte).
// Reemplaza a TouchableOpacity en tarjetas para que la app se sienta viva.
export default function PressableScale({ children, onPress, style, containerStyle, disabled }: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  // Estilo de layout para el Pressable exterior (p. ej. flex: 1 en filas).
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={containerStyle}
      onPressIn={() => { scale.value = withSpring(0.965, { damping: 20, stiffness: 350 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 350 }); }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
