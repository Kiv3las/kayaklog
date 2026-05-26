declare module 'react-native-confetti-cannon' {
  import * as React from 'react';

  interface ConfettiCannonProps {
    count: number;
    origin: { x: number; y: number };
    explosionSpeed?: number;
    fallSpeed?: number;
    colors?: string[];
    fadeOut?: boolean;
    autoStart?: boolean;
    autoStartDelay?: number;
    onAnimationStart?: () => void;
    onAnimationEnd?: () => void;
    testID?: string;
  }

  class ConfettiCannon extends React.PureComponent<ConfettiCannonProps> {
    start(): void;
    stop(): void;
    resume(): void;
  }

  export default ConfettiCannon;
}
