import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type Category = 'Entertainment' | 'Software' | 'Storage' | 'Music' | 'Fitness' | 'Utilities' | 'Learning' | 'Other';
type Cycle = 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
type Tab = 'Home' | 'Subscriptions' | 'Insights' | 'Settings';

type Subscription = {
  id: number;
  name: string;
  category: Category;
  amount: number;
  cycle: Cycle;
  nextRenewal: string;
  manageUrl: string;
  notes: string;
  reminderEnabled: number;
  createdAt: string;
};

type SubscriptionInput = Omit<Subscription, 'id' | 'createdAt'>;
type GmailCandidate = {
  id: number;
  name: string;
  category: Category;
  amount: number | null;
  cycle: Cycle | 'Unknown';
  nextRenewal: string | null;
  confidence: number;
  evidenceCount: number;
  needsReview: boolean;
  manageUrl: string;
  alreadyImported: boolean;
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://subsathi-api.onrender.com').replace(/\/$/, '');
const SESSION_KEY = 'subsathi_api_session_v1';
const GOOGLE_AUTH_RETURN_URL = 'subsathi://auth';


const C = {
  ink: '#102A35',
  muted: '#6E8188',
  green: '#16A879',
  greenDark: '#087D59',
  greenPale: '#E6F7F0',
  cream: '#F6F8F7',
  white: '#FFFFFF',
  line: '#E7EDEB',
  orange: '#F4A340',
  orangePale: '#FFF3E0',
  red: '#D95959',
  redPale: '#FFF0EF',
  navy: '#0D2330',
  bluePale: '#EAF2FF',
};

const CATEGORIES: { name: Category; emoji: string; tint: string }[] = [
  { name: 'Entertainment', emoji: '🎬', tint: '#FCEBDD' },
  { name: 'Software', emoji: '💻', tint: '#E8EFFF' },
  { name: 'Storage', emoji: '☁️', tint: '#E5F5FA' },
  { name: 'Music', emoji: '🎧', tint: '#F2E9FF' },
  { name: 'Fitness', emoji: '💪', tint: '#E3F5E9' },
  { name: 'Utilities', emoji: '📶', tint: '#E7F0FF' },
  { name: 'Learning', emoji: '📚', tint: '#FFF1D8' },
  { name: 'Other', emoji: '🔁', tint: '#EDF1F1' },
];
const CYCLES: Cycle[] = ['Weekly', 'Monthly', 'Quarterly', 'Yearly'];

function categoryMeta(category: Category) {
  return CATEGORIES.find((item) => item.name === category) ?? CATEGORIES[CATEGORIES.length - 1];
}
function localDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function parseLocalDate(value: string) {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return new Date(NaN);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}
function formatDate(value: string) {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return value || 'Date not set';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
function monthlyEquivalent(item: Pick<Subscription, 'amount' | 'cycle'>) {
  switch (item.cycle) {
    case 'Weekly': return item.amount * 52 / 12;
    case 'Monthly': return item.amount;
    case 'Quarterly': return item.amount / 3;
    case 'Yearly': return item.amount / 12;
  }
}
function annualEquivalent(item: Pick<Subscription, 'amount' | 'cycle'>) {
  switch (item.cycle) {
    case 'Weekly': return item.amount * 52;
    case 'Monthly': return item.amount * 12;
    case 'Quarterly': return item.amount * 4;
    case 'Yearly': return item.amount;
  }
}
function daysUntil(value: string) {
  const target = parseLocalDate(value);
  const today = parseLocalDate(localDateString(new Date()));
  if (Number.isNaN(target.getTime())) return 9999;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
function dueLabel(value: string) {
  if (!value) return 'Date not set';
  const days = daysUntil(value);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `In ${days} days`;
  return `Due ${formatDate(value)}`;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseLocalDate(value);
  const [year, month, day] = value.split('-').map(Number);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

async function initializeDatabase() {
  const db = await SQLite.openDatabaseAsync('subsathi.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      cycle TEXT NOT NULL,
      nextRenewal TEXT NOT NULL,
      manageUrl TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      reminderEnabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );
  `);
  return db;
}

async function rescheduleRenewalReminders(items: Subscription[], enabled: boolean) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled || !items.some((item) => Boolean(item.reminderEnabled))) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('renewals', {
        name: 'Subscription renewals',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return;
    for (const item of items) {
      if (!item.reminderEnabled) continue;
      const renewal = parseLocalDate(item.nextRenewal);
      renewal.setDate(renewal.getDate() - 2);
      renewal.setHours(9, 0, 0, 0);
      if (Number.isNaN(renewal.getTime()) || renewal.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${item.name} renews soon`,
          body: `${item.name} is scheduled to renew on ${formatDate(item.nextRenewal)}. Check your plan before it renews.`,
          data: { subscriptionId: item.id, serviceName: item.name, renewalDate: item.nextRenewal },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: renewal },
      });
    }
  } catch (error) {
    // Reminder scheduling must not block saving subscription details.
    console.warn('Unable to refresh renewal reminders', error);
  }
}

function Pill({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'orange' | 'grey' | 'red' }) {
  const styles = tone === 'orange' ? pillOrange : tone === 'grey' ? pillGrey : tone === 'red' ? pillRed : pillGreen;
  return <View style={[styles.base]}><Text style={styles.text}>{children}</Text></View>;
}
function PrimaryButton({ title, onPress, small = false }: { title: string; onPress: () => void; small?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, small && styles.primaryButtonSmall, pressed && { opacity: 0.85 }]}><Text style={styles.primaryButtonText}>{title}</Text></Pressable>;
}
function GhostButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.ghostButton, pressed && { opacity: 0.7 }]}><Text style={styles.ghostButtonText}>{title}</Text></Pressable>;
}
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{action && onAction ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}
function BrandMark({ size = 42 }: { size?: number }) {
  return <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.32 }]}><Text style={{ fontSize: size * 0.45 }}>↻</Text></View>;
}

