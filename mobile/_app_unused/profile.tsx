import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { FocusScoreRing } from '../components/FocusScoreRing';
import { RewardsBar } from '../components/RewardsBar';

type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';

const STATUS_COLORS = {
  COMPLIANT: '#22c55e',
  NON_COMPLIANT: '#eab308',
  OFFLINE: '#475569',
  BYPASSING: '#ef4444',
};

// In production, fetch from API using stored auth token
const MOCK_PROFILE = {
  name: 'Alex Rivera',
  grade: '10th',
  focusScore: 1240,
  dailyScore: 87,
  weeklyScore: 412,
  tier: 'SILVER' as Tier,
  streak: 5,
  totalViolations: 2,
  status: 'COMPLIANT' as const,
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState(MOCK_PROFILE);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: fetch fresh data from API
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  const statusColor = STATUS_COLORS[profile.status];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.grade}>Grade {profile.grade}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {profile.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Focus ring */}
        <View style={styles.ringSection}>
          <FocusScoreRing score={profile.focusScore} tier={profile.tier} size={180} />
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Today', value: profile.dailyScore },
            { label: 'This Week', value: profile.weeklyScore },
            { label: 'Violations', value: profile.totalViolations },
            { label: 'Day Streak', value: `🔥 ${profile.streak}` },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Rewards progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tier Progress</Text>
          <RewardsBar focusScore={profile.focusScore} currentTier={profile.tier} />
        </View>

        {/* Tip */}
        <View style={styles.tip}>
          <Text style={styles.tipText}>
            💡 Keep your phone put away in class to earn +1 point per minute.
            Reach Silver level (500 pts) for early lunch privileges!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    padding: 24,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  grade: {
    fontSize: 15,
    color: '#475569',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ringSection: {
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tip: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  tipText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
});
