import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import mobileAds, { AdsConsent, BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

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
type BillingSource = 'provider' | 'google_play' | 'apple_app_store' | 'paypal' | 'upi_autopay' | 'bank_mandate';
type Tab = 'Home' | 'Subscriptions' | 'AI' | 'Insights' | 'Settings';
type AssistantLanguage = 'en-IN' | 'hi-IN';
type AssistantMessage = { id: string; role: 'assistant' | 'user'; text: string };

type Subscription = {
  id: number;
  name: string;
  category: Category;
  amount: number | null;
  cycle: Cycle | 'Unknown';
  nextRenewal: string;
  manageUrl: string;
  billingSource: BillingSource;
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
  sourceAccounts: string[];
  needsReview: boolean;
  manageUrl: string;
  billingSource: BillingSource;
  billingSourceLabel: string;
  alreadyImported: boolean;
};
type GmailAccountSummary = { email: string; primary: boolean };

function profileGmailAccounts(profile: any): GmailAccountSummary[] {
  if (Array.isArray(profile?.gmail_accounts)) {
    return profile.gmail_accounts
      .filter((item: any) => item && typeof item.email === 'string' && item.email.includes('@'))
      .map((item: any) => ({ email: String(item.email), primary: Boolean(item.primary) }));
  }
  const email = String(profile?.gmail_email || profile?.email || '');
  return email.includes('@') ? [{ email, primary: true }] : [];
}
type GmailCandidateDraft = {
  amountText: string;
  cycle: Cycle | 'Unknown';
  renewalText: string;
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://subsathi-api.onrender.com').replace(/\/$/, '');
const SESSION_KEY = 'subsathi_api_session_v1';
const GOOGLE_AUTH_RETURN_URL = 'subsathi://auth';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchWithNetworkRetry(
  url: string,
  init: RequestInit = {},
  attempts = 3,
  timeoutMs = 15000,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if ([502, 503, 504].includes(response.status) && attempt + 1 < attempts) {
        await sleep(600 * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) throw error;
      await sleep(700 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed. Please retry.');
}

function isRecoverableSQLiteHandleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /NativeDatabase\.prepareAsync|NativeDatabase\.(?:runAsync|getFirstAsync|getAllAsync)|NullPointerException|database.*closed|native database.*null/i.test(message);
}

function isNetworkConnectivityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /network request failed|fetch failed|unknownhostexception|unable to resolve host|network error|aborted|timeout/i.test(message);
}



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
const BILLING_SOURCE_OPTIONS: { value: BillingSource; label: string }[] = [
  { value: 'provider', label: 'Service website' },
  { value: 'google_play', label: 'Google Play' },
  { value: 'apple_app_store', label: 'Apple App Store' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'upi_autopay', label: 'UPI AutoPay' },
  { value: 'bank_mandate', label: 'Bank / card mandate' },
];
const BILLING_SOURCE_LABELS: Record<BillingSource, string> = {
  provider: 'Service website', google_play: 'Google Play', apple_app_store: 'Apple App Store',
  paypal: 'PayPal', upi_autopay: 'UPI AutoPay', bank_mandate: 'Bank / card mandate',
};
const BILLING_SOURCE_MANAGEMENT_URLS: Partial<Record<BillingSource, string>> = {
  google_play: 'https://play.google.com/store/account/subscriptions',
  apple_app_store: 'https://apps.apple.com/account/subscriptions',
  paypal: 'https://www.paypal.com/myaccount/autopay/',
  upi_autopay: '', bank_mandate: '',
};
function normalizeBillingSource(value: unknown): BillingSource {
  const valid: BillingSource[] = ['provider', 'google_play', 'apple_app_store', 'paypal', 'upi_autopay', 'bank_mandate'];
  return valid.includes(value as BillingSource) ? value as BillingSource : 'provider';
}
function billingSourceLabel(value: unknown): string {
  return BILLING_SOURCE_LABELS[normalizeBillingSource(value)];
}

const SERVICE_MANAGEMENT_URLS: Record<string, string> = {
  adobecreativecloud: 'https://account.adobe.com/plans',
  netflix: 'https://www.netflix.com/YourAccount',
  spotifypremium: 'https://www.spotify.com/account/overview/',
  spotify: 'https://www.spotify.com/account/overview/',
  canvapro: 'https://www.canva.com/settings/billing-and-teams/',
  canva: 'https://www.canva.com/settings/billing-and-teams/',
  youtubepremium: 'https://www.youtube.com/paid_memberships',
  appleicloud: 'https://account.apple.com/',
  applemusic: 'https://account.apple.com/',
  amazonprime: 'https://www.amazon.in/gp/primecentral',
  amazonmusic: 'https://www.amazon.in/music/settings',
  googleone: 'https://one.google.com/settings',
  microsoft365: 'https://account.microsoft.com/services',
  xboxgamepass: 'https://account.microsoft.com/services',
  jiohotstar: 'https://www.jiohotstar.com/',
  chatgptplus: 'https://chatgpt.com/#settings/Subscription',
  chatgpt: 'https://chatgpt.com/#settings/Subscription',
  dropboxplus: 'https://www.dropbox.com/account/plan',
  notion: 'https://www.notion.so/settings/plans',
  linkedinpremium: 'https://www.linkedin.com/mypreferences/d/manage-subscription',
  zoompro: 'https://zoom.us/billing',
  duolingosuper: 'https://www.duolingo.com/settings/super',
  sonyliv: 'https://www.sonyliv.com/',
  zee5: 'https://www.zee5.com/',
  figma: 'https://www.figma.com/settings',
  zomatogold: 'https://www.zomato.com/',
  swiggyone: 'https://www.swiggy.com/',
  audible: 'https://www.audible.in/account/overview',
  grammarlypremium: 'https://account.grammarly.com/',
  githubcopilot: 'https://github.com/settings/copilot',
  crunchyrollpremium: 'https://www.crunchyroll.com/account/membership',
  courseraplus: 'https://www.coursera.org/account/subscriptions',
};

function normalizedServiceName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function knownManagementUrl(serviceName: string, billingSource: BillingSource = 'provider'): string {
  const sourceUrl = BILLING_SOURCE_MANAGEMENT_URLS[billingSource];
  if (sourceUrl !== undefined) return sourceUrl;
  const key = normalizedServiceName(serviceName);
  if (SERVICE_MANAGEMENT_URLS[key]) return SERVICE_MANAGEMENT_URLS[key];
  const aliases: Array<[string, string]> = [
    ['spotify', 'spotify'], ['netflix', 'netflix'], ['adobe', 'adobecreativecloud'],
    ['youtube', 'youtubepremium'], ['icloud', 'appleicloud'], ['apple', 'appleicloud'],
    ['amazonprime', 'amazonprime'], ['googleone', 'googleone'], ['microsoft', 'microsoft365'],
    ['hotstar', 'jiohotstar'], ['chatgpt', 'chatgptplus'], ['dropbox', 'dropboxplus'],
    ['linkedin', 'linkedinpremium'], ['duolingo', 'duolingosuper'], ['zomato', 'zomatogold'],
    ['swiggy', 'swiggyone'], ['audible', 'audible'], ['grammarly', 'grammarlypremium'],
    ['githubcopilot', 'githubcopilot'], ['crunchyroll', 'crunchyrollpremium'], ['coursera', 'courseraplus'],
  ];
  for (const [needle, target] of aliases) {
    if (key.includes(needle) && SERVICE_MANAGEMENT_URLS[target]) return SERVICE_MANAGEMENT_URLS[target];
  }
  return '';
}

function categoryMeta(category: Category) {
  return CATEGORIES.find((item) => item.name === category) ?? CATEGORIES[CATEGORIES.length - 1];
}
function categoryIconName(category: Category): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (category) {
    case 'Entertainment': return 'movie-open-outline';
    case 'Software': return 'laptop';
    case 'Storage': return 'cloud-outline';
    case 'Music': return 'music-note-outline';
    case 'Fitness': return 'dumbbell';
    case 'Utilities': return 'wifi';
    case 'Learning': return 'book-open-variant';
    default: return 'repeat';
  }
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
function hasKnownPrice(item: Pick<Subscription, 'amount' | 'cycle'>): boolean {
  return item.amount !== null && Number.isFinite(item.amount) && item.amount > 0 && item.cycle !== 'Unknown';
}
function monthlyEquivalent(item: Pick<Subscription, 'amount' | 'cycle'>): number {
  if (!hasKnownPrice(item)) return 0;
  switch (item.cycle) {
    case 'Weekly': return item.amount! * 52 / 12;
    case 'Monthly': return item.amount!;
    case 'Quarterly': return item.amount! / 3;
    case 'Yearly': return item.amount! / 12;
    default: return 0;
  }
}
function annualEquivalent(item: Pick<Subscription, 'amount' | 'cycle'>): number {
  if (!hasKnownPrice(item)) return 0;
  switch (item.cycle) {
    case 'Weekly': return item.amount! * 52;
    case 'Monthly': return item.amount! * 12;
    case 'Quarterly': return item.amount! * 4;
    case 'Yearly': return item.amount!;
    default: return 0;
  }
}
function daysUntil(value: string) {
  const target = parseLocalDate(value);
  const today = parseLocalDate(localDateString(new Date()));
  if (Number.isNaN(target.getTime())) return 9999;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function buildAssistantReply(question: string, items: Subscription[], language: AssistantLanguage): string {
  const q = question.toLowerCase().trim();
  const hindi = language === 'hi-IN';
  const pricedItems = items.filter(hasKnownPrice);
  const unconfirmedCount = items.length - pricedItems.length;
  const monthly = pricedItems.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  const yearly = pricedItems.reduce((sum, item) => sum + annualEquivalent(item), 0);
  const reviewNote = unconfirmedCount
    ? (hindi ? ` ${unconfirmedCount} aur plan(s) ka price/cycle confirm nahi hai, isliye totals mein include nahi.` : ` ${unconfirmedCount} other plan(s) have an unconfirmed price/cycle and are excluded from totals.`)
    : '';
  const upcoming = [...items].filter((item) => daysUntil(item.nextRenewal) >= -7 && daysUntil(item.nextRenewal) <= 45)
    .sort((a, b) => daysUntil(a.nextRenewal) - daysUntil(b.nextRenewal));
  const ranked = [...pricedItems].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
  const nameCounts = new Map<string, { name: string; count: number; monthly: number }>();
  items.forEach((item) => {
    const key = item.name.trim().toLowerCase();
    const previous = nameCounts.get(key);
    nameCounts.set(key, { name: item.name, count: (previous?.count || 0) + 1, monthly: (previous?.monthly || 0) + monthlyEquivalent(item) });
  });
  const duplicates = [...nameCounts.values()].filter((item) => item.count > 1);
  if (!items.length) {
    return hindi
      ? 'Pehle ek ya do subscriptions add karo. Phir main monthly kharcha, next renewals aur possible savings tumhare actual tracker se bata sakta hoon.'
      : 'Add a subscription or two first. Then I can explain your monthly spend, upcoming renewals and possible savings using your tracker.';
  }
  if (!pricedItems.length && /(year|annual|annually|yearly|saal|salana|save|saving|reduce|lower|cut|cheap|unused|bacha|bachat|kam karo|kam kar|sasta|waste|spend|expense|monthly|month|kharch|cost|budget|kitna|how much|category|stream|music|software|storage|entertainment|where|kahan|highest)/.test(q)) {
    return hindi
      ? `Abhi kisi plan ka price aur billing cycle dono confirm nahi hain, isliye spend calculate nahi kar sakta. ${unconfirmedCount} tracked plan(s) hain; email ya provider se details milne par total update hoga.`
      : `I cannot calculate recurring spend yet because no tracked plan has both a confirmed price and billing cycle. ${unconfirmedCount} plan(s) are tracked; totals will update as details are confirmed.`;
  }
  if (/(duplicate|same plan|repeat|double charge|do baar|ek hi|same service)/.test(q)) {
    if (duplicates.length) {
      return hindi
        ? 'Mujhe same naam ke possible duplicate entries mili hain: ' + duplicates.map((item) => `${item.name} (${item.count} entries, ${money(item.monthly)}/mo total)`).join('; ') + '. Ye sirf tracker ke naam par based signal hai—provider account check karke hi delete ya cancel karna.'
        : 'I found possible duplicate tracker entries: ' + duplicates.map((item) => `${item.name} (${item.count} entries, ${money(item.monthly)}/mo combined)`).join('; ') + '. This is a name-based signal, not proof of duplicate billing—verify the provider account before removing or cancelling anything.';
    }
    return hindi
      ? 'Abhi exact same naam wali duplicate entries nahi mili. Similar plans alag naam se ho sakte hain, isliye provider accounts bhi check karna.'
      : 'I did not find exact same-name duplicates in your tracker. Similar plans can have different names, so check provider accounts too.';
  }
  if (/(renew|renewal|upcoming|next|due|kab|aane wale|date|kitne din)/.test(q)) {
    if (!upcoming.length) {
      return hindi
        ? 'Agale 45 din ke aas-paas koi renewal date nahi mili. Har subscription ki date verify karke add karoge to reminders zyada useful honge.'
        : 'I do not see a renewal within the next 45 days or the recent overdue window. Add verified renewal dates to make reminders more useful.';
    }
    return (hindi ? 'Tumhare tracker ke hisaab se closest renewals: ' : 'Your closest tracked renewals are: ') +
      upcoming.slice(0, 3).map((item) => `${item.name}: ${item.amount === null ? 'price unconfirmed' : money(item.amount)}${item.cycle === 'Unknown' ? '' : ` per ${item.cycle.toLowerCase()}`}, ${dueLabel(item.nextRenewal)}`).join('; ') +
      (hindi ? '. Dates saved tracker se aati hain—provider par verify kar lena.' : '. These dates come from your saved tracker; verify them with each provider.');
  }
  if (/(year|annual|annually|yearly|saal|salana)/.test(q)) {
    return hindi
      ? `Tumhara estimated yearly commitment ${money(yearly)} hai, ${pricedItems.length} price/cycle-confirmed plans se. Monthly equivalent ${money(monthly)} hai. Ye estimate hai, final bank statement nahi.${reviewNote}`
      : `Your estimated yearly commitment is ${money(yearly)} across ${pricedItems.length} price/cycle-confirmed plans, or about ${money(monthly)} per month. This is an estimate based on saved entries, not a bank statement.${reviewNote}`;
  }
  if (/(save|saving|reduce|lower|cut|cheap|cancel|unused|bacha|bachat|kam karo|kam kar|sasta|waste)/.test(q)) {
    const top = ranked.slice(0, 3);
    return hindi
      ? `Savings review ke liye pehle ye plans dekho: ${top.map((item) => `${item.name} (${money(monthlyEquivalent(item))}/mo equivalent)`).join(', ')}. Inmein se jo use nahi hote ya overlap karte hain unka official plan check karo. Cancel karne se pehle shared use aur renewal date verify karna—main kisi service ko automatically cancel nahi karta.`
      : `Start your savings review with: ${top.map((item) => `${item.name} (${money(monthlyEquivalent(item))}/mo equivalent)`).join(', ')}. Check which are unused or overlap, then review the official plan. Verify shared use and renewal terms before cancelling; I never cancel a service for you.`;
  }
  if (/(how many|number of|count|kitne plan|kitni subscription|total plan|total subscriptions)/.test(q)) {
    return hindi
      ? `Tumne ${items.length} subscription track ki hain. Confirmed price/cycle wale plans ka estimated monthly equivalent ${money(monthly)} aur yearly commitment ${money(yearly)} hai.${reviewNote}`
      : `You are tracking ${items.length} subscriptions. Price/cycle-confirmed plans have an estimated monthly equivalent of ${money(monthly)} and yearly commitment of ${money(yearly)}.${reviewNote}`;
  }
  if (/(category|stream|music|software|storage|entertainment|kis par|kahan|where|spend|expense|monthly|month|kharch|cost|budget|kitna|how much|total)/.test(q)) {
    const categories = new Map<string, number>();
    items.forEach((item) => categories.set(item.category, (categories.get(item.category) || 0) + monthlyEquivalent(item)));
    const biggestCategory = [...categories.entries()].sort((a, b) => b[1] - a[1])[0];
    const highest = ranked[0];
    return hindi
      ? `Abhi ${pricedItems.length} price/cycle-confirmed plans ka monthly equivalent ${money(monthly)} hai (yearly estimate ${money(yearly)}). Sabse bada category spend ${biggestCategory[0]} par ${money(biggestCategory[1])}/mo hai. Highest monthly-equivalent plan ${highest.name} hai (${money(monthlyEquivalent(highest))}/mo). Pehle is plan ko review karna useful rahega.${reviewNote}`
      : `Your ${pricedItems.length} price/cycle-confirmed plans cost about ${money(monthly)} per month equivalent (${money(yearly)} yearly estimate). Your highest-spend category is ${biggestCategory[0]} at ${money(biggestCategory[1])}/mo. Your highest monthly-equivalent plan is ${highest.name} at ${money(monthlyEquivalent(highest))}/mo, so it is a useful first review.${reviewNote}`;
  }
  const top = ranked[0];
  const next = upcoming[0];
  return hindi
    ? `Quick money check: ${items.length} plans, ${money(monthly)}/mo equivalent aur ${money(yearly)}/year estimate. ${top ? `Sabse mehenga monthly-equivalent plan ${top.name} (${money(monthlyEquivalent(top))}/mo) hai. ` : ''}${next ? `Next renewal: ${next.name}, ${dueLabel(next.nextRenewal)}.` : 'Renewal dates check karna next best step hai.'} Tum mujhse monthly spend, next renewal, duplicates ya savings ke baare mein pooch sakte ho.`
    : `Quick money check: ${items.length} plans, ${money(monthly)}/mo equivalent and ${money(yearly)}/year estimated. ${top ? `Your highest monthly-equivalent plan is ${top.name} at ${money(monthlyEquivalent(top))}/mo. ` : ''}${next ? `Next renewal: ${next.name}, ${dueLabel(next.nextRenewal)}.` : 'Review and confirm renewal dates next.'} Ask me about monthly spend, upcoming renewals, possible duplicates or savings.`;
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
      amount REAL,
      cycle TEXT NOT NULL DEFAULT 'Unknown',
      nextRenewal TEXT NOT NULL,
      manageUrl TEXT NOT NULL DEFAULT '',
      billingSource TEXT NOT NULL DEFAULT 'provider',
      notes TEXT NOT NULL DEFAULT '',
      reminderEnabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );
  `);
  // Additive migration keeps entries created by older versions intact.
  const existingColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(subscriptions)');
  if (!existingColumns.some((column) => column.name === 'billingSource')) {
    await db.execAsync("ALTER TABLE subscriptions ADD COLUMN billingSource TEXT NOT NULL DEFAULT 'provider'");
  }
  // Older installs declared amount NOT NULL. Rebuild transactionally so scanned
  // subscriptions can be saved with unknown prices instead of fake zero amounts.
  const columnsAfterAdditions = await db.getAllAsync<{ name: string; notnull: number }>('PRAGMA table_info(subscriptions)');
  if (columnsAfterAdditions.some((column) => column.name === 'amount' && column.notnull === 1)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE subscriptions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          amount REAL,
          cycle TEXT NOT NULL DEFAULT 'Unknown',
          nextRenewal TEXT NOT NULL DEFAULT '',
          manageUrl TEXT NOT NULL DEFAULT '',
          billingSource TEXT NOT NULL DEFAULT 'provider',
          notes TEXT NOT NULL DEFAULT '',
          reminderEnabled INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL
        );
      `);
      await db.execAsync(`
        INSERT INTO subscriptions_new (id, name, category, amount, cycle, nextRenewal, manageUrl, billingSource, notes, reminderEnabled, createdAt)
        SELECT id, name, category, amount, cycle, nextRenewal, manageUrl, billingSource, notes, reminderEnabled, createdAt FROM subscriptions;
      `);
      await db.execAsync('DROP TABLE subscriptions;');
      await db.execAsync('ALTER TABLE subscriptions_new RENAME TO subscriptions;');
    });
  }
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
  return <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.32 }]}><MaterialCommunityIcons name="autorenew" size={size * 0.57} color={C.white} /></View>;
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const adUnitFromEnv = (process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID || '').trim();
  const adUnitId = adUnitFromEnv || TestIds.ADAPTIVE_BANNER;
  const isTestAds = !adUnitFromEnv;
  const adsInitializedRef = useRef(false);
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const dbRecoveryRef = useRef<Promise<SQLite.SQLiteDatabase> | null>(null);
  const dbOperationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tab, setTab] = useState<Tab>('Home');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | Category>('All');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [scanInfoOpen, setScanInfoOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [adsReady, setAdsReady] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const [apiSession, setApiSession] = useState<string | null>(null);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccountSummary[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanCandidates, setScanCandidates] = useState<GmailCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [expandedCandidateIds, setExpandedCandidateIds] = useState<number[]>([]);
  const [candidateEdits, setCandidateEdits] = useState<Record<number, GmailCandidateDraft>>({});
  const [scanSummary, setScanSummary] = useState<{
    scannedMessages: number;
    fullMessagesFetched: number;
    matchedReceipts: number;
    searchResultHits: number;
    queriesUsed: number;
    scanLimitPerAccount: number;
    scanLimitReached: boolean;
    candidateCount: number;
    durationMs: number;
    accountsScanned: string[];
    accountErrors: { email: string; message: string }[];
    mode: 'full' | 'incremental';
    aiAssisted: boolean;
    aiAnalyzedMessages: number;
    aiWarning: string;
  } | null>(null);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [googleOAuthConfigured, setGoogleOAuthConfigured] = useState<boolean | null>(null);
  const [aiExtractionConfigured, setAiExtractionConfigured] = useState<boolean | null>(null);
  const [durableDatabaseConfigured, setDurableDatabaseConfigured] = useState<boolean | null>(null);
  const [serverScanLimit, setServerScanLimit] = useState<number | null>(null);
  const [gmailNeedsRepair, setGmailNeedsRepair] = useState(false);
  const [aiAssistedScan, setAiAssistedScan] = useState(false);
  const [aiPreferenceLoaded, setAiPreferenceLoaded] = useState(false);
  const autoScanSessionRef = useRef<string | null>(null);
  const scanInFlightRef = useRef(false);
  const screenProgress = useRef(new Animated.Value(1)).current;
  const [assistantLanguage, setAssistantLanguage] = useState<AssistantLanguage>('hi-IN');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [assistantQuery, setAssistantQuery] = useState('');
  const [pendingVoiceQuery, setPendingVoiceQuery] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    { id: 'welcome', role: 'assistant', text: 'Namaste! Main SmartSathi hoon. Main tumhare saved plans se monthly kharcha, upcoming renewals aur possible savings samjha sakta hoon. Type karo ya mic dabao.' },
  ]);

  const ensureLocalDatabase = useCallback(async (forceReopen = false): Promise<SQLite.SQLiteDatabase> => {
    if (dbRecoveryRef.current) return dbRecoveryRef.current;
    const opening = (async () => {
      let database = dbRef.current;
      if (database && !forceReopen) {
        try {
          await database.getFirstAsync<{ ok: number }>('SELECT 1 AS ok');
          return database;
        } catch (error) {
          console.warn('Local SQLite handle needs recovery', error);
          forceReopen = true;
        }
      }
      dbRef.current = null;
      if (database) {
        try { await database.closeAsync(); } catch { /* A native stale handle may already be closed. */ }
      }
      database = await initializeDatabase();
      dbRef.current = database;
      await database.getFirstAsync<{ ok: number }>('SELECT 1 AS ok');
      return database;
    })();
    dbRecoveryRef.current = opening;
    try {
      return await opening;
    } finally {
      if (dbRecoveryRef.current === opening) dbRecoveryRef.current = null;
    }
  }, []);

  const withLocalDatabase = useCallback(async <T,>(
    operation: (database: SQLite.SQLiteDatabase) => Promise<T>,
  ): Promise<T> => {
    const previous = dbOperationQueueRef.current;
    let release!: () => void;
    dbOperationQueueRef.current = new Promise<void>((resolve) => { release = resolve; });
    await previous.catch(() => undefined);
    try {
      let database: SQLite.SQLiteDatabase;
      try {
        database = await ensureLocalDatabase();
      } catch (error) {
        if (!isRecoverableSQLiteHandleError(error)) throw error;
        console.warn('Recovering SQLite initialization after native database failure');
        await sleep(250);
        database = await ensureLocalDatabase(true);
      }
      try {
        return await operation(database);
      } catch (error) {
        if (!isRecoverableSQLiteHandleError(error)) throw error;
        console.warn('Recovering native SQLite handle and retrying one database operation');
        const recovered = await ensureLocalDatabase(true);
        return await operation(recovered);
      }
    } finally {
      release();
    }
  }, [ensureLocalDatabase]);

  const refreshApiHealth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetchWithNetworkRetry(`${API_BASE_URL}/health`, {}, 3, 12000);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('SubSathi API health check failed.');
      setApiReachable(true);
      setGoogleOAuthConfigured(payload.google_oauth_configured === true);
      setAiExtractionConfigured(payload.ai_extraction_configured === true);
      setDurableDatabaseConfigured(payload.durable_database_configured === true);
      setServerScanLimit(Number(payload.scan_max_messages_per_inbox || 500));
      return true;
    } catch {
      setApiReachable(false);
      setGoogleOAuthConfigured(null);
      setAiExtractionConfigured(null);
      setDurableDatabaseConfigured(null);
      setServerScanLimit(null);
      return false;
    }
  }, []);

  useSpeechRecognitionEvent('start', () => { setVoiceListening(true); setVoiceError(''); });
  useSpeechRecognitionEvent('end', () => setVoiceListening(false));
  useSpeechRecognitionEvent('error', (event) => {
    setVoiceListening(false);
    const code = String(event.error || '');
    if (code !== 'aborted' && code !== 'no-speech') {
      setVoiceError('Voice recognition could not start. Check microphone permission and your device speech-recognition service, then retry.');
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript;
    if (event.isFinal && transcript && transcript.trim()) {
      setAssistantQuery(transcript.trim());
      setPendingVoiceQuery(transcript.trim());
    }
  });

  useEffect(() => {
    let active = true;
    void refreshApiHealth().then(() => {
      // A single temporary mobile-DNS failure should not permanently mark the API offline.
      // refreshApiHealth itself makes three bounded attempts before reporting failure.
    }).finally(() => {
      if (!active) return;
    });
    return () => { active = false; };
  }, [refreshApiHealth]);

  useEffect(() => {
    screenProgress.setValue(0);
    Animated.timing(screenProgress, {
      toValue: 1,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, screenProgress]);

  const loadSubscriptions = useCallback(async () => {
    const rows = await withLocalDatabase((db) =>
      db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC'),
    );
    setSubscriptions(rows);
  }, [withLocalDatabase]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const initial = await withLocalDatabase(async (db) => ({
          rows: await db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC'),
          preference: await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'notificationsEnabled'"),
          aiPreference: await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'aiAssistedScan'"),
        }));
        if (mounted) {
          setSubscriptions(initial.rows);
          if (initial.preference) setNotificationsEnabled(initial.preference.value === 'true');
          if (initial.aiPreference) setAiAssistedScan(initial.aiPreference.value === 'true');
          setAiPreferenceLoaded(true);
        }
      } catch (error) {
        Alert.alert('Local tracker needs repair', 'SubSathi could not open its on-device database. Your saved subscription file was not deliberately deleted. Restart the app and try again; if this persists, contact support before reinstalling.');
        console.warn('Local database initialization failed', error);
      } finally {
        if (mounted) {
          setReady(true);
          setAiPreferenceLoaded(true);
        }
      }
    })();
    return () => { mounted = false; };
  }, [withLocalDatabase]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(SESSION_KEY);
        if (!token || !mounted) return;
        const response = await fetchWithNetworkRetry(`${API_BASE_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } }, 2, 12000);
        if (!response.ok) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          return;
        }
        const profile = await response.json();
        if (mounted && profile.gmail_connected) {
          const accounts = profileGmailAccounts(profile);
          setApiSession(token);
          setGmailAccounts(accounts);
          setGmailEmail(profile.gmail_email || accounts[0]?.email || profile.email || null);
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let info = await AdsConsent.requestInfoUpdate();
        if (info.isConsentFormAvailable) {
          info = await AdsConsent.loadAndShowConsentFormIfRequired();
        }
        if (!mounted) return;
        setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === 'REQUIRED');
        if (info.canRequestAds) {
          await mobileAds().initialize();
          adsInitializedRef.current = true;
          if (mounted) setAdsReady(true);
        }
      } catch (error) {
        // Ads must never block the core subscription tracker if consent or ad services are unavailable.
        console.warn('Ads consent or initialization is not available yet', error);
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
  }).reduce((sum, item) => sum + (item.amount ?? 0), 0), [subscriptions]);
  const filtered = useMemo(() => subscriptions.filter((item) => {
    const text = `${item.name} ${item.category}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (filter === 'All' || item.category === filter);
  }), [subscriptions, search, filter]);
  const categorySpend = useMemo(() => CATEGORIES.map((category) => ({
    ...category,
    amount: subscriptions.filter((item) => item.category === category.name).reduce((sum, item) => sum + monthlyEquivalent(item), 0),
  })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount), [subscriptions]);

  // Savings Radar uses only the plans the user has saved on this device. It flags
  // review opportunities, never labels category overlap as a confirmed duplicate charge.
  const savingsRadar = useMemo(() => {
    const byCategory = new Map<Category, Subscription[]>();
    const byServiceAndSource = new Map<string, Subscription[]>();
    for (const item of subscriptions) {
      const categoryItems = byCategory.get(item.category) || [];
      categoryItems.push(item);
      byCategory.set(item.category, categoryItems);
      const serviceKey = normalizedServiceName(item.name) + '|' + normalizeBillingSource(item.billingSource);
      const serviceItems = byServiceAndSource.get(serviceKey) || [];
      serviceItems.push(item);
      byServiceAndSource.set(serviceKey, serviceItems);
    }
    const overlaps = [...byCategory.entries()]
      .filter(([category, items]) => ['Entertainment', 'Music', 'Software', 'Storage'].includes(category) && items.length > 1)
      .map(([category, items]) => {
        const priced = items.filter(hasKnownPrice);
        const monthlySpend = priced.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
        const reviewOpportunity = priced.length > 1
          ? Math.min(...priced.map((item) => monthlyEquivalent(item)))
          : 0;
        return { category, items, monthlySpend, reviewOpportunity };
      })
      .sort((a, b) => b.monthlySpend - a.monthlySpend);
    const repeatedEntries = [...byServiceAndSource.values()]
      .filter((items) => items.length > 1)
      .map((items) => ({
        name: items[0].name,
        count: items.length,
        category: items[0].category,
        source: normalizeBillingSource(items[0].billingSource),
        monthlySpend: items.reduce((sum, item) => sum + monthlyEquivalent(item), 0),
      }));
    const missingDetails = subscriptions.filter((item) => !hasKnownPrice(item) || !item.nextRenewal).length;
    return {
      overlaps,
      repeatedEntries,
      missingDetails,
      potentialMonthly: overlaps.reduce((sum, item) => sum + item.reviewOpportunity, 0),
    };
  }, [subscriptions]);

  const answerAssistant = useCallback((rawQuestion: string, speakReply = false) => {
    const question = rawQuestion.trim();
    if (!question) return;
    const answer = buildAssistantReply(question, subscriptions, assistantLanguage);
    const timestamp = Date.now();
    setAssistantMessages((current) => [
      ...current,
      { id: `user-${timestamp}`, role: 'user' as const, text: question },
      { id: `assistant-${timestamp + 1}`, role: 'assistant' as const, text: answer },
    ].slice(-11));
    setAssistantQuery('');
    setVoiceError('');
    if (speakReply || voiceRepliesEnabled) {
      void Speech.stop();
      Speech.speak(answer, { language: assistantLanguage, rate: 0.94, pitch: 1.0 });
    }
  }, [subscriptions, assistantLanguage, voiceRepliesEnabled]);

  useEffect(() => {
    if (!pendingVoiceQuery.trim()) return;
    answerAssistant(pendingVoiceQuery, true);
    setPendingVoiceQuery('');
  }, [pendingVoiceQuery, answerAssistant]);

  const startVoiceCapture = async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceError('Allow microphone and speech-recognition access in Android settings, then try again.');
        return;
      }
      setVoiceError('');
      ExpoSpeechRecognitionModule.start({
        lang: assistantLanguage,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
        contextualStrings: subscriptions.map((item) => item.name).slice(0, 20),
      });
    } catch (error) {
      setVoiceListening(false);
      setVoiceError(error instanceof Error ? error.message : 'Voice recognition is not available on this device right now.');
    }
  };

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (item: Subscription) => { setEditing(item); setEditorOpen(true); };

  const saveSubscription = async (input: SubscriptionInput) => {
    const rows = await withLocalDatabase(async (db) => {
      if (editing) {
        await db.runAsync(
          'UPDATE subscriptions SET name = ?, category = ?, amount = ?, cycle = ?, nextRenewal = ?, manageUrl = ?, billingSource = ?, notes = ?, reminderEnabled = ? WHERE id = ?',
          input.name, input.category, input.amount, input.cycle, input.nextRenewal, input.manageUrl, input.billingSource, input.notes, input.reminderEnabled, editing.id,
        );
      } else {
        await db.runAsync(
          'INSERT INTO subscriptions (name, category, amount, cycle, nextRenewal, manageUrl, billingSource, notes, reminderEnabled, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          input.name, input.category, input.amount, input.cycle, input.nextRenewal, input.manageUrl, input.billingSource, input.notes, input.reminderEnabled, new Date().toISOString(),
        );
      }
      return db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC');
    });
    setSubscriptions(rows);
    await rescheduleRenewalReminders(rows, notificationsEnabled);
    setEditorOpen(false);
    setEditing(null);
  };

  const deleteSubscription = (item: Subscription) => {
    Alert.alert('Delete subscription?', `Remove ${item.name} from SubSathi? This only deletes the tracker entry; it does not cancel your actual subscription.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const rows = await withLocalDatabase(async (db) => {
            await db.runAsync('DELETE FROM subscriptions WHERE id = ?', item.id);
            return db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC');
          });
          setSubscriptions(rows);
          await rescheduleRenewalReminders(rows, notificationsEnabled);
          if (editing?.id === item.id) { setEditing(null); setEditorOpen(false); }
        } catch (error) {
          console.warn('Could not delete local tracker entry', error);
          Alert.alert('Could not delete entry', 'Your existing tracker entries have not been deliberately removed. Retry after restarting SubSathi.');
        }
      } },
    ]);
  };

  const openManage = async (item: Subscription, intent: 'manage' | 'cancel' = 'manage') => {
    const source = normalizeBillingSource(item.billingSource);
    const sourceUrl = BILLING_SOURCE_MANAGEMENT_URLS[source];
    const directUrl = (sourceUrl && sourceUrl.trim()) || item.manageUrl.trim() || knownManagementUrl(item.name, source);
    if (source === 'upi_autopay' || source === 'bank_mandate') {
      const isUpi = source === 'upi_autopay';
      Alert.alert(
        isUpi ? 'Manage UPI AutoPay mandate' : 'Manage bank / card mandate',
        isUpi
          ? 'Open the UPI app used to approve this mandate, then go to Profile or Payments → AutoPay / Mandates. SubSathi cannot cancel a UPI mandate from inside the app without a supported payment-provider integration.'
          : 'Open the bank or card issuer app used for this recurring instruction, then find Standing Instructions, e-Mandates or Recurring Payments. SubSathi cannot cancel a bank mandate directly yet.',
        [
          { text: 'Got it', style: 'cancel' },
          { text: 'Open official help', onPress: () => {
            const helpUrl = isUpi ? 'https://www.npci.org.in/what-we-do/upi/upi-autopay' : 'https://www.rbi.org.in/';
            void Linking.openURL(helpUrl).catch(() => Alert.alert('Could not open help', 'Please check your internet connection.'));
          } },
        ],
      );
      return;
    }
    if (!directUrl) {
      Alert.alert(
        'Management link not verified',
        'SubSathi could not confirm an official management page for ' + item.name + '. It will not send you to a generic web search. Edit this subscription and save the provider’s official account or billing URL.',
        [{ text: 'OK' }],
      );
      return;
    }
    const safeUrl = /^https:\/\//i.test(directUrl) ? directUrl : 'https://' + directUrl.replace(/^https?:\/\//i, '');
    const launchOfficialPage = async () => {
      try {
        await Linking.openURL(safeUrl);
      } catch {
        Alert.alert('Could not open billing page', 'Please check your internet connection and try again.');
      }
    };
    if (intent === 'cancel') {
      Alert.alert(
        'Continue to cancel renewal?',
        'SubSathi will open ' + billingSourceLabel(source) + ' for ' + item.name + '. Review the plan there and confirm cancellation with the provider. This step does not cancel it automatically.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open cancellation page', style: 'destructive', onPress: () => { void launchOfficialPage(); } },
        ],
      );
      return;
    }
    await launchOfficialPage();
  };

    const connectGmail = async () => {
    setScanError('');
    setScanLoading(true);
    try {
      const healthResponse = await fetchWithNetworkRetry(`${API_BASE_URL}/health`, {}, 3, 12000);
      const healthPayload = await healthResponse.json().catch(() => ({}));
      if (!healthResponse.ok) throw new Error('The SubSathi server is not healthy right now. Please retry in a moment.');
      setApiReachable(true);
      setGoogleOAuthConfigured(healthPayload.google_oauth_configured === true);
      setAiExtractionConfigured(healthPayload.ai_extraction_configured === true);
      setDurableDatabaseConfigured(healthPayload.durable_database_configured === true);
      setServerScanLimit(Number(healthPayload.scan_max_messages_per_inbox || 500));
      if (healthPayload.google_oauth_configured !== true) {
        throw new Error('Gmail connection is blocked by server setup, not by your phone. The hosted API does not have Google OAuth credentials configured. In Google Cloud, enable Gmail API and create a Web OAuth client. In Render, add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then set GOOGLE_REDIRECT_URI to https://subsathi-api.onrender.com/api/auth/google/callback. Add your Google account as an OAuth test user while the consent screen is in testing, deploy the changes, and try again. Never put the client secret inside the APK or send it in chat.');
      }
      const startResponse = await fetchWithNetworkRetry(`${API_BASE_URL}/api/auth/google/url?redirect_target=mobile`, {}, 2, 12000);
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
      const profileResponse = await fetchWithNetworkRetry(`${API_BASE_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } }, 2, 12000);
      const profile = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok || !profile.gmail_connected) throw new Error(profile.detail || 'Gmail connection could not be verified by the SubSathi server.');
      await SecureStore.setItemAsync(SESSION_KEY, token);
      const connectedAccounts = profileGmailAccounts(profile);
      setGmailAccounts(connectedAccounts);
      setGmailEmail(profile.gmail_email || connectedAccounts[0]?.email || profile.email || callback.searchParams.get('email'));
      setGmailNeedsRepair(false);
      setScanCandidates([]);
      setSelectedCandidateIds([]);
      setCandidateEdits({});

      const activateConnectedSession = async (enableAI?: boolean) => {
        try {
          if (enableAI !== undefined) {
            await withLocalDatabase(async (localDb) => {
              await localDb.runAsync(
                "INSERT INTO app_settings (key, value) VALUES ('aiAssistedScan', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                enableAI ? 'true' : 'false',
              );
              await localDb.runAsync(
                "INSERT INTO app_settings (key, value) VALUES ('aiConsentResolved', 'true') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
              );
            });
            setAiAssistedScan(enableAI);
          }
          setApiSession(token);
          if (enableAI === true) {
            Alert.alert('AI-enhanced scan enabled', 'SubSathi will analyse up to 100 likely billing-email excerpts per inbox; uncertain detections are reviewed first using OpenAI, in addition to its local checks. You can turn this off any time in Email scan settings.');
          } else if (enableAI === false) {
            Alert.alert('Gmail connected', 'Automatic subscription discovery is starting using local detection. You can enable AI-assisted extraction later in Email scan settings.');
          } else {
            Alert.alert('Gmail connected', `Automatic subscription discovery is starting for ${profile.gmail_email || profile.email || 'your Google account'}. Review detections in Email scan before importing any plans.`);
          }
        } catch {
          // Never enable external AI processing if the user's preference could not be saved.
          setAiAssistedScan(false);
          setApiSession(token);
          Alert.alert('Gmail connected', 'Standard subscription detection is starting. The AI preference could not be saved, so no email excerpts will be sent to an AI service.');
        }
      };

      const { savedConsent, savedAiPreference } = await withLocalDatabase(async (localDb) => ({
        savedConsent: await localDb.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'aiConsentResolved'"),
        savedAiPreference: await localDb.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'aiAssistedScan'"),
      }));
      if (healthPayload.ai_extraction_configured === true && !savedConsent && !savedAiPreference) {
        Alert.alert(
          'Improve subscription detection with AI?',
          'With your permission, SubSathi sends short excerpts from likely billing emails to OpenAI so it can identify missing service names, prices, billing cycles and explicitly stated renewal dates. SubSathi does not store full email bodies. AI will never invent a price or date, and you can keep standard local detection instead.',
          [
            { text: 'Keep AI off', style: 'cancel', onPress: () => { void activateConnectedSession(false); } },
            { text: 'Enable AI scan', onPress: () => { void activateConnectedSession(true); } },
          ],
        );
        return;
      }
      await activateConnectedSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not connect Gmail. Check your internet connection and API settings.';
      const oauthSetupIsMissing = message.includes('does not have Google OAuth credentials configured');
      if (oauthSetupIsMissing) {
        // Keep the single amber setup notice visible; don't repeat the same issue in a red error box.
        setGoogleOAuthConfigured(false);
        setScanError('');
      } else {
        const friendlyMessage = isNetworkConnectivityError(error)
          ? `SubSathi couldn't reach ${API_BASE_URL} after retrying. This is a network/DNS connection failure, not a Gmail detection failure. Your on-device tracker entries are safe; tap Retry server connection when ready.`
          : message;
        if (isNetworkConnectivityError(error)) setApiReachable(false);
        setScanError(friendlyMessage);
      }
    } finally {
      setScanLoading(false);
    }
  };

  const refreshGmailProfile = async (session: string) => {
    const response = await fetchWithNetworkRetry(API_BASE_URL + '/api/me', {
      headers: { Authorization: 'Bearer ' + session },
    }, 2, 12000);
    const profile = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(profile.detail || 'Could not refresh connected Gmail accounts.');
    const accounts = profileGmailAccounts(profile);
    setGmailAccounts(accounts);
    setGmailEmail(profile.gmail_email || accounts[0]?.email || profile.email || null);
    return accounts;
  };

  const connectAdditionalGmail = async () => {
    let activeSession = apiSession;
    if (!activeSession) {
      try { activeSession = await SecureStore.getItemAsync(SESSION_KEY); } catch { activeSession = null; }
    }
    if (!activeSession) {
      setGmailNeedsRepair(Boolean(gmailEmail));
      Alert.alert(
        gmailEmail ? 'Repair the primary Gmail connection' : 'Connect SubSathi first',
        gmailEmail
          ? 'This screen still remembers your Gmail address, but the saved SubSathi session is missing. Tap Repair Gmail connection to restore the primary account, then link another inbox.'
          : 'Connect your first Gmail account before linking another inbox.',
      );
      return;
    }
    setScanError('');
    setScanLoading(true);
    try {
      const profileResponse = await fetchWithNetworkRetry(API_BASE_URL + '/api/me', {
        headers: { Authorization: 'Bearer ' + activeSession },
      }, 2, 12000);
      const profile = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok || !profile.gmail_connected) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setApiSession(null);
        setGmailEmail(null);
        setGmailAccounts([]);
        setGmailNeedsRepair(true);
        throw new Error('Your saved SubSathi session is no longer valid. Tap Repair Gmail connection to reconnect the primary inbox; local tracker entries remain on this phone.');
      }
      setApiSession(activeSession);
      setGmailAccounts(profileGmailAccounts(profile));
      setGmailEmail(profile.gmail_email || profile.email || gmailEmail);
      const startResponse = await fetchWithNetworkRetry(API_BASE_URL + '/api/auth/google/link-url', {
        headers: { Authorization: 'Bearer ' + activeSession },
      }, 2, 12000);
      const startPayload = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok || !startPayload.authorization_url) {
        throw new Error(startPayload.detail || 'Could not start Google consent for the additional inbox.');
      }
      const result = await WebBrowser.openAuthSessionAsync(String(startPayload.authorization_url), GOOGLE_AUTH_RETURN_URL);
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        setScanError('Additional Gmail linking was cancelled. Existing connections are unchanged.');
        return;
      }
      const callback = new URL(result.url);
      const callbackError = callback.searchParams.get('error');
      if (callbackError) throw new Error(callbackError);
      if (callback.searchParams.get('linked') !== '1') {
        throw new Error('Google did not confirm that the extra Gmail account was linked. Please retry.');
      }
      const email = callback.searchParams.get('email') || 'the new inbox';
      await refreshGmailProfile(activeSession);
      setScanCandidates([]);
      setSelectedCandidateIds([]);
      setCandidateEdits({});
      setScanSummary(null);
      Alert.alert('Gmail account added', email + ' is linked. The next scan will search connected inboxes together.');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not link the additional Gmail account.');
    } finally {
      setScanLoading(false);
    }
  };

  const disconnectAdditionalGmail = async (email: string) => {
    if (!apiSession) return;
    setScanLoading(true);
    setScanError('');
    try {
      const response = await fetch(API_BASE_URL + '/api/auth/gmail/accounts/' + encodeURIComponent(email), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + apiSession },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Could not disconnect this Gmail inbox.');
      const accounts = await refreshGmailProfile(apiSession);
      setScanCandidates([]);
      setSelectedCandidateIds([]);
      setCandidateEdits({});
      setScanSummary(null);
      Alert.alert('Gmail account disconnected', email + ' removed. ' + accounts.length + ' Gmail account(s) remain connected.');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not disconnect this Gmail account.');
    } finally {
      setScanLoading(false);
    }
  };

  const scanGmail = async (sessionOverride?: string, mode: 'quick' | 'full' = 'quick', aiOverride?: boolean) => {
    const session = sessionOverride || apiSession;
    if (!session) { setScanError('Connect Gmail first.'); return; }
    // Connecting Gmail and opening the scanner can both request a scan. Never run
    // overlapping scans: they waste Gmail quota and can trigger API rate limits.
    if (scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    setScanError('');
    setScanSummary(null);
    setScanLoading(true);
    try {
      const useAi = (aiOverride ?? aiAssistedScan) && aiExtractionConfigured === true;
      const scanQuery = '?max_messages=1500' + (mode === 'full' ? '&force_full_scan=true' : '') + (useAi ? '&ai_assisted=true' : '');
      // A scan is a costly, stateful POST. Do not automatically replay it after a
      // network timeout: the server may still be scanning the inbox and a duplicate
      // request can trigger Gmail's per-user rate limits.
      const response = await fetchWithNetworkRetry(API_BASE_URL + '/api/gmail/scan' + scanQuery, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
      }, 1, 120000);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          setApiSession(null);
          setGmailEmail(null);
          setGmailNeedsRepair(true);
        } else if (response.status === 409) {
          // Keep the current phone session and local tracker; this status is also used
          // for Gmail re-consent, and should never force a destructive disconnect flow.
          setGmailNeedsRepair(true);
        }
        if ([502, 503, 504].includes(response.status)) setApiReachable(false);
        throw new Error(payload.detail || 'Gmail scan failed. Please retry.');
      }
      setApiReachable(true);
      const mapped: GmailCandidate[] = (payload.candidates || []).map((item: any) => {
        const category = CATEGORIES.some((entry) => entry.name === item.category) ? item.category as Category : 'Other';
        const cycle = CYCLES.includes(item.cycle as Cycle) ? item.cycle as Cycle : 'Unknown';
        const billingSource = normalizeBillingSource(item.billingSource);
        return {
          id: Number(item.id), name: String(item.name || 'Unknown service'), category,
          amount: item.amount === null || item.amount === undefined ? null : Number(item.amount),
          cycle, nextRenewal: item.nextRenewal || null, confidence: Number(item.confidence || 0),
          evidenceCount: Number(item.evidenceCount || 1),
          sourceAccounts: Array.isArray(item.sourceAccounts) ? item.sourceAccounts.map((email: unknown) => String(email)) : [],
          needsReview: Boolean(item.needsReview),
          manageUrl: String(item.manageUrl || ''),
          billingSource,
          billingSourceLabel: String(item.billingSourceLabel || billingSourceLabel(billingSource)),
          alreadyImported: Boolean(item.alreadyImported),
        };
      });
      const localKey = (name: string, source: unknown) => normalizedServiceName(name) + '|' + normalizeBillingSource(source);

      // AI/full scans can discover a renewal date or official management page after
      // a plan was imported. Refresh only safe, missing/stale fields in the local
      // tracker; never replace a user-entered price or billing cycle silently.
      if (Array.isArray(payload.enriched_imported)) {
        const localRows = await withLocalDatabase((db) => db.getAllAsync<Subscription>('SELECT * FROM subscriptions'));
        const updates: {
          id: number; amount: number | null; cycle: Cycle | 'Unknown'; nextRenewal: string; manageUrl: string; category: Category;
        }[] = [];
        for (const remote of payload.enriched_imported) {
          const match = localRows.find((row) => localKey(row.name, row.billingSource) === localKey(String(remote.name || ''), remote.billingSource));
          if (!match) continue;
          const remoteDate = typeof remote.nextRenewal === 'string' ? remote.nextRenewal : '';
          const nextRenewal = remoteDate && (!match.nextRenewal || remoteDate > match.nextRenewal)
            ? remoteDate : match.nextRenewal;
          const remoteAmount = typeof remote.amount === 'number' && Number.isFinite(remote.amount) && remote.amount > 0
            ? remote.amount : null;
          const amount = match.amount == null && remoteAmount !== null ? remoteAmount : match.amount;
          const remoteCycle = CYCLES.includes(remote.cycle as Cycle) ? remote.cycle as Cycle : 'Unknown';
          const cycle = match.cycle === 'Unknown' && remoteCycle !== 'Unknown' ? remoteCycle : match.cycle;
          const remoteUrl = typeof remote.manageUrl === 'string' ? remote.manageUrl : '';
          const manageUrl = !match.manageUrl && remoteUrl.startsWith('https://') && !/\s/.test(remoteUrl)
            ? remoteUrl : match.manageUrl;
          const remoteCategory = CATEGORIES.some((entry) => entry.name === remote.category && entry.name !== 'Other')
            ? remote.category as Category : 'Other';
          const category = match.category === 'Other' && remoteCategory !== 'Other' ? remoteCategory : match.category;
          if (amount !== match.amount || cycle !== match.cycle || nextRenewal !== match.nextRenewal || manageUrl !== match.manageUrl || category !== match.category) {
            updates.push({ id: match.id, amount, cycle, nextRenewal, manageUrl, category });
            match.amount = amount;
            match.cycle = cycle;
            match.nextRenewal = nextRenewal;
            match.manageUrl = manageUrl;
            match.category = category;
          }
        }
        if (updates.length) {
          await withLocalDatabase(async (db) => {
            for (const update of updates) {
              await db.runAsync(
                'UPDATE subscriptions SET amount = ?, cycle = ?, nextRenewal = ?, manageUrl = ?, category = ? WHERE id = ?',
                update.amount, update.cycle, update.nextRenewal, update.manageUrl, update.category, update.id,
              );
            }
          });
          await loadSubscriptions();
        }
      }

      const locallyTrackedNames = new Set(subscriptions.map((item) => localKey(item.name, item.billingSource)));
      const adjusted = mapped.map((item) => ({
        ...item,
        alreadyImported: item.alreadyImported || locallyTrackedNames.has(localKey(item.name, item.billingSource)),
      }));
      setScanCandidates(adjusted);
      setCandidateEdits(Object.fromEntries(adjusted.map((item) => [item.id, {
        amountText: item.amount === null ? '' : String(item.amount),
        cycle: item.cycle,
        renewalText: item.nextRenewal || '',
      }])));
      setSelectedCandidateIds(adjusted.filter((item) => !item.alreadyImported).map((item) => item.id));
      setExpandedCandidateIds([]);
      const accountErrors: { email: string; message: string }[] = Array.isArray(payload.account_errors)
        ? payload.account_errors.map((item: any) => ({ email: String(item.email || ''), message: String(item.message || 'This inbox could not be scanned.') }))
        : [];
      setGmailNeedsRepair(accountErrors.some((item) => /permission|refresh token|reconnect this gmail|authorization expired/i.test(item.message)));
      setScanSummary({
        scannedMessages: Number(payload.scanned_messages || 0),
        fullMessagesFetched: Number(payload.full_messages_fetched || 0),
        matchedReceipts: Number(payload.matched_receipts || 0),
        searchResultHits: Number(payload.search_result_hits || 0),
        queriesUsed: Number(payload.queries_used || 0),
        scanLimitPerAccount: Number(payload.scan_limit_per_account || 500),
        scanLimitReached: Boolean(payload.scan_limit_reached),
        candidateCount: Number(payload.candidate_count ?? adjusted.length),
        durationMs: Number(payload.scan_duration_ms || 0),
        accountsScanned: Array.isArray(payload.scanned_accounts) ? payload.scanned_accounts.map((email: unknown) => String(email)) : [],
        accountErrors,
        mode: payload.scan_mode === 'full' ? 'full' : 'incremental',
        aiAssisted: Boolean(payload.ai_assisted_scan),
        aiAnalyzedMessages: Number(payload.ai_analyzed_messages || 0),
        aiWarning: String(payload.ai_warning || ''),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not scan Gmail. Please retry.';
      if (isNetworkConnectivityError(error)) {
        setApiReachable(false);
        setScanError(`SubSathi couldn't resolve or reach its server after retrying. Your tracker entries on this phone are safe. Check your connection and tap Retry server connection; no new scan result was confirmed.`);
      } else {
        if (/permission|refresh token|gmail authorization|reconnect this gmail|re-authori[sz]/i.test(message)) {
          setGmailNeedsRepair(true);
        }
        setScanError(message);
      }
    } finally {
      scanInFlightRef.current = false;
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
    if (!ready || !aiPreferenceLoaded || apiReachable !== true || !gmailEmail || autoScanSessionRef.current === apiSession) return;
    autoScanSessionRef.current = apiSession;
    void scanGmail(apiSession);
  }, [ready, aiPreferenceLoaded, apiReachable, apiSession, gmailEmail]);

  const importGmailCandidates = async () => {
    if (!apiSession || !selectedCandidateIds.length) return;
    setScanError('');
    setScanLoading(true);
    let localSavedCount = 0;
    try {
      const selectedCandidates = selectedCandidateIds
        .map((id) => scanCandidates.find((candidate) => candidate.id === id))
        .filter((candidate): candidate is GmailCandidate => Boolean(candidate && !candidate.alreadyImported));
      if (!selectedCandidates.length) {
        setSelectedCandidateIds([]);
        return;
      }

      const overrides: { candidate_id: number; amount?: number | null; cycle?: Cycle | 'Unknown'; next_renewal?: string }[] = [];
      const reviewed: {
        candidate: GmailCandidate;
        amount: number | null;
        cycle: Cycle | 'Unknown';
        nextRenewal: string;
      }[] = [];

      for (const candidate of selectedCandidates) {
        const draft = candidateEdits[candidate.id] || {
          amountText: candidate.amount === null ? '' : String(candidate.amount),
          cycle: candidate.cycle,
          renewalText: candidate.nextRenewal || '',
        };
        const hasPriceText = draft.amountText.trim().length > 0;
        const parsedAmount = hasPriceText ? Number(draft.amountText.replace(/,/g, '').trim()) : null;
        if (hasPriceText && (!Number.isFinite(parsedAmount) || (parsedAmount ?? 0) <= 0 || (parsedAmount ?? 0) > 10000000)) {
          Alert.alert('Check the price', `Enter a valid INR amount for ${candidate.name}, or leave it blank until confirmed.`);
          return;
        }
        if (draft.renewalText.trim() && !validDate(draft.renewalText.trim())) {
          Alert.alert('Check the renewal date', `Enter ${candidate.name}'s date as YYYY-MM-DD, or leave it blank if the email did not contain a date.`);
          return;
        }
        const override: { candidate_id: number; amount?: number | null; cycle?: Cycle | 'Unknown'; next_renewal?: string } = { candidate_id: candidate.id };
        if (hasPriceText && parsedAmount !== null && parsedAmount !== candidate.amount) override.amount = parsedAmount;
        else if (!hasPriceText && candidate.amount !== null) override.amount = null;
        if (draft.cycle !== candidate.cycle) override.cycle = draft.cycle;
        const editedRenewal = draft.renewalText.trim();
        if (editedRenewal !== (candidate.nextRenewal || '')) override.next_renewal = editedRenewal;
        if (Object.keys(override).length > 1) overrides.push(override);
        reviewed.push({
          candidate,
          amount: hasPriceText ? parsedAmount : null,
          cycle: draft.cycle,
          nextRenewal: editedRenewal,
        });
      }

      // Save the user's reviewed entries on-device FIRST. The phone's tracker must
      // never depend on a later Gmail API response; otherwise a remote import can
      // succeed while SQLite fails and the item disappears from the import queue.
      localSavedCount = await withLocalDatabase(async (db) => {
        const existingRows = await db.getAllAsync<Subscription>('SELECT * FROM subscriptions');
        const knownKeys = new Set(existingRows.map((item) =>
          normalizedServiceName(item.name) + '|' + normalizeBillingSource(item.billingSource),
        ));
        let inserted = 0;
        await db.withTransactionAsync(async () => {
          for (const item of reviewed) {
            const billingSource = normalizeBillingSource(item.candidate.billingSource);
            const key = normalizedServiceName(item.candidate.name) + '|' + billingSource;
            if (knownKeys.has(key)) continue;
            await db.runAsync(
              'INSERT INTO subscriptions (name, category, amount, cycle, nextRenewal, manageUrl, billingSource, notes, reminderEnabled, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              item.candidate.name,
              item.candidate.category,
              item.amount,
              item.cycle,
              item.nextRenewal,
              item.candidate.manageUrl || '',
              billingSource,
              'Imported from Gmail billing evidence; verify unconfirmed price/cycle/date before relying on forecasts.',
              1,
              new Date().toISOString(),
            );
            knownKeys.add(key);
            inserted += 1;
          }
        });
        return inserted;
      });
      await loadSubscriptions();
      const localRows = await withLocalDatabase((db) =>
        db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY nextRenewal ASC, name COLLATE NOCASE ASC'),
      );
      await rescheduleRenewalReminders(localRows, notificationsEnabled);
      const importedKeys = new Set(reviewed.map((item) =>
        normalizedServiceName(item.candidate.name) + '|' + normalizeBillingSource(item.candidate.billingSource),
      ));
      setScanCandidates((current) => current.map((item) =>
        importedKeys.has(normalizedServiceName(item.name) + '|' + normalizeBillingSource(item.billingSource))
          ? { ...item, alreadyImported: true }
          : item,
      ));
      setSelectedCandidateIds([]);

      // Cloud confirmation is best-effort after the phone has safely saved the tracker.
      // If Render/Gmail is offline, these locally saved entries remain usable and can
      // be reconciled on a later scan without requiring the user to re-enter them.
      let cloudSyncWarning = '';
      try {
        const response = await fetchWithNetworkRetry(`${API_BASE_URL}/api/gmail/import`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiSession}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate_ids: selectedCandidates.map((candidate) => candidate.id), overrides }),
        }, 1, 20000);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          cloudSyncWarning = ' Your plans are safely saved on this phone, but Gmail sync could not be confirmed. You can retry the scan later.';
          console.warn('Gmail import confirmation failed after local save', response.status, payload.detail || '');
        }
      } catch (error) {
        cloudSyncWarning = ' Your plans are safely saved on this phone, but the server could not confirm the import. Retry Gmail sync when the connection is back.';
        console.warn('Gmail import confirmation unavailable after local save', error);
      }
      Alert.alert(
        'Import complete',
        `${localSavedCount} subscription${localSavedCount === 1 ? '' : 's'} saved on this phone. Missing prices, cycles and dates remain unconfirmed; spend totals exclude unknown price/cycle values.${cloudSyncWarning}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed. Please retry.';
      setScanError(isNetworkConnectivityError(error)
        ? 'The server could not be reached, but no import was marked complete. Your current on-device tracker entries are safe. Retry when the connection returns.'
        : message);
      if (localSavedCount > 0) {
        Alert.alert('Tracker entries saved', `${localSavedCount} subscription(s) were saved on this phone. Some follow-up work did not finish; you do not need to enter them again.`);
      }
    } finally {
      setScanLoading(false);
    }
  };

  const exportSubscriptions = async () => {
    if (!subscriptions.length) {
      Alert.alert('Nothing to export', 'Add or import a subscription before exporting your list.');
      return;
    }
    try {
      // Escape CSV cells and neutralise spreadsheet formulas in user-controlled text.
      const csvCell = (value: unknown) => {
        let text = String(value ?? '');
        if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      };
      const header = [
        'Service name', 'Category', 'Price (INR)', 'Billing cycle',
        'Next renewal date', 'Management URL', 'Notes', 'Reminder enabled', 'Created at',
      ];
      const rows = subscriptions.map((item) => [
        item.name, item.category, item.amount, item.cycle, item.nextRenewal,
        item.manageUrl, item.notes, item.reminderEnabled ? 'Yes' : 'No', item.createdAt,
      ]);
      const csv = '\uFEFF' + [header, ...rows]
        .map((row) => row.map(csvCell).join(','))
        .join('\r\n');
      const directory = FileSystem.cacheDirectory;
      if (!directory) throw new Error('The app cache folder is unavailable.');
      const fileUri = directory + 'subsathi-subscriptions-' + localDateString(new Date()) + '.csv';
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing is unavailable', 'This device cannot open the share sheet right now. Try again after restarting the app.');
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export SubSathi subscriptions',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      console.warn('Could not export subscriptions', error);
      Alert.alert('Export failed', 'SubSathi could not create the CSV file. Your saved subscriptions have not been changed.');
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
      setApiSession(null); setGmailEmail(null); setGmailAccounts([]); setScanCandidates([]); setSelectedCandidateIds([]);
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
      await withLocalDatabase((localDb) => localDb.runAsync("INSERT INTO app_settings (key, value) VALUES ('aiAssistedScan', 'false') ON CONFLICT(key) DO UPDATE SET value = excluded.value").then(() => undefined));
      setApiSession(null); setGmailEmail(null); setGmailAccounts([]); setScanCandidates([]); setSelectedCandidateIds([]); setAiAssistedScan(false);
      toastLocal('All Gmail accounts disconnected. Locally imported plans remain on this device.');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Disconnect failed.');
    } finally { setScanLoading(false); }
  };

  const toastLocal = (message: string) => Alert.alert('SubSathi', message);

  const openAdPrivacyOptions = async () => {
    try {
      const info = await AdsConsent.showPrivacyOptionsForm();
      setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === 'REQUIRED');
      if (info.canRequestAds) {
        if (!adsInitializedRef.current) {
          await mobileAds().initialize();
          adsInitializedRef.current = true;
        }
        setAdsReady(true);
      } else {
        setAdsReady(false);
      }
      toastLocal('Advertising privacy choices updated.');
    } catch (error) {
      console.warn('Could not open advertising privacy options', error);
      toastLocal('Privacy options are not available on this device right now.');
    }
  };

  const openScanner = () => {
    setScanError('');
    setScanInfoOpen(true);
    if (apiSession && gmailEmail) setTimeout(() => { void scanGmail(); }, 250);
  };

  const renderSubscriptionCard = (item: Subscription, compact = false) => {
    const meta = categoryMeta(item.category);
    const days = daysUntil(item.nextRenewal);
    const tone = days < 0 ? 'red' : days <= 7 ? 'orange' : 'grey';
    return (
      <Pressable key={item.id} onPress={() => openEdit(item)} style={({ pressed }) => [styles.subscriptionCard, compact && styles.compactCard, pressed && { opacity: 0.88 }]}>
        <View style={[styles.serviceIcon, { backgroundColor: meta.tint }]}><MaterialCommunityIcons name={categoryIconName(item.category)} size={23} color={C.ink} /></View>
        <View style={styles.subscriptionMain}>
          <Text style={styles.serviceName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.serviceSub}>{item.category} · {item.cycle === 'Unknown' ? 'Cycle not confirmed' : item.cycle}</Text>
          <Text style={styles.serviceSub}>Billed via {billingSourceLabel(item.billingSource)}</Text>
          <View style={styles.duePillRow}><Pill tone={tone}>{dueLabel(item.nextRenewal)}</Pill></View>
        </View>
        <View style={styles.subscriptionRight}>
          <Text style={styles.serviceAmount}>{item.amount === null ? 'Price unknown' : money(item.amount)}</Text>
          <Text style={styles.serviceSub}>{item.cycle === 'Unknown' ? 'Cycle not confirmed' : item.cycle === 'Yearly' ? '/ year' : item.cycle === 'Monthly' ? '/ month' : item.cycle === 'Quarterly' ? '/ quarter' : '/ week'}</Text>
          {!compact ? <Pressable onPress={(event) => { event.stopPropagation(); void openManage(item, 'manage'); }} style={styles.manageMini}><Text style={styles.manageMiniText}>Manage / renew ↗</Text></Pressable> : null}
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
      <LinearGradient colors={['#0B2230', '#124F4A', '#16A879']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <View pointerEvents="none" style={styles.heroDecorLarge} />
        <View pointerEvents="none" style={styles.heroDecorSmall} />
        <View pointerEvents="none" style={styles.heroArtwork}><MaterialCommunityIcons name="wallet-membership" size={54} color="rgba(255,255,255,0.17)" /><Feather name="trending-up" size={19} color="rgba(255,255,255,0.62)" style={styles.heroArtworkTrend} /></View>
        <View style={styles.heroTop}><View><Text style={styles.heroEyebrow}>YOUR RECURRING SPEND</Text><Text style={styles.heroAmount}>{money(activeMonthly)}<Text style={styles.heroPer}> / mo</Text></Text></View><View style={styles.heroIconBubble}><MaterialCommunityIcons name="chart-donut" size={26} color={C.white} /></View></View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStatsRow}>
          <View><Text style={styles.heroStatLabel}>Yearly estimate</Text><Text style={styles.heroStatValue}>{money(activeAnnual)}</Text></View>
          <View style={styles.heroStatsSeparator} />
          <View><Text style={styles.heroStatLabel}>Tracked plans</Text><Text style={styles.heroStatValue}>{subscriptions.length}</Text></View>
          <View style={styles.heroStatsSeparator} />
          <View><Text style={styles.heroStatLabel}>Due in 30 days</Text><Text style={styles.heroStatValue}>{nextThirtyDays.length}</Text></View>
        </View>
        {subscriptions.some((item) => !hasKnownPrice(item)) ? <Text style={{ color: '#D7EEE7', fontSize: 10, lineHeight: 14, marginTop: 10 }}>{subscriptions.filter((item) => !hasKnownPrice(item)).length} plan(s) with unconfirmed price/cycle are excluded from spend totals.</Text> : null}
      </LinearGradient>
      <Pressable accessibilityRole="button" onPress={openScanner} style={({ pressed }) => [styles.gmailBannerPressable, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
        <LinearGradient colors={gmailEmail ? ['#E8F8F0', '#D8F3E8'] : googleOAuthConfigured === false ? ['#EAF2FF', '#DCE8FF'] : ['#E9F8F1', '#D9F2E7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gmailBanner}>
          <View style={[styles.gmailBannerIcon, { backgroundColor: gmailEmail ? C.greenDark : C.navy }]}><Feather name={gmailEmail ? 'check-circle' : 'mail'} size={23} color={C.white} /></View>
          <View style={styles.gmailBannerCopy}>
            <Text style={styles.gmailBannerTitle}>{gmailEmail ? 'Gmail is connected' : googleOAuthConfigured === false ? 'Finish Gmail setup' : 'Find subscriptions automatically'}</Text>
            <Text style={styles.gmailBannerBody}>{gmailEmail ? `Connected to ${gmailEmail}. Scan receipts to refresh detections.` : googleOAuthConfigured === false ? 'Google OAuth is not configured on the server yet. Tap to view the exact setup needed.' : apiReachable === false ? 'The server is not responding. Your on-device tracker still works.' : 'Connect securely with Google and review billing-email matches before importing.'}</Text>
          </View>
          <Feather name={gmailEmail ? 'check' : 'arrow-up-right'} size={21} color={C.greenDark} />
        </LinearGradient>
      </Pressable>
      <View style={styles.quickActionRow}>
        <Pressable style={styles.quickAction} onPress={openNew}><View style={[styles.quickActionIcon, { backgroundColor: C.greenPale }]}><Feather name="plus" size={23} color={C.greenDark} /></View><Text style={styles.quickActionLabel}>Add plan</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={openScanner}><View style={[styles.quickActionIcon, { backgroundColor: C.bluePale }]}><Feather name="mail" size={21} color="#3568A8" /></View><Text style={styles.quickActionLabel}>Email scan</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => setTab('Insights')}><View style={[styles.quickActionIcon, { backgroundColor: C.orangePale }]}><Feather name="trending-up" size={21} color="#9C5E0C" /></View><Text style={styles.quickActionLabel}>Find savings</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => setTab('AI')}><View style={[styles.quickActionIcon, { backgroundColor: '#F1EAFE' }]}><Feather name="cpu" size={21} color="#7651A6" /></View><Text style={styles.quickActionLabel}>AI coach</Text></Pressable>
        <Pressable style={styles.quickAction} onPress={() => setTab('Subscriptions')}><View style={[styles.quickActionIcon, { backgroundColor: '#EAF2FF' }]}><Feather name="grid" size={21} color="#3568A8" /></View><Text style={styles.quickActionLabel}>All plans</Text></Pressable>
      </View>
      <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Coming up</Text><Pressable onPress={() => setTab('Subscriptions')}><Text style={styles.sectionAction}>View all</Text></Pressable></View>
      {upcoming.length ? <View style={styles.listCard}>{upcoming.slice(0, 4).map((item, index) => <View key={item.id}>{renderSubscriptionCard(item, true)}{index < Math.min(upcoming.length, 4) - 1 ? <View style={styles.innerDivider} /> : null}</View>)}</View> : <View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={{ fontSize: 26 }}>🗓️</Text></View><Text style={styles.emptyTitle}>No renewals coming up</Text><Text style={styles.emptyBody}>Add a subscription and SubSathi will help you keep an eye on its renewal date.</Text><PrimaryButton title="Add your first plan" onPress={openNew} /></View>}
      <View style={styles.tipCard}><View style={styles.tipIcon}><Text style={{ fontSize: 20 }}>💡</Text></View><View style={styles.tipCopy}><Text style={styles.tipTitle}>Small charges add up</Text><Text style={styles.tipBody}>Review your recurring plans once a month. Cancel unused plans directly with the provider.</Text></View></View>
      <Text style={styles.footerNote}>{gmailEmail ? `Gmail connected: ${gmailEmail}. Scan billing emails to discover plans automatically.` : 'Your tracker is stored on this device. Connect Gmail to start automatic subscription discovery.'}</Text>
    </ScrollView>
  );

  const renderSubscriptions = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageHeader}><Text style={styles.pageEyebrow}>YOUR SERVICES</Text><Text style={styles.pageTitle}>Subscriptions</Text><Text style={styles.pageSub}>{subscriptions.length} plan{subscriptions.length === 1 ? '' : 's'} tracked · {money(activeMonthly)} estimated monthly spend from confirmed prices</Text>
       {subscriptions.some((item) => !hasKnownPrice(item)) ? <Text style={styles.fieldHint}>{subscriptions.filter((item) => !hasKnownPrice(item)).length} plan(s) excluded from spend totals until price and billing cycle are confirmed.</Text> : null}</View>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search subscriptions..." placeholderTextColor="#91A0A4" style={styles.searchInput} returnKeyType="search" /><Pressable onPress={openNew} style={styles.searchAdd}><Text style={styles.searchAddText}>＋</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['All', ...CATEGORIES.map((category) => category.name)] as ('All' | Category)[]).map((name) => <Pressable key={name} onPress={() => setFilter(name)} style={[styles.filterChip, filter === name && styles.filterChipActive]}><Text style={[styles.filterText, filter === name && styles.filterTextActive]}>{name}</Text></Pressable>)}
      </ScrollView>
      {filtered.length ? <View style={styles.listCard}>{filtered.map((item, index) => <View key={item.id}>{renderSubscriptionCard(item)}<View style={styles.cardActionsRow}><Pressable onPress={() => openEdit(item)}><Text style={styles.cardAction}>Edit details</Text></Pressable><Text style={styles.actionDot}>·</Text><Pressable onPress={() => { void openManage(item, 'cancel'); }}><Text style={[styles.cardAction, { color: C.red }]}>Cancel renewal</Text></Pressable><Text style={styles.actionDot}>·</Text><Pressable onPress={() => deleteSubscription(item)}><Text style={[styles.cardAction, { color: C.muted }]}>Remove tracker</Text></Pressable></View>{index < filtered.length - 1 ? <View style={styles.listDivider} /> : null}</View>)}</View> : <View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={{ fontSize: 26 }}>🔎</Text></View><Text style={styles.emptyTitle}>{subscriptions.length ? 'No matches found' : 'Your list starts here'}</Text><Text style={styles.emptyBody}>{subscriptions.length ? 'Try another search or category.' : 'Add recurring plans like OTT, software, storage, gym, broadband and memberships.'}</Text>{!subscriptions.length ? <PrimaryButton title="Add subscription" onPress={openNew} /> : <GhostButton title="Clear filters" onPress={() => { setSearch(''); setFilter('All'); }} />}</View>}
      <View style={styles.noteBanner}><Text style={styles.noteBannerIcon}>ⓘ</Text><Text style={styles.noteBannerText}>Manage / renew opens the official billing page. Cancel renewal takes you to the service or payment platform to confirm cancellation; removing a tracker entry never cancels a real subscription.</Text></View>
    </ScrollView>
  );

  const renderInsights = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageHeader}><Text style={styles.pageEyebrow}>YOUR MONEY SNAPSHOT</Text><Text style={styles.pageTitle}>Insights</Text><Text style={styles.pageSub}>Know where your recurring money goes.</Text></View>
      <View style={styles.insightHero}><Text style={styles.insightHeroLabel}>ESTIMATED YEARLY COMMITMENT</Text><Text style={styles.insightHeroAmount}>{money(activeAnnual)}</Text><Text style={styles.insightHeroNote}>Totals include only plans with a confirmed price and billing cycle. Actual charges may vary.</Text><View style={styles.insightMetricRow}><View style={styles.insightMetric}><Text style={styles.insightMetricLabel}>Monthly equivalent</Text><Text style={styles.insightMetricValue}>{money(activeMonthly)}</Text></View><View style={styles.insightMetric}><Text style={styles.insightMetricLabel}>Due this month</Text><Text style={styles.insightMetricValue}>{money(currentMonthDue)}</Text></View></View></View>
      <SectionTitle title="Spend by category" />
      {categorySpend.length ? <View style={styles.panel}>{categorySpend.map((cat) => <View key={cat.name} style={styles.categorySpendRow}><View style={[styles.categorySpendIcon, { backgroundColor: cat.tint }]}><MaterialCommunityIcons name={categoryIconName(cat.name)} size={21} color={C.ink} /></View><View style={styles.categorySpendMain}><View style={styles.categorySpendNameRow}><Text style={styles.categorySpendName}>{cat.name}</Text><Text style={styles.categorySpendAmount}>{money(cat.amount)}<Text style={styles.categoryMonthly}> / mo</Text></Text></View><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, (cat.amount / (categorySpend[0]?.amount || 1)) * 100)}%` }]} /></View></View></View>)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Insights will appear here</Text><Text style={styles.emptyBody}>Add a few subscriptions to see your spending breakdown.</Text><PrimaryButton title="Add a plan" onPress={openNew} /></View>}
      <SectionTitle title="Things to review" />
      <View style={styles.panel}>
        {nextThirtyDays.length ? <View style={styles.reviewRow}><View style={[styles.reviewIcon, { backgroundColor: C.orangePale }]}><Text>⏰</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>{nextThirtyDays.length} upcoming renewal{nextThirtyDays.length === 1 ? '' : 's'}</Text><Text style={styles.reviewBody}>Review the plan and price before the charge date.</Text></View><Text style={styles.reviewArrow}>›</Text></View> : <View style={styles.reviewRow}><View style={[styles.reviewIcon, { backgroundColor: C.greenPale }]}><Text>✓</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>No renewals due in 30 days</Text><Text style={styles.reviewBody}>Add renewal dates to get a more useful view.</Text></View></View>}
        <View style={styles.innerDivider} />
        <View style={styles.reviewRow}><View style={[styles.reviewIcon, { backgroundColor: C.bluePale }]}><Text>🔍</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Smart Savings Radar</Text><Text style={styles.reviewBody}>A live review of repeated tracker entries, category overlap, upcoming renewals and missing billing details is shown below.</Text></View></View>
      </View>
      <SectionTitle title="Smart Savings Radar" />
      <View style={styles.panel}>
        <View style={{ backgroundColor: C.navy, borderRadius: 15, padding: 15, marginTop: 8, marginBottom: 10 }}>
          <Text style={{ color: '#B7CDD2', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>POTENTIAL MONTHLY SAVINGS TO INVESTIGATE</Text>
          <Text style={{ color: C.white, fontSize: 26, fontWeight: '800', marginTop: 5 }}>{money(savingsRadar.potentialMonthly)}<Text style={{ color: '#B7CDD2', fontSize: 11, fontWeight: '600' }}> / month</Text></Text>
          <Text style={{ color: '#B7CDD2', fontSize: 10, lineHeight: 15, marginTop: 5 }}>Estimated conservatively from the lowest-priced plan in each overlapping category. This is only a review opportunity—not confirmed savings or proof that plans are duplicates.</Text>
        </View>
        {savingsRadar.overlaps.length ? savingsRadar.overlaps.slice(0, 4).map((group) => (
          <View key={group.category} style={{ borderTopWidth: 1, borderTopColor: '#EEF2F1', paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: categoryMeta(group.category).tint, alignItems: 'center', justifyContent: 'center' }}><Text>{categoryMeta(group.category).emoji}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>{group.category} · {group.items.length} plans</Text>
                <Text style={styles.reviewBody}>{group.items.map((item) => item.name).join(' · ')}</Text>
                <Text style={styles.reviewBody}>{money(group.monthlySpend)}/mo tracked{group.reviewOpportunity > 0 ? ' · ' + money(group.reviewOpportunity) + '/mo to review' : ' · confirm prices to estimate'}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => { setSearch(''); setFilter(group.category); setTab('Subscriptions'); }} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.greenPale }}><Text style={{ color: C.greenDark, fontSize: 10, fontWeight: '800' }}>Review</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.reviewBody}>No multi-plan overlap found in entertainment, music, software or storage yet. Add or import plans and this review updates automatically.</Text>}
        {savingsRadar.repeatedEntries.map((item) => (
          <View key={item.name + item.category + item.source + item.count} style={{ borderTopWidth: 1, borderTopColor: '#EEF2F1', paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.reviewIcon, { backgroundColor: C.orangePale }]}><Text>↻</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewTitle}>Repeated tracker entry · {item.name}</Text>
              <Text style={styles.reviewBody}>{item.count} entries · {BILLING_SOURCE_LABELS[item.source]} · {money(item.monthlySpend)}/mo equivalent in the tracker. This does not prove the provider charged you twice.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => { setSearch(item.name); setFilter('All'); setTab('Subscriptions'); }} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.greenPale }}><Text style={{ color: C.greenDark, fontSize: 10, fontWeight: '800' }}>Check</Text></Pressable>
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderTopColor: '#EEF2F1', paddingTop: 12, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.reviewIcon, { backgroundColor: C.bluePale }]}><Text>🧾</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewTitle}>{savingsRadar.missingDetails} plan(s) need a details check</Text>
            <Text style={styles.reviewBody}>Missing price, billing cycle or renewal date means a plan may be absent from forecasts or alerts.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { setSearch(''); setFilter('All'); setTab('Subscriptions'); }} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.greenPale }}><Text style={{ color: C.greenDark, fontSize: 10, fontWeight: '800' }}>Fix</Text></Pressable>
        </View>
        {nextThirtyDays.length ? <View style={{ borderTopWidth: 1, borderTopColor: '#EEF2F1', paddingTop: 12, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.reviewIcon, { backgroundColor: C.orangePale }]}><Text>⏰</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewTitle}>{nextThirtyDays.length} renewal(s) in the next 30 days</Text>
            <Text style={styles.reviewBody}>Review upcoming charges before they happen. SubSathi cannot cancel a provider plan automatically.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { setSearch(''); setFilter('All'); setTab('Subscriptions'); }} style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.greenPale }}><Text style={{ color: C.greenDark, fontSize: 10, fontWeight: '800' }}>Review</Text></Pressable>
        </View> : null}
      </View>
      <Text style={styles.footerNote}>SubSathi calculates estimates from plans you saved on this device. It does not read bank statements or confirm which services you actively use.</Text>
    </ScrollView>
  );


  const renderAI = () => {
    const mostExpensive = [...subscriptions].filter(hasKnownPrice).sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))[0];
    const nextTracked = [...subscriptions].filter((item) => Boolean(item.nextRenewal) && daysUntil(item.nextRenewal) >= -7)
      .sort((a, b) => daysUntil(a.nextRenewal) - daysUntil(b.nextRenewal))[0];
    const duplicateNameCount = new Set(subscriptions.filter((item, index, all) =>
      all.findIndex((other) => other.name.trim().toLowerCase() === item.name.trim().toLowerCase()) !== index
    ).map((item) => item.name.trim().toLowerCase())).size;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>YOUR PRIVATE MONEY COACH</Text>
          <Text style={styles.pageTitle}>SmartSathi AI</Text>
          <Text style={styles.pageSub}>Hindi or English. Ask about spend, renewals, duplicates and ways to review costs.</Text>
        </View>
        <LinearGradient colors={['#0D2330', '#164F58', '#16A879']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiHero}>
          <View pointerEvents="none" style={styles.heroDecorLarge} />
          <View style={styles.aiHeroTop}>
            <View style={styles.aiOrb}><MaterialCommunityIcons name="robot-happy-outline" size={27} color={C.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiHeroTitle}>Your subscription co-pilot</Text>
              <Text style={styles.aiHeroSub}>Live insights from your saved plans · Voice enabled</Text>
            </View>
            <Pill tone={voiceListening ? 'orange' : 'green'}>{voiceListening ? 'Listening' : 'Ready'}</Pill>
          </View>
          {subscriptions.some((item) => !hasKnownPrice(item)) ? <Text style={[styles.aiHeroSub, { marginTop: 8 }]}>{subscriptions.filter((item) => !hasKnownPrice(item)).length} plan(s) with unconfirmed price/cycle are excluded from spend totals.</Text> : null}
          <View style={styles.aiHeroStatsRow}>
            <View style={styles.aiHeroStat}><Text style={styles.aiHeroStatLabel}>Monthly equivalent</Text><Text style={styles.aiHeroStatValue}>{money(activeMonthly)}</Text></View>
            <View style={styles.aiHeroStat}><Text style={styles.aiHeroStatLabel}>Tracked plans</Text><Text style={styles.aiHeroStatValue}>{subscriptions.length}</Text></View>
            <View style={styles.aiHeroStat}><Text style={styles.aiHeroStatLabel}>Next 30 days</Text><Text style={styles.aiHeroStatValue}>{nextThirtyDays.length} due</Text></View>
          </View>
        </LinearGradient>

        <SectionTitle title="Smart highlights" />
        <View style={styles.panel}>
          {subscriptions.length === 0 ? (
            <View style={styles.aiHighlightRow}>
              <View style={styles.aiHighlightIcon}><Feather name="plus-circle" size={20} color={C.greenDark} /></View>
              <View style={styles.aiHighlightCopy}><Text style={styles.aiHighlightTitle}>Start with your first plan</Text><Text style={styles.aiHighlightBody}>Add a subscription and SmartSathi will start analysing its recurring cost and renewal dates.</Text></View>
            </View>
          ) : (
            <>
              <View style={styles.aiHighlightRow}>
                <View style={styles.aiHighlightIcon}><Feather name="trending-up" size={20} color={C.greenDark} /></View>
                <View style={styles.aiHighlightCopy}><Text style={styles.aiHighlightTitle}>Highest monthly-equivalent cost</Text><Text style={styles.aiHighlightBody}>{mostExpensive ? `${mostExpensive.name}: ${money(monthlyEquivalent(mostExpensive))} per month equivalent. Review whether the plan still fits your needs.` : 'No confirmed price and billing cycle yet. Review a detected plan to add details when you have them.'}</Text></View>
              </View>
              <View style={styles.innerDivider} />
              <View style={styles.aiHighlightRow}>
                <View style={[styles.aiHighlightIcon, { backgroundColor: C.orangePale }]}><Feather name="calendar" size={20} color="#9C5E0C" /></View>
                <View style={styles.aiHighlightCopy}><Text style={styles.aiHighlightTitle}>{nextTracked ? 'Renewal to keep an eye on' : 'Add verified renewal dates'}</Text><Text style={styles.aiHighlightBody}>{nextTracked ? `${nextTracked.name} · ${dueLabel(nextTracked.nextRenewal)}` : 'A renewal date is needed before this can be forecast accurately.'}</Text></View>
              </View>
              <View style={styles.innerDivider} />
              <View style={styles.aiHighlightRow}>
                <View style={[styles.aiHighlightIcon, { backgroundColor: C.bluePale }]}><Feather name="copy" size={20} color="#3568A8" /></View>
                <View style={styles.aiHighlightCopy}><Text style={styles.aiHighlightTitle}>{duplicateNameCount ? 'Possible duplicate names found' : 'Duplicate check'}</Text><Text style={styles.aiHighlightBody}>{duplicateNameCount ? `${duplicateNameCount} service name(s) appear more than once. Ask SmartSathi to review possible duplicates, then verify directly with the provider.` : 'No exact duplicate names found. Similar plans may still exist under different names.'}</Text></View>
              </View>
            </>
          )}
        </View>

        <SectionTitle title="Ask SmartSathi" />
        <View style={styles.aiChatPanel}>
          {assistantMessages.map((message) => (
            <View key={message.id} style={[styles.aiMessage, message.role === 'user' ? styles.aiUserBubble : styles.aiAssistantBubble]}>
              <Text style={styles.aiMessageText}>{message.text}</Text>
            </View>
          ))}
          {voiceError ? <View style={styles.aiWarning}><Text style={styles.aiWarningText}>{voiceError}</Text></View> : null}
          <View style={styles.aiInputRow}>
            <TextInput
              value={assistantQuery}
              onChangeText={setAssistantQuery}
              placeholder={assistantLanguage === 'hi-IN' ? 'Apna sawaal yahan likho…' : 'Ask about spend, renewals or savings…'}
              placeholderTextColor="#91A0A4"
              style={styles.aiInput}
              returnKeyType="send"
              onSubmitEditing={() => answerAssistant(assistantQuery)}
              accessibilityLabel="Ask SmartSathi a question"
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Send question" onPress={() => answerAssistant(assistantQuery)} style={styles.aiSendButton}>
              <Feather name="arrow-up" size={20} color={C.white} />
            </Pressable>
          </View>
          <View style={styles.aiControls}>
            <Pressable onPress={() => setAssistantLanguage((value) => value === 'hi-IN' ? 'en-IN' : 'hi-IN')} style={[styles.aiToggle, assistantLanguage === 'hi-IN' && styles.aiToggleActive]}>
              <Text style={[styles.aiToggleText, assistantLanguage === 'hi-IN' && styles.aiToggleTextActive]}>{assistantLanguage === 'hi-IN' ? 'हिंदी' : 'English'} · Switch</Text>
            </Pressable>
            <Pressable onPress={() => setVoiceRepliesEnabled((value) => !value)} style={[styles.aiToggle, voiceRepliesEnabled && styles.aiToggleActive]}>
              <Text style={[styles.aiToggleText, voiceRepliesEnabled && styles.aiToggleTextActive]}>{voiceRepliesEnabled ? 'Voice reply on' : 'Voice reply off'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { if (voiceListening) ExpoSpeechRecognitionModule.stop(); else void startVoiceCapture(); }} style={[styles.aiVoiceButton, voiceListening && styles.aiVoiceButtonActive]}>
              <Feather name={voiceListening ? 'mic-off' : 'mic'} size={16} color={C.white} />
              <Text style={styles.aiVoiceText}>{voiceListening ? 'Stop listening' : 'Ask by voice'}</Text>
            </Pressable>
          </View>
        </View>

        <SectionTitle title="Try asking" />
        <View style={styles.aiQuickRow}>
          {['Mera monthly kharcha kitna hai?', 'Agla renewal kab hai?', 'How can I save money?', 'Show my yearly spend'].map((prompt) => (
            <Pressable key={prompt} onPress={() => answerAssistant(prompt)} style={styles.aiQuickChip}>
              <Text style={styles.aiQuickText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.footerNote}>SmartSathi analyses only the subscription entries saved in this app; your chat is processed on this phone and is not sent to a cloud AI service. Voice recognition is provided by your device's speech service, whose network and privacy behaviour may depend on Android settings. Amounts and duplicate matches are estimates—verify details before acting.</Text>
      </ScrollView>
    );
  };

  const renderSettings = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageHeader}><Text style={styles.pageEyebrow}>YOUR APP</Text><Text style={styles.pageTitle}>Settings</Text><Text style={styles.pageSub}>Privacy, alerts and connected services.</Text></View>
      <View style={styles.profilePanel}><BrandMark size={52} /><View style={{ flex: 1 }}><Text style={styles.profilePanelTitle}>SubSathi</Text><Text style={styles.profilePanelSub}>Local-first · Version 0.5.12 · SmartSathi AI</Text></View><Pill tone="green">On device</Pill></View>
      <View style={styles.panel}>
        <Text style={styles.settingsSectionLabel}>REMINDERS</Text>
        <View style={styles.settingRow}><View style={styles.settingIcon}><Text>🔔</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Renewal notifications</Text><Text style={styles.settingBody}>Remind two days before, at 9:00 AM when permitted.</Text></View><Switch value={notificationsEnabled} onValueChange={(value) => { setNotificationsEnabled(value); void withLocalDatabase((db) => db.runAsync("INSERT INTO app_settings (key, value) VALUES ('notificationsEnabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", value ? 'true' : 'false').then(() => undefined)).catch((error) => { console.warn('Could not save notification preference', error); Alert.alert('Preference not saved', 'Renewal notifications changed for this session. Restart SubSathi and retry if the setting does not persist.'); }); void rescheduleRenewalReminders(subscriptions, value); }} trackColor={{ false: '#CBD5D4', true: '#A7E4CD' }} thumbColor={notificationsEnabled ? C.green : '#F6F7F7'} /></View>
        <View style={styles.innerDivider} />
        <Text style={styles.settingsSectionLabel}>CONNECTED SERVICES</Text>
        <Pressable onPress={openScanner} style={styles.settingRow}><View style={[styles.settingIcon, { backgroundColor: C.bluePale }]}><Text>✉</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Gmail auto-detection</Text><Text style={styles.settingBody}>{gmailEmail ? (gmailAccounts.length || 1) + ' Gmail account(s) connected · scan inboxes together.' : 'Not connected · secure Google OAuth setup required.'}</Text></View><Text style={styles.settingArrow}>›</Text></Pressable>
        <View style={styles.innerDivider} />
         {privacyOptionsRequired ? <><View style={styles.innerDivider} /><Pressable onPress={() => { void openAdPrivacyOptions(); }} style={styles.settingRow}><View style={[styles.settingIcon, { backgroundColor: C.greenPale }]}><Text>◈</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Advertising privacy choices</Text><Text style={styles.settingBody}>Review or change the choices shown by Google's consent form.</Text></View><Text style={styles.settingArrow}>›</Text></Pressable></> : null}
        <View style={styles.settingRow}><View style={styles.settingIcon}><Text>🔐</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>Local-first data</Text><Text style={styles.settingBody}>{gmailEmail ? 'Tracker entries remain on this device. Each linked Gmail inbox is scanned only after its owner grants Google consent; full receipt bodies are processed but not saved.' : 'This MVP stores tracker entries in local SQLite. Gmail, SMS, bank and UPI access are separate sources and are not silently accessible.'}</Text></View></View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.settingsSectionLabel}>DATA MANAGEMENT</Text>
        <Pressable style={styles.settingsActionRow} onPress={() => { void exportSubscriptions(); }}><Text style={styles.settingsAction}>Export my subscription list (CSV)</Text><Text style={styles.settingArrow}>›</Text></Pressable>
        <View style={styles.innerDivider} />
        <Pressable style={styles.settingsActionRow} onPress={() => Alert.alert('Clear all tracker data?', 'This permanently removes all subscriptions stored in this app. It will not cancel any real subscription.', [{ text: 'Keep data', style: 'cancel' }, { text: 'Clear all', style: 'destructive', onPress: async () => { try { await withLocalDatabase((db) => db.runAsync('DELETE FROM subscriptions').then(() => undefined)); await Notifications.cancelAllScheduledNotificationsAsync(); await loadSubscriptions(); setTab('Home'); } catch (error) { console.warn('Could not clear local tracker', error); Alert.alert('Could not clear data', 'Your tracker was not deliberately cleared. Restart SubSathi and retry.'); } } }])}><Text style={[styles.settingsAction, { color: C.red }]}>Clear all tracker data</Text><Text style={styles.settingArrow}>›</Text></Pressable>
        {apiSession ? <><View style={styles.innerDivider} /><Pressable style={styles.settingsActionRow} onPress={() => Alert.alert('Delete server account?', 'This removes the SubSathi server account, encrypted Gmail credentials and cached scan candidates. Tracker entries saved locally on this phone will remain.', [{ text: 'Keep account', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: () => { void deleteServerAccount(); } }])}><Text style={[styles.settingsAction, { color: C.red }]}>Delete SubSathi server account</Text><Text style={styles.settingArrow}>›</Text></Pressable></> : null}
      </View>
      <Text style={styles.footerNote}>Gmail only finds subscriptions evidenced in connected inboxes. Phone-number-only sign-ups, SMS and UPI/card mandates need separate, explicit integrations.</Text>
    </ScrollView>
  );

  if (!ready) return <SafeAreaView edges={['top', 'bottom']} style={styles.loadingScreen}><StatusBar barStyle="dark-content" backgroundColor={C.cream} /><BrandMark size={58} /><Text style={styles.loadingTitle}>SubSathi</Text><ActivityIndicator color={C.green} style={{ marginTop: 12 }} /><Text style={styles.loadingSub}>Getting your subscriptions ready...</Text></SafeAreaView>;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <Animated.View style={[styles.appContent, { opacity: screenProgress, transform: [{ translateY: screenProgress.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }] }]}>
        {tab === 'Home' ? renderHome() : tab === 'Subscriptions' ? renderSubscriptions() : tab === 'AI' ? renderAI() : tab === 'Insights' ? renderInsights() : renderSettings()}
      </Animated.View>
      {adsReady && !adFailed ? <View style={styles.adContainer}>
        {isTestAds ? <Text style={styles.adTestLabel}>TEST AD · NOT PAID</Text> : null}
        <BannerAd
          key={adUnitId}
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => setAdFailed(false)}
          onAdFailedToLoad={(error) => {
            console.warn('SubSathi banner ad failed to load', error);
            setAdFailed(true);
          }}
        />
      </View> : null}
      <View style={[styles.bottomNav, { height: 72 + insets.bottom, paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0) }]}>
        {([['Home', 'home'], ['Subscriptions', 'layers'], ['AI', 'cpu'], ['Insights', 'pie-chart'], ['Settings', 'settings']] as [Tab, keyof typeof Feather.glyphMap][]).map(([name, icon]) => <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} onPress={() => setTab(name)} style={styles.navItem}><View style={[styles.navIconWrap, tab === name && styles.navIconActive]}><Feather name={icon} size={20} style={[styles.navIcon, tab === name && styles.navIconSelected]} /></View><Text style={[styles.navLabel, tab === name && styles.navLabelSelected]}>{name}</Text></Pressable>)}
      </View>
      <SubscriptionEditor visible={editorOpen} initial={editing} onClose={() => { setEditorOpen(false); setEditing(null); }} onSave={saveSubscription} onDelete={editing ? () => deleteSubscription(editing) : undefined} />
      <Modal visible={scanInfoOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setScanInfoOpen(false)}>
        <SafeAreaView style={styles.editorSafeArea}>
          <View style={styles.editorHeader}><Pressable onPress={() => setScanInfoOpen(false)} style={styles.editorClose}><Text style={styles.editorCloseText}>✕</Text></Pressable><View style={{ flex: 1 }}><Text style={styles.editorTitle}>Automatic discovery</Text><Text style={styles.editorSubtitle}>Find subscriptions from billing emails</Text></View><Pill tone={gmailEmail && apiReachable === true && !gmailNeedsRepair ? 'green' : 'orange'}>{!gmailEmail ? 'Not connected' : apiReachable === false ? 'Offline' : gmailNeedsRepair ? 'Repair access' : apiReachable === null ? 'Checking' : 'Connected'}</Pill></View>
          <ScrollView contentContainerStyle={styles.editorScroll} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 16 }}>
              <LinearGradient colors={['#DFF6EB', '#E7F0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.infoModalIcon, { marginBottom: 12 }]}><Feather name="mail" size={26} color={C.greenDark} /></LinearGradient>
              <Text style={styles.modalTitle}>{gmailEmail ? gmailNeedsRepair ? 'Gmail access needs repair' : apiReachable === false ? 'Gmail linked · server offline' : 'Gmail is connected' : 'Stop adding every plan manually'}</Text>
              <Text style={styles.modalIntro}>{gmailEmail ? `Connected account: ${gmailEmail}. Scan relevant billing emails, then review the detected subscriptions before importing them to this phone.` : 'Connect through Google’s official secure consent screen. SubSathi will search for billing receipts, renewal notices and recurring payment emails. It never asks for your Gmail password.'}</Text>
              {googleOAuthConfigured === false ? <View style={styles.oauthSetupNotice}>
                <View style={styles.oauthNoticeTitleRow}><Feather name="alert-circle" size={17} color="#9B5A08" /><Text style={styles.oauthSetupTitle}>Server setup required</Text></View>
                <Text style={styles.oauthSetupBody}>Google sign-in cannot start until the app owner configures Google OAuth on the hosted server. Enable Gmail API in that same project. Never paste a client secret into the APK or chat.</Text>
              </View> : apiReachable === false ? <View style={styles.oauthSetupNotice}><View style={styles.oauthNoticeTitleRow}><Feather name="wifi-off" size={17} color="#9B5A08" /><Text style={styles.oauthSetupTitle}>Server temporarily unreachable</Text></View><Text style={styles.oauthSetupBody}>Gmail was linked previously, but SubSathi could not reach its server after retrying. This is a network/DNS or server-connectivity problem—not evidence that your subscriptions disappeared. Your phone's saved tracker remains available offline.</Text></View> : null}
              {apiReachable === false ? <GhostButton title={scanLoading ? 'Retrying server…' : 'Retry server connection'} onPress={() => {
                if (scanLoading) return;
                void (async () => {
                  setScanError('');
                  const reachable = await refreshApiHealth();
                  if (reachable && apiSession && gmailEmail) await scanGmail(undefined, 'quick');
                  else if (!reachable) setScanError('SubSathi server is still unreachable after three checks. Your local tracker remains safe; retry once the network/server is available.');
                })();
              }} /> : null}
              {durableDatabaseConfigured === false ? <View style={[styles.oauthSetupNotice, { marginTop: 10 }]}>
                <View style={styles.oauthNoticeTitleRow}><Feather name="database" size={17} color="#9B5A08" /><Text style={styles.oauthSetupTitle}>Cloud storage needs a permanent database</Text></View>
                <Text style={styles.oauthSetupBody}>The live API is reporting temporary storage. Gmail login details may need repair after a server restart, though your on-device subscription tracker is separate. The app owner must connect the managed PostgreSQL database before relying on persistent cloud connections.</Text>
              </View> : null}
              {gmailNeedsRepair && gmailEmail ? <View style={[styles.oauthSetupNotice, { marginTop: 10 }]}>
                <View style={styles.oauthNoticeTitleRow}><Feather name="shield" size={17} color="#9B5A08" /><Text style={styles.oauthSetupTitle}>Gmail permission needs repair</Text></View>
                <Text style={styles.oauthSetupBody}>Google rejected the saved Gmail access token. Use the repair button below to approve the permission again. Do not disconnect the whole SubSathi account, and do not uninstall the app.</Text>
              </View> : null}
              <View style={styles.infoChecklist}>
                <Text style={styles.infoChecklistLine}>✓ Read billing-related emails only using Gmail search</Text>
                <Text style={styles.infoChecklistLine}>✓ Detect supported services, amounts and cycle hints</Text>
                <Text style={styles.infoChecklistLine}>✓ Never invent a missing renewal date</Text>
                <Text style={styles.infoChecklistLine}>✓ Review detections before importing</Text>
              </View>
              {scanError && googleOAuthConfigured !== false ? <View style={{ borderRadius: 12, backgroundColor: C.redPale, padding: 12, marginBottom: 12 }}><Text style={{ color: C.red, fontSize: 11, lineHeight: 16 }}>{scanError}</Text></View> : null}
              {scanLoading ? <View style={{ paddingVertical: 18, alignItems: 'center' }}><ActivityIndicator color={C.green} size="large" /><Text style={styles.settingBody}>{gmailEmail ? 'Checking recent receipts and renewals in parallel…' : 'Opening Google authorization…'}</Text><Text style={[styles.fieldHint, { textAlign: 'center', marginTop: 5 }]}>Only likely billing emails are analysed. This should be much quicker than checking every message one by one.</Text></View> : null}
              {!gmailEmail ? <PrimaryButton title={googleOAuthConfigured === false ? 'Check Gmail setup again' : 'Connect Gmail securely'} onPress={() => { void connectGmail(); }} /> : <View style={{ gap: 9 }}>
                <PrimaryButton title={scanLoading ? 'Syncing new emails…' : 'Quick sync new billing emails'} onPress={() => { if (!scanLoading) void scanGmail(undefined, 'quick'); }} />
                <GhostButton title={scanLoading ? 'Rescanning…' : 'Deep rescan' + (serverScanLimit ? ' · up to ' + serverScanLimit.toLocaleString() + ' emails' : '')} onPress={() => { if (!scanLoading) void scanGmail(undefined, 'full'); }} />
                <Text style={styles.fieldHint}>Quick sync checks new email only. Deep rescan searches provider, billing, trial and renewal wording. {serverScanLimit ? 'The server limit is ' + serverScanLimit.toLocaleString() + ' selected messages per inbox.' : 'The server scan limit is being checked.'} Gmail search remains bounded, so no scan can promise every historic message was covered.</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F7FAF8', borderColor: C.line, borderWidth: 1, borderRadius: 13, padding: 12, marginTop: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>OPTIONAL AI-ASSISTED EXTRACTION</Text>
                    <Text style={styles.fieldHint}>{aiExtractionConfigured === true
                      ? 'When enabled, AI reviews up to 100 billing-email excerpts per inbox (3,500 body characters each), prioritising uncertain or incomplete detections before checking complete local matches. Enabling it runs a full rescan. Selected excerpts are sent to OpenAI only with this setting enabled; verified evidence can correct parser results, but AI never invents prices or dates. This preference is saved on this phone.'
                      : aiExtractionConfigured === false
                        ? 'AI extraction is not configured on the server yet. Standard email detection remains available; the app will not send email text to an AI service.'
                        : 'Checking whether optional AI extraction is configured on the server…'}</Text>
                  </View>
                  <Switch
                    value={aiAssistedScan}
                    disabled={aiExtractionConfigured !== true || scanLoading}
                    onValueChange={(value) => {
                      void withLocalDatabase(async (db) => {
                        await db.runAsync("INSERT INTO app_settings (key, value) VALUES ('aiAssistedScan', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", value ? 'true' : 'false');
                        await db.runAsync("INSERT INTO app_settings (key, value) VALUES ('aiConsentResolved', 'true') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
                      }).then(() => {
                        setAiAssistedScan(value);
                        if (value && apiSession && gmailEmail && !scanLoading) void scanGmail(undefined, 'full', true);
                      }).catch(() => Alert.alert('Could not save AI preference', 'SubSathi has not changed the AI setting. Restart the app and retry.'));
                    }}
                    trackColor={{ false: '#CBD5D4', true: '#A7E4CD' }}
                    thumbColor={aiAssistedScan ? C.green : '#F6F7F7'}
                    accessibilityLabel="Allow AI-assisted billing email extraction"
                  />
                </View>
                <GhostButton title={scanLoading ? 'Checking access…' : gmailNeedsRepair ? 'Repair Gmail connection' : 'Refresh / repair Gmail access'} onPress={() => { if (!scanLoading) void connectGmail(); }} />
                <GhostButton title="Connect another Gmail account" onPress={() => { if (!scanLoading) void connectAdditionalGmail(); }} />
                <GhostButton title="Disconnect all Gmail accounts" onPress={() => { Alert.alert('Disconnect all Gmail accounts?', 'All linked Gmail credentials and cached detections will be removed from the server. Subscription entries already imported on this phone will remain.', [{ text: 'Keep connected', style: 'cancel' }, { text: 'Disconnect all', style: 'destructive', onPress: () => { void disconnectGmail(); } }]); }} />
                {gmailAccounts.filter((account) => !account.primary).map((account) => <Pressable key={account.email} disabled={scanLoading} onPress={() => Alert.alert('Remove Gmail account?', 'Remove ' + account.email + ' from this SubSathi profile?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove account', style: 'destructive', onPress: () => { void disconnectAdditionalGmail(account.email); } }])} style={{ paddingVertical: 7 }}><Text style={{ fontSize: 10, color: C.muted }}>Secondary inbox · {account.email} · tap to remove</Text></Pressable>)}
              </View>}
            </View>
            {gmailEmail && scanSummary ? <View style={{ backgroundColor: C.greenPale, borderRadius: 13, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: C.greenDark, fontSize: 11, fontWeight: '800' }}>{scanSummary.mode === 'full' ? 'Deep rescan' : 'Quick sync'} · Searched {scanSummary.scannedMessages} messages across {scanSummary.accountsScanned.length} Gmail account(s){scanSummary.durationMs > 0 ? ` in ${(scanSummary.durationMs / 1000).toFixed(1)}s` : ''}</Text>
              <Text style={{ color: '#42695E', fontSize: 10, lineHeight: 15, marginTop: 4 }}>Ran {scanSummary.queriesUsed} search paths across the inbox(es); opened {scanSummary.fullMessagesFetched} likely billing email(s), detected {scanSummary.matchedReceipts} matching message(s), and found {scanSummary.candidateCount} subscription candidate(s).</Text>
              <Text style={{ color: '#42695E', fontSize: 10, lineHeight: 15, marginTop: 4 }}>Server cap: up to {scanSummary.scanLimitPerAccount.toLocaleString()} selected messages per inbox per scan. Combined search hits can include the same email more than once.</Text>
              {scanSummary.scanLimitReached ? <Text style={{ color: '#8B5108', fontSize: 10, lineHeight: 15, marginTop: 7, fontWeight: '700' }}>Coverage note: this server allowed up to {scanSummary.scanLimitPerAccount.toLocaleString()} messages per inbox for this pass and the search hit its cap. These results are not proof that your inbox contains only this many subscriptions; older or unusually worded billing emails may still be missed.</Text> : null}
              {scanSummary.aiAssisted ? <Text style={{ color: '#42695E', fontSize: 10, lineHeight: 15, marginTop: 5 }}>{scanSummary.aiWarning || (scanSummary.aiAnalyzedMessages > 0 ? `AI-assisted extraction reviewed ${scanSummary.aiAnalyzedMessages} incomplete/uncertain email(s) and only added fields supported by quoted email evidence.` : 'AI-assisted mode was enabled, but no incomplete or uncertain emails needed extra analysis in this scan.')}</Text> : null}
              {scanSummary.accountErrors.map((item) => <Text key={item.email} style={{ color: C.red, fontSize: 10, lineHeight: 15, marginTop: 5 }}>{item.email}: {item.message}</Text>)}
            </View> : null}
            {gmailEmail && scanCandidates.length > 0 ? <View style={{ marginBottom: 18 }}>
              <SectionTitle
                title="Detected subscriptions"
                action={selectedCandidateIds.length ? 'Clear selection' : 'Select all new'}
                onAction={() => setSelectedCandidateIds((current) => current.length
                  ? []
                  : scanCandidates.filter((item) => !item.alreadyImported).map((item) => item.id))}
              />
              <Text style={styles.fieldHint}>New detections are selected automatically. AI checks available billing evidence, and you can correct any price, cycle or renewal date before importing. Unconfirmed values stay blank.</Text>
              {scanCandidates.map((candidate) => {
                const selected = selectedCandidateIds.includes(candidate.id);
                const categoryMetaItem = categoryMeta(candidate.category);
                const canReviewDetails = !candidate.alreadyImported;
                const draft = candidateEdits[candidate.id] || {
                  amountText: candidate.amount === null ? '' : String(candidate.amount),
                  cycle: candidate.cycle,
                  renewalText: candidate.nextRenewal || '',
                };
                return <View key={candidate.id} style={{ backgroundColor: C.white, borderColor: selected ? C.green : C.line, borderWidth: selected ? 1.5 : 1, borderRadius: 15, marginTop: 9, overflow: 'hidden', opacity: candidate.alreadyImported ? 0.7 : 1 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${candidate.name}`}
                    disabled={candidate.alreadyImported}
                    onPress={() => setSelectedCandidateIds((current) => selected ? current.filter((id) => id !== candidate.id) : [...current, candidate.id])}
                    style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, minHeight: 80 }}
                  >
                    <View style={{ width: 25, height: 25, borderRadius: 8, borderWidth: 1.5, borderColor: selected ? C.green : '#CBD7D2', backgroundColor: selected ? C.green : C.white, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.white, fontSize: 14, fontWeight: '900' }}>{selected ? '✓' : ''}</Text>
                    </View>
                    <View style={[styles.serviceIcon, { backgroundColor: categoryMetaItem.tint }]}><Text style={styles.serviceEmoji}>{categoryMetaItem.emoji}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.serviceName}>{candidate.name}</Text>
                      <Text style={styles.serviceSub}>{candidate.evidenceCount} billing email(s) · Confidence {candidate.confidence}%</Text>
                      <Text style={styles.serviceSub}>Billed via {candidate.billingSourceLabel}</Text>
                      {candidate.sourceAccounts.length ? <Text style={styles.serviceSub}>Inbox: {candidate.sourceAccounts.join(', ')}</Text> : null}
                      <Text style={styles.serviceSub}>{candidate.nextRenewal ? `Renewal: ${formatDate(candidate.nextRenewal)}` : 'Renewal date not in email — optional'}{candidate.cycle === 'Unknown' ? ' · Cycle needs review' : ` · ${candidate.cycle}`}</Text>
                      {candidate.alreadyImported ? <Pill tone="grey">Already tracked</Pill> : candidate.needsReview ? <Pill tone="orange">Review details</Pill> : <Pill tone="green">Detected</Pill>}
                    </View>
                    <View style={{ alignItems: 'flex-end', maxWidth: 100 }}>
                      <Text style={styles.serviceAmount}>{candidate.amount !== null ? money(candidate.amount) : 'Price needed'}</Text>
                      <Text style={[styles.serviceSub, { textAlign: 'right' }]}>{candidate.amount === null ? 'Price needed' : candidate.cycle === 'Unknown' ? 'Billing cycle needed' : `per ${candidate.cycle.toLowerCase()}`}</Text>
                    </View>
                  </Pressable>
                  {canReviewDetails ? <Pressable onPress={() => setExpandedCandidateIds((current) => current.includes(candidate.id) ? current.filter((id) => id !== candidate.id) : [...current, candidate.id])} style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}><Text style={{ color: C.greenDark, fontSize: 11, fontWeight: '800' }}>{expandedCandidateIds.includes(candidate.id) ? 'Hide details' : 'Review / correct details'}</Text></Pressable> : null}
                  {expandedCandidateIds.includes(candidate.id) && canReviewDetails ? <View style={{ borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#F8FBF9', padding: 13 }}>
                    <Text style={styles.fieldLabel}>PRICE (INR)</Text>
                    <Text style={styles.fieldHint}>Check this against the recurring plan charge. Clear it if the amount is not confirmed.</Text>
                    <TextInput
                      value={draft.amountText}
                      onChangeText={(value) => setCandidateEdits((current) => ({ ...current, [candidate.id]: { ...draft, amountText: value } }))}
                      placeholder="e.g. 199"
                      placeholderTextColor="#97A5A8"
                      style={styles.input}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`Price for ${candidate.name}`}
                    />
                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>BILLING CYCLE</Text>
                    <View style={styles.cycleRow}>{(['Unknown', ...CYCLES] as (Cycle | 'Unknown')[]).map((cycle) => <Pressable key={cycle} onPress={() => setCandidateEdits((current) => ({ ...current, [candidate.id]: { ...draft, cycle } }))} style={[styles.cycleChip, draft.cycle === cycle && styles.cycleChipActive]}><Text style={[styles.cycleChipText, draft.cycle === cycle && styles.cycleChipTextActive]}>{cycle === 'Unknown' ? 'Not confirmed' : cycle}</Text></Pressable>)}</View>
                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>NEXT RENEWAL DATE</Text>
                    <Text style={styles.fieldHint}>Confirm or correct the date as YYYY-MM-DD. Clear it if there is no verified date.</Text>
                    <TextInput
                      value={draft.renewalText}
                      onChangeText={(value) => setCandidateEdits((current) => ({ ...current, [candidate.id]: { ...draft, renewalText: value } }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#97A5A8"
                      style={styles.input}
                      keyboardType="numbers-and-punctuation"
                      accessibilityLabel={`Renewal date for ${candidate.name}`}
                      maxLength={10}
                    />
                  </View> : null}
                </View>;
              })}
              <View style={{ marginTop: 14 }}>
                <PrimaryButton title={scanLoading ? 'Importing…' : selectedCandidateIds.length ? `Import ${selectedCandidateIds.length} selected` : 'Select a subscription to import'} onPress={() => { if (!scanLoading && selectedCandidateIds.length) void importGmailCandidates(); }} />
              </View>
            </View> : null}
            {gmailEmail && !scanCandidates.length && !scanLoading ? <View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={{ fontSize: 26 }}>🔎</Text></View><Text style={styles.emptyTitle}>{scanError || (scanSummary?.accountErrors.length ? 'Scan incomplete — some emails failed' : scanSummary?.scanLimitReached ? 'Scan reached its coverage limit' : scanSummary ? 'No subscriptions confidently identified' : 'Ready to find your subscriptions')}</Text><Text style={styles.emptyBody}>{scanError ? 'The latest scan did not complete successfully. Read the error above, wait until any Gmail rate limit clears, then retry. This does not mean your inbox has no subscriptions.' : scanSummary?.accountErrors.length ? 'At least one Gmail operation failed. Results are incomplete; use the account error above to decide whether to repair access or wait for quota reset. Do not treat zero candidates as proof that there are no subscriptions.' : scanSummary?.scanLimitReached ? `SubSathi searched ${scanSummary.scannedMessages} messages but hit the server coverage limit of ${scanSummary.scanLimitPerAccount.toLocaleString()} messages per inbox. This is a partial scan, not proof that every subscription was found.` : scanSummary ? `SubSathi opened ${scanSummary.fullMessagesFetched} likely billing emails but found no message with enough recurring-subscription evidence to create a candidate. Some services send receipts with different wording; results remain incomplete until the relevant service email is recognized.` : 'Scan billing emails to discover supported plans. Some providers omit their price or renewal date, so review any incomplete detections before importing them.'}</Text></View> : null}
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
  const [cycle, setCycle] = useState<Cycle | 'Unknown'>('Monthly');
  const [nextRenewal, setNextRenewal] = useState('');
  const [manageUrl, setManageUrl] = useState('');
  const [billingSource, setBillingSource] = useState<BillingSource>('provider');
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setCategory(initial?.category ?? 'Entertainment');
    setAmount(initial?.amount == null ? '' : String(initial.amount));
    setCycle(initial?.cycle ?? 'Monthly');
    setNextRenewal(initial?.nextRenewal ?? '');
    setManageUrl(initial?.manageUrl ?? '');
    setBillingSource(normalizeBillingSource(initial?.billingSource));
    setNotes(initial?.notes ?? '');
    setReminderEnabled(initial ? Boolean(initial.reminderEnabled) : true);
    setSaving(false);
  }, [visible, initial]);

  const submit = async () => {
    const hasAmount = amount.trim().length > 0;
    const numericAmount = hasAmount ? Number(amount.replace(/,/g, '').trim()) : null;
    if (!name.trim()) { Alert.alert('Add a service name', 'For example, Adobe, Netflix, Hotstar or Gym.'); return; }
    if (hasAmount && (!Number.isFinite(numericAmount) || (numericAmount ?? 0) <= 0 || (numericAmount ?? 0) > 10000000)) { Alert.alert('Check the amount', 'Enter a valid amount greater than ₹0, or leave it blank until confirmed.'); return; }
    if (nextRenewal.trim() && !validDate(nextRenewal.trim())) { Alert.alert('Check the renewal date', 'Use YYYY-MM-DD, or leave the field blank until you confirm the date with the provider.'); return; }
    if (manageUrl.trim() && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(manageUrl.trim())) { Alert.alert('Check the management link', 'Enter a website address such as https://example.com/account.'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), category, amount: numericAmount, cycle, nextRenewal: nextRenewal.trim(),
        manageUrl: manageUrl.trim(), billingSource, notes: notes.trim(), reminderEnabled: reminderEnabled ? 1 : 0,
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
          <Text style={styles.fieldLabel}>CATEGORY</Text><View style={styles.categoryGrid}>{CATEGORIES.map((cat) => <Pressable key={cat.name} onPress={() => setCategory(cat.name)} style={[styles.categoryOption, category === cat.name && styles.categoryOptionActive]}><MaterialCommunityIcons name={categoryIconName(cat.name)} size={19} color={category === cat.name ? C.greenDark : C.muted} /><Text style={[styles.categoryOptionText, category === cat.name && styles.categoryOptionTextActive]}>{cat.name}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>PRICE (INR, OPTIONAL UNTIL CONFIRMED)</Text><View style={styles.amountInputWrap}><Text style={styles.rupeeSign}>₹</Text><TextInput value={amount} onChangeText={setAmount} placeholder="Leave blank if unknown" placeholderTextColor="#97A5A8" style={styles.amountInput} keyboardType="decimal-pad" /></View>
          <Text style={styles.fieldLabel}>BILLING CYCLE</Text><View style={styles.cycleRow}>{(['Unknown', ...CYCLES] as (Cycle | 'Unknown')[]).map((item) => <Pressable key={item} onPress={() => setCycle(item)} style={[styles.cycleChip, item === cycle && styles.cycleChipActive]}><Text style={[styles.cycleChipText, item === cycle && styles.cycleChipTextActive]}>{item === 'Unknown' ? 'Not confirmed' : item}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>NEXT RENEWAL DATE (OPTIONAL)</Text><TextInput value={nextRenewal} onChangeText={setNextRenewal} placeholder="Leave blank if not confirmed" placeholderTextColor="#97A5A8" style={styles.input} autoCapitalize="none" maxLength={10} />
          <Text style={styles.fieldHint}>Only enter a date confirmed by the provider. Format: YYYY-MM-DD. Leave blank if unknown; reminders need a verified date.</Text>
          <Text style={styles.fieldLabel}>BILLED THROUGH</Text>
          <View style={styles.categoryGrid}>{BILLING_SOURCE_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => setBillingSource(option.value)} style={[styles.categoryOption, billingSource === option.value && styles.categoryOptionActive]}><Text style={[styles.categoryOptionText, billingSource === option.value && styles.categoryOptionTextActive]}>{option.label}</Text></Pressable>)}</View>
          <Text style={styles.fieldHint}>Choose where this subscription is charged so SubSathi can open the correct official management page.</Text>
          <Text style={styles.fieldLabel}>OFFICIAL MANAGEMENT LINK (OPTIONAL)</Text><TextInput value={manageUrl} onChangeText={setManageUrl} placeholder="https://provider.com/account" placeholderTextColor="#97A5A8" style={styles.input} autoCapitalize="none" keyboardType="url" autoCorrect={false} />
          <Text style={styles.fieldHint}>Only use the service’s official account page. Renewal and cancellation confirmation happen with that provider.</Text>
          <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text><TextInput value={notes} onChangeText={setNotes} placeholder="Plan name, billing account, cancellation notes..." placeholderTextColor="#97A5A8" style={[styles.input, styles.notesInput]} multiline maxLength={400} />
          <View style={styles.reminderRow}><View style={{ flex: 1 }}><Text style={styles.settingTitle}>Renewal reminder</Text><Text style={styles.settingBody}>Notify me two days before, if permissions allow.</Text></View><Switch value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ false: '#CBD5D4', true: '#A7E4CD' }} thumbColor={reminderEnabled ? C.green : '#F6F7F7'} /></View>
          <PrimaryButton title={saving ? 'Saving...' : initial ? 'Save changes' : 'Save subscription'} onPress={() => { if (!saving) void submit(); }} />
          {initial && onDelete ? <Pressable onPress={onDelete} style={styles.deleteFromEditor}><Text style={styles.deleteFromEditorText}>Remove from tracker</Text></Pressable> : null}
          <Text style={styles.formPrivacyNote}>Details stay in local app storage in this MVP. Unknown prices are excluded from spend estimates. This does not cancel, renew or change your real provider plan.</Text>
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
  safeArea: { flex: 1, backgroundColor: C.cream }, appContent: { flex: 1, minHeight: 0 }, adContainer: { minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 2, paddingBottom: 2 }, adTestLabel: { color: '#829398', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 1 }, scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream }, loadingTitle: { marginTop: 12, color: C.ink, fontSize: 24, fontWeight: '800' }, loadingSub: { marginTop: 10, fontSize: 13, color: C.muted },
  brandMark: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.green, overflow: 'hidden' }, brandName: { fontSize: 20, color: C.ink, fontWeight: '800', letterSpacing: -0.6 }, brandTagline: { marginTop: 2, fontSize: 11, color: C.muted }, brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 }, homeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 }, profileCircle: { height: 40, width: 40, borderRadius: 20, backgroundColor: '#E1ECE8', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D2E1DB' }, profileText: { color: C.greenDark, fontWeight: '800', fontSize: 16 },
  heroCard: { borderRadius: 26, padding: 21, overflow: 'hidden', minHeight: 175 }, heroDecorLarge: { position: 'absolute', width: 205, height: 205, borderRadius: 103, right: -66, top: -60, backgroundColor: 'rgba(255,255,255,0.055)' }, heroDecorSmall: { position: 'absolute', width: 125, height: 125, borderRadius: 63, right: 44, bottom: -88, backgroundColor: 'rgba(255,255,255,0.07)' }, heroArtwork: { position: 'absolute', right: 60, top: 54, opacity: 1, transform: [{ rotate: '-12deg' }] }, heroArtworkTrend: { position: 'absolute', right: -5, top: -2 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroEyebrow: { fontSize: 10, letterSpacing: 1.2, color: '#B7CDD2', fontWeight: '700' }, heroAmount: { marginTop: 7, fontSize: 31, fontWeight: '800', color: C.white, letterSpacing: -1 }, heroPer: { fontSize: 13, fontWeight: '500', color: '#B7CDD2', letterSpacing: 0 }, heroIconBubble: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }, heroDivider: { height: 1, backgroundColor: '#2C4650', marginVertical: 18 }, heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroStatLabel: { color: '#B7CDD2', fontSize: 10, marginBottom: 6 }, heroStatValue: { color: C.white, fontSize: 13, fontWeight: '700' }, heroStatsSeparator: { width: 1, height: 30, backgroundColor: '#2C4650', marginHorizontal: 3 },
  gmailBannerPressable: { marginTop: 13, marginBottom: 5, borderRadius: 20, overflow: 'hidden', shadowColor: '#0A5038', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }, gmailBanner: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 11, borderRadius: 20, minHeight: 86 }, gmailBannerIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, gmailBannerCopy: { flex: 1, minWidth: 0 }, gmailBannerTitle: { color: C.ink, fontSize: 12, fontWeight: '800', letterSpacing: -0.15 }, gmailBannerBody: { color: '#58716B', fontSize: 10, lineHeight: 15, marginTop: 5 },
  quickActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 24 }, quickAction: { alignItems: 'center', width: '19%' }, quickActionIcon: { height: 52, width: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, quickActionLabel: { color: C.ink, fontSize: 11, fontWeight: '600', marginTop: 8 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 1 }, sectionTitle: { color: C.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 }, sectionAction: { color: C.greenDark, fontSize: 12, fontWeight: '700' },
  listCard: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 4 }, subscriptionCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 11 }, compactCard: { paddingVertical: 11 }, serviceIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, serviceEmoji: { fontSize: 20 }, subscriptionMain: { flex: 1, minWidth: 0 }, serviceName: { color: C.ink, fontSize: 13, fontWeight: '800' }, serviceSub: { color: C.muted, fontSize: 10, marginTop: 4 }, duePillRow: { marginTop: 7 }, subscriptionRight: { alignItems: 'flex-end', minWidth: 75 }, serviceAmount: { color: C.ink, fontSize: 13, fontWeight: '800' }, manageMini: { paddingTop: 8, paddingBottom: 2 }, manageMiniText: { color: C.greenDark, fontSize: 10, fontWeight: '700' }, innerDivider: { height: 1, backgroundColor: '#EEF2F1', marginLeft: 0 }, listDivider: { height: 1, backgroundColor: C.line }, cardActionsRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 11, gap: 8 }, cardAction: { fontSize: 11, color: C.greenDark, fontWeight: '700' }, actionDot: { color: '#ADB9BA' },
  emptyCard: { paddingHorizontal: 24, paddingVertical: 28, borderRadius: 20, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', backgroundColor: C.white, alignItems: 'center' }, emptyIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.greenPale, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, emptyTitle: { textAlign: 'center', color: C.ink, fontSize: 16, fontWeight: '800' }, emptyBody: { textAlign: 'center', color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 17 }, primaryButton: { backgroundColor: C.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 14, minHeight: 47 }, primaryButtonSmall: { minHeight: 38, paddingVertical: 9 }, primaryButtonText: { color: C.white, fontSize: 13, fontWeight: '800' }, ghostButton: { borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 }, ghostButtonText: { color: C.ink, fontSize: 12, fontWeight: '700' }, tipCard: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 15, padding: 14, backgroundColor: '#EAF4F0', borderRadius: 16, gap: 10 }, tipIcon: { width: 36, height: 36, backgroundColor: C.white, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, tipCopy: { flex: 1 }, tipTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, tipBody: { marginTop: 5, color: '#56716C', fontSize: 11, lineHeight: 17 }, footerNote: { color: '#8B999C', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 16, marginHorizontal: 8 },
  bottomNav: { height: 72, flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 8, justifyContent: 'space-around', alignItems: 'center' }, navItem: { alignItems: 'center', justifyContent: 'center', width: '20%', gap: 3 }, navIconWrap: { height: 30, minWidth: 48, borderRadius: 13, justifyContent: 'center', alignItems: 'center' }, navIconActive: { backgroundColor: C.greenPale }, navIcon: { color: '#829297' }, navIconSelected: { color: C.greenDark }, navLabel: { color: '#89999D', fontSize: 9, fontWeight: '600' }, navLabelSelected: { color: C.greenDark, fontWeight: '800' },
  pageHeader: { marginTop: 9, marginBottom: 20 }, pageEyebrow: { color: C.greenDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 }, pageTitle: { color: C.ink, fontSize: 29, fontWeight: '800', letterSpacing: -1 }, pageSub: { color: C.muted, fontSize: 12, marginTop: 6, lineHeight: 18 }, searchBox: { height: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.line, paddingLeft: 13, paddingRight: 7, marginBottom: 13 }, searchIcon: { fontSize: 26, color: '#8B9A9E', marginRight: 9 }, searchInput: { flex: 1, fontSize: 13, color: C.ink, paddingVertical: 7 }, searchAdd: { width: 37, height: 37, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }, searchAddText: { color: C.white, fontSize: 24, fontWeight: '500', marginTop: -2 }, filterRow: { gap: 7, paddingBottom: 14 }, filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, filterChipActive: { backgroundColor: C.navy, borderColor: C.navy }, filterText: { fontSize: 11, color: C.muted, fontWeight: '700' }, filterTextActive: { color: C.white }, noteBanner: { marginTop: 14, padding: 13, backgroundColor: C.bluePale, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, noteBannerIcon: { color: '#3865A8', fontWeight: '800' }, noteBannerText: { color: '#496B91', fontSize: 10, lineHeight: 16, flex: 1 },
  insightHero: { backgroundColor: C.navy, borderRadius: 22, padding: 20, marginBottom: 23 }, insightHeroLabel: { color: '#B7CDD2', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, insightHeroAmount: { color: C.white, fontSize: 31, fontWeight: '800', marginTop: 7, letterSpacing: -1 }, insightHeroNote: { color: '#B7CDD2', fontSize: 10, marginTop: 6, lineHeight: 15 }, insightMetricRow: { flexDirection: 'row', gap: 12, borderTopColor: '#2C4650', borderTopWidth: 1, marginTop: 17, paddingTop: 15 }, insightMetric: { flex: 1 }, insightMetricLabel: { color: '#B7CDD2', fontSize: 10 }, insightMetricValue: { color: C.white, fontSize: 14, fontWeight: '800', marginTop: 5 }, panel: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingHorizontal: 15, paddingVertical: 7, marginBottom: 21 }, categorySpendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 11 }, categorySpendIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, categorySpendMain: { flex: 1 }, categorySpendNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, categorySpendName: { color: C.ink, fontSize: 12, fontWeight: '700' }, categorySpendAmount: { color: C.ink, fontSize: 11, fontWeight: '800' }, categoryMonthly: { color: C.muted, fontWeight: '500', fontSize: 9 }, barTrack: { height: 5, backgroundColor: '#EEF2F1', borderRadius: 5, overflow: 'hidden', marginTop: 9 }, barFill: { height: 5, borderRadius: 5, backgroundColor: C.green }, reviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 }, reviewIcon: { height: 38, width: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, reviewCopy: { flex: 1 }, reviewTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, reviewBody: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 4 }, reviewArrow: { color: C.muted, fontSize: 24 },
  aiHero: { borderRadius: 24, padding: 18, marginBottom: 20, overflow: 'hidden' }, aiHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, aiOrb: { height: 48, width: 48, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }, aiHeroTitle: { color: C.white, fontSize: 17, fontWeight: '800' }, aiHeroSub: { color: '#C7E2DD', fontSize: 10, lineHeight: 15, marginTop: 4 }, aiHeroStatsRow: { flexDirection: 'row', gap: 10, borderTopColor: 'rgba(255,255,255,0.15)', borderTopWidth: 1, marginTop: 17, paddingTop: 15 }, aiHeroStat: { flex: 1 }, aiHeroStatLabel: { color: '#C7E2DD', fontSize: 9, marginBottom: 5 }, aiHeroStatValue: { color: C.white, fontSize: 13, fontWeight: '800' },
  aiChatPanel: { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 18 }, aiMessage: { maxWidth: '92%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, marginBottom: 9 }, aiUserBubble: { alignSelf: 'flex-end', backgroundColor: C.greenPale, borderBottomRightRadius: 4 }, aiAssistantBubble: { alignSelf: 'flex-start', backgroundColor: '#F2F6F5', borderBottomLeftRadius: 4 }, aiMessageText: { color: C.ink, fontSize: 12, lineHeight: 18 }, aiInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }, aiInput: { flex: 1, minHeight: 45, maxHeight: 100, backgroundColor: C.cream, borderRadius: 13, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: C.ink }, aiSendButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }, aiControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 10, flexWrap: 'wrap' }, aiToggle: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }, aiToggleActive: { backgroundColor: C.greenPale, borderColor: C.green }, aiToggleText: { fontSize: 10, fontWeight: '700', color: C.muted }, aiToggleTextActive: { color: C.greenDark }, aiVoiceButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: C.navy }, aiVoiceButtonActive: { backgroundColor: '#A73737' }, aiVoiceText: { color: C.white, fontSize: 10, fontWeight: '800' }, aiQuickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }, aiQuickChip: { borderRadius: 20, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.white }, aiQuickText: { color: C.ink, fontSize: 10, fontWeight: '700' }, aiHighlightRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 }, aiHighlightIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.greenPale }, aiHighlightCopy: { flex: 1 }, aiHighlightTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, aiHighlightBody: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, aiWarning: { padding: 12, borderRadius: 12, backgroundColor: C.orangePale, marginBottom: 12 }, aiWarningText: { color: '#8B5108', fontSize: 10, lineHeight: 15 },
  profilePanel: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 16 }, profilePanelTitle: { color: C.ink, fontSize: 15, fontWeight: '800' }, profilePanelSub: { color: C.muted, fontSize: 11, marginTop: 4 }, settingsSectionLabel: { color: '#829398', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 13, marginBottom: 5 }, settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 }, settingIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#EFF4F2', alignItems: 'center', justifyContent: 'center' }, settingCopy: { flex: 1 }, settingTitle: { color: C.ink, fontSize: 12, fontWeight: '800' }, settingBody: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, settingArrow: { color: '#8DA0A4', fontSize: 23, paddingLeft: 4 }, settingsActionRow: { paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, settingsAction: { color: C.ink, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9, 28, 36, 0.48)', justifyContent: 'center', alignItems: 'center', padding: 22 }, infoModal: { backgroundColor: C.white, borderRadius: 25, padding: 23, width: '100%', maxWidth: 430 }, infoModalIcon: { width: 58, height: 58, backgroundColor: C.bluePale, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }, modalTitle: { color: C.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.6 }, modalIntro: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 10 }, infoChecklist: { gap: 11, backgroundColor: C.cream, borderRadius: 15, padding: 14, marginTop: 16, marginBottom: 18 }, infoChecklistLine: { color: C.ink, fontSize: 11, fontWeight: '600' }, oauthSetupNotice: { borderRadius: 15, backgroundColor: '#FFF6E7', borderWidth: 1, borderColor: '#F4D9A9', padding: 13, marginBottom: 13 }, oauthNoticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, oauthSetupTitle: { color: '#8B5108', fontSize: 12, fontWeight: '800' }, oauthSetupBody: { color: '#785B34', fontSize: 10, lineHeight: 16, marginTop: 7 },
  editorSafeArea: { flex: 1, backgroundColor: C.cream }, editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.white }, editorClose: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F0F4F3', alignItems: 'center', justifyContent: 'center' }, editorCloseText: { color: C.ink, fontSize: 17 }, editorTitle: { color: C.ink, fontSize: 18, fontWeight: '800' }, editorSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 }, editorScroll: { padding: 20, paddingBottom: 35 }, fieldLabel: { color: '#62777D', fontWeight: '800', fontSize: 10, letterSpacing: 1, marginTop: 18, marginBottom: 9 }, input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, color: C.ink, fontSize: 13, minHeight: 49, paddingHorizontal: 14, paddingVertical: 12 }, categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, categoryOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, categoryOptionActive: { backgroundColor: C.greenPale, borderColor: C.green }, categoryOptionText: { color: C.muted, fontSize: 10, fontWeight: '700' }, categoryOptionTextActive: { color: C.greenDark }, amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingLeft: 15 }, rupeeSign: { color: C.ink, fontSize: 20, fontWeight: '700' }, amountInput: { flex: 1, minHeight: 49, paddingHorizontal: 10, color: C.ink, fontSize: 18, fontWeight: '700' }, cycleRow: { flexDirection: 'row', gap: 7 }, cycleChip: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }, cycleChipActive: { backgroundColor: C.navy, borderColor: C.navy }, cycleChipText: { color: C.muted, fontSize: 10, fontWeight: '700' }, cycleChipTextActive: { color: C.white }, fieldHint: { fontSize: 10, lineHeight: 15, color: C.muted, marginTop: 6 }, notesInput: { minHeight: 78, textAlignVertical: 'top' }, reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 14 }, deleteFromEditor: { alignItems: 'center', paddingVertical: 14 }, deleteFromEditorText: { color: C.red, fontSize: 12, fontWeight: '800' }, formPrivacyNote: { color: '#8B999C', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 14, marginBottom: 10 },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
