import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';

const TIER_THRESHOLDS: Record<Tier, number> = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1500,
  ELITE: 3000,
};

const TIER_ORDER: Tier[] = ['BRONZE', 'SILVER', 'GOLD', 'ELITE'];

const TIER_COLORS: Record<Tier, string> = {
  BRONZE: '#b45309',
  SILVER: '#94a3b8',
  GOLD: '#eab308',
  ELITE: '#a855f7',
};

interface Props {
  focusScore: number;
  currentTier: Tier;
}

export function RewardsBar({ focusScore, currentTier }: Props) {
  const currentTierIdx = TIER_ORDER.indexOf(currentTier);
  const nextTier = TIER_ORDER[currentTierIdx + 1] as Tier | undefined;

  const progressMin = TIER_THRESHOLDS[currentTier];
  const progressMax = nextTier ? TIER_THRESHOLDS[nextTier] : TIER_THRESHOLDS.ELITE;
  const progressPct = nextTier
    ? Math.min(((focusScore - progressMin) / (progressMax - progressMin)) * 100, 100)
    : 100;
  const pointsToNext = nextTier ? Math.max(progressMax - focusScore, 0) : 0;

  return (
    <View style={styles.container}>
      {/* Tier badges */}
      <View style={styles.tiers}>
        {TIER_ORDER.map((tier, idx) => (
          <View key={tier} style={styles.tierItem}>
            <View
              style={[
                styles.tierDot,
                {
                  backgroundColor: idx <= currentTierIdx ? TIER_COLORS[tier] : '#334155',
                  borderColor: TIER_COLORS[tier],
                },
              ]}
            />
            <Text style={[styles.tierLabel, idx <= currentTierIdx && { color: TIER_COLORS[tier] }]}>
              {tier.charAt(0) + tier.slice(1).toLowerCase()}
            </Text>
          </View>
        ))}
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${progressPct}%` as any,
              backgroundColor: TIER_COLORS[currentTier],
            },
          ]}
        />
      </View>

      {/* Next tier info */}
      {nextTier && (
        <Text style={styles.nextTierText}>
          {pointsToNext.toLocaleString()} points to {nextTier.charAt(0) + nextTier.slice(1).toLowerCase()}
        </Text>
      )}
      {!nextTier && (
        <Text style={[styles.nextTierText, { color: TIER_COLORS.ELITE }]}>
          🏆 Elite tier achieved!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 4,
  },
  tiers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tierItem: {
    alignItems: 'center',
    gap: 4,
  },
  tierDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  tierLabel: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  nextTierText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
  },
});
