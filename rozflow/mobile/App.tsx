import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type Screen = 'Today' | 'Plan' | 'Habits' | 'Focus' | 'Money' | 'Settings';
type AddKind = 'task' | 'habit' | 'bill' | 'expense' | null;
type Priority = 'High' | 'Medium' | 'Low';
type Task = { id: number; title: string; note: string; dueDate: string; priority: Priority; done: number; createdAt: string };
type Habit = { id: number; title: string; icon: string; tint: string; createdAt: string };
type HabitLog = { habit_id: number; day: string };
type Bill = { id: number; title: string; amount: number; dueDate: string; repeatEvery: 'Never' | 'Monthly' | 'Yearly'; notificationId: string | null; createdAt: string };
type Expense = { id: number; amount: number; category: string; note: string; day: string; createdAt: string };
type AddForm = { title: string; note: string; date: string; amount: string; category: string; priority: Priority; repeatEvery: 'Never' | 'Monthly' | 'Yearly' };
const C = {
  ink: '#112A33', muted: '#71848A', green: '#13A879', greenDark: '#087B58',
  mint: '#DDF8EB', cream: '#F5F8F6', white: '#FFFFFF', line: '#E1EAE6',
  navy: '#0A2532', blue: '#E5F0FF', amber: '#FFF1D9', red: '#C84D55',
  redPale: '#FCE9E9', violet: '#EFE8FF', shadow: '#082A32',
};
const HABIT_TEMPLATES = [
  { title: 'Drink water', icon: 'water-outline', tint: '#DFF3FF' },
  { title: 'Move for 10 min', icon: 'run', tint: '#E0F7E8' },
  { title: 'Read 10 pages', icon: 'book-open-page-variant-outline', tint: '#F0E8FF' },
  { title: 'Plan tomorrow', icon: 'calendar-check-outline', tint: '#FFF0D9' },
];
const EXPENSE_CATEGORIES = ['Food', 'Travel', 'Shopping', 'Bills', 'Health', 'Other'];
const PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];

function localDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function dayDate(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12, 0, 0, 0);
}
function dateLabel(day: string, short = false) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Date not set';
  const date = dayDate(day);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return date.toLocaleDateString('en-IN', short
    ? { day: 'numeric', month: 'short' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
}
function money(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
}
function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = dayDate(day);
  return !Number.isNaN(parsed.getTime()) && localDay(parsed) === day;
}
function streakFor(habitId: number, logs: HabitLog[]) {
  const done = new Set(logs.filter((log) => log.habit_id === habitId).map((log) => log.day));
  const cursor = new Date();
  if (!done.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (done.has(localDay(cursor)) && streak < 3660) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
function nextDate(day: string, repeat: 'Monthly' | 'Yearly') {
  const date = dayDate(day);
  const originalDay = date.getDate();
  if (repeat === 'Monthly') {
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDay));
  } else {
    const month = date.getMonth();
    date.setFullYear(date.getFullYear() + 1);
    if (date.getMonth() !== month) date.setDate(0);
  }
  return localDay(date);
}
function friendlyHour() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function dateHeading() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function ActionButton({ title, onPress, tone = 'green', compact = false, icon }: {
  title: string; onPress: () => void; tone?: 'green' | 'light' | 'dark' | 'red'; compact?: boolean; icon?: keyof typeof Feather.glyphMap;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.actionButton, tone === 'green' && styles.actionGreen, tone === 'dark' && styles.actionDark,
        tone === 'red' && styles.actionRed, tone === 'light' && styles.actionLight, compact && styles.actionCompact,
        pressed && { opacity: 0.86, transform: [{ scale: 0.985 }] }]}>
      {icon ? <Feather name={icon} size={compact ? 14 : 16} color={tone === 'light' ? C.ink : C.white} /> : null}
      <Text style={[styles.actionText, tone === 'light' && { color: C.ink }]}>{title}</Text>
    </Pressable>
  );
}
function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && onAction ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}  ›</Text></Pressable> : null}</View>;
}
function AppContent() {
  const insets = useSafeAreaInsets();
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const splashScale = useRef(new Animated.Value(0.68)).current;
  const splashRotate = useRef(new Animated.Value(0)).current;
  const splashGlow = useRef(new Animated.Value(0.35)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [screen, setScreen] = useState<Screen>('Today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState('15000');
  const [addKind, setAddKind] = useState<AddKind>(null);
  const [form, setForm] = useState<AddForm>({ title: '', note: '', date: localDay(), amount: '', category: 'Food', priority: 'Medium', repeatEvery: 'Monthly' });
  const [saving, setSaving] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusEndAt, setFocusEndAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [focusToday, setFocusToday] = useState(0);
  const [expenseFilter, setExpenseFilter] = useState<'Month' | 'Today'>('Month');
  const [budgetDraft, setBudgetDraft] = useState('15000');
  const [search, setSearch] = useState('');
  const focusFinishHandled = useRef(false);

  const withDb = useCallback(async <T,>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    let db = dbRef.current;
    if (!db) {
      db = await SQLite.openDatabaseAsync('rozflow.db');
      dbRef.current = db;
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', dueDate TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Medium', done INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, icon TEXT NOT NULL, tint TEXT NOT NULL, createdAt TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS habit_logs (habit_id INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (habit_id, day));
        CREATE TABLE IF NOT EXISTS bills (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, amount REAL NOT NULL, dueDate TEXT NOT NULL, repeatEvery TEXT NOT NULL DEFAULT 'Monthly', notificationId TEXT, createdAt TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, category TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', day TEXT NOT NULL, createdAt TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS focus_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, minutes INTEGER NOT NULL, day TEXT NOT NULL, completedAt TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      `);
    }
    return fn(db);
  }, []);

  const refreshData = useCallback(async () => {
    const data = await withDb(async (db) => {
      const [nextTasks, nextHabits, nextLogs, nextBills, nextExpenses, focus, savedBudget] = await Promise.all([
        db.getAllAsync<Task>('SELECT * FROM tasks ORDER BY done ASC, dueDate ASC, CASE priority WHEN "High" THEN 0 WHEN "Medium" THEN 1 ELSE 2 END, id DESC'),
        db.getAllAsync<Habit>('SELECT * FROM habits ORDER BY id ASC'),
        db.getAllAsync<HabitLog>('SELECT * FROM habit_logs'),
        db.getAllAsync<Bill>('SELECT * FROM bills ORDER BY dueDate ASC, id DESC'),
        db.getAllAsync<Expense>('SELECT * FROM expenses ORDER BY day DESC, id DESC'),
        db.getFirstAsync<{ total: number | null }>('SELECT SUM(minutes) AS total FROM focus_sessions WHERE day = ?', localDay()),
        db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = "monthlyBudget"'),
      ]);
      return { nextTasks, nextHabits, nextLogs, nextBills, nextExpenses, focus: focus?.total ?? 0, budget: savedBudget?.value ?? '15000' };
    });
    setTasks(data.nextTasks); setHabits(data.nextHabits); setHabitLogs(data.nextLogs);
    setBills(data.nextBills); setExpenses(data.nextExpenses); setFocusToday(data.focus);
    setBudget(data.budget); setBudgetDraft(data.budget);
  }, [withDb]);

  useEffect(() => {
    let mounted = true;
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Bill reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 220, 120, 220],
    }).catch((error) => console.warn('Could not prepare bill reminder channel', error));
    const entrance = Animated.parallel([
      Animated.sequence([
        Animated.spring(splashScale, { toValue: 1.08, speed: 11, bounciness: 7, useNativeDriver: true }),
        Animated.spring(splashScale, { toValue: 1, speed: 15, bounciness: 4, useNativeDriver: true }),
      ]),
      Animated.timing(splashRotate, { toValue: 1, duration: 950, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(splashGlow, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(splashGlow, { toValue: 0.56, duration: 520, useNativeDriver: true }),
      ]),
    ]);
    entrance.start(({ finished }) => { if (mounted && finished) setSplashDone(true); });
    void refreshData().catch((error) => {
      console.warn('RozFlow local database initialization failed', error);
      Alert.alert('Could not open local data', 'Please restart RozFlow. Your app data has not been intentionally cleared.');
    }).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; entrance.stop(); };
  }, [refreshData, splashScale, splashRotate, splashGlow]);

  useEffect(() => {
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(orbFloat, { toValue: 1, duration: 2100, useNativeDriver: true }),
      Animated.timing(orbFloat, { toValue: 0, duration: 2100, useNativeDriver: true }),
    ]));
    floating.start();
    return () => floating.stop();
  }, [orbFloat]);

  useEffect(() => {
    if (focusEndAt === null) return undefined;
    let mounted = true;
    const tick = () => {
      const left = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
      if (mounted) setSecondsLeft(left);
      if (left === 0 && !focusFinishHandled.current) {
        focusFinishHandled.current = true;
        setFocusEndAt(null);
        void withDb((db) => db.runAsync('INSERT INTO focus_sessions (minutes, day, completedAt) VALUES (?, ?, ?)', focusMinutes, localDay(), new Date().toISOString()).then(() => undefined))
          .then(() => refreshData())
          .then(() => Alert.alert('Focus session complete ✨', `${focusMinutes} minutes of focused work. Take a short break and enjoy the win.`))
          .catch((error) => console.warn('Could not save focus session', error));
      }
    };
    tick();
    const handle = setInterval(tick, 400);
    return () => { mounted = false; clearInterval(handle); };
  }, [focusEndAt, focusMinutes, refreshData, withDb]);

  const today = localDay();
  const todayTasks = useMemo(() => tasks.filter((task) => task.dueDate === today), [tasks, today]);
  const completedToday = todayTasks.filter((task) => task.done === 1).length;
  const openTasks = tasks.filter((task) => task.done === 0);
  const upcomingBills = bills.filter((bill) => bill.dueDate >= today).slice(0, 4);
  const monthStart = today.slice(0, 7) + '-01';
  const monthExpenses = useMemo(() => expenses.filter((item) => item.day >= monthStart && item.day <= today), [expenses, monthStart, today]);
  const todayExpenses = useMemo(() => expenses.filter((item) => item.day === today), [expenses, today]);
  const spentThisMonth = monthExpenses.reduce((sum, item) => sum + item.amount, 0);
  const spentToday = todayExpenses.reduce((sum, item) => sum + item.amount, 0);
  const budgetNumber = Math.max(0, Number(budget) || 0);
  const remainingBudget = budgetNumber - spentThisMonth;
  const taskProgress = todayTasks.length ? Math.round(completedToday / todayTasks.length * 100) : 0;
  const habitCompletedToday = habits.filter((habit) => habitLogs.some((log) => log.habit_id === habit.id && log.day === today)).length;
  const filteredTasks = tasks.filter((task) => (search.trim() === '' || (task.title + ' ' + task.note).toLowerCase().includes(search.toLowerCase())));
  const visibleExpenses = expenseFilter === 'Today' ? todayExpenses : monthExpenses;
  const categoryTotals = EXPENSE_CATEGORIES.map((category) => ({
    category, total: monthExpenses.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0),
  })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  const rotateIntro = splashRotate.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '0deg'] });
  const orbTranslate = orbFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const orbTurn = orbFloat.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  const setField = <K extends keyof AddForm>(key: K, value: AddForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const openAdd = (kind: Exclude<AddKind, null>) => {
    setForm({ title: '', note: '', date: today, amount: '', category: 'Food', priority: 'Medium', repeatEvery: 'Monthly' });
    setAddKind(kind);
  };
  const markTask = async (task: Task) => {
    try {
      await withDb((db) => db.runAsync('UPDATE tasks SET done = ? WHERE id = ?', task.done ? 0 : 1, task.id).then(() => undefined));
      await refreshData();
    } catch { Alert.alert('Could not update task', 'Your saved tasks are unchanged. Please try again.'); }
  };
  const deleteTask = (task: Task) => Alert.alert('Remove task?', task.title, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      await withDb((db) => db.runAsync('DELETE FROM tasks WHERE id = ?', task.id).then(() => undefined));
      await refreshData();
    } },
  ]);
  const toggleHabit = async (habit: Habit) => {
    const alreadyDone = habitLogs.some((log) => log.habit_id === habit.id && log.day === today);
    await withDb((db) => alreadyDone
      ? db.runAsync('DELETE FROM habit_logs WHERE habit_id = ? AND day = ?', habit.id, today).then(() => undefined)
      : db.runAsync('INSERT OR IGNORE INTO habit_logs (habit_id, day) VALUES (?, ?)', habit.id, today).then(() => undefined));
    await refreshData();
  };
  const addHabitTemplate = async (item: typeof HABIT_TEMPLATES[number]) => {
    if (habits.some((habit) => habit.title.toLowerCase() === item.title.toLowerCase())) {
      Alert.alert('Already on your list', 'You can check in on this habit every day.');
      return;
    }
    await withDb((db) => db.runAsync('INSERT INTO habits (title, icon, tint, createdAt) VALUES (?, ?, ?, ?)', item.title, item.icon, item.tint, new Date().toISOString()).then(() => undefined));
    await refreshData();
  };
  const deleteHabit = (habit: Habit) => Alert.alert('Remove habit?', `Remove "${habit.title}" and its check-in history from this device?`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      await withDb(async (db) => {
        await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ?', habit.id);
        await db.runAsync('DELETE FROM habits WHERE id = ?', habit.id);
      });
      await refreshData();
    } },
  ]);
  const scheduleBillReminder = async (bill: Pick<Bill, 'title' | 'amount' | 'dueDate'>) => {
    try {
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return null;
      const due = dayDate(bill.dueDate);
      due.setDate(due.getDate() - 1);
      due.setHours(9, 0, 0, 0);
      if (due.getTime() <= Date.now()) return null;
      return await Notifications.scheduleNotificationAsync({
        content: { title: `Upcoming bill: ${bill.title}`, body: `${money(bill.amount)} is due on ${dateLabel(bill.dueDate)}. Keep your day on track.`, data: { dueDate: bill.dueDate, bill: bill.title } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due },
      });
    } catch (error) {
      console.warn('Bill reminder could not be scheduled', error);
      return null;
    }
  };
  const saveForm = async () => {
    if (!addKind || saving) return;
    setSaving(true);
    try {
      if (addKind === 'task') {
        if (!form.title.trim()) { Alert.alert('Add a task name', 'Give your next action a short, clear title.'); return; }
        if (!validDay(form.date)) { Alert.alert('Check the date', 'Use YYYY-MM-DD, for example 2026-10-20.'); return; }
        await withDb((db) => db.runAsync('INSERT INTO tasks (title, note, dueDate, priority, done, createdAt) VALUES (?, ?, ?, ?, 0, ?)', form.title.trim(), form.note.trim(), form.date, form.priority, new Date().toISOString()).then(() => undefined));
      } else if (addKind === 'habit') {
        if (!form.title.trim()) { Alert.alert('Name your habit', 'A small habit is easier to repeat.'); return; }
        if (habits.some((habit) => habit.title.toLowerCase() === form.title.trim().toLowerCase())) { Alert.alert('Habit already exists', 'Choose a different name or check in on your existing habit.'); return; }
        await withDb((db) => db.runAsync('INSERT INTO habits (title, icon, tint, createdAt) VALUES (?, ?, ?, ?)', form.title.trim(), 'star-four-points-outline', '#E0F7E8', new Date().toISOString()).then(() => undefined));
      } else if (addKind === 'bill') {
        const amount = Number(form.amount.replace(/,/g, '').trim());
        if (!form.title.trim()) { Alert.alert('Name the bill', 'For example, electricity, rent or phone recharge.'); return; }
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) { Alert.alert('Check the amount', 'Enter a valid amount greater than zero.'); return; }
        if (!validDay(form.date)) { Alert.alert('Check the due date', 'Use YYYY-MM-DD, for example 2026-10-20.'); return; }
        const data = { title: form.title.trim(), amount, dueDate: form.date };
        const billId = await withDb(async (db) => {
          const result = await db.runAsync('INSERT INTO bills (title, amount, dueDate, repeatEvery, notificationId, createdAt) VALUES (?, ?, ?, ?, NULL, ?)', data.title, amount, data.dueDate, form.repeatEvery, new Date().toISOString());
          return result.lastInsertRowId;
        });
        const notificationId = await scheduleBillReminder(data);
        if (notificationId) await withDb((db) => db.runAsync('UPDATE bills SET notificationId = ? WHERE id = ?', notificationId, billId).then(() => undefined));
      } else if (addKind === 'expense') {
        const amount = Number(form.amount.replace(/,/g, '').trim());
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) { Alert.alert('Check the amount', 'Enter a valid amount greater than zero.'); return; }
        await withDb((db) => db.runAsync('INSERT INTO expenses (amount, category, note, day, createdAt) VALUES (?, ?, ?, ?, ?)', amount, form.category, form.note.trim(), today, new Date().toISOString()).then(() => undefined));
      }
      setAddKind(null);
      await refreshData();
    } catch (error) {
      console.warn('Could not save RozFlow entry', error);
      Alert.alert('Could not save', 'The entry was not confirmed. Your other saved data is unchanged; please try again.');
    } finally {
      setSaving(false);
    }
  };
  const markBillPaid = (bill: Bill) => {
    const next = bill.repeatEvery === 'Never' ? null : nextDate(bill.dueDate, bill.repeatEvery);
    Alert.alert(next ? 'Mark bill paid?' : 'Remove paid bill?', next ? `Next due date will be ${dateLabel(next)}.` : `"${bill.title}" will be removed from upcoming bills.`, [
      { text: 'Not yet', style: 'cancel' },
      { text: next ? 'Paid · schedule next' : 'Paid · remove', onPress: async () => {
        if (bill.notificationId) await Notifications.cancelScheduledNotificationAsync(bill.notificationId).catch(() => undefined);
        if (next) {
          const notificationId = await scheduleBillReminder({ title: bill.title, amount: bill.amount, dueDate: next });
          await withDb((db) => db.runAsync('UPDATE bills SET dueDate = ?, notificationId = ? WHERE id = ?', next, notificationId, bill.id).then(() => undefined));
        } else {
          await withDb((db) => db.runAsync('DELETE FROM bills WHERE id = ?', bill.id).then(() => undefined));
        }
        await refreshData();
      } },
    ]);
  };
  const saveBudget = async () => {
    const value = Number(budgetDraft.replace(/,/g, '').trim());
    if (!Number.isFinite(value) || value < 0 || value > 1000000000) { Alert.alert('Check monthly budget', 'Enter a valid number, or use 0 to turn off the budget guide.'); return; }
    await withDb((db) => db.runAsync('INSERT INTO settings (key, value) VALUES ("monthlyBudget", ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', String(value)).then(() => undefined));
    await refreshData();
    Alert.alert('Budget updated', value ? `Your monthly guide is ${money(value)}.` : 'Your monthly budget guide is turned off.');
  };
  const deleteExpense = (expense: Expense) => Alert.alert('Remove expense?', `${money(expense.amount)} · ${expense.category}`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      await withDb((db) => db.runAsync('DELETE FROM expenses WHERE id = ?', expense.id).then(() => undefined));
      await refreshData();
    } },
  ]);
  const exportBackup = async () => {
    try {
      const data = await withDb(async (db) => ({
        exportedAt: new Date().toISOString(), app: 'RozFlow',
        tasks: await db.getAllAsync<Task>('SELECT * FROM tasks'),
        habits: await db.getAllAsync<Habit>('SELECT * FROM habits'),
        habitLogs: await db.getAllAsync<HabitLog>('SELECT * FROM habit_logs'),
        bills: await db.getAllAsync<Bill>('SELECT * FROM bills'),
        expenses: await db.getAllAsync<Expense>('SELECT * FROM expenses'),
        focusSessions: await db.getAllAsync('SELECT * FROM focus_sessions'),
        settings: await db.getAllAsync('SELECT * FROM settings'),
      }));
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) throw new Error('The app cache directory is unavailable.');
      const uri = cacheDirectory + `rozflow-backup-${today}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save your RozFlow backup' });
      else Alert.alert('Backup created', 'The backup was created in the app cache, but device sharing is unavailable.');
    } catch (error) {
      console.warn('RozFlow backup export failed', error);
      Alert.alert('Backup failed', 'Could not create the backup file. Your stored data has not been changed.');
    }
  };
  const clearLocalData = () => Alert.alert('Clear all RozFlow data?', 'This removes tasks, habits, spending logs, bills and focus history from this phone. Export a backup first if you want to keep a copy.', [
    { text: 'Keep my data', style: 'cancel' },
    { text: 'Clear everything', style: 'destructive', onPress: async () => {
      await withDb(async (db) => {
        await db.execAsync('DELETE FROM tasks; DELETE FROM habits; DELETE FROM habit_logs; DELETE FROM bills; DELETE FROM expenses; DELETE FROM focus_sessions; DELETE FROM settings;');
      });
      await Notifications.cancelAllScheduledNotificationsAsync();
      await refreshData();
      setScreen('Today');
    } },
  ]);

  const renderTask = (task: Task) => (
    <View key={task.id} style={styles.taskRow}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.done === 1 }} onPress={() => void markTask(task)}
        style={[styles.taskCheck, task.done === 1 && styles.taskCheckDone]}>{task.done === 1 ? <Feather name="check" size={16} color={C.white} /> : null}</Pressable>
      <Pressable style={styles.taskCopy} onPress={() => Alert.alert(task.title, `${task.note ? task.note + '\n\n' : ''}Due ${dateLabel(task.dueDate)} · ${task.priority} priority`, [
        { text: 'Close', style: 'cancel' }, { text: 'Remove task', style: 'destructive', onPress: () => deleteTask(task) },
      ])}>
        <Text style={[styles.taskTitle, task.done === 1 && styles.taskTitleDone]}>{task.title}</Text>
        <Text style={styles.taskSub}>{dateLabel(task.dueDate, true)}{task.note ? ` · ${task.note}` : ''}</Text>
      </Pressable>
      <View style={[styles.priorityDot, { backgroundColor: task.priority === 'High' ? C.red : task.priority === 'Medium' ? '#EAA23C' : C.green }]} />
    </View>
  );

  const renderToday = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
      <View style={styles.topHeader}>
        <View><Text style={styles.eyebrow}>YOUR DAILY LIFE, IN SYNC</Text><Text style={styles.greeting}>{friendlyHour()} ✨</Text><Text style={styles.dateHeading}>{dateHeading()}</Text></View>
        <Pressable onPress={() => setScreen('Settings')} style={styles.avatarButton}><Feather name="sliders" size={19} color={C.greenDark} /></Pressable>
      </View>
      <LinearGradient colors={['#0A2532', '#105D56', '#11A879']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View pointerEvents="none" style={styles.heroCircleOne} /><View pointerEvents="none" style={styles.heroCircleTwo} />
        <View style={styles.heroContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>A LITTLE PROGRESS, EVERY DAY</Text>
            <Text style={styles.heroTitle}>{todayTasks.length ? `${taskProgress}% of today's plan` : 'Make today count.'}</Text>
            <Text style={styles.heroSubtitle}>{todayTasks.length ? `${completedToday} of ${todayTasks.length} tasks complete. Keep your momentum going.` : 'Clear your mind. Focus on what matters next.'}</Text>
          </View>
          <Animated.View style={[styles.orbitStage, { transform: [{ translateY: orbTranslate }, { rotate: orbTurn }, { perspective: 850 }, { rotateY: '12deg' }] }]}>
            <View style={styles.orbitOuter} /><View style={styles.orbitMiddle} />
            <LinearGradient colors={['#D4FFF0', '#52E2B3', '#138F78']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orbitPlanet}>
              <MaterialCommunityIcons name="lightning-bolt" size={31} color="#063E38" />
            </LinearGradient>
            <View style={styles.orbitSatellite} />
          </Animated.View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStats}>
          <View><Text style={styles.heroStatLabel}>HABITS</Text><Text style={styles.heroStatValue}>{habitCompletedToday}/{habits.length}</Text></View>
          <View style={styles.heroSeparator} />
          <View><Text style={styles.heroStatLabel}>FOCUS TODAY</Text><Text style={styles.heroStatValue}>{focusToday} min</Text></View>
          <View style={styles.heroSeparator} />
          <View><Text style={styles.heroStatLabel}>SPENT TODAY</Text><Text style={styles.heroStatValue}>{money(spentToday)}</Text></View>
        </View>
      </LinearGradient>
      <View style={styles.quickGrid}>
        <Pressable onPress={() => openAdd('task')} style={({ pressed }) => [styles.quickCard, pressed && styles.quickPressed]}><View style={[styles.quickIcon, { backgroundColor: C.mint }]}><Feather name="plus" size={20} color={C.greenDark} /></View><Text style={styles.quickTitle}>Add a task</Text><Text style={styles.quickSub}>Clear your head</Text></Pressable>
        <Pressable onPress={() => setScreen('Focus')} style={({ pressed }) => [styles.quickCard, pressed && styles.quickPressed]}><View style={[styles.quickIcon, { backgroundColor: C.violet }]}><Feather name="target" size={19} color="#7152B8" /></View><Text style={styles.quickTitle}>Focus mode</Text><Text style={styles.quickSub}>One thing at a time</Text></Pressable>
        <Pressable onPress={() => openAdd('expense')} style={({ pressed }) => [styles.quickCard, pressed && styles.quickPressed]}><View style={[styles.quickIcon, { backgroundColor: C.amber }]}><Feather name="credit-card" size={19} color="#A16B15" /></View><Text style={styles.quickTitle}>Log spending</Text><Text style={styles.quickSub}>Stay money-aware</Text></Pressable>
      </View>
      <SectionHeader title="Today's plan" action="See all" onAction={() => setScreen('Plan')} />
      {todayTasks.length ? <View style={styles.surfaceCard}>{todayTasks.slice(0, 4).map(renderTask)}{todayTasks.length > 4 ? <Pressable style={styles.viewMore} onPress={() => setScreen('Plan')}><Text style={styles.sectionAction}>+ {todayTasks.length - 4} more tasks</Text></Pressable> : null}</View> :
        <View style={styles.emptyCard}><View style={styles.emptyEmoji}><Feather name="sunrise" size={24} color={C.greenDark} /></View><Text style={styles.emptyTitle}>Start with one small win</Text><Text style={styles.emptyBody}>Pick one thing that would make today feel lighter.</Text><ActionButton title="Add my first task" onPress={() => openAdd('task')} compact icon="plus" /></View>}
      <SectionHeader title="Coming up" action="Manage" onAction={() => setScreen('Plan')} />
      {upcomingBills.length ? <View style={styles.surfaceCard}>{upcomingBills.slice(0, 3).map((bill) => <View key={bill.id} style={styles.billRow}><View style={styles.billIcon}><Feather name="calendar" size={17} color={C.greenDark} /></View><View style={styles.taskCopy}><Text style={styles.taskTitle}>{bill.title}</Text><Text style={styles.taskSub}>Due {dateLabel(bill.dueDate)}{bill.repeatEvery !== 'Never' ? ` · ${bill.repeatEvery.toLowerCase()}` : ''}</Text></View><Text style={styles.billAmount}>{money(bill.amount)}</Text></View>)}</View> :
        <Pressable onPress={() => { setScreen('Plan'); openAdd('bill'); }} style={styles.addBillHint}><Feather name="bell" size={17} color={C.greenDark} /><Text style={styles.addBillText}>Add rent, electricity or other bill reminders</Text><Feather name="arrow-up-right" size={15} color={C.greenDark} /></Pressable>}
      <View style={styles.insightTip}><Feather name="heart" size={17} color={C.greenDark} /><View style={{ flex: 1 }}><Text style={styles.tipTitle}>Progress, not perfection</Text><Text style={styles.tipText}>A 10-minute focus session or one completed task still counts. Build a system that works for you.</Text></View></View>
      <Text style={styles.privacyHint}>Private by design · Your daily data stays on this phone</Text>
    </ScrollView>
  );

  const renderPlan = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
      <View style={styles.screenHead}><Text style={styles.eyebrow}>GET IT OUT OF YOUR HEAD</Text><Text style={styles.screenTitle}>Your plan</Text><Text style={styles.screenSub}>{openTasks.length} tasks to do · Every little step counts.</Text></View>
      <View style={styles.searchInputWrap}><Feather name="search" size={17} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Find a task..." placeholderTextColor={C.muted} style={styles.searchInput} /></View>
      <View style={styles.actionRow}><ActionButton title="New task" onPress={() => openAdd('task')} compact icon="plus" /><ActionButton title="Add bill" onPress={() => openAdd('bill')} compact tone="light" icon="bell" /></View>
      <SectionHeader title="Tasks" />
      {filteredTasks.length ? <View style={styles.surfaceCard}>{filteredTasks.map(renderTask)}</View> :
        <View style={styles.emptyCard}><View style={styles.emptyEmoji}><Feather name="check-square" size={24} color={C.greenDark} /></View><Text style={styles.emptyTitle}>{search ? 'No tasks found' : 'A clear slate'}</Text><Text style={styles.emptyBody}>{search ? 'Try another search.' : 'Add tasks, set a due date and choose the priority.'}</Text><ActionButton title="Add a task" onPress={() => openAdd('task')} compact icon="plus" /></View>}
      <SectionHeader title="Bills & reminders" action="Add bill" onAction={() => openAdd('bill')} />
      {bills.length ? <View style={styles.surfaceCard}>{bills.map((bill) => (
        <View key={bill.id} style={styles.billFullRow}>
          <View style={styles.billIcon}><Feather name="calendar" size={17} color={C.greenDark} /></View>
          <View style={styles.taskCopy}><Text style={styles.taskTitle}>{bill.title}</Text><Text style={styles.taskSub}>{dateLabel(bill.dueDate)} · {bill.repeatEvery === 'Never' ? 'One-time' : bill.repeatEvery}</Text><Text style={styles.billAmount}>{money(bill.amount)}</Text></View>
          <Pressable accessibilityRole="button" onPress={() => markBillPaid(bill)} style={styles.paidButton}><Feather name="check" size={14} color={C.greenDark} /><Text style={styles.paidText}>Paid</Text></Pressable>
        </View>
      ))}</View> : <View style={styles.emptyCard}><View style={styles.emptyEmoji}><Feather name="bell" size={23} color={C.greenDark} /></View><Text style={styles.emptyTitle}>Never miss a bill</Text><Text style={styles.emptyBody}>Track the next due date and receive a reminder one day before, if notifications are enabled.</Text><ActionButton title="Add a bill reminder" onPress={() => openAdd('bill')} compact icon="plus" /></View>}
      <Text style={styles.privacyHint}>Bill reminders are local notifications. RozFlow never pays a bill or changes a service for you.</Text>
    </ScrollView>
  );

  const renderHabits = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
      <View style={styles.screenHead}><Text style={styles.eyebrow}>SMALL ACTIONS, BIG CHANGE</Text><Text style={styles.screenTitle}>Your habits</Text><Text style={styles.screenSub}>Show up for yourself, one day at a time.</Text></View>
      <LinearGradient colors={['#173044', '#3B3471', '#7162B5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.habitHero}>
        <View style={{ flex: 1 }}><Text style={styles.habitHeroEyebrow}>TODAY'S CHECK-IN</Text><Text style={styles.habitHeroAmount}>{habitCompletedToday}<Text style={styles.habitHeroMuted}> / {habits.length}</Text></Text><Text style={styles.habitHeroSub}>{habits.length ? 'Every check-in is a vote for the person you want to become.' : 'Start with one small habit. You can always add more.'}</Text></View>
        <View style={styles.habitHeroOrb}><MaterialCommunityIcons name="sprout" size={34} color="#D9D1FF" /></View>
      </LinearGradient>
      <SectionHeader title="Your daily habits" action="Add habit" onAction={() => openAdd('habit')} />
      {habits.length ? <View style={styles.surfaceCard}>{habits.map((habit) => {
        const done = habitLogs.some((log) => log.habit_id === habit.id && log.day === today);
        return <View key={habit.id} style={styles.habitRow}>
          <View style={[styles.habitIcon, { backgroundColor: habit.tint }]}><MaterialCommunityIcons name={habit.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={23} color={C.ink} /></View>
          <View style={styles.taskCopy}><Text style={styles.taskTitle}>{habit.title}</Text><Text style={styles.taskSub}>{streakFor(habit.id, habitLogs)} day streak · {done ? 'Checked in today' : 'Ready for a check-in'}</Text></View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => void toggleHabit(habit)} style={[styles.habitCheck, done && styles.habitCheckDone]}>{done ? <Feather name="check" size={17} color={C.white} /> : <Feather name="plus" size={17} color={C.greenDark} />}</Pressable>
          <Pressable onPress={() => deleteHabit(habit)} hitSlop={8} style={{ padding: 5 }}><Feather name="more-horizontal" size={18} color={C.muted} /></Pressable>
        </View>;
      })}</View> : <View style={styles.emptyCard}><View style={styles.emptyEmoji}><MaterialCommunityIcons name="sprout" size={25} color={C.greenDark} /></View><Text style={styles.emptyTitle}>Build your own rhythm</Text><Text style={styles.emptyBody}>Choose a tiny habit you'll realistically repeat. RozFlow tracks your check-ins and streaks locally.</Text><ActionButton title="Create a habit" onPress={() => openAdd('habit')} compact icon="plus" /></View>}
      <SectionHeader title="Quick-start habits" />
      <Text style={styles.screenSub}>Tap any starter to add it to your list.</Text>
      <View style={styles.templateGrid}>{HABIT_TEMPLATES.filter((item) => !habits.some((habit) => habit.title === item.title)).map((item) => (
        <Pressable key={item.title} onPress={() => void addHabitTemplate(item)} style={({ pressed }) => [styles.templateCard, pressed && styles.quickPressed]}>
          <View style={[styles.templateIcon, { backgroundColor: item.tint }]}><MaterialCommunityIcons name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={C.ink} /></View>
          <Text style={styles.templateTitle}>{item.title}</Text><Feather name="plus-circle" size={16} color={C.greenDark} />
        </Pressable>
      ))}</View>
    </ScrollView>
  );

  const startFocus = () => {
    if (focusEndAt !== null) return;
    focusFinishHandled.current = false;
    const duration = secondsLeft > 0 && secondsLeft < focusMinutes * 60 ? secondsLeft : focusMinutes * 60;
    setSecondsLeft(duration);
    setFocusEndAt(Date.now() + duration * 1000);
  };
  const pauseFocus = () => {
    if (focusEndAt === null) return;
    const left = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
    setFocusEndAt(null); setSecondsLeft(left); focusFinishHandled.current = false;
  };
  const resetFocus = () => { setFocusEndAt(null); setSecondsLeft(focusMinutes * 60); focusFinishHandled.current = false; };
  const setDuration = (mins: number) => { if (focusEndAt !== null) return; setFocusMinutes(mins); setSecondsLeft(mins * 60); };
  const clock = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const renderFocus = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
      <View style={styles.screenHead}><Text style={styles.eyebrow}>LESS SCROLLING, MORE LIVING</Text><Text style={styles.screenTitle}>Focus mode</Text><Text style={styles.screenSub}>Protect a little time for what matters.</Text></View>
      <LinearGradient colors={['#091C2A', '#163E55', '#235E68']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.focusStage}>
        <View pointerEvents="none" style={styles.focusHalo} /><View pointerEvents="none" style={styles.focusHaloInner} />
        <Text style={styles.focusLabel}>{focusEndAt !== null ? 'YOU ARE IN THE ZONE' : secondsLeft < focusMinutes * 60 ? 'SESSION PAUSED' : 'YOUR NEXT QUIET MOMENT'}</Text>
        <View style={styles.timerOrbOuter}><View style={styles.timerOrbInner}><Text style={styles.timerText}>{clock}</Text><Text style={styles.timerMinutes}>{focusEndAt !== null ? 'STAY WITH IT' : 'FOCUS TIMER'}</Text></View></View>
        <Text style={styles.focusStageSub}>{focusEndAt !== null ? 'One thing at a time. You are doing great.' : 'Silence the noise. Choose one meaningful task.'}</Text>
        <View style={styles.focusControls}>
          <Pressable onPress={() => focusEndAt !== null ? pauseFocus() : startFocus()} style={styles.focusMainButton}><Feather name={focusEndAt !== null ? 'pause' : 'play'} size={18} color={C.navy} /><Text style={styles.focusMainButtonText}>{focusEndAt !== null ? 'Pause session' : secondsLeft < focusMinutes * 60 ? 'Resume focus' : 'Start focusing'}</Text></Pressable>
          <Pressable onPress={resetFocus} style={styles.focusReset}><Feather name="rotate-ccw" size={17} color={C.white} /></Pressable>
        </View>
      </LinearGradient>
      <SectionHeader title="Choose your session" />
      <View style={styles.durationRow}>{[15, 25, 50].map((mins) => <Pressable key={mins} disabled={focusEndAt !== null} onPress={() => setDuration(mins)} style={[styles.durationCard, focusMinutes === mins && styles.durationActive, focusEndAt !== null && { opacity: 0.5 }]}><Text style={[styles.durationMinutes, focusMinutes === mins && styles.durationMinutesActive]}>{mins}</Text><Text style={[styles.durationLabel, focusMinutes === mins && styles.durationMinutesActive]}>MINUTES</Text><Text style={[styles.durationName, focusMinutes === mins && styles.durationMinutesActive]}>{mins === 15 ? 'Quick win' : mins === 25 ? 'Pomodoro' : 'Deep work'}</Text></Pressable>)}</View>
      <View style={styles.focusStatCard}><View style={styles.focusStatIcon}><Feather name="award" size={21} color={C.greenDark} /></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>Focused time today</Text><Text style={styles.taskSub}>Only completed sessions count.</Text></View><Text style={styles.focusStatValue}>{focusToday} min</Text></View>
      <Text style={styles.privacyHint}>The timer uses the device clock so it can recover after brief app switches. Completed sessions are stored on this phone.</Text>
    </ScrollView>
  );

  const renderMoney = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
      <View style={styles.screenHead}><Text style={styles.eyebrow}>SPEND WITH INTENTION</Text><Text style={styles.screenTitle}>Your money</Text><Text style={styles.screenSub}>Small awareness today. Better decisions tomorrow.</Text></View>
      <LinearGradient colors={['#0B2834', '#11544F', '#147F67']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.moneyHero}>
        <Text style={styles.moneyHeroEyebrow}>SPENT THIS MONTH</Text><Text style={styles.moneyHeroAmount}>{money(spentThisMonth)}</Text><View style={styles.moneyProgressTrack}><View style={[styles.moneyProgressFill, { width: `${budgetNumber > 0 ? Math.min(100, spentThisMonth / budgetNumber * 100) : 0}%` }]} /></View>
        <View style={styles.moneyMetaRow}><Text style={styles.moneyMeta}>{budgetNumber > 0 ? `${money(Math.max(0, remainingBudget))} left in your guide` : 'Set a monthly guide to track your pace'}</Text><Text style={styles.moneyMeta}>{budgetNumber > 0 ? `${Math.round(spentThisMonth / budgetNumber * 100)}%` : '—'}</Text></View>
        {remainingBudget < 0 && budgetNumber > 0 ? <Text style={styles.overBudgetText}>You are {money(Math.abs(remainingBudget))} over your monthly guide. Review the categories below—no judgement.</Text> : null}
      </LinearGradient>
      <View style={styles.budgetEditCard}><View style={{ flex: 1 }}><Text style={styles.taskTitle}>Monthly spending guide</Text><Text style={styles.taskSub}>A personal target, not a bank balance.</Text></View><View style={styles.budgetEditRight}><TextInput value={budgetDraft} onChangeText={setBudgetDraft} keyboardType="decimal-pad" style={styles.budgetInput} accessibilityLabel="Monthly spending budget" /><Pressable onPress={() => void saveBudget()} style={styles.smallSaveButton}><Text style={styles.smallSaveText}>Save</Text></Pressable></View></View>
      <View style={styles.actionRow}><ActionButton title="Log an expense" onPress={() => openAdd('expense')} compact icon="plus" /><ActionButton title="Set a reminder" onPress={() => { setScreen('Plan'); openAdd('bill'); }} tone="light" compact icon="bell" /></View>
      <SectionHeader title="Where it goes" />
      {categoryTotals.length ? <View style={styles.surfaceCard}>{categoryTotals.map((item) => <View key={item.category} style={styles.categoryRow}><View style={styles.categoryLabelRow}><Text style={styles.categoryName}>{item.category}</Text><Text style={styles.categoryAmount}>{money(item.total)}</Text></View><View style={styles.moneyBarTrack}><View style={[styles.moneyBarFill, { width: `${Math.max(3, item.total / categoryTotals[0].total * 100)}%` }]} /></View></View>)}</View> : <View style={styles.emptyCard}><View style={styles.emptyEmoji}><Feather name="pie-chart" size={24} color={C.greenDark} /></View><Text style={styles.emptyTitle}>Your spending story starts here</Text><Text style={styles.emptyBody}>Log a coffee, commute or grocery run. The monthly breakdown updates automatically.</Text><ActionButton title="Log first expense" onPress={() => openAdd('expense')} compact icon="plus" /></View>}
      <SectionHeader title="Recent spending" />
      <View style={styles.filterTabs}>{(['Month', 'Today'] as const).map((filterName) => <Pressable key={filterName} onPress={() => setExpenseFilter(filterName)} style={[styles.filterTab, expenseFilter === filterName && styles.filterTabActive]}><Text style={[styles.filterTabText, expenseFilter === filterName && styles.filterTabTextActive]}>{filterName === 'Month' ? 'This month' : 'Today'}</Text></Pressable>)}</View>
      {visibleExpenses.length ? <View style={styles.surfaceCard}>{visibleExpenses.slice(0, 30).map((item) => <View key={item.id} style={styles.expenseRow}><View style={styles.expenseIcon}><Feather name={item.category === 'Food' ? 'coffee' : item.category === 'Travel' ? 'navigation' : item.category === 'Bills' ? 'file-text' : item.category === 'Health' ? 'heart' : item.category === 'Shopping' ? 'shopping-bag' : 'circle'} size={17} color={C.greenDark} /></View><View style={styles.taskCopy}><Text style={styles.taskTitle}>{item.note || item.category}</Text><Text style={styles.taskSub}>{item.category} · {dateLabel(item.day, true)}</Text></View><Text style={styles.billAmount}>{money(item.amount)}</Text><Pressable onPress={() => deleteExpense(item)} hitSlop={8} style={{ padding: 5 }}><Feather name="x" size={15} color={C.muted} /></Pressable></View>)}</View> : <Text style={styles.noExpenses}>Nothing logged {expenseFilter === 'Today' ? 'today' : 'this month'} yet.</Text>}
      <Text style={styles.privacyHint}>Manual expense tracking only. RozFlow is not connected to your bank, card, Gmail or UPI account.</Text>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
      <View style={styles.topHeader}><View><Text style={styles.eyebrow}>YOUR SPACE, YOUR RULES</Text><Text style={styles.screenTitle}>Settings</Text></View><Pressable onPress={() => setScreen('Today')} style={styles.avatarButton}><Feather name="x" size={20} color={C.ink} /></Pressable></View>
      <View style={styles.settingsBrand}><LinearGradient colors={['#0A2532', '#0E9C73']} style={styles.settingsBrandIcon}><MaterialCommunityIcons name="orbit" size={30} color="#CFFFF0" /></LinearGradient><View style={{ flex: 1 }}><Text style={styles.settingsBrandTitle}>RozFlow</Text><Text style={styles.taskSub}>Daily Life OS · Version 1.0.0</Text></View><View style={styles.offlinePill}><View style={styles.offlineDot} /><Text style={styles.offlineText}>OFFLINE READY</Text></View></View>
      <SectionHeader title="Data & privacy" />
      <View style={styles.surfaceCard}>
        <Pressable onPress={() => void exportBackup()} style={styles.settingsRow}><View style={[styles.settingGlyph, { backgroundColor: C.mint }]}><Feather name="download" size={18} color={C.greenDark} /></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>Export a backup</Text><Text style={styles.taskSub}>Share a JSON copy of tasks, habits, bills and expenses.</Text></View><Feather name="chevron-right" size={18} color={C.muted} /></Pressable>
        <View style={styles.divider} />
        <Pressable onPress={() => Alert.alert('How RozFlow works', 'No sign-in, Gmail, cloud AI or bank connection. Your tasks, habits, bills, focus sessions and expense notes are stored in the app’s local database. Export a backup before changing devices or clearing data.')} style={styles.settingsRow}><View style={[styles.settingGlyph, { backgroundColor: C.blue }]}><Feather name="shield" size={18} color="#386CB2" /></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>Privacy, explained</Text><Text style={styles.taskSub}>See what stays on your phone.</Text></View><Feather name="chevron-right" size={18} color={C.muted} /></Pressable>
        <View style={styles.divider} />
        <Pressable onPress={clearLocalData} style={styles.settingsRow}><View style={[styles.settingGlyph, { backgroundColor: C.redPale }]}><Feather name="trash-2" size={18} color={C.red} /></View><View style={{ flex: 1 }}><Text style={[styles.taskTitle, { color: C.red }]}>Clear all local data</Text><Text style={styles.taskSub}>Permanent. Export a backup first.</Text></View><Feather name="chevron-right" size={18} color={C.muted} /></Pressable>
      </View>
      <SectionHeader title="Your daily dashboard" />
      <View style={styles.surfaceCard}>
        <View style={styles.settingsRow}><View style={[styles.settingGlyph, { backgroundColor: C.violet }]}><Feather name="target" size={18} color="#7152B8" /></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>Focus sessions completed</Text><Text style={styles.taskSub}>Today, saved on this phone.</Text></View><Text style={styles.settingsValue}>{focusToday} min</Text></View>
        <View style={styles.divider} />
        <View style={styles.settingsRow}><View style={[styles.settingGlyph, { backgroundColor: C.amber }]}><Feather name="check-circle" size={18} color="#A16B15" /></View><View style={{ flex: 1 }}><Text style={styles.taskTitle}>Habits checked today</Text><Text style={styles.taskSub}>A little consistency goes a long way.</Text></View><Text style={styles.settingsValue}>{habitCompletedToday}/{habits.length}</Text></View>
      </View>
      <Text style={styles.privacyHint}>RozFlow is a new, independent app. It does not replace or delete the existing SubSathi app.</Text>
    </ScrollView>
  );

  const addTitle = addKind === 'task' ? 'Capture a task' : addKind === 'habit' ? 'Start a habit' : addKind === 'bill' ? 'Add bill reminder' : 'Log an expense';
  const saveLabel = saving ? 'Saving...' : addKind === 'task' ? 'Save task' : addKind === 'habit' ? 'Add habit' : addKind === 'bill' ? 'Save reminder' : 'Save expense';
  const shortDateHint = 'Format: YYYY-MM-DD';
  const screenContent = screen === 'Today' ? renderToday() : screen === 'Plan' ? renderPlan() : screen === 'Habits' ? renderHabits() : screen === 'Focus' ? renderFocus() : screen === 'Money' ? renderMoney() : renderSettings();

  if (!ready || !splashDone) return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.splashSafe}>
      <StatusBar barStyle="light-content" backgroundColor="#081C28" />
      <LinearGradient colors={['#071923', '#0A3841', '#087756']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.splash}>
        <View pointerEvents="none" style={styles.splashRingOne} /><View pointerEvents="none" style={styles.splashRingTwo} />
        <Animated.View style={[styles.splashGlow, { opacity: splashGlow, transform: [{ scale: splashGlow.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.16] }) }] }]} />
        <Animated.View style={[styles.splashLogoFrame, { transform: [{ scale: splashScale }, { rotate: rotateIntro }] }]}>
          <LinearGradient colors={['#D4FFF0', '#53E4B3', '#109B7C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.splashLogo}><MaterialCommunityIcons name="orbit" size={49} color="#063A34" /></LinearGradient>
          <View style={styles.splashSatellite} />
        </Animated.View>
        <Animated.Text style={[styles.splashTitle, { opacity: splashGlow }]}>RozFlow</Animated.Text>
        <Text style={styles.splashTagline}>Your day. Your money. Your momentum.</Text>
        {!ready ? <ActivityIndicator color="#49E8B0" style={{ marginTop: 22 }} /> : <View style={{ height: 38 }} />}
        <View style={styles.splashPips}><View style={styles.splashPip} /><Animated.View style={[styles.splashPip, styles.splashPipActive, { opacity: splashGlow }]} /><View style={styles.splashPip} /></View>
        <Text style={styles.splashFoot}>A LITTLE MORE IN CONTROL, EVERY DAY</Text>
      </LinearGradient>
    </SafeAreaView>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <View style={styles.appContent}>{screenContent}</View>
      {screen !== 'Settings' ? <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0), height: 68 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0) }]}>
        {([
          ['Today', 'sun'], ['Plan', 'check-square'], ['Habits', 'activity'], ['Focus', 'target'], ['Money', 'pie-chart'],
        ] as [Screen, keyof typeof Feather.glyphMap][]).map(([name, icon]) => <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} onPress={() => setScreen(name)} style={styles.navItem}>
          <View style={[styles.navIconWrap, screen === name && styles.navIconActive]}><Feather name={icon} size={19} color={screen === name ? C.greenDark : '#809398'} /></View>
          <Text style={[styles.navLabel, screen === name && styles.navLabelActive]}>{name}</Text>
        </Pressable>)}
      </View> : null}
      <Modal visible={addKind !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddKind(null)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}><Pressable onPress={() => setAddKind(null)} style={styles.modalClose}><Feather name="x" size={20} color={C.ink} /></Pressable><View style={{ flex: 1 }}><Text style={styles.modalTitle}>{addTitle}</Text><Text style={styles.modalSubtitle}>A calmer day starts with one small step.</Text></View></View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
              {addKind === 'task' || addKind === 'habit' || addKind === 'bill' ? <>
                <Text style={styles.inputLabel}>{addKind === 'habit' ? 'HABIT NAME' : addKind === 'bill' ? 'BILL / REMINDER NAME' : 'WHAT NEEDS TO GET DONE?'}</Text>
                <TextInput value={form.title} onChangeText={(value) => setField('title', value)} placeholder={addKind === 'habit' ? 'e.g. Walk 10 minutes' : addKind === 'bill' ? 'e.g. Electricity bill' : 'e.g. Call the dentist'} placeholderTextColor={C.muted} style={styles.textInput} maxLength={100} autoFocus />
              </> : null}
              {addKind === 'task' ? <>
                <Text style={styles.inputLabel}>DUE DATE</Text><TextInput value={form.date} onChangeText={(value) => setField('date', value)} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} style={styles.textInput} maxLength={10} />
                <Text style={styles.formHint}>{shortDateHint}. Defaults to today.</Text>
                <Text style={styles.inputLabel}>PRIORITY</Text><View style={styles.optionRow}>{PRIORITIES.map((item) => <Pressable key={item} onPress={() => setField('priority', item)} style={[styles.optionChip, form.priority === item && styles.optionChipActive]}><Text style={[styles.optionText, form.priority === item && styles.optionTextActive]}>{item}</Text></Pressable>)}</View>
                <Text style={styles.inputLabel}>NOTE (OPTIONAL)</Text><TextInput value={form.note} onChangeText={(value) => setField('note', value)} placeholder="A little detail to help future-you" placeholderTextColor={C.muted} style={[styles.textInput, styles.multilineInput]} multiline maxLength={300} />
              </> : null}
              {addKind === 'habit' ? <Text style={styles.formHint}>Choose something small enough to repeat on a busy day. Check-ins and streaks stay on this phone.</Text> : null}
              {addKind === 'bill' ? <>
                <Text style={styles.inputLabel}>AMOUNT (INR)</Text><TextInput value={form.amount} onChangeText={(value) => setField('amount', value)} placeholder="e.g. 1800" placeholderTextColor={C.muted} style={styles.textInput} keyboardType="decimal-pad" />
                <Text style={styles.inputLabel}>NEXT DUE DATE</Text><TextInput value={form.date} onChangeText={(value) => setField('date', value)} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} style={styles.textInput} maxLength={10} />
                <Text style={styles.formHint}>{shortDateHint}. A reminder is scheduled for 9 AM one day before, when notification permission is allowed.</Text>
                <Text style={styles.inputLabel}>REPEAT</Text><View style={styles.optionRow}>{(['Never', 'Monthly', 'Yearly'] as const).map((item) => <Pressable key={item} onPress={() => setField('repeatEvery', item)} style={[styles.optionChip, form.repeatEvery === item && styles.optionChipActive]}><Text style={[styles.optionText, form.repeatEvery === item && styles.optionTextActive]}>{item}</Text></Pressable>)}</View>
              </> : null}
              {addKind === 'expense' ? <>
                <Text style={styles.inputLabel}>AMOUNT (INR)</Text><TextInput value={form.amount} onChangeText={(value) => setField('amount', value)} placeholder="e.g. 240" placeholderTextColor={C.muted} style={styles.textInput} keyboardType="decimal-pad" autoFocus />
                <Text style={styles.inputLabel}>CATEGORY</Text><View style={styles.optionWrap}>{EXPENSE_CATEGORIES.map((item) => <Pressable key={item} onPress={() => setField('category', item)} style={[styles.optionChip, form.category === item && styles.optionChipActive]}><Text style={[styles.optionText, form.category === item && styles.optionTextActive]}>{item}</Text></Pressable>)}</View>
                <Text style={styles.inputLabel}>WHAT WAS IT FOR? (OPTIONAL)</Text><TextInput value={form.note} onChangeText={(value) => setField('note', value)} placeholder="Coffee, auto, groceries..." placeholderTextColor={C.muted} style={styles.textInput} maxLength={100} />
                <Text style={styles.formHint}>Logged for today. RozFlow does not connect to your bank or read your transactions.</Text>
              </> : null}
              <View style={{ marginTop: 24 }}><ActionButton title={saveLabel} onPress={() => void saveForm()} icon="check" /></View>
              <Text style={styles.formPrivacy}>Saved locally on this device.</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.cream },
  appContent: { flex: 1, minHeight: 0 },
  splashSafe: { flex: 1, backgroundColor: '#081C28' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 24 },
  splashRingOne: { position: 'absolute', width: 330, height: 330, borderRadius: 165, right: -110, top: -115, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  splashRingTwo: { position: 'absolute', width: 390, height: 390, borderRadius: 195, left: -170, bottom: -180, borderWidth: 1, borderColor: 'rgba(129,255,214,0.14)', backgroundColor: 'rgba(12,170,125,0.06)' },
  splashGlow: { position: 'absolute', height: 190, width: 190, borderRadius: 95, backgroundColor: 'rgba(36,232,173,0.16)', borderWidth: 1, borderColor: 'rgba(133,255,221,0.22)' },
  splashLogoFrame: { width: 142, height: 142, borderRadius: 47, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(211,255,240,0.36)', marginBottom: 25, shadowColor: '#22E0A2', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.32, shadowRadius: 28, elevation: 12 },
  splashLogo: { width: 86, height: 86, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  splashSatellite: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#E8FFF5', right: 13, top: 21, borderWidth: 2, borderColor: '#16765F' },
  splashTitle: { color: '#F5FFF9', fontSize: 44, fontWeight: '900', letterSpacing: -1.6 },
  splashTagline: { marginTop: 8, color: '#B9DDD2', fontSize: 13, textAlign: 'center', letterSpacing: 0.25 },
  splashPips: { position: 'absolute', bottom: 112, flexDirection: 'row', gap: 7, alignItems: 'center' },
  splashPip: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.34)' },
  splashPipActive: { width: 20, backgroundColor: '#49E8B0' },
  splashFoot: { position: 'absolute', bottom: 79, color: '#A3CFC0', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  pageContent: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 25 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  eyebrow: { color: C.greenDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.55, marginBottom: 6 },
  greeting: { color: C.ink, fontSize: 27, fontWeight: '900', letterSpacing: -1 },
  dateHeading: { color: C.muted, fontSize: 12, marginTop: 4 },
  avatarButton: { width: 43, height: 43, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 19, borderRadius: 27, overflow: 'hidden', marginBottom: 16, shadowColor: C.shadow, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 7 },
  heroCircleOne: { position: 'absolute', width: 235, height: 235, borderRadius: 118, right: -80, top: -96, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.045)' },
  heroCircleTwo: { position: 'absolute', width: 155, height: 155, borderRadius: 78, right: 65, bottom: -108, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroEyebrow: { color: '#B7DAD1', fontSize: 8, fontWeight: '900', letterSpacing: 1.35 },
  heroTitle: { color: C.white, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.65, marginTop: 8, maxWidth: 215 },
  heroSubtitle: { color: '#D0E9E1', fontSize: 10, lineHeight: 15, marginTop: 7, maxWidth: 205 },
  orbitStage: { width: 106, height: 117, alignItems: 'center', justifyContent: 'center' },
  orbitOuter: { position: 'absolute', width: 99, height: 76, borderRadius: 50, borderWidth: 1.3, borderColor: 'rgba(205,255,237,0.63)', transform: [{ rotate: '-27deg' }, { scaleY: 0.75 }] },
  orbitMiddle: { position: 'absolute', width: 75, height: 100, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(205,255,237,0.35)', transform: [{ rotate: '47deg' }, { scaleY: 0.70 }] },
  orbitPlanet: { width: 64, height: 64, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#8AFFD3', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.42, shadowRadius: 15, elevation: 8 },
  orbitSatellite: { position: 'absolute', width: 12, height: 12, borderRadius: 6, right: 3, top: 23, backgroundColor: '#FFF9D6', borderWidth: 2, borderColor: '#1BB58A' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 17 },
  heroStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  heroStatLabel: { color: '#A9D0C6', fontSize: 8, letterSpacing: 0.7, fontWeight: '800', marginBottom: 5 },
  heroStatValue: { color: C.white, fontSize: 12, fontWeight: '800' },
  heroSeparator: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.20)' },
  quickGrid: { flexDirection: 'row', gap: 9, marginBottom: 24 },
  quickCard: { flex: 1, minWidth: 0, backgroundColor: C.white, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: C.line },
  quickPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  quickIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  quickTitle: { color: C.ink, fontSize: 10, fontWeight: '900' },
  quickSub: { color: C.muted, fontSize: 8, marginTop: 4, lineHeight: 11 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, marginTop: 2 },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.35 },
  sectionAction: { color: C.greenDark, fontSize: 11, fontWeight: '800' },
  surfaceCard: { borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 22 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EFF3F1' },
  taskCheck: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: '#C8D8D1', alignItems: 'center', justifyContent: 'center' },
  taskCheckDone: { backgroundColor: C.green, borderColor: C.green },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitle: { color: C.ink, fontSize: 12, fontWeight: '800' },
  taskTitleDone: { color: '#8FA09B', textDecorationLine: 'line-through' },
  taskSub: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  priorityDot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 4 },
  viewMore: { paddingVertical: 12, alignItems: 'center' },
  emptyCard: { alignItems: 'center', backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', paddingHorizontal: 22, paddingVertical: 25, marginBottom: 22 },
  emptyEmoji: { width: 52, height: 52, borderRadius: 18, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 6, marginBottom: 16, textAlign: 'center', maxWidth: 270 },
  actionButton: { minHeight: 47, paddingHorizontal: 17, paddingVertical: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionGreen: { backgroundColor: C.green },
  actionDark: { backgroundColor: C.navy },
  actionRed: { backgroundColor: C.red },
  actionLight: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  actionCompact: { minHeight: 37, paddingVertical: 9, paddingHorizontal: 13, alignSelf: 'flex-start' },
  actionText: { color: C.white, fontSize: 11, fontWeight: '900' },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EFF3F1' },
  billFullRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EFF3F1' },
  billIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.mint },
  billAmount: { color: C.ink, fontSize: 12, fontWeight: '900' },
  addBillHint: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 15, marginBottom: 22, borderRadius: 16, backgroundColor: C.mint },
  addBillText: { color: C.greenDark, flex: 1, fontSize: 10, fontWeight: '800' },
  insightTip: { flexDirection: 'row', gap: 11, borderRadius: 18, backgroundColor: '#E9F6F0', padding: 14, marginTop: 4 },
  tipTitle: { color: C.ink, fontSize: 11, fontWeight: '900' },
  tipText: { color: '#57776B', fontSize: 10, lineHeight: 16, marginTop: 4 },
  privacyHint: { color: '#89999B', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 17, marginHorizontal: 7 },
  screenHead: { marginBottom: 20, marginTop: 9 },
  screenTitle: { color: C.ink, fontSize: 31, fontWeight: '900', letterSpacing: -1 },
  screenSub: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13, marginBottom: 12 },
  searchInput: { flex: 1, color: C.ink, minHeight: 45, fontSize: 12 },
  paidButton: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.mint, flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidText: { color: C.greenDark, fontSize: 9, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#EEF3F0', marginLeft: 48 },
  habitHero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 24, overflow: 'hidden' },
  habitHeroEyebrow: { color: '#D1C8FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  habitHeroAmount: { color: C.white, fontSize: 40, fontWeight: '900', marginTop: 4 },
  habitHeroMuted: { color: '#C2BCED', fontSize: 22 },
  habitHeroSub: { color: '#E0DCF9', fontSize: 10, lineHeight: 15, marginTop: 4, maxWidth: 235 },
  habitHeroOrb: { width: 63, height: 63, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.11)', alignItems: 'center', justifyContent: 'center' },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EFF3F1' },
  habitIcon: { height: 43, width: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  habitCheck: { width: 37, height: 37, borderRadius: 14, backgroundColor: '#F0F6F3', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  habitCheckDone: { backgroundColor: C.green, borderColor: C.green },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  templateCard: { width: '48%', backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  templateIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  templateTitle: { color: C.ink, fontSize: 10, fontWeight: '800', flex: 1 },
  focusStage: { minHeight: 405, borderRadius: 30, padding: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 22, shadowColor: C.navy, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 7 },
  focusHalo: { position: 'absolute', width: 310, height: 310, borderRadius: 155, borderWidth: 1, borderColor: 'rgba(119,248,208,0.18)' },
  focusHaloInner: { position: 'absolute', width: 235, height: 235, borderRadius: 118, borderWidth: 1, borderColor: 'rgba(119,248,208,0.12)', backgroundColor: 'rgba(61,219,174,0.035)' },
  focusLabel: { color: '#9DDACC', fontSize: 9, fontWeight: '900', letterSpacing: 1.65, marginBottom: 22 },
  timerOrbOuter: { width: 216, height: 216, borderRadius: 108, borderWidth: 1.5, borderColor: 'rgba(127,255,216,0.65)', padding: 12, backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center', transform: [{ perspective: 800 }, { rotateX: '10deg' }] },
  timerOrbInner: { width: 182, height: 182, borderRadius: 91, backgroundColor: 'rgba(13,170,125,0.23)', borderWidth: 1, borderColor: 'rgba(214,255,240,0.23)', alignItems: 'center', justifyContent: 'center' },
  timerText: { color: C.white, fontSize: 41, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  timerMinutes: { color: '#A8E9D7', fontSize: 8, letterSpacing: 1.5, fontWeight: '900', marginTop: 8 },
  focusStageSub: { color: '#D5EDE6', fontSize: 10, marginTop: 22, textAlign: 'center' },
  focusControls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  focusMainButton: { borderRadius: 14, backgroundColor: '#CFFFF0', minHeight: 46, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  focusMainButtonText: { color: C.navy, fontSize: 11, fontWeight: '900' },
  focusReset: { width: 43, height: 43, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.23)', alignItems: 'center', justifyContent: 'center' },
  durationRow: { flexDirection: 'row', gap: 9, marginBottom: 17 },
  durationCard: { flex: 1, backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.line, paddingVertical: 15, alignItems: 'center' },
  durationActive: { backgroundColor: C.navy, borderColor: C.navy },
  durationMinutes: { color: C.ink, fontSize: 24, fontWeight: '900' },
  durationMinutesActive: { color: C.white },
  durationLabel: { color: C.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 2 },
  durationName: { color: C.muted, fontSize: 9, marginTop: 8 },
  focusStatCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  focusStatIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  focusStatValue: { color: C.greenDark, fontSize: 18, fontWeight: '900' },
  moneyHero: { borderRadius: 24, padding: 20, marginBottom: 13, overflow: 'hidden' },
  moneyHeroEyebrow: { color: '#B6DBD0', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  moneyHeroAmount: { color: C.white, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 9 },
  moneyProgressTrack: { height: 7, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 19, overflow: 'hidden' },
  moneyProgressFill: { height: 7, backgroundColor: '#6CF0C5', borderRadius: 7 },
  moneyMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  moneyMeta: { color: '#C9E9E0', fontSize: 9, fontWeight: '700' },
  overBudgetText: { color: '#FFE3A1', fontSize: 10, lineHeight: 15, marginTop: 10 },
  budgetEditCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, padding: 12, marginBottom: 16 },
  budgetEditRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  budgetInput: { width: 76, color: C.ink, fontWeight: '900', fontSize: 12, textAlign: 'right', paddingVertical: 6 },
  smallSaveButton: { backgroundColor: C.mint, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  smallSaveText: { color: C.greenDark, fontSize: 10, fontWeight: '900' },
  categoryRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EFF3F1' },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryName: { color: C.ink, fontSize: 11, fontWeight: '800' },
  categoryAmount: { color: C.ink, fontSize: 11, fontWeight: '900' },
  moneyBarTrack: { height: 6, backgroundColor: '#EFF4F1', borderRadius: 6, overflow: 'hidden', marginTop: 9 },
  moneyBarFill: { height: 6, backgroundColor: C.green, borderRadius: 6 },
  filterTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterTab: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  filterTabActive: { backgroundColor: C.navy, borderColor: C.navy },
  filterTabText: { color: C.muted, fontSize: 10, fontWeight: '800' },
  filterTabTextActive: { color: C.white },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EFF3F1' },
  expenseIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  noExpenses: { fontSize: 11, color: C.muted, marginBottom: 17, marginTop: 2 },
  settingsBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, padding: 14, marginBottom: 24 },
  settingsBrandIcon: { width: 51, height: 51, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  settingsBrandTitle: { color: C.ink, fontSize: 17, fontWeight: '900' },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.mint, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  offlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.greenDark },
  offlineText: { color: C.greenDark, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13 },
  settingGlyph: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  settingsValue: { color: C.greenDark, fontSize: 15, fontWeight: '900' },
  bottomNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 7, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line },
  navItem: { width: '20%', alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIconWrap: { minWidth: 44, height: 29, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: C.mint },
  navLabel: { color: '#859599', fontSize: 9, fontWeight: '700' },
  navLabelActive: { color: C.greenDark, fontWeight: '900' },
  modalSafe: { flex: 1, backgroundColor: C.cream },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, paddingHorizontal: 19, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  modalClose: { height: 38, width: 38, borderRadius: 13, backgroundColor: '#EDF3EF', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: C.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  modalSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 },
  modalContent: { paddingHorizontal: 20, paddingVertical: 22, paddingBottom: 35 },
  inputLabel: { color: '#60777D', fontWeight: '900', fontSize: 9, letterSpacing: 1.1, marginTop: 17, marginBottom: 8 },
  textInput: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, color: C.ink, minHeight: 49, paddingHorizontal: 14, paddingVertical: 12, fontSize: 12 },
  multilineInput: { minHeight: 85, textAlignVertical: 'top' },
  formHint: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 7 },
  formPrivacy: { color: '#91A09E', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 15 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { flex: 1, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  optionChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  optionText: { color: C.muted, fontSize: 10, fontWeight: '800' },
  optionTextActive: { color: C.white },
});