export default function App() {
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tab, setTab] = useState<Tab>('Home');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | Category>('All');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [scanInfoOpen, setScanInfoOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [apiSession, setApiSession] = useState<string | null>(null);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanCandidates, setScanCandidates] = useState<GmailCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const autoScanSessionRef = useRef<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    const rows = await db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC');
    setSubscriptions(rows);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await initializeDatabase();
        if (!mounted) { await db.closeAsync(); return; }
        dbRef.current = db;
        const rows = await db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC');
        const preference = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'notificationsEnabled'");
        if (mounted) {
          setSubscriptions(rows);
          if (preference) setNotificationsEnabled(preference.value === 'true');
        }
      } catch (error) {
        Alert.alert('Could not open local database', 'Please restart the app. Your subscriptions have not been uploaded anywhere.');
        console.warn(error);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(SESSION_KEY);
        if (!token || !mounted) return;
        const response = await fetch(`${API_BASE_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          return;
        }
        const profile = await response.json();
        if (mounted && profile.gmail_connected) {
          setApiSession(token);
          setGmailEmail(profile.gmail_email || profile.email || null);
        } else if (mounted) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
        }
      } catch (error) {
        // API may be offline during app startup. Local subscription tracking remains usable.
        console.warn('Could not restore SubSathi cloud session', error);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const activeMonthly = useMemo(() => subscriptions.reduce((sum, item) => sum + monthlyEquivalent(item), 0), [subscriptions]);
  const activeAnnual = useMemo(() => subscriptions.reduce((sum, item) => sum + annualEquivalent(item), 0), [subscriptions]);
  const nextThirtyDays = useMemo(() => subscriptions.filter((item) => daysUntil(item.nextRenewal) >= 0 && daysUntil(item.nextRenewal) <= 30), [subscriptions]);
  const upcoming = useMemo(() => subscriptions.filter((item) => daysUntil(item.nextRenewal) >= -3 && daysUntil(item.nextRenewal) <= 30).sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal)), [subscriptions]);
  const currentMonthDue = useMemo(() => subscriptions.filter((item) => {
    const date = parseLocalDate(item.nextRenewal);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && daysUntil(item.nextRenewal) >= 0;
  }).reduce((sum, item) => sum + item.amount, 0), [subscriptions]);
  const filtered = useMemo(() => subscriptions.filter((item) => {
    const text = `${item.name} ${item.category}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (filter === 'All' || item.category === filter);
  }), [subscriptions, search, filter]);
  const categorySpend = useMemo(() => CATEGORIES.map((category) => ({
    ...category,
    amount: subscriptions.filter((item) => item.category === category.name).reduce((sum, item) => sum + monthlyEquivalent(item), 0),
  })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount), [subscriptions]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (item: Subscription) => { setEditing(item); setEditorOpen(true); };

  const saveSubscription = async (input: SubscriptionInput) => {
    const db = dbRef.current;
    if (!db) throw new Error('Database is not ready.');
    if (editing) {
      await db.runAsync(
        'UPDATE subscriptions SET name = ?, category = ?, amount = ?, cycle = ?, nextRenewal = ?, manageUrl = ?, notes = ?, reminderEnabled = ? WHERE id = ?',
        input.name, input.category, input.amount, input.cycle, input.nextRenewal, input.manageUrl, input.notes, input.reminderEnabled, editing.id,
      );
    } else {
      await db.runAsync(
        'INSERT INTO subscriptions (name, category, amount, cycle, nextRenewal, manageUrl, notes, reminderEnabled, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        input.name, input.category, input.amount, input.cycle, input.nextRenewal, input.manageUrl, input.notes, input.reminderEnabled, new Date().toISOString(),
      );
    }
    const rows = await db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC');
    setSubscriptions(rows);
    await rescheduleRenewalReminders(rows, notificationsEnabled);
    setEditorOpen(false);
    setEditing(null);
  };

  const deleteSubscription = (item: Subscription) => {
    Alert.alert('Delete subscription?', `Remove ${item.name} from SubSathi? This only deletes the tracker entry; it does not cancel your actual subscription.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const db = dbRef.current;
        if (!db) return;
        await db.runAsync('DELETE FROM subscriptions WHERE id = ?', item.id);
        const rows = await db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC');
        setSubscriptions(rows);
        await rescheduleRenewalReminders(rows, notificationsEnabled);
        if (editing?.id === item.id) { setEditing(null); setEditorOpen(false); }
      } },
    ]);
  };

  const openManage = async (item: Subscription) => {
    const url = item.manageUrl.trim();
    if (!url) {
      Alert.alert('Management link not added', `Add the official ${item.name} billing or subscription-management URL by editing this entry.`);
      return;
    }
    const safeUrl = /^https:\/\//i.test(url) ? url : /^http:\/\//i.test(url) ? `https://${url.slice(7)}` : `https://${url}`;
    try {
      const supported = await Linking.canOpenURL(safeUrl);
      if (supported) await Linking.openURL(safeUrl);
      else Alert.alert('Link unavailable', 'This management link could not be opened on this device.');
    } catch {
      Alert.alert('Could not open link', 'Please check the saved URL. Only use the official provider website.');
    }
  };

  const connectGmail = async () => {
    setScanError('');
    setScanLoading(true);
    try {
      const startResponse = await fetch(`${API_BASE_URL}/api/auth/google/url?redirect_target=mobile`);
      const startPayload = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok || !startPayload.authorization_url) {
        throw new Error(startPayload.detail || 'The SubSathi API could not start Google authorization. Check the server URL and OAuth configuration.');
      }
      const result = await WebBrowser.openAuthSessionAsync(String(startPayload.authorization_url), GOOGLE_AUTH_RETURN_URL);
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        setScanError('Google sign-in was cancelled or did not return to SubSathi. You can try again.');
        return;
      }
      const callback = new URL(result.url);
      const callbackError = callback.searchParams.get('error');
      if (callbackError) throw new Error(callbackError);
      const code = callback.searchParams.get('code');
      if (!code) throw new Error('Google returned to SubSathi without a sign-in code. Check the backend callback URL and app scheme.');
      const exchangeResponse = await fetch(`${API_BASE_URL}/api/auth/google/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const exchangePayload = await exchangeResponse.json().catch(() => ({}));
      if (!exchangeResponse.ok || !exchangePayload.session) throw new Error(exchangePayload.detail || 'Could not exchange the one-time sign-in code. Please retry.');
      const token = String(exchangePayload.session);
      const profileResponse = await fetch(`${API_BASE_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
      const profile = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok || !profile.gmail_connected) throw new Error(profile.detail || 'Gmail connection could not be verified by the SubSathi server.');
      await SecureStore.setItemAsync(SESSION_KEY, token);
      setApiSession(token);
      setGmailEmail(profile.gmail_email || profile.email || callback.searchParams.get('email'));
      setScanCandidates([]);
      setSelectedCandidateIds([]);
      Alert.alert('Gmail connected', `Automatic subscription discovery is starting for ${profile.gmail_email || profile.email || 'your Google account'}. Review detections in Email scan before importing any plans.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not connect Gmail. Check your internet connection and API settings.';
      setScanError(message.includes('Network request failed') ? `Cannot reach SubSathi API at ${API_BASE_URL}. Deploy the backend or set EXPO_PUBLIC_API_BASE_URL to your server address.` : message);
    } finally {
      setScanLoading(false);
    }
  };

  const scanGmail = async (sessionOverride?: string) => {
    const session = sessionOverride || apiSession;
    if (!session) { setScanError('Connect Gmail first.'); return; }
    setScanError('');
    setScanLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/gmail/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          setApiSession(null);
          setGmailEmail(null);
        }
        throw new Error(payload.detail || 'Gmail scan failed. Please retry.');
      }
      const mapped: GmailCandidate[] = (payload.candidates || []).map((item: any) => {
        const category = CATEGORIES.some((entry) => entry.name === item.category) ? item.category as Category : 'Other';
        const cycle = CYCLES.includes(item.cycle as Cycle) ? item.cycle as Cycle : 'Unknown';
        return {
          id: Number(item.id), name: String(item.name || 'Unknown service'), category,
          amount: item.amount === null || item.amount === undefined ? null : Number(item.amount),
          cycle, nextRenewal: item.nextRenewal || null, confidence: Number(item.confidence || 0),
          evidenceCount: Number(item.evidenceCount || 1), needsReview: Boolean(item.needsReview),
          manageUrl: String(item.manageUrl || ''), alreadyImported: Boolean(item.alreadyImported),
        };
      });
      const locallyTrackedNames = new Set(subscriptions.map((item) => item.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
      const adjusted = mapped.map((item) => ({ ...item, alreadyImported: item.alreadyImported || locallyTrackedNames.has(item.name.toLowerCase().replace(/[^a-z0-9]/g, '')) }));
      setScanCandidates(adjusted);
      setSelectedCandidateIds(adjusted.filter((item) => !item.alreadyImported && item.amount !== null && item.cycle !== 'Unknown').map((item) => item.id));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not scan Gmail. Please retry.');
    } finally {
      setScanLoading(false);
    }
  };

  // Automatically scan once when a valid Gmail session is restored or newly connected.
  // Entering the Email scan screen still refreshes results on demand.
  useEffect(() => {
    if (!apiSession) {
      autoScanSessionRef.current = null;
      return;
    }
    if (!ready || !gmailEmail || autoScanSessionRef.current === apiSession) return;
    autoScanSessionRef.current = apiSession;
    void scanGmail(apiSession);
  }, [ready, apiSession, gmailEmail]);

  const importGmailCandidates = async () => {
    if (!apiSession || !selectedCandidateIds.length) return;
    setScanError('');
    setScanLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/gmail/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiSession}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: selectedCandidateIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Could not import selected detections.');
      const db = dbRef.current;
      if (!db) throw new Error('Local subscription database is not ready.');
      let imported = 0;
      for (const item of payload.imported || []) {
        const existing = subscriptions.some((local) => local.name.toLowerCase().replace(/[^a-z0-9]/g, '') === String(item.name).toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (existing) continue;
        await db.runAsync(
          'INSERT INTO subscriptions (name, category, amount, cycle, nextRenewal, manageUrl, notes, reminderEnabled, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          String(item.name), CATEGORIES.some((entry) => entry.name === item.category) ? item.category : 'Other', Number(item.amount),
          CYCLES.includes(item.cycle as Cycle) ? item.cycle : 'Monthly', String(item.nextRenewal || ''), String(item.manageUrl || ''),
          String(item.notes || 'Imported from Gmail receipt; verify the billing details.'), 1, new Date().toISOString(),
        );
        imported += 1;
      }
      await loadSubscriptions();
      const importedIds = new Set(selectedCandidateIds);
      setScanCandidates((current) => current.map((item) => importedIds.has(item.id) ? { ...item, alreadyImported: true } : item));
      setSelectedCandidateIds([]);
      if (dbRef.current) {
        const rows = await dbRef.current.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC');
        await rescheduleRenewalReminders(rows, notificationsEnabled);
      }
      Alert.alert('Import complete', `${imported} subscription${imported === 1 ? '' : 's'} added to this device. Please review any missing renewal dates or billing cycles.`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Import failed. Please retry.');
    } finally {
      setScanLoading(false);
    }
  };

  const deleteServerAccount = async () => {
    if (!apiSession) return;
    setScanLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${apiSession}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Could not delete the server account.');
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setApiSession(null); setGmailEmail(null); setScanCandidates([]); setSelectedCandidateIds([]);
      Alert.alert('Server account deleted', 'The Gmail connection and server-side scan data have been deleted. Your locally saved subscription entries remain on this phone; clear them separately in Settings if you want.');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Account deletion failed.');
      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
    } finally { setScanLoading(false); }
  };

  const disconnectGmail = async () => {
    if (!apiSession) return;
    setScanLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/gmail/connection`, { method: 'DELETE', headers: { Authorization: `Bearer ${apiSession}` } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Could not disconnect Gmail on the server.');
      }
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setApiSession(null); setGmailEmail(null); setScanCandidates([]); setSelectedCandidateIds([]);
      toastLocal('Gmail disconnected. Locally imported plans remain on this device.');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Disconnect failed.');
    } finally { setScanLoading(false); }
  };

  const toastLocal = (message: string) => Alert.alert('SubSathi', message);

  const openScanner = () => {
    setScanError('');
    setScanInfoOpen(true);
    if (apiSession) setTimeout(() => { void scanGmail(); }, 250);
  };

  const renderSubscriptionCard = (item: Subscription, compact = false) => {
    const meta = categoryMeta(item.category);
    const days = daysUntil(item.nextRenewal);
    const tone = days < 0 ? 'red' : days <= 7 ? 'orange' : 'grey';
    return (
      <Pressable key={item.id} onPress={() => openEdit(item)} style={({ pressed }) => [styles.subscriptionCard, compact && styles.compactCard, pressed && { opacity: 0.88 }]}>
        <View style={[styles.serviceIcon, { backgroundColor: meta.tint }]}><Text style={styles.serviceEmoji}>{meta.emoji}</Text></View>
        <View style={styles.subscriptionMain}>
          <Text style={styles.serviceName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.serviceSub}>{item.category} · {item.cycle}</Text>
          <View style={styles.duePillRow}><Pill tone={tone}>{dueLabel(item.nextRenewal)}</Pill></View>
        </View>
        <View style={styles.subscriptionRight}>
          <Text style={styles.serviceAmount}>{money(item.amount)}</Text>
          <Text style={styles.serviceSub}>{item.cycle === 'Yearly' ? '/ year' : item.cycle === 'Monthly' ? '/ month' : item.cycle === 'Quarterly' ? '/ quarter' : '/ week'}</Text>
          {!compact ? <Pressable onPress={(event) => { event.stopPropagation(); void openManage(item); }} style={styles.manageMini}><Text style={styles.manageMiniText}>Manage ↗</Text></Pressable> : null}
        </View>
      </Pressable>
    );
  };

  const renderHome = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.homeTopRow}>
        <View style={styles.brandLockup}><BrandMark size={43} /><View><Text style={styles.brandName}>SubSathi</Text><Text style={styles.brandTagline}>Your money, under control.</Text></View></View>
        <Pressable onPress={() => setTab('Settings')} style={styles.profileCircle}><Text style={styles.profileText}>H</Text></Pressable>
      </View>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}><View><Text style={styles.heroEyebrow}>YOUR RECURRING SPEND</Text><Text style={styles.heroAmount}>{money(activeMonthly)}<Text style={styles.heroPer}> / mo</Text></Text></View><View style={styles.heroIconBubble}><Text style={{ fontSize: 25 }}>↻</Text></View></View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStatsRow}>
          <View><Text style={styles.heroStatLabel}>Yearly estimate</Text><Text style={styles.heroStatValue}>{money(activeAnnual)}</Text></View>
          <View style={styles.heroStatsSeparator} />
          <View><Text style={styles.heroStatLabel}>Tracked plans</Text><Text style={styles.heroStatValue}>{subscriptions.length}</Text></View>
          <View style={styles.heroStatsSeparator} />
          <View><Text style={styles.heroStatLabel}>Due in 30 days</Text><Text style={styles.heroStatValue}>{nextThirtyDays.length}</Text></View>
        </View>
      </View>
      <View style={styles.quickActionRow}>
        <Pressable style={styles.quickAction} onPress={openNew}><View style={[styles.quickActionIcon, { backgroundColor: C.greenPale }]}><Text style={{ color: C.greenDark, fontSize: 22, fontWeight: '700' }}>＋</Text></View><Text style={styles.quickActionLabel}>Add plan</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={openScanner}><View style={[styles.quickActionIcon, { backgroundColor: C.bluePale }]}><Text style={{ fontSize: 21 }}>✉</Text></View><Text style={styles.quickActionLabel}>Email scan</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => setTab('Insights')}><View style={[styles.quickActionIcon, { backgroundColor: C.orangePale }]}><Text style={{ fontSize: 21 }}>↘</Text></View><Text style={styles.quickActionLabel}>Find savings</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => setTab('Subscriptions')}><View style={[styles.quickActionIcon, { backgroundColor: '#F1EAFE' }]}><Text style={{ fontSize: 21 }}>▦</Text></View><Text style={styles.quickActionLabel}>All plans</Text></Pressable>
      </View>
      <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Coming up</Text><Pressable onPress={() => setTab('Subscriptions')}><Text style={styles.sectionAction}>View all</Text></Pressable></View>
      {upcoming.length ? <View style={styles.listCard}>{upcoming.slice(0, 4).map((item, index) => <View key={item.id}>{renderSubscriptionCard(item, true)}{index < Math.min(upcoming.length, 4) - 1 ? <View style={styles.innerDivider} /> : null}</View>)}</View> : <View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={{ fontSize: 26 }}>🗓️</Text></View><Text style={styles.emptyTitle}>No renewals coming up</Text><Text style={styles.emptyBody}>Add a subscription and SubSathi will help you keep an eye on its renewal date.</Text><PrimaryButton title="Add your first plan" onPress={openNew} /></View>}
      <View style={styles.tipCard}><View style={styles.tipIcon}><Text style={{ fontSize: 20 }}>💡</Text></View><View style={styles.tipCopy}><Text style={styles.tipTitle}>Small charges add up</Text><Text style={styles.tipBody}>Review your recurring plans once a month. Cancel unused plans directly with the provider.</Text></View></View>
      <Text style={styles.footerNote}>{gmailEmail ? `Gmail connected: ${gmailEmail}. Scan billing emails to discover plans automatically.` : 'Your tracker is stored on this device. Connect Gmail to start automatic subscription discovery.'}</Text>
    </ScrollView>
  );

  const renderSubscriptions = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageHeader}><Text style={styles.pageEyebrow}>YOUR SERVICES</Text><Text style={styles.pageTitle}>Subscriptions</Text><Text style={styles.pageSub}>{subscriptions.length} plan{subscriptions.length === 1 ? '' : 's'} tracked · {money(activeMonthly)} / month equivalent</Text></View>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search subscriptions..." placeholderTextColor="#91A0A4" style={styles.searchInput} returnKeyType="search" /><Pressable onPress={openNew} style={styles.searchAdd}><Text style={styles.searchAddText}>＋</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['All', ...CATEGORIES.map((category) => category.name)] as ('All' | Category)[]).map((name) => <Pressable key={name} onPress={() => setFilter(name)} style={[styles.filterChip, filter === name && styles.filterChipActive]}><Text style={[styles.filterText, filter === name && styles.filterTextActive]}>{name}</Text></Pressable>)}
      </ScrollView>
      {filtered.length ? <View style={styles.listCard}>{filtered.map((item, index) => <View key={item.id}>{renderSubscriptionCard(item)}<View style={styles.cardActionsRow}><Pressable onPress={() => openEdit(item)}><Text style={styles.cardAction}>Edit details</Text></Pressable><Text style={styles.actionDot}>·</Text><Pressable onPress={() => deleteSubscription(item)}><Text style={[styles.cardAction, { color: C.red }]}>Remove tracker</Text></Pressable></View>{index < filtered.length - 1 ? <View style={styles.listDivider} /> : null}</View>)}</View> : <View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={{ fontSize: 26 }}>🔎</Text></View><Text style={styles.emptyTitle}>{subscriptions.length ? 'No matches found' : 'Your list starts here'}</Text><Text style={styles.emptyBody}>{subscriptions.length ? 'Try another search or category.' : 'Add recurring plans like OTT, software, storage, gym, broadband and memberships.'}</Text>{!subscriptions.length ? <PrimaryButton title="Add subscription" onPress={openNew} /> : <GhostButton title="Clear filters" onPress={() => { setSearch(''); setFilter('All'); }} />}</View>}
      <View style={styles.noteBanner}><Text style={styles.noteBannerIcon}>ⓘ</Text><Text style={styles.noteBannerText}>Removing a plan here only removes it from your tracker. It does not cancel the provider's subscription.</Text></View>
    </ScrollView>
  );

  const renderInsights = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageHeader}><Text style={styles.pageEyebrow}>YOUR MONEY SNAPSHOT</Text><Text style={styles.pageTitle}>Insights</Text><Text style={styles.pageSub}>Know where your recurring money goes.</Text></View>
      <View style={styles.insightHero}><Text style={styles.insightHeroLabel}>ESTIMATED YEARLY COMMITMENT</Text><Text style={styles.insightHeroAmount}>{money(activeAnnual)}</Text><Text style={styles.insightHeroNote}>Based on the plans you have added. Actual charges may vary.</Text><View style={styles.insightMetricRow}><View style={styles.insightMetric}><Text style={styles.insightMetricLabel}>Monthly equivalent</Text><Text style={styles.insightMetricValue}>{money(activeMonthly)}</Text></View><View style={styles.insightMetric}><Text style={styles.insightMetricLabel}>Due this month</Text><Text style={styles.insightMetricValue}>{money(currentMonthDue)}</Text></View></View></View>
      <SectionTitle title="Spend by category" />
      {categorySpend.length ? <View style={styles.panel}>{categorySpend.map((cat) => <View key={cat.name} style={styles.categorySpendRow}><View style={[styles.categorySpendIcon, { backgroundColor: cat.tint }]}><Text>{cat.emoji}</Text></View><View style={styles.categorySpendMain}><View style={styles.categorySpendNameRow}><Text style={styles.categorySpendName}>{cat.name}</Text><Text style={styles.categorySpendAmount}>{money(cat.amount)}<Text style={styles.categoryMonthly}> / mo</Text></Text></View><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, (cat.amount / (categorySpend[0]?.amount || 1)) * 100)}%` }]} /></View></View></View>)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Insights will appear here</Text><Text style={styles.emptyBody}>Add a few subscriptions to see your spending breakdown.</Text><PrimaryButton title="Add a plan" onPress={openNew} /></View>}
      <SectionTitle title="Things to review" />
      <View style={styles.panel}>
        {nextThirtyDays.length ? <View style={styles.reviewRow}><View style={[styles.reviewIcon, { backgroundColor: C.orangePale }]}><Text>⏰</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>{nextThirtyDays.length} upcoming renewal{nextThirtyDays.length === 1 ? '' : 's'}</Text><Text style={styles.reviewBody}>Review the plan and price before the charge date.</Text></View><Text style={styles.reviewArrow}>›</Text></View> : <View style={styles.reviewRow}><View style={[styles.reviewIcon, { backgroundColor: C.greenPale }]}><Text>✓</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>No renewals due in 30 days</Text><Text style={styles.reviewBody}>Add renewal dates to get a more useful view.</Text></View></View>}
        <View style={styles.innerDivider} />
        <View style={styles.reviewRow}><View style={[styles.reviewIcon, { backgroundColor: C.bluePale }]}><Text>🔍</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Check for duplicate plans</Text><Text style={styles.reviewBody}>Compare your streaming, storage and music services yourself. Automatic duplicate detection is on the roadmap.</Text></View></View>
      </View>
      <Text style={styles.footerNote}>SubSathi shows estimates based on your entries; it does not have access to your bank or provider billing records in this MVP.</Text>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageHeader}><Text style={styles.pageEyebrow}>YOUR APP</Text><Text style={styles.pageTitle}>Settings</Text><Text style={styles.pageSub}>Privacy, alerts and connected services.</Text></View>
      <View style={styles.profilePanel}><BrandMark size={52} /><View style={{ flex: 1 }}><Text style={styles.profilePanelTitle}>SubSathi</Text><Text style={styles.profilePanelSub}>MVP · Version 0.1.0</Text></View><Pill tone="green">On device</Pill></View>
      <View style={styles.panel}>
        <Text style={styles.settingsSectionLabel}>REMINDERS</Text>
        <View style={styles.settingRow}><View style={styles.settingIcon}><Text>🔔</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Renewal notifications</Text><Text style={styles.settingBody}>Remind two days before, at 9:00 AM when permitted.</Text></View><Switch value={notificationsEnabled} onValueChange={(value) => { setNotificationsEnabled(value); const db = dbRef.current; if (db) void db.runAsync("INSERT INTO app_settings (key, value) VALUES ('notificationsEnabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", value ? 'true' : 'false'); void rescheduleRenewalReminders(subscriptions, value); }} trackColor={{ false: '#CBD5D4', true: '#A7E4CD' }} thumbColor={notificationsEnabled ? C.green : '#F6F7F7'} /></View>
        <View style={styles.innerDivider} />
        <Text style={styles.settingsSectionLabel}>CONNECTED SERVICES</Text>
        <Pressable onPress={openScanner} style={styles.settingRow}><View style={[styles.settingIcon, { backgroundColor: C.bluePale }]}><Text>✉</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Gmail auto-detection</Text><Text style={styles.settingBody}>{gmailEmail ? `Connected to ${gmailEmail} · scan receipts on demand.` : 'Not connected · secure Google OAuth setup required.'}</Text></View><Text style={styles.settingArrow}>›</Text></Pressable>
        <View style={styles.innerDivider} />
        <View style={styles.settingRow}><View style={styles.settingIcon}><Text>🔐</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Local-first data</Text><Text style={styles.settingBody}>{gmailEmail ? 'Tracker entries remain on this device. Gmail credentials are encrypted on the SubSathi server; receipt contents are parsed for subscription evidence and not saved as full messages.' : 'This MVP stores your tracker entries in local SQLite. No bank, SMS or payment account is connected.'}</Text></View></View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.settingsSectionLabel}>DATA MANAGEMENT</Text>
        <Pressable style={styles.settingsActionRow} onPress={() => Alert.alert('Export is not available yet', 'CSV export is planned for a later MVP update.')}><Text style={styles.settingsAction}>Export my subscription list</Text><Text style={styles.settingArrow}>›</Text></Pressable>
        <View style={styles.innerDivider} />
        <Pressable style={styles.settingsActionRow} onPress={() => Alert.alert('Clear all tracker data?', 'This permanently removes all subscriptions stored in this app. It will not cancel any real subscription.', [{ text: 'Keep data', style: 'cancel' }, { text: 'Clear all', style: 'destructive', onPress: async () => { const db = dbRef.current; if (!db) return; await db.runAsync('DELETE FROM subscriptions'); await Notifications.cancelAllScheduledNotificationsAsync(); await loadSubscriptions(); setTab('Home'); } }])}><Text style={[styles.settingsAction, { color: C.red }]}>Clear all tracker data</Text><Text style={styles.settingArrow}>›</Text></Pressable>
        {apiSession ? <><View style={styles.innerDivider} /><Pressable style={styles.settingsActionRow} onPress={() => Alert.alert('Delete server account?', 'This removes the SubSathi server account, encrypted Gmail credentials and cached scan candidates. Tracker entries saved locally on this phone will remain.', [{ text: 'Keep account', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: () => { void deleteServerAccount(); } }])}><Text style={[styles.settingsAction, { color: C.red }]}>Delete SubSathi server account</Text><Text style={styles.settingArrow}>›</Text></Pressable></> : null}
      </View>
      <Text style={styles.footerNote}>Before a public launch, add a privacy policy, account/data deletion flow, production error handling and required Google OAuth verification.</Text>
    </ScrollView>
  );

  if (!ready) return <SafeAreaView style={styles.loadingScreen}><StatusBar barStyle="dark-content" backgroundColor={C.cream} /><BrandMark size={58} /><Text style={styles.loadingTitle}>SubSathi</Text><ActivityIndicator color={C.green} style={{ marginTop: 12 }} /><Text style={styles.loadingSub}>Getting your subscriptions ready...</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <View style={styles.appContent}>
        {tab === 'Home' ? renderHome() : tab === 'Subscriptions' ? renderSubscriptions() : tab === 'Insights' ? renderInsights() : renderSettings()}
      </View>
      <View style={styles.bottomNav}>
        {([['Home', '⌂'], ['Subscriptions', '▤'], ['Insights', '◔'], ['Settings', '⚙']] as [Tab, string][]).map(([name, icon]) => <Pressable key={name} onPress={() => setTab(name)} style={styles.navItem}><View style={[styles.navIconWrap, tab === name && styles.navIconActive]}><Text style={[styles.navIcon, tab === name && styles.navIconSelected]}>{icon}</Text></View><Text style={[styles.navLabel, tab === name && styles.navLabelSelected]}>{name}</Text></Pressable>)}
      </View>
      <SubscriptionEditor visible={editorOpen} initial={editing} onClose={() => { setEditorOpen(false); setEditing(null); }} onSave={saveSubscription} onDelete={editing ? () => deleteSubscription(editing) : undefined} />
      <Modal visible={scanInfoOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setScanInfoOpen(false)}>
        <SafeAreaView style={styles.editorSafeArea}>
          <View style={styles.editorHeader}><Pressable onPress={() => setScanInfoOpen(false)} style={styles.editorClose}><Text style={styles.editorCloseText}>✕</Text></Pressable><View style={{ flex: 1 }}><Text style={styles.editorTitle}>Automatic discovery</Text><Text style={styles.editorSubtitle}>Find subscriptions from billing emails</Text></View><Pill tone={gmailEmail ? 'green' : 'orange'}>{gmailEmail ? 'Connected' : 'Not connected'}</Pill></View>
          <ScrollView contentContainerStyle={styles.editorScroll} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 16 }}>
              <View style={[styles.infoModalIcon, { marginBottom: 12 }]}><Text style={{ fontSize: 27 }}>✉️</Text></View>
              <Text style={styles.modalTitle}>{gmailEmail ? 'Gmail is connected' : 'Stop adding every plan manually'}</Text>
              <Text style={styles.modalIntro}>{gmailEmail ? `Connected account: ${gmailEmail}. Scan relevant billing emails, then review the detected subscriptions before importing them to this phone.` : 'Connect through Google’s official secure consent screen. SubSathi will search for billing receipts, renewal notices and recurring payment emails. It never asks for your Gmail password.'}</Text>
              <View style={styles.infoChecklist}>
                <Text style={styles.infoChecklistLine}>✓ Read billing-related emails only using Gmail search</Text>
                <Text style={styles.infoChecklistLine}>✓ Detect supported services, amounts and cycle hints</Text>
                <Text style={styles.infoChecklistLine}>✓ Never invent a missing renewal date</Text>
                <Text style={styles.infoChecklistLine}>✓ Review detections before importing</Text>
              </View>
              {scanError ? <View style={{ borderRadius: 12, backgroundColor: C.redPale, padding: 12, marginBottom: 12 }}><Text style={{ color: C.red, fontSize: 11, lineHeight: 16 }}>{scanError}</Text></View> : null}
              {scanLoading ? <View style={{ paddingVertical: 18, alignItems: 'center' }}><ActivityIndicator color={C.green} size="large" /><Text style={styles.settingBody}>{gmailEmail ? 'Scanning billing-related messages…' : 'Opening Google authorization…'}</Text></View> : null}
              {!gmailEmail ? <PrimaryButton title="Connect Gmail securely" onPress={() => { void connectGmail(); }} /> : <View style={{ gap: 9 }}><PrimaryButton title={scanLoading ? 'Scanning…' : 'Scan my billing emails'} onPress={() => { if (!scanLoading) void scanGmail(); }} /><GhostButton title="Disconnect Gmail" onPress={() => { Alert.alert('Disconnect Gmail?', 'SubSathi will delete the server-stored Gmail credential and cached scan results. Plans already imported to this phone will remain.', [{ text: 'Keep connected', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: () => { void disconnectGmail(); } }]); }} /></View>}
            </View>
            {gmailEmail && scanCandidates.length > 0 ? <View style={{ marginBottom: 18 }}><SectionTitle title="Detected subscriptions" action={`${scanCandidates.filter((item) => !item.alreadyImported && item.amount !== null && item.cycle !== 'Unknown').length} importable`} /><Text style={styles.fieldHint}>Select plans to import. Missing price or billing cycle needs manual confirmation. Estimates are never treated as verified renewal dates.</Text>{scanCandidates.map((candidate) => {
              const selected = selectedCandidateIds.includes(candidate.id);
              const eligible = !candidate.alreadyImported && candidate.amount !== null && candidate.amount > 0 && candidate.cycle !== 'Unknown';
              const categoryMetaItem = categoryMeta(candidate.category);
              return <Pressable key={candidate.id} disabled={!eligible} onPress={() => setSelectedCandidateIds((current) => selected ? current.filter((id) => id !== candidate.id) : [...current, candidate.id])} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.white, borderColor: selected ? C.green : C.line, borderWidth: selected ? 1.5 : 1, borderRadius: 15, padding: 12, marginTop: 9, opacity: eligible ? 1 : 0.6 }}><View style={{ width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: selected ? C.green : '#CBD7D2', backgroundColor: selected ? C.green : C.white, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.white, fontSize: 14, fontWeight: '900' }}>{selected ? '✓' : ''}</Text></View><View style={[styles.serviceIcon, { backgroundColor: categoryMetaItem.tint }]}><Text style={styles.serviceEmoji}>{categoryMetaItem.emoji}</Text></View><View style={{ flex: 1 }}><Text style={styles.serviceName}>{candidate.name}</Text><Text style={styles.serviceSub}>{candidate.evidenceCount} billing email(s) · Confidence {candidate.confidence}%</Text><Text style={styles.serviceSub}>{candidate.nextRenewal ? `Renewal: ${formatDate(candidate.nextRenewal)}` : 'Renewal date not found — review required'}{candidate.cycle === 'Unknown' ? ' · Billing cycle not clear' : ` · ${candidate.cycle}`}</Text>{candidate.alreadyImported ? <Pill tone="grey">Already tracked</Pill> : candidate.needsReview ? <Pill tone="orange">Check details</Pill> : <Pill tone="green">Detected</Pill>}</View><View style={{ alignItems: 'flex-end' }}><Text style={styles.serviceAmount}>{candidate.amount !== null ? money(candidate.amount) : 'Price ?'}</Text><Text style={styles.serviceSub}>{candidate.amount !== null ? `per ${candidate.cycle.toLowerCase()}` : 'Need review'}</Text></View></Pressable>;
            })}<View style={{ marginTop: 14 }}><PrimaryButton title={scanLoading ? 'Importing…' : `Import ${selectedCandidateIds.length} selected`} onPress={() => { if (!scanLoading) void importGmailCandidates(); }} /></View></View> : null}
            {gmailEmail && !scanCandidates.length && !scanLoading ? <View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={{ fontSize: 26 }}>🔎</Text></View><Text style={styles.emptyTitle}>Ready to find your subscriptions</Text><Text style={styles.emptyBody}>Scan billing emails to discover supported plans. Some providers may not include their renewal price or date in the email.</Text></View> : null}
            <Text style={styles.formPrivacyNote}>Only the supported metadata from billing-related email results is retained by the server. Full email bodies are processed for extraction and are not stored by the scanner. Disconnect access if you no longer want SubSathi to scan Gmail.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function SubscriptionEditor({ visible, initial, onClose, onSave, onDelete }: {
  visible: boolean;
  initial: Subscription | null;
  onClose: () => void;
  onSave: (input: SubscriptionInput) => Promise<void>;
  onDelete?: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Entertainment');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<Cycle>('Monthly');
  const [nextRenewal, setNextRenewal] = useState(localDateString(new Date(Date.now() + 7 * 86400000)));
  const [manageUrl, setManageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setCategory(initial?.category ?? 'Entertainment');
    setAmount(initial ? String(initial.amount) : '');
    setCycle(initial?.cycle ?? 'Monthly');
    setNextRenewal(initial?.nextRenewal ?? localDateString(new Date(Date.now() + 7 * 86400000)));
    setManageUrl(initial?.manageUrl ?? '');
    setNotes(initial?.notes ?? '');
    setReminderEnabled(initial ? Boolean(initial.reminderEnabled) : true);
    setSaving(false);
  }, [visible, initial]);

  const submit = async () => {
    const numericAmount = Number(amount.replace(/,/g, '').trim());
    if (!name.trim()) { Alert.alert('Add a service name', 'For example, Adobe, Netflix, Hotstar or Gym.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10000000) { Alert.alert('Check the amount', 'Enter a valid amount greater than ₹0.'); return; }
    if (!validDate(nextRenewal)) { Alert.alert('Check the renewal date', 'Use the format YYYY-MM-DD, for example 2026-11-18.'); return; }
    if (manageUrl.trim() && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(manageUrl.trim())) { Alert.alert('Check the management link', 'Enter a website address such as https://example.com/account.'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), category, amount: numericAmount, cycle, nextRenewal,
        manageUrl: manageUrl.trim(), notes: notes.trim(), reminderEnabled: reminderEnabled ? 1 : 0,
      });
    } catch (error) {
      Alert.alert('Could not save', 'Please try again. Your existing entries have not been changed.');
      console.warn(error);
    } finally { setSaving(false); }
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.editorSafeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editorHeader}><Pressable onPress={onClose} style={styles.editorClose}><Text style={styles.editorCloseText}>✕</Text></Pressable><View style={{ flex: 1 }}><Text style={styles.editorTitle}>{initial ? 'Edit subscription' : 'Add subscription'}</Text><Text style={styles.editorSubtitle}>Keep the details handy. You can change them anytime.</Text></View></View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorScroll}>
          <Text style={styles.fieldLabel}>SERVICE NAME *</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Adobe Creative Cloud" placeholderTextColor="#97A5A8" style={styles.input} maxLength={70} autoCapitalize="words" />
          <Text style={styles.fieldLabel}>CATEGORY</Text><View style={styles.categoryGrid}>{CATEGORIES.map((cat) => <Pressable key={cat.name} onPress={() => setCategory(cat.name)} style={[styles.categoryOption, category === cat.name && styles.categoryOptionActive]}><Text style={{ fontSize: 18 }}>{cat.emoji}</Text><Text style={[styles.categoryOptionText, category === cat.name && styles.categoryOptionTextActive]}>{cat.name}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>PRICE (INR) *</Text><View style={styles.amountInputWrap}><Text style={styles.rupeeSign}>₹</Text><TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#97A5A8" style={styles.amountInput} keyboardType="decimal-pad" /></View>
          <Text style={styles.fieldLabel}>BILLING CYCLE</Text><View style={styles.cycleRow}>{CYCLES.map((item) => <Pressable key={item} onPress={() => setCycle(item)} style={[styles.cycleChip, item === cycle && styles.cycleChipActive]}><Text style={[styles.cycleChipText, item === cycle && styles.cycleChipTextActive]}>{item}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>NEXT RENEWAL DATE *</Text><TextInput value={nextRenewal} onChangeText={setNextRenewal} placeholder="YYYY-MM-DD" placeholderTextColor="#97A5A8" style={styles.input} autoCapitalize="none" maxLength={10} />
          <Text style={styles.fieldHint}>Enter the date shown by the provider. Format: YYYY-MM-DD.</Text>
          <Text style={styles.fieldLabel}>OFFICIAL MANAGE / RENEW LINK</Text><TextInput value={manageUrl} onChangeText={setManageUrl} placeholder="https://provider.com/account" placeholderTextColor="#97A5A8" style={styles.input} autoCapitalize="none" keyboardType="url" autoCorrect={false} />
          <Text style={styles.fieldHint}>Use the provider's official account or billing page. SubSathi does not process payments.</Text>
          <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text><TextInput value={notes} onChangeText={setNotes} placeholder="Plan name, billing account, cancellation notes..." placeholderTextColor="#97A5A8" style={[styles.input, styles.notesInput]} multiline maxLength={400} />
          <View style={styles.reminderRow}><View style={{ flex: 1 }}><Text style={styles.settingTitle}>Renewal reminder</Text><Text style={styles.settingBody}>Notify me two days before, if permissions allow.</Text></View><Switch value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ false: '#CBD5D4', true: '#A7E4CD' }} thumbColor={reminderEnabled ? C.green : '#F6F7F7'} /></View>
          <PrimaryButton title={saving ? 'Saving...' : initial ? 'Save changes' : 'Save subscription'} onPress={() => { if (!saving) void submit(); }} />
          {initial && onDelete ? <Pressable onPress={onDelete} style={styles.deleteFromEditor}><Text style={styles.deleteFromEditorText}>Remove from tracker</Text></Pressable> : null}
          <Text style={styles.formPrivacyNote}>Details stay in local app storage in this MVP. This does not cancel, renew or change your real provider plan.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const pillGreen = StyleSheet.create({ base: { alignSelf: 'flex-start', backgroundColor: C.greenPale, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, text: { fontSize: 10, fontWeight: '700', color: C.greenDark } });
const pillOrange = StyleSheet.create({ base: { alignSelf: 'flex-start', backgroundColor: C.orangePale, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, text: { fontSize: 10, fontWeight: '700', color: '#9C5E0C' } });
const pillGrey = StyleSheet.create({ base: { alignSelf: 'flex-start', backgroundColor: '#EEF2F1', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, text: { fontSize: 10, fontWeight: '700', color: '#687B81' } });
const pillRed = StyleSheet.create({ base: { alignSelf: 'flex-start', backgroundColor: C.redPale, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, text: { fontSize: 10, fontWeight: '700', color: C.red } });

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.cream }, appContent: { flex: 1 }, scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream }, loadingTitle: { marginTop: 12, color: C.ink, fontSize: 24, fontWeight: '800' }, loadingSub: { marginTop: 10, fontSize: 13, color: C.muted },
  brandMark: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.green, overflow: 'hidden' }, brandName: { fontSize: 20, color: C.ink, fontWeight: '800', letterSpacing: -0.6 }, brandTagline: { marginTop: 2, fontSize: 11, color: C.muted }, brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 }, homeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 }, profileCircle: { height: 40, width: 40, borderRadius: 20, backgroundColor: '#E1ECE8', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D2E1DB' }, profileText: { color: C.greenDark, fontWeight: '800', fontSize: 16 },
  heroCard: { borderRadius: 24, backgroundColor: C.navy, padding: 20, overflow: 'hidden' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroEyebrow: { fontSize: 10, letterSpacing: 1.2, color: '#B7CDD2', fontWeight: '700' }, heroAmount: { marginTop: 7, fontSize: 31, fontWeight: '800', color: C.white, letterSpacing: -1 }, heroPer: { fontSize: 13, fontWeight: '500', color: '#B7CDD2', letterSpacing: 0 }, heroIconBubble: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#18434A', alignItems: 'center', justifyContent: 'center' }, heroDivider: { height: 1, backgroundColor: '#2C4650', marginVertical: 18 }, heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroStatLabel: { color: '#B7CDD2', fontSize: 10, marginBottom: 6 }, heroStatValue: { color: C.white, fontSize: 13, fontWeight: '700' }, heroStatsSeparator: { width: 1, height: 30, backgroundColor: '#2C4650', marginHorizontal: 3 },
  quickActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 24 }, quickAction: { alignItems: 'center', width: '24%' }, quickActionIcon: { height: 52, width: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, quickActionLabel: { color: C.ink, fontSize: 11, fontWeight: '600', marginTop: 8 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 1 }, sectionTitle: { color: C.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 }, sectionAction: { color: C.greenDark, fontSize: 12, fontWeight: '700' },
  listCard: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 4 }, subscriptionCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 11 }, compactCard: { paddingVertical: 11 }, serviceIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, serviceEmoji: { fontSize: 20 }, subscriptionMain: { flex: 1, minWidth: 0 }, serviceName: { color: C.ink, fontSize: 13, fontWeight: '800' }, serviceSub: { color: C.muted, fontSize: 10, marginTop: 4 }, duePillRow: { marginTop: 7 }, subscriptionRight: { alignItems: 'flex-end', minWidth: 75 }, serviceAmount: { color: C.ink, fontSize: 13, fontWeight: '800' }, manageMini: { paddingTop: 8, paddingBottom: 2 }, manageMiniText: { color: C.greenDark, fontSize: 10, fontWeight: '700' }, innerDivider: { height: 1, backgroundColor: '#EEF2F1', marginLeft: 0 }, listDivider: { height: 1, backgroundColor: C.line }, cardActionsRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 11, gap: 8 }, cardAction: { fontSize: 11, color: C.greenDark, fontWeight: '700' }, actionDot: { color: '#ADB9BA' },
  emptyCard: { paddingHorizontal: 24, paddingVertical: 28, borderRadius: 20, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', backgroundColor: C.white, alignItems: 'center' }, emptyIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.greenPale, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, emptyTitle: { textAlign: 'center', color: C.ink, fontSize: 16, fontWeight: '800' }, emptyBody: { textAlign: 'center', color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 17 }, primaryButton: { backgroundColor: C.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 14, minHeight: 47 }, primaryButtonSmall: { minHeight: 38, paddingVertical: 9 }, primaryButtonText: { color: C.white, fontSize: 13, fontWeight: '800' }, ghostButton: { borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 }, ghostButtonText: { color: C.ink, fontSize: 12, fontWeight: '700' }, tipCard: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 15, padding: 14, backgroundColor: '#EAF4F0', borderRadius: 16, gap: 10 }, tipIcon: { width: 36, height: 36, backgroundColor: C.white, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, tipCopy: { flex: 1 }, tipTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, tipBody: { marginTop: 5, color: '#56716C', fontSize: 11, lineHeight: 17 }, footerNote: { color: '#8B999C', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 16, marginHorizontal: 8 },
  bottomNav: { height: 72, flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 8, justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'android' ? 4 : 0 }, navItem: { alignItems: 'center', justifyContent: 'center', width: '25%', gap: 3 }, navIconWrap: { height: 30, minWidth: 48, borderRadius: 13, justifyContent: 'center', alignItems: 'center' }, navIconActive: { backgroundColor: C.greenPale }, navIcon: { color: '#829297', fontSize: 21, fontWeight: '600' }, navIconSelected: { color: C.greenDark }, navLabel: { color: '#89999D', fontSize: 9, fontWeight: '600' }, navLabelSelected: { color: C.greenDark, fontWeight: '800' },
  pageHeader: { marginTop: 9, marginBottom: 20 }, pageEyebrow: { color: C.greenDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 }, pageTitle: { color: C.ink, fontSize: 29, fontWeight: '800', letterSpacing: -1 }, pageSub: { color: C.muted, fontSize: 12, marginTop: 6, lineHeight: 18 }, searchBox: { height: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.line, paddingLeft: 13, paddingRight: 7, marginBottom: 13 }, searchIcon: { fontSize: 26, color: '#8B9A9E', marginRight: 9 }, searchInput: { flex: 1, fontSize: 13, color: C.ink, paddingVertical: 7 }, searchAdd: { width: 37, height: 37, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }, searchAddText: { color: C.white, fontSize: 24, fontWeight: '500', marginTop: -2 }, filterRow: { gap: 7, paddingBottom: 14 }, filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, filterChipActive: { backgroundColor: C.navy, borderColor: C.navy }, filterText: { fontSize: 11, color: C.muted, fontWeight: '700' }, filterTextActive: { color: C.white }, noteBanner: { marginTop: 14, padding: 13, backgroundColor: C.bluePale, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, noteBannerIcon: { color: '#3865A8', fontWeight: '800' }, noteBannerText: { color: '#496B91', fontSize: 10, lineHeight: 16, flex: 1 },
  insightHero: { backgroundColor: C.navy, borderRadius: 22, padding: 20, marginBottom: 23 }, insightHeroLabel: { color: '#B7CDD2', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, insightHeroAmount: { color: C.white, fontSize: 31, fontWeight: '800', marginTop: 7, letterSpacing: -1 }, insightHeroNote: { color: '#B7CDD2', fontSize: 10, marginTop: 6, lineHeight: 15 }, insightMetricRow: { flexDirection: 'row', gap: 12, borderTopColor: '#2C4650', borderTopWidth: 1, marginTop: 17, paddingTop: 15 }, insightMetric: { flex: 1 }, insightMetricLabel: { color: '#B7CDD2', fontSize: 10 }, insightMetricValue: { color: C.white, fontSize: 14, fontWeight: '800', marginTop: 5 }, panel: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 15, paddingVertical: 7, marginBottom: 21 }, categorySpendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 11 }, categorySpendIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, categorySpendMain: { flex: 1 }, categorySpendNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, categorySpendName: { color: C.ink, fontSize: 12, fontWeight: '700' }, categorySpendAmount: { color: C.ink, fontSize: 11, fontWeight: '800' }, categoryMonthly: { color: C.muted, fontWeight: '500', fontSize: 9 }, barTrack: { height: 5, backgroundColor: '#EEF2F1', borderRadius: 5, overflow: 'hidden', marginTop: 9 }, barFill: { height: 5, borderRadius: 5, backgroundColor: C.green }, reviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 }, reviewIcon: { height: 38, width: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, reviewCopy: { flex: 1 }, reviewTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, reviewBody: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 4 }, reviewArrow: { color: C.muted, fontSize: 24 },
  profilePanel: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 16 }, profilePanelTitle: { color: C.ink, fontSize: 15, fontWeight: '800' }, profilePanelSub: { color: C.muted, fontSize: 11, marginTop: 4 }, settingsSectionLabel: { color: '#829398', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 13, marginBottom: 5 }, settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 }, settingIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#EFF4F2', alignItems: 'center', justifyContent: 'center' }, settingCopy: { flex: 1 }, settingTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, settingBody: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, settingArrow: { color: '#8DA0A4', fontSize: 23, paddingLeft: 4 }, settingsActionRow: { paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, settingsAction: { color: C.ink, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9, 28, 36, 0.48)', justifyContent: 'center', alignItems: 'center', padding: 22 }, infoModal: { backgroundColor: C.white, borderRadius: 25, padding: 23, width: '100%', maxWidth: 430 }, infoModalIcon: { width: 58, height: 58, backgroundColor: C.bluePale, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }, modalTitle: { color: C.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.6 }, modalIntro: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 10 }, infoChecklist: { gap: 11, backgroundColor: C.cream, borderRadius: 15, padding: 14, marginTop: 16, marginBottom: 18 }, infoChecklistLine: { color: C.ink, fontSize: 11, fontWeight: '600' },
  editorSafeArea: { flex: 1, backgroundColor: C.cream }, editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.white }, editorClose: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F0F4F3', alignItems: 'center', justifyContent: 'center' }, editorCloseText: { color: C.ink, fontSize: 17 }, editorTitle: { color: C.ink, fontSize: 18, fontWeight: '800' }, editorSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 }, editorScroll: { padding: 20, paddingBottom: 35 }, fieldLabel: { color: '#62777D', fontWeight: '800', fontSize: 10, letterSpacing: 1, marginTop: 18, marginBottom: 9 }, input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, color: C.ink, fontSize: 13, minHeight: 49, paddingHorizontal: 14, paddingVertical: 12 }, categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, categoryOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, categoryOptionActive: { backgroundColor: C.greenPale, borderColor: C.green }, categoryOptionText: { color: C.muted, fontSize: 10, fontWeight: '700' }, categoryOptionTextActive: { color: C.greenDark }, amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingLeft: 15 }, rupeeSign: { color: C.ink, fontSize: 20, fontWeight: '700' }, amountInput: { flex: 1, minHeight: 49, paddingHorizontal: 10, color: C.ink, fontSize: 18, fontWeight: '700' }, cycleRow: { flexDirection: 'row', gap: 7 }, cycleChip: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }, cycleChipActive: { backgroundColor: C.navy, borderColor: C.navy }, cycleChipText: { color: C.muted, fontSize: 10, fontWeight: '700' }, cycleChipTextActive: { color: C.white }, fieldHint: { fontSize: 10, lineHeight: 15, color: C.muted, marginTop: 6 }, notesInput: { minHeight: 78, textAlignVertical: 'top' }, reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 14 }, deleteFromEditor: { alignItems: 'center', paddingVertical: 14 }, deleteFromEditorText: { color: C.red, fontSize: 12, fontWeight: '800' }, formPrivacyNote: { color: '#8B999C', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 14, marginBottom: 10 },
});