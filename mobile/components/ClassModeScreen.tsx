import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Vibration,
} from 'react-native';
import { FocusScoreRing } from './FocusScoreRing';

type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';

interface Props {
  className: string;
  teacherName?: string;
  endsAt?: Date;
  focusScore: number;
  dailyScore: number;
  tier: Tier;
  streak: number;
  isCompliant: boolean;
}

function useCountdown(endsAt?: Date): string {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!endsAt) return;

    const tick = () => {
      const diff = endsAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00');
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return timeLeft;
}

export function ClassModeScreen({
  className,
  teacherName,
  endsAt,
  focusScore,
  dailyScore,
  tier,
  streak,
  isCompliant,
}: Props) {
  const timeLeft = useCountdown(endsAt);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isCompliant) {
      // Pulse animation for non-compliant state
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
      Vibration.vibrate([0, 200, 100, 200]);
    } else {
      pulseAnim.setValue(1);
      Animated.stopAnimation;
    }
  }, [isCompliant]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Status indicator */}
      <Animated.View
        style={[
          styles.statusBanner,
          {
            backgroundColor: isCompliant ? '#22c55e18' : '#ef444418',
            borderColor: isCompliant ? '#22c55e40' : '#ef444440',
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isCompliant ? '#22c55e' : '#ef4444' },
          ]}
        />
        <Text style={[styles.statusText, { color: isCompliant ? '#22c55e' : '#ef4444' }]}>
          {isCompliant ? 'IN CLASS MODE — EARNING POINTS' : 'PUT YOUR PHONE DOWN'}
        </Text>
      </Animated.View>

      {/* Class info */}
      <View style={styles.classInfo}>
        <Text style={styles.classModeLabel}>CLASS MODE</Text>
        <Text style={styles.className}>{className}</Text>
        {teacherName && <Text style={styles.teacherName}>{teacherName}</Text>}
      </View>

      {/* Countdown */}
      {timeLeft ? (
        <View style={styles.countdown}>
          <Text style={styles.countdownLabel}>Ends in</Text>
          <Text style={styles.countdownTime}>{timeLeft}</Text>
        </View>
      ) : (
        <View style={styles.countdown}>
          <Text style={styles.countdownLabel}>Session in progress</Text>
        </View>
      )}

      {/* Focus score ring */}
      <View style={styles.scoreSection}>
        <FocusScoreRing score={focusScore} tier={tier} size={180} />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dailyScore}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>🔥 {streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      </View>

      {/* Motivational footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isCompliant
            ? '✓ Keep it up! Every minute earns you points.'
            : '⚠ Violation detected. Put your phone away.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  classInfo: {
    alignItems: 'center',
    marginTop: 32,
  },
  classModeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 2,
    marginBottom: 8,
  },
  className: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  teacherName: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  countdown: {
    alignItems: 'center',
    marginTop: 24,
  },
  countdownLabel: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  countdownTime: {
    fontSize: 48,
    fontWeight: '700',
    color: '#e2e8f0',
    fontVariant: ['tabular-nums'],
  },
  scoreSection: {
    alignItems: 'center',
    marginTop: 32,
    gap: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#1e293b',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
});
