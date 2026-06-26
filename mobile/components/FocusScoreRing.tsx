import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';

const TIER_COLORS: Record<Tier, string> = {
  BRONZE: '#b45309',
  SILVER: '#94a3b8',
  GOLD: '#eab308',
  ELITE: '#a855f7',
};

interface Props {
  score: number;
  maxScore?: number;
  tier: Tier;
  size?: number;
}

export function FocusScoreRing({ score, maxScore = 3000, tier, size = 160 }: Props) {
  const animatedScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPercent = Math.min(score / maxScore, 1);
  const strokeDashoffset = circumference * (1 - fillPercent);
  const color = TIER_COLORS[tier];
  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1f1f1f"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>

      <View style={styles.center}>
        <Text style={[styles.score, { fontSize: size * 0.18 }]}>
          {score.toLocaleString()}
        </Text>
        <Text style={[styles.tier, { color }]}>{tier}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  tier: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
