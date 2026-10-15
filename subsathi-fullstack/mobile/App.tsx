import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Priority = 'High' | 'Medium' | 'Low';
type Tab = 'Today' | 'Plan' | 'Money' | 'Coach';
type EditorKind = 'task' | 'expense' | 'goal' | 'habit' | 'contribute' | null;
type DayTask = { id: number; title: string; details: string; dueDate: string; priority: Priority; completed: number; createdAt: string };
type Habit = { id: number; title: string; icon: string; tint: string; active: number };
type HabitLog = { habitId: number; date: string };
type Expense = { id: number; title: string; amount: number; category: string; spentAt: string };
type Goal = { id: number; title: string; targetAmount: number; savedAmount: number; targetDate: string; createdAt: string };
type ChatMessage = { id: string; role: 'coach' | 'you'; text: string };

const C = { ink:'#142536', navy:'#102637', navy2:'#193C50', green:'#16A879', greenDark:'#087653', mint:'#DDF8EB', paper:'#F5F8F7', white:'#FFFFFF', muted:'#71828B', line:'#E4ECE9', blue:'#447EF7', bluePale:'#EAF1FF', purple:'#8864E8', purplePale:'#F0EAFF', orange:'#E99A39', orangePale:'#FFF2DE', red:'#D95360', redPale:'#FFF0F0', aqua:'#35BFC2', shadow:'#102F35' };
const EXPENSE_CATEGORIES = ['Food','Transport','Home','Learning','Fun','Health','Other'];
const HABIT_SEEDS = [
  { title:'Drink water', icon:'water-outline', tint:'#DDF3FF' },
  { title:'Move your body', icon:'run', tint:'#E2F8EC' },
  { title:'Learn 10 minutes', icon:'book-open-variant', tint:'#EFE8FF' },
  { title:'Plan tomorrow', icon:'calendar-check-outline', tint:'#FFF0DB' },
];
const todayKey = () => dateKey(new Date());
function dateKey(date: Date) { return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }
function monthKey() { return todayKey().slice(0,7); }
function money(value: number) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:value%1===0?0:2}).format(value); }
function greeting() { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; }
function readableDate() { return new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}); }
function shortDate(value: string) {
  if(!value) return 'Any time';
  const d=new Date(value+'T12:00:00');
  if(Number.isNaN(d.getTime())) return value;
  if(value===todayKey()) return 'Today';
  const t=new Date(); t.setDate(t.getDate()+1);
  if(value===dateKey(t)) return 'Tomorrow';
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}
function priorityColor(p: Priority) { return p==='High'?C.red:p==='Medium'?C.orange:C.blue; }
function streakDays(logs: HabitLog[]) {
  const days=new Set(logs.map(x=>x.date)); const cursor=new Date();
  if(!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
  let count=0;
  while(days.has(dateKey(cursor))&&count<366){count++;cursor.setDate(cursor.getDate()-1);}
  return count;
}
async function openDatabase() {
  const db=await SQLite.openDatabaseAsync('daypilot-life.db');
  await db.execAsync(
    'PRAGMA journal_mode = WAL;'+
    'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,details TEXT NOT NULL DEFAULT \'\',dueDate TEXT NOT NULL,priority TEXT NOT NULL DEFAULT \'Medium\',completed INTEGER NOT NULL DEFAULT 0,createdAt TEXT NOT NULL);'+
    'CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,icon TEXT NOT NULL,tint TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);'+
    'CREATE TABLE IF NOT EXISTS habit_logs (habitId INTEGER NOT NULL,date TEXT NOT NULL,PRIMARY KEY(habitId,date));'+
    'CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,amount REAL NOT NULL,category TEXT NOT NULL,spentAt TEXT NOT NULL);'+
    'CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,targetAmount REAL NOT NULL,savedAmount REAL NOT NULL DEFAULT 0,targetDate TEXT NOT NULL DEFAULT \'\',createdAt TEXT NOT NULL);'+
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL);'
  );
  const count=await db.getFirstAsync<{count:number}>('SELECT COUNT(*) AS count FROM habits');
  if((count?.count??0)===0) for(const h of HABIT_SEEDS) await db.runAsync('INSERT INTO habits (title,icon,tint,active) VALUES (?,?,?,1)',h.title,h.icon,h.tint);
  const budget=await db.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?','monthlyBudget');
  if(!budget) await db.runAsync('INSERT INTO settings (key,value) VALUES (?,?)','monthlyBudget','15000');
  return db;
}
async function readDatabase(db: SQLite.SQLiteDatabase) {
  const [tasks,habits,logs,expenses,goals,budgetRow,reminderRow]=await Promise.all([
    db.getAllAsync<DayTask>('SELECT * FROM tasks ORDER BY completed ASC, CASE priority WHEN \'High\' THEN 0 WHEN \'Medium\' THEN 1 ELSE 2 END,dueDate ASC,id DESC'),
    db.getAllAsync<Habit>('SELECT * FROM habits WHERE active=1 ORDER BY id ASC'),
    db.getAllAsync<HabitLog>('SELECT habitId,date FROM habit_logs'),
    db.getAllAsync<Expense>('SELECT * FROM expenses ORDER BY spentAt DESC,id DESC'),
    db.getAllAsync<Goal>('SELECT * FROM goals ORDER BY id DESC'),
    db.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?','monthlyBudget'),
    db.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?','dailyReminder'),
  ]);
  return { tasks,habits,logs,expenses,goals,budget:Math.max(0,Number(budgetRow?.value||15000)),reminderEnabled:reminderRow?.value==='true' };
}
function BrandMark({size=44}:{size?:number}) {
  return <View style={[s.brandMark,{width:size,height:size,borderRadius:size*.34}]}><View style={[s.brandOrbit,{width:size*.66,height:size*.66,borderRadius:size*.34}]}/><Feather name="compass" size={size*.46} color="#FFFFFF"/><View style={[s.brandSpark,{width:size*.12,height:size*.12,borderRadius:size*.06}]}/></View>;
}
function SectionTitle({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}) {
  return <View style={s.sectionRow}><Text style={s.sectionTitle}>{title}</Text>{action&&onAction?<Pressable onPress={onAction}><Text style={s.actionText}>{action}</Text></Pressable>:null}</View>;
}
function Tag({label,color=C.greenDark,bg=C.mint}:{label:string;color?:string;bg?:string}) {
  return <View style={[s.tag,{backgroundColor:bg}]}><Text style={[s.tagText,{color}]}>{label}</Text></View>;
}
function ProgressBar({value,color=C.green,track='#E8F0ED'}:{value:number;color?:string;track?:string}) {
  return <View style={[s.progressTrack,{backgroundColor:track}]}><View style={[s.progressFill,{width:Math.max(0,Math.min(100,value))+'%',backgroundColor:color}]}/></View>;
}
function PrimaryButton({title,onPress}:{title:string;onPress:()=>void}) {
  return <Pressable onPress={onPress} style={({pressed})=>[s.primaryButton,pressed&&s.pressed]}><Text style={s.primaryButtonText}>{title}</Text></Pressable>;
}
function SecondaryButton({title,onPress}:{title:string;onPress:()=>void}) {
  return <Pressable onPress={onPress} style={({pressed})=>[s.secondaryButton,pressed&&s.pressed]}><Text style={s.secondaryButtonText}>{title}</Text></Pressable>;
}

function DayPilotApp() {
  const insets=useSafeAreaInsets();
  const dbRef=useRef<SQLite.SQLiteDatabase|null>(null);
  const [ready,setReady]=useState(false),[bootError,setBootError]=useState('');
  const [tab,setTab]=useState<Tab>('Today');
  const [tasks,setTasks]=useState<DayTask[]>([]),[habits,setHabits]=useState<Habit[]>([]),[logs,setLogs]=useState<HabitLog[]>([]),[expenses,setExpenses]=useState<Expense[]>([]),[goals,setGoals]=useState<Goal[]>([]);
  const [budget,setBudget]=useState(15000),[budgetDraft,setBudgetDraft]=useState('15000'),[reminderEnabled,setReminderEnabled]=useState(false);
  const [editorKind,setEditorKind]=useState<EditorKind>(null),[editorTitle,setEditorTitle]=useState(''),[editorDetails,setEditorDetails]=useState(''),[editorAmount,setEditorAmount]=useState(''),[editorCategory,setEditorCategory]=useState('Food'),[editorPriority,setEditorPriority]=useState<Priority>('Medium'),[editorDate,setEditorDate]=useState(todayKey()),[goalId,setGoalId]=useState<number|null>(null);
  const [focusVisible,setFocusVisible]=useState(false),[focusRunning,setFocusRunning]=useState(false),[focusSeconds,setFocusSeconds]=useState(25*60),[focusSessions,setFocusSessions]=useState(0);
  const [chatInput,setChatInput]=useState(''),[chat,setChat]=useState<ChatMessage[]>([{id:'hello',role:'coach',text:'Hey, I’m your DayPilot coach. I work offline with the tasks, habits and spending you save here. Tell me what feels messy today, or try one of the quick prompts below.'}]);
  const [searchTasks,setSearchTasks]=useState(''),[taskFilter,setTaskFilter]=useState<'All'|'Open'|'Done'>('All');
  const splashScale=useRef(new Animated.Value(.72)).current,splashRotation=useRef(new Animated.Value(0)).current,splashGlow=useRef(new Animated.Value(.25)).current,screenFade=useRef(new Animated.Value(1)).current;
  const [bootAnimDone,setBootAnimDone]=useState(false);
  const refresh=useCallback(async(db?:SQLite.SQLiteDatabase)=>{
    const live=db||dbRef.current;if(!live)return;
    const v=await readDatabase(live);
    setTasks(v.tasks);setHabits(v.habits);setLogs(v.logs);setExpenses(v.expenses);setGoals(v.goals);setBudget(v.budget);setBudgetDraft(String(v.budget));setReminderEnabled(v.reminderEnabled);
  },[]);
  useEffect(()=>{
    let mounted=true;
    const intro=Animated.parallel([
      Animated.sequence([Animated.timing(splashScale,{toValue:1.08,duration:460,easing:Easing.out(Easing.back(1.2)),useNativeDriver:true}),Animated.spring(splashScale,{toValue:1,speed:12,bounciness:4,useNativeDriver:true})]),
      Animated.timing(splashRotation,{toValue:1,duration:820,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      Animated.sequence([Animated.timing(splashGlow,{toValue:1,duration:380,easing:Easing.out(Easing.cubic),useNativeDriver:true}),Animated.timing(splashGlow,{toValue:.65,duration:440,easing:Easing.inOut(Easing.quad),useNativeDriver:true})]),
    ],{stopTogether:false});
    intro.start(({finished})=>{if(mounted&&finished)setBootAnimDone(true);});
    (async()=>{try{const db=await openDatabase();dbRef.current=db;await refresh(db);if(mounted)setReady(true);}catch(error){console.warn('DayPilot database failed',error);if(mounted){setBootError('DayPilot could not open local storage. Your data has not been deleted. Close the app and try again.');setReady(true);setBootAnimDone(true);}}})();
    return()=>{mounted=false;intro.stop();};
  },[refresh,splashScale,splashRotation,splashGlow]);
  useEffect(()=>{screenFade.setValue(0);Animated.timing(screenFade,{toValue:1,duration:250,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();},[tab,screenFade]);
  useEffect(()=>{
    if(!focusRunning)return;
    const timer=setInterval(()=>setFocusSeconds(v=>v<=1?0:v-1),1000);
    return()=>clearInterval(timer);
  },[focusRunning]);
  useEffect(()=>{
    if(!focusRunning||focusSeconds!==0)return;
    setFocusRunning(false);setFocusSessions(v=>v+1);
    Alert.alert('Focus session complete ✨','Nice work. Take a little break, stretch, and celebrate the progress.');
  },[focusRunning,focusSeconds]);

  const todayTasks=useMemo(()=>tasks.filter(x=>x.dueDate===todayKey()),[tasks]);
  const openToday=todayTasks.filter(x=>!x.completed),completedToday=todayTasks.filter(x=>!!x.completed);
  const doneHabits=habits.filter(h=>logs.some(l=>l.habitId===h.id&&l.date===todayKey()));
  const scoreBase=todayTasks.length*3+habits.length*2;
  const dayScore=scoreBase?Math.round((completedToday.length*3+doneHabits.length*2)/scoreBase*100):0;
  const streak=streakDays(logs);
  const monthSpend=expenses.filter(x=>x.spentAt.slice(0,7)===monthKey()).reduce((n,x)=>n+x.amount,0);
  const budgetUsed=budget>0?Math.min(100,monthSpend/budget*100):(monthSpend>0?100:0),remainingBudget=Math.max(0,budget-monthSpend);
  const dueOpen=tasks.filter(x=>!x.completed&&x.dueDate&&x.dueDate<=todayKey()).length;
  const filteredTasks=tasks.filter(x=>(x.title+' '+x.details).toLowerCase().includes(searchTasks.trim().toLowerCase())&&(taskFilter==='All'||(taskFilter==='Open'?!x.completed:!!x.completed)));
  const categoryTotals=EXPENSE_CATEGORIES.map(category=>({category,total:expenses.filter(x=>x.spentAt.slice(0,7)===monthKey()&&x.category===category).reduce((n,x)=>n+x.amount,0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const goalAverage=goals.length?Math.round(goals.reduce((sum,g)=>sum+(g.targetAmount>0?Math.min(100,g.savedAmount/g.targetAmount*100):0),0)/goals.length):0;

  const openEditor=(kind:Exclude<EditorKind,null>,id?:number)=>{
    setEditorKind(kind);setEditorTitle('');setEditorDetails('');setEditorAmount('');setEditorCategory('Food');setEditorPriority('Medium');setEditorDate(kind==='goal'?'':todayKey());setGoalId(id??null);
  };
  const closeEditor=()=>{setEditorKind(null);setGoalId(null);};
  const saveEditor=async()=>{
    const db=dbRef.current;if(!db){Alert.alert('Storage unavailable','Restart DayPilot and try again.');return;}
    try {
      if(editorKind==='task'){
        if(!editorTitle.trim()){Alert.alert('Give your task a name','A short, clear action works best.');return;}
        if(editorDate&&!/^\d{4}-\d{2}-\d{2}$/.test(editorDate)){Alert.alert('Check the date','Use YYYY-MM-DD.');return;}
        await db.runAsync('INSERT INTO tasks (title,details,dueDate,priority,completed,createdAt) VALUES (?,?,?,?,0,?)',editorTitle.trim(),editorDetails.trim(),editorDate||todayKey(),editorPriority,new Date().toISOString());
      }else if(editorKind==='expense'){
        const amount=Number(editorAmount.replace(/,/g,'').trim());
        if(!editorTitle.trim()||!Number.isFinite(amount)||amount<=0){Alert.alert('Check your expense','Enter a name and an amount greater than zero.');return;}
        await db.runAsync('INSERT INTO expenses (title,amount,category,spentAt) VALUES (?,?,?,?)',editorTitle.trim(),amount,editorCategory,editorDate||todayKey());
      }else if(editorKind==='goal'){
        const target=Number(editorAmount.replace(/,/g,'').trim());
        if(!editorTitle.trim()||!Number.isFinite(target)||target<=0){Alert.alert('Check your goal','Enter a goal name and a target amount.');return;}
        if(editorDate&&!/^\d{4}-\d{2}-\d{2}$/.test(editorDate)){Alert.alert('Check the date','Use YYYY-MM-DD, or leave blank.');return;}
        await db.runAsync('INSERT INTO goals (title,targetAmount,savedAmount,targetDate,createdAt) VALUES (?,?,0,?,?)',editorTitle.trim(),target,editorDate,new Date().toISOString());
      }else if(editorKind==='habit'){
        if(!editorTitle.trim()){Alert.alert('Name your habit','Try “Stretch for five minutes” or “Practise a skill”.');return;}
        await db.runAsync('INSERT INTO habits (title,icon,tint,active) VALUES (?,?,?,1)',editorTitle.trim(),'star-four-points-outline','#E8E8FF');
      }else if(editorKind==='contribute'){
        const amount=Number(editorAmount.replace(/,/g,'').trim());
        if(!goalId||!Number.isFinite(amount)||amount<=0){Alert.alert('Check your contribution','Enter an amount greater than zero.');return;}
        await db.runAsync('UPDATE goals SET savedAmount=savedAmount+? WHERE id=?',amount,goalId);
      }
      closeEditor();await refresh(db);
    }catch(error){console.warn('Could not save DayPilot entry',error);Alert.alert('Could not save','Your existing entries are unchanged. Please try again.');}
  };
  const toggleTask=async(task:DayTask)=>{
    const db=dbRef.current;if(!db)return;
    try{await db.runAsync('UPDATE tasks SET completed=? WHERE id=?',task.completed?0:1,task.id);await refresh(db);}
    catch(error){console.warn(error);Alert.alert('Could not update task','Please try again.');}
  };
  const deleteTask=(task:DayTask)=>Alert.alert('Delete this task?',task.title,[{text:'Keep it',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{const db=dbRef.current;if(db){await db.runAsync('DELETE FROM tasks WHERE id=?',task.id);await refresh(db);}}}]);
  const toggleHabit=async(habit:Habit)=>{
    const db=dbRef.current;if(!db)return;const did=logs.some(x=>x.habitId===habit.id&&x.date===todayKey());
    try{if(did)await db.runAsync('DELETE FROM habit_logs WHERE habitId=? AND date=?',habit.id,todayKey());else await db.runAsync('INSERT OR IGNORE INTO habit_logs (habitId,date) VALUES (?,?)',habit.id,todayKey());await refresh(db);}
    catch(error){console.warn(error);Alert.alert('Could not update habit','Please try again.');}
  };
  const deleteExpense=(item:Expense)=>Alert.alert('Remove this expense?',item.title+' · '+money(item.amount),[{text:'Keep',style:'cancel'},{text:'Remove',style:'destructive',onPress:async()=>{const db=dbRef.current;if(db){await db.runAsync('DELETE FROM expenses WHERE id=?',item.id);await refresh(db);}}}]);
  const deleteGoal=(goal:Goal)=>Alert.alert('Remove this goal?',goal.title,[{text:'Keep goal',style:'cancel'},{text:'Remove',style:'destructive',onPress:async()=>{const db=dbRef.current;if(db){await db.runAsync('DELETE FROM goals WHERE id=?',goal.id);await refresh(db);}}}]);
  const saveBudget=async()=>{
    const value=Number(budgetDraft.replace(/,/g,'').trim());
    if(!Number.isFinite(value)||value<0){Alert.alert('Check your budget','Enter zero or a positive amount.');return;}
    const db=dbRef.current;if(!db)return;
    await db.runAsync('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','monthlyBudget',String(value));
    await refresh(db);Alert.alert('Budget updated','Your monthly spending plan is saved on this device.');
  };
  const toggleReminder=async()=>{
    const db=dbRef.current;if(!db)return;
    try{
      if(reminderEnabled){
        const scheduled=await Notifications.getAllScheduledNotificationsAsync();
        for(const item of scheduled)if(item.content.data?.dayPilotReminder===true)await Notifications.cancelScheduledNotificationAsync(item.identifier);
        await db.runAsync('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','dailyReminder','false');setReminderEnabled(false);return;
      }
      const permission=await Notifications.requestPermissionsAsync();
      if(!permission.granted){Alert.alert('Notifications are off','Enable notifications in Android Settings to receive the daily planning nudge.');return;}
      await Notifications.scheduleNotificationAsync({
        content:{title:'A small plan for a better day ✨',body:'Take two minutes to review your tasks, habits and spending in DayPilot.',data:{dayPilotReminder:true}},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour:20,minute:0},
      });
      await db.runAsync('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','dailyReminder','true');setReminderEnabled(true);
    }catch(error){console.warn('Reminder setup failed',error);Alert.alert('Reminder not updated','Check notification permissions in Android Settings and retry.');}
  };
  const coachReply=(raw:string)=>{
    const q=raw.toLowerCase().trim();if(!q)return;
    let answer='';
    if(/spend|spent|money|kharch|expense|budget|paise/.test(q))
      answer='This month you have logged '+money(monthSpend)+' from '+expenses.filter(x=>x.spentAt.slice(0,7)===monthKey()).length+' entries. Your budget is '+money(budget)+', leaving '+money(remainingBudget)+'. A practical next step: check the biggest category and choose one small limit for the rest of the week.';
    else if(/habit|streak|routine|water|walk|read/.test(q))
      answer='Today you have completed '+doneHabits.length+' of '+habits.length+' active habits, and your current activity streak is '+streak+' day'+(streak===1?'':'s')+'. Keep it easy: choose the smallest version of one habit and finish it before adding more.';
    else if(/goal|save|saving|target|bacha/.test(q))
      answer=goals.length?'You have '+goals.length+' active savings goal(s), with '+money(goals.reduce((sum,g)=>sum+g.savedAmount,0))+' saved so far. Average progress is '+goalAverage+'%. Try dividing the remaining target into a weekly amount that fits your budget.':'No savings goals yet. Add one clear target—an emergency buffer, course, trip, or useful purchase—and give it a realistic target amount.';
    else if(/task|todo|work|priority|plan|overwhelm|busy/.test(q)){
      const urgent=tasks.filter(x=>!x.completed&&(x.priority==='High'||x.dueDate<=todayKey())).slice(0,3);
      answer=urgent.length?'Start with one of these, not all of them: '+urgent.map(x=>x.title+' ('+x.priority.toLowerCase()+')').join('; ')+'. Pick the first action, work on it for 25 minutes, then decide the next step.':openToday.length?'You have '+openToday.length+' open task(s) for today. Choose the one that matters most and give it one uninterrupted 25-minute focus session.':'Your task list is clear for now. Use the space intentionally: rest, plan tomorrow, or move one meaningful goal forward.';
    }else if(/focus|concentrat|procrastinat|distract/.test(q))
      answer='Try a gentle focus sprint: choose just one task, put the phone on silent, and work for 25 minutes. DayPilot has a built-in focus timer. The aim is progress, not perfection.';
    else
      answer='Here is your current snapshot: '+openToday.length+' task(s) still open today, '+doneHabits.length+'/'+habits.length+' habits completed, and '+money(monthSpend)+' spent this month against a '+money(budget)+' budget. Pick the area that would make tomorrow easier, and I’ll help you break it into a small next step. I use only data saved in this app; no account or inbox connection is needed.';
    const stamp=Date.now();setChat(items=>[...items,{id:'you-'+stamp,role:'you',text:raw.trim()},{id:'coach-'+(stamp+1),role:'coach',text:answer}].slice(-12));setChatInput('');
  };
  const renderTaskRow=(task:DayTask)=><View key={task.id} style={[s.taskRow,!!task.completed&&s.taskRowDone]}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!task.completed}} onPress={()=>{void toggleTask(task);}} style={[s.checkCircle,!!task.completed&&s.checkCircleDone]}>{task.completed?<Feather name="check" size={15} color="#FFFFFF"/>:null}</Pressable>
    <Pressable style={s.taskCopy} onPress={()=>Alert.alert(task.title,(task.details?task.details+'\n\n':'')+'Due: '+shortDate(task.dueDate)+'\nPriority: '+task.priority,[{text:'Close',style:'cancel'},{text:'Delete task',style:'destructive',onPress:()=>deleteTask(task)}])}>
      <Text style={[s.taskTitle,!!task.completed&&s.taskTitleDone}>{task.title}</Text><Text style={s.taskMeta}>{shortDate(task.dueDate)} · {task.priority} priority</Text>
    </Pressable><View style={[s.priorityDot,{backgroundColor:priorityColor(task.priority)}]}/>
  </View>;

  const renderToday=()=> <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
    <View style={s.topBar}><View style={s.brandLockup}><BrandMark size={43}/><View><Text style={s.brandName}>DayPilot</Text><Text style={s.brandTag}>Your day, with direction.</Text></View></View><Pressable onPress={()=>setTab('Coach')} style={s.coachOrb}><Feather name="message-circle" size={20} color={C.greenDark}/></Pressable></View>
    <Text style={s.greeting}>{greeting()} 👋</Text><Text style={s.todayDate}>{readableDate()}</Text>
    <LinearGradient colors={['#102637','#174D57','#117C62']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
      <View pointerEvents="none" style={s.heroOrb1}/><View pointerEvents="none" style={s.heroOrb2}/>
      <View style={s.heroHeader}><View><Text style={s.heroEyebrow}>YOUR DAILY MOMENTUM</Text><Text style={s.heroTitle}>{dayScore>=80?'You are in your flow.':dayScore>=40?'Look at you, moving.':'Small steps count.'}</Text></View><Animated.View style={[s.heroBadge,{transform:[{rotate:splashRotation.interpolate({inputRange:[0,1],outputRange:['-12deg','0deg']})}]}]}><Feather name="compass" size={27} color="#D9FFF0"/></Animated.View></View>
      <View style={s.scoreRow}><View style={s.scoreRingOuter}><View style={s.scoreRingInner}><Text style={s.scoreNumber}>{dayScore}</Text><Text style={s.scorePct}>/ 100</Text></View></View>
        <View style={s.scoreCopy}><Text style={s.scoreHeadline}>Day score</Text><Text style={s.scoreBody}>{completedToday.length} of {todayTasks.length} tasks and {doneHabits.length} of {habits.length} habits complete.</Text><View style={s.heroMiniRow}><View style={s.heroMini}><Feather name="zap" size={13} color="#8DF4CA"/><Text style={s.heroMiniText}>{streak} day streak</Text></View><View style={s.heroMini}><Feather name="clock" size={13} color="#8DF4CA"/><Text style={s.heroMiniText}>{focusSessions} focus sprints</Text></View></View></View>
      </View><Text style={s.heroFooter}>You don’t need a perfect day. Just a next step.</Text>
    </LinearGradient>
    <View style={s.quickActions}>
      <Pressable onPress={()=>openEditor('task')} style={({pressed})=>[s.quickAction,pressed&&s.pressed]}><View style={[s.quickIcon,{backgroundColor:C.mint}]}><Feather name="plus" size={21} color={C.greenDark}/></View><Text style={s.quickLabel}>Add task</Text></Pressable>
      <Pressable onPress={()=>setFocusVisible(true)} style={({pressed})=>[s.quickAction,pressed&&s.pressed]}><View style={[s.quickIcon,{backgroundColor:C.purplePale}]}><Feather name="target" size={20} color={C.purple}/></View><Text style={s.quickLabel}>Focus</Text></Pressable>
      <Pressable onPress={()=>{setTab('Money');openEditor('expense');}} style={({pressed})=>[s.quickAction,pressed&&s.pressed]}><View style={[s.quickIcon,{backgroundColor:C.orangePale}]}><Feather name="credit-card" size={20} color="#A96513"/></View><Text style={s.quickLabel}>Log spend</Text></Pressable>
      <Pressable onPress={()=>setTab('Coach')} style={({pressed})=>[s.quickAction,pressed&&s.pressed]}><View style={[s.quickIcon,{backgroundColor:C.bluePale}]}><Feather name="sparkles" size={20} color={C.blue}/></View><Text style={s.quickLabel}>Coach</Text></Pressable>
    </View>
    <View style={s.dailyCheckCard}><View style={s.dailyCheckTop}><View style={s.dailyCheckIcon}><Feather name={dueOpen?'alert-circle':'sunrise'} size={20} color={dueOpen?C.orange:C.greenDark}/></View><View style={{flex:1}}><Text style={s.dailyCheckEyebrow}>YOUR NEXT BEST STEP</Text><Text style={s.dailyCheckTitle}>{dueOpen?dueOpen+' task(s) need your attention':openToday.length?'Choose your first small win':'Make room for something meaningful'}</Text></View><Tag label={dueOpen?'Review':'Today'} color={dueOpen?'#9A5C10':C.greenDark} bg={dueOpen?C.orangePale:C.mint}/></View>
      <Text style={s.dailyCheckBody}>{dueOpen?'Start with one overdue or high-priority task. Finish one thing before opening ten more.':openToday.length?'Pick one task, work on it for 25 minutes, then take a real break. You can change the plan as your day changes.':'Your open list is clear. Review a goal, practise a habit, or take a guilt-free break.'}</Text><Pressable onPress={()=>setTab('Plan')} style={s.inlineCTA}><Text style={s.inlineCTAText}>Open my plan <Feather name="arrow-up-right" size={14} color={C.greenDark}/></Text></Pressable>
    </View>
    <SectionTitle title="Today's habits" action="Manage" onAction={()=>setTab('Plan')}/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.habitScroll}>
      {habits.map(h=>{const done=logs.some(x=>x.habitId===h.id&&x.date===todayKey());return <Pressable key={h.id} onPress={()=>{void toggleHabit(h);}} style={({pressed})=>[s.habitCard,done&&s.habitCardDone,pressed&&s.pressed]}><View style={[s.habitIcon,{backgroundColor:h.tint}]}><MaterialCommunityIcons name={h.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={23} color={C.ink}/></View><Text style={s.habitTitle} numberOfLines={2}>{h.title}</Text><View style={[s.habitStatus,done&&s.habitStatusDone]}><Feather name={done?'check':'plus'} size={12} color={done?'#FFFFFF':C.greenDark}/><Text style={[s.habitStatusText,done&&{color:'#FFFFFF'}]}>{done?'Done':'Check in'}</Text></View></Pressable>;})}
      <Pressable onPress={()=>openEditor('habit')} style={[s.habitCard,s.addHabitCard]}><View style={s.addHabitCircle}><Feather name="plus" size={21} color={C.greenDark}/></View><Text style={s.habitTitle}>New habit</Text><Text style={s.habitMeta}>Build your routine</Text></Pressable>
    </ScrollView>
    <SectionTitle title="Up next" action="View all" onAction={()=>setTab('Plan')}/>
    {openToday.length?<View style={s.panel}>{openToday.slice(0,4).map(renderTaskRow)}{openToday.length>4?<Pressable onPress={()=>setTab('Plan')} style={s.showAll}><Text style={s.actionText}>+ {openToday.length-4} more tasks</Text></Pressable>:null}</View>:<View style={s.emptyCard}><View style={s.emptyIcon}><Feather name="check-circle" size={25} color={C.greenDark}/></View><Text style={s.emptyTitle}>Your list has breathing room</Text><Text style={s.emptyBody}>Add one thing worth finishing today. Keep it small and specific.</Text><PrimaryButton title="Add a task" onPress={()=>openEditor('task')}/></View>}
    <Pressable onPress={()=>{void toggleReminder();}} style={s.reminderRow}><View style={s.reminderIcon}><Feather name="bell" size={18} color={C.greenDark}/></View><View style={{flex:1}}><Text style={s.reminderTitle}>Daily evening reset</Text><Text style={s.reminderBody}>A gentle 8 PM nudge to plan tomorrow. {reminderEnabled?'On':'Optional'}</Text></View><Switch value={reminderEnabled} onValueChange={()=>{void toggleReminder();}} trackColor={{false:'#D6E0DD',true:'#A6E9CC'}} thumbColor={reminderEnabled?C.green:'#FFFFFF'}/></Pressable>
    <Text style={s.footerNote}>Made to help you focus on your life, not manage another inbox. Your tasks, habits and expenses stay on this device.</Text>
  </ScrollView>;

  const renderPlan=()=> <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
    <View style={s.pageHeader}><Text style={s.pageEyebrow}>MAKE SPACE FOR WHAT MATTERS</Text><Text style={s.pageTitle}>Your plan</Text><Text style={s.pageSub}>{openToday.length} open today · {tasks.filter(x=>!!x.completed).length} completed overall. Plan lightly, adjust often.</Text></View>
    <LinearGradient colors={['#E5F8EE','#EEF1FF']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.planSummary}><View style={s.planSummaryIcon}><Feather name="calendar" size={23} color={C.greenDark}/></View><View style={{flex:1}}><Text style={s.planSummaryTitle}>A good plan leaves room</Text><Text style={s.planSummaryBody}>Choose one important task first. Everything else is a bonus, not a failure.</Text></View></LinearGradient>
    <View style={s.planButtons}><View style={{flex:1}}><PrimaryButton title="+ New task" onPress={()=>openEditor('task')}/></View><View style={{flex:1}}><SecondaryButton title="+ New habit" onPress={()=>openEditor('habit')}/></View></View>
    <View style={s.searchBox}><Feather name="search" size={18} color={C.muted}/><TextInput value={searchTasks} onChangeText={setSearchTasks} placeholder="Find a task..." placeholderTextColor="#91A0A4" style={s.searchInput}/></View>
    <View style={s.filterRow}>{(['All','Open','Done'] as const).map(x=><Pressable key={x} onPress={()=>setTaskFilter(x)} style={[s.filterChip,taskFilter===x&&s.filterChipActive]}><Text style={[s.filterText,taskFilter===x&&s.filterTextActive]}>{x}</Text></Pressable>)}</View>
    <SectionTitle title="Tasks"/>
    {filteredTasks.length?<View style={s.panel}>{filteredTasks.map(renderTaskRow)}</View>:<View style={s.emptyCard}><View style={s.emptyIcon}><Feather name="check-square" size={24} color={C.greenDark}/></View><Text style={s.emptyTitle}>Nothing in this view yet</Text><Text style={s.emptyBody}>Add a small, clear action and let DayPilot keep it in sight.</Text><PrimaryButton title="Create a task" onPress={()=>openEditor('task')}/></View>}
    <SectionTitle title="Habit garden" action="Add habit" onAction={()=>openEditor('habit')}/>
    <View style={s.panel}>{habits.map(h=>{const done=logs.some(x=>x.habitId===h.id&&x.date===todayKey()),total=logs.filter(x=>x.habitId===h.id).length;return <View key={h.id} style={s.planHabitRow}><View style={[s.habitIcon,{backgroundColor:h.tint}]}><MaterialCommunityIcons name={h.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={21} color={C.ink}/></View><View style={{flex:1}}><Text style={s.taskTitle}>{h.title}</Text><Text style={s.taskMeta}>{total} lifetime check-in{total===1?'':'s'} · {done?'completed today':'not done today'}</Text></View><Pressable onPress={()=>{void toggleHabit(h);}} style={[s.miniCheck,done&&s.miniCheckDone]}><Feather name={done?'check':'plus'} size={15} color={done?'#FFFFFF':C.greenDark}/></Pressable></View>;})}</View>
    <Text style={s.footerNote}>A streak is a reminder of consistency, not a score of your worth. Missing a day does not erase your progress.</Text>
  </ScrollView>;

  const renderMoney=()=> <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
    <View style={s.pageHeader}><Text style={s.pageEyebrow}>GENTLE MONEY CLARITY</Text><Text style={s.pageTitle}>My money</Text><Text style={s.pageSub}>Know what leaves, what stays and what you're working toward.</Text></View>
    <LinearGradient colors={['#102637','#17465A','#3D6CD7']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.moneyHero}><View style={s.moneyHeroTop}><View><Text style={s.moneyHeroEyebrow}>LOGGED THIS MONTH</Text><Text style={s.moneyHeroTotal}>{money(monthSpend)}</Text></View><View style={s.moneyHeroIcon}><Feather name="pie-chart" size={26} color="#FFFFFF"/></View></View>
      <View style={s.budgetTextRow}><Text style={s.budgetLabel}>Budget: {money(budget)}</Text><Text style={[s.budgetLabel,{color:budget>0&&monthSpend>budget?'#FFD0D4':'#BFECDD'}]}>{budget>0?Math.round(monthSpend/budget*100)+'%':'No limit'}</Text></View><ProgressBar value={budgetUsed} color={monthSpend>budget&&budget>0?'#FF8A95':'#77F0C3'} track="rgba(255,255,255,0.16)"/><Text style={s.moneyHeroFoot}>{budget>0?money(remainingBudget)+' left in your monthly plan':'Set a budget to see your remaining amount.'}</Text>
    </LinearGradient>
    <View style={s.planButtons}><View style={{flex:1}}><PrimaryButton title="+ Log expense" onPress={()=>openEditor('expense')}/></View><View style={{flex:1}}><SecondaryButton title="+ Savings goal" onPress={()=>openEditor('goal')}/></View></View>
    <View style={s.budgetEditor}><View style={s.budgetEditorCopy}><Text style={s.cardTitle}>Monthly spending plan</Text><Text style={s.cardSub}>Choose a limit that fits real life.</Text></View><View style={s.budgetInputRow}><Text style={s.rupee}>₹</Text><TextInput value={budgetDraft} onChangeText={setBudgetDraft} keyboardType="decimal-pad" style={s.budgetInput} accessibilityLabel="Monthly spending budget"/><Pressable onPress={()=>{void saveBudget();}} style={s.budgetSave}><Feather name="check" size={17} color="#FFFFFF"/></Pressable></View></View>
    <SectionTitle title="Where it goes"/>
    {categoryTotals.length?<View style={s.panel}>{categoryTotals.map((item,i)=>{const colors=[C.green,C.blue,C.purple,C.orange,C.aqua,C.red,'#7B8D98'],color=colors[i%colors.length];return <View key={item.category} style={s.categoryRow}><View style={[s.categoryDot,{backgroundColor:color}]}/><View style={{flex:1}}><View style={s.categoryTop}><Text style={s.categoryName}>{item.category}</Text><Text style={s.categoryAmount}>{money(item.total)}</Text></View><ProgressBar value={monthSpend?item.total/monthSpend*100:0} color={color}/></View></View>;})}<Text style={s.cardSub}>Only expenses you enter are counted. This isn't connected to your bank.</Text></View>:<View style={s.emptyCard}><View style={s.emptyIcon}><Feather name="coffee" size={24} color={C.greenDark}/></View><Text style={s.emptyTitle}>Your money picture starts here</Text><Text style={s.emptyBody}>Log a coffee, commute or bill in a few seconds. Patterns become clearer without bank access.</Text><PrimaryButton title="Log first expense" onPress={()=>openEditor('expense')}/></View>}
    <SectionTitle title="Recent expenses" action="Add" onAction={()=>openEditor('expense')}/>
    {expenses.filter(x=>x.spentAt.slice(0,7)===monthKey()).slice(0,6).map(x=><Pressable key={x.id} onPress={()=>deleteExpense(x)} style={s.expenseRow}><View style={s.expenseIcon}><Feather name={x.category==='Food'?'coffee':x.category==='Transport'?'truck':x.category==='Home'?'home':x.category==='Health'?'heart':'shopping-bag'} size={18} color={C.greenDark}/></View><View style={{flex:1}}><Text style={s.taskTitle}>{x.title}</Text><Text style={s.taskMeta}>{x.category} · {shortDate(x.spentAt)}</Text></View><View style={{alignItems:'flex-end'}}><Text style={s.expenseAmount}>{money(x.amount)}</Text><Text style={s.deleteHint}>Tap to remove</Text></View></Pressable>)}
    <SectionTitle title="Goals worth saving for" action="Add goal" onAction={()=>openEditor('goal')}/>
    {goals.length?goals.map(g=>{const percent=g.targetAmount>0?Math.min(100,g.savedAmount/g.targetAmount*100):0;return <View key={g.id} style={s.goalCard}><View style={s.goalHeader}><View style={s.goalIcon}><Feather name="flag" size={20} color={C.purple}/></View><View style={{flex:1}}><Text style={s.goalTitle}>{g.title}</Text><Text style={s.goalMeta}>{money(g.savedAmount)} of {money(g.targetAmount)} saved</Text></View><Text style={s.goalPercent}>{Math.round(percent)}%</Text></View><ProgressBar value={percent} color={C.purple}/><View style={s.goalActions}><Pressable onPress={()=>openEditor('contribute',g.id)}><Text style={s.actionText}>+ Add savings</Text></Pressable><Pressable onPress={()=>deleteGoal(g)}><Text style={s.deleteGoalText}>Remove</Text></Pressable></View></View>; }):<View style={s.goalEmpty}><Text style={s.cardTitle}>Give your money a destination</Text><Text style={s.cardSub}>Emergency buffer, learning, a trip, or anything that matters to you.</Text><Pressable onPress={()=>openEditor('goal')} style={s.inlineCTA}><Text style={s.inlineCTAText}>Create a savings goal <Feather name="arrow-right" size={14} color={C.greenDark}/></Text></Pressable></View>}
    <Text style={s.footerNote}>All figures use the expenses and savings you enter. DayPilot never connects to a bank or moves money automatically.</Text>
  </ScrollView>;

  const renderCoach=()=> <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
    <View style={s.pageHeader}><Text style={s.pageEyebrow}>YOUR EVERYDAY THINKING PARTNER</Text><Text style={s.pageTitle}>Smart Coach</Text><Text style={s.pageSub}>Practical next steps, using the information already on this phone.</Text></View>
    <LinearGradient colors={['#14283C','#334E81','#6F57A9']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.coachHero}><View style={s.coachHeroTop}><View style={s.coachAvatar}><Feather name="compass" size={25} color="#FFFFFF"/></View><View style={{flex:1}}><Text style={s.coachHeroTitle}>Your next-step coach</Text><Text style={s.coachHeroSub}>Offline · Private · Built around your day</Text></View><Tag label="READY" color="#E5FFF5" bg="rgba(255,255,255,0.14)"/></View><View style={s.coachMetrics}><View style={s.coachMetric}><Text style={s.coachMetricValue}>{openToday.length}</Text><Text style={s.coachMetricLabel}>Tasks open</Text></View><View style={s.coachMetric}><Text style={s.coachMetricValue}>{doneHabits.length}/{habits.length}</Text><Text style={s.coachMetricLabel}>Habits done</Text></View><View style={s.coachMetric}><Text style={s.coachMetricValue}>{money(monthSpend)}</Text><Text style={s.coachMetricLabel}>Logged this month</Text></View></View></LinearGradient>
    <View style={s.chatPanel}>{chat.map(m=><View key={m.id} style={[s.chatBubble,m.role==='you'?s.chatYou:s.chatCoach]}><Text style={s.chatRole}>{m.role==='you'?'YOU':'DAYPILOT COACH'}</Text><Text style={s.chatText}>{m.text}</Text></View>)}<View style={s.chatInputRow}><TextInput value={chatInput} onChangeText={setChatInput} style={s.chatInput} placeholder="What would make today easier?" placeholderTextColor="#95A2A5" multiline maxLength={500} onSubmitEditing={()=>coachReply(chatInput)} returnKeyType="send" accessibilityLabel="Ask the DayPilot coach"/><Pressable style={s.sendButton} onPress={()=>coachReply(chatInput)}><Feather name="arrow-up" size={20} color="#FFFFFF"/></Pressable></View></View>
    <SectionTitle title="Try a quick check-in"/>
    <View style={s.promptGrid}>{[
      {label:'Plan my day',icon:'calendar',prompt:'Help me plan my day and choose my priority.'},{label:'Review spending',icon:'credit-card',prompt:'Review my spending and budget.'},{label:'Build consistency',icon:'repeat',prompt:'How can I keep my habits consistent?'},{label:'Reach my goal',icon:'target',prompt:'Help me make progress on my savings goal.'},{label:'Beat procrastination',icon:'zap',prompt:'I feel distracted and keep procrastinating.'},{label:'Weekly reset',icon:'refresh-cw',prompt:'Give me a practical reset using my current tasks and habits.'},
    ].map(x=><Pressable key={x.label} onPress={()=>coachReply(x.prompt)} style={({pressed})=>[s.promptCard,pressed&&s.pressed]}><View style={s.promptIcon}><Feather name={x.icon as keyof typeof Feather.glyphMap} size={18} color={C.greenDark}/></View><Text style={s.promptLabel}>{x.label}</Text><Feather name="arrow-up-right" size={14} color={C.muted}/></Pressable>)}</View>
    <Pressable onPress={()=>setFocusVisible(true)} style={s.focusPrompt}><View style={s.focusPromptIcon}><Feather name="target" size={21} color={C.purple}/></View><View style={{flex:1}}><Text style={s.cardTitle}>Need to get started?</Text><Text style={s.cardSub}>Start a 25-minute focus sprint. One task, one timer, no guilt.</Text></View><Feather name="chevron-right" size={18} color={C.muted}/></Pressable>
    <Text style={s.footerNote}>Coach replies are generated on this device from simple rules and your saved entries. They are not a cloud AI or professional financial advice.</Text>
  </ScrollView>;

  const renderEditor=()=> {
    const title=editorKind==='task'?'New task':editorKind==='expense'?'Log an expense':editorKind==='goal'?'Create a savings goal':editorKind==='habit'?'Add a habit':'Add to savings';
    return <Modal visible={editorKind!==null} transparent animationType="slide" onRequestClose={closeEditor}><View style={s.modalOverlay}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.modalKeyboard}><View style={s.modalSheet}><View style={s.modalHandle}/><View style={s.modalHeader}><View style={{flex:1}}><Text style={s.modalTitle}>{title}</Text><Text style={s.modalSubtitle}>A small step, saved for later.</Text></View><Pressable onPress={closeEditor} style={s.modalClose}><Feather name="x" size={20} color={C.ink}/></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:18}}>
        {editorKind!=='contribute'?<><Text style={s.fieldLabel}>{editorKind==='expense'?'WHAT DID YOU SPEND ON?':editorKind==='goal'?'WHAT ARE YOU SAVING FOR?':editorKind==='habit'?'WHAT HABIT WILL YOU BUILD?':'WHAT NEEDS TO GET DONE?'}</Text><TextInput value={editorTitle} onChangeText={setEditorTitle} placeholder={editorKind==='expense'?'e.g. Lunch with a friend':editorKind==='goal'?'e.g. Emergency fund':editorKind==='habit'?'e.g. Stretch for five minutes':'e.g. Finish project outline'} placeholderTextColor="#97A5A8" style={s.formInput} maxLength={100} autoFocus/></>:<Text style={s.fieldLabel}>HOW MUCH DID YOU PUT ASIDE?</Text>}
        {editorKind==='task'?<><Text style={s.fieldLabel}>A LITTLE MORE CONTEXT (OPTIONAL)</Text><TextInput value={editorDetails} onChangeText={setEditorDetails} placeholder="What does done look like?" placeholderTextColor="#97A5A8" style={[s.formInput,{minHeight:74,textAlignVertical:'top'}]} multiline maxLength={300}/><Text style={s.fieldLabel}>PRIORITY</Text><View style={s.choiceRow}>{(['High','Medium','Low'] as Priority[]).map(x=><Pressable key={x} onPress={()=>setEditorPriority(x)} style={[s.choiceChip,editorPriority===x&&{backgroundColor:priorityColor(x),borderColor:priorityColor(x)}]}><Text style={[s.choiceText,editorPriority===x&&{color:'#FFFFFF'}]}>{x}</Text></Pressable>)}</View><Text style={s.fieldLabel}>DUE DATE (YYYY-MM-DD)</Text><TextInput value={editorDate} onChangeText={setEditorDate} placeholder={todayKey()} placeholderTextColor="#97A5A8" style={s.formInput} maxLength={10}/></>:null}
        {editorKind==='expense'?<><Text style={s.fieldLabel}>AMOUNT (INR)</Text><View style={s.amountInputBox}><Text style={s.rupee}>₹</Text><TextInput value={editorAmount} onChangeText={setEditorAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#97A5A8" style={s.amountField}/></View><Text style={s.fieldLabel}>CATEGORY</Text><View style={s.categoryChoices}>{EXPENSE_CATEGORIES.map(x=><Pressable key={x} onPress={()=>setEditorCategory(x)} style={[s.choiceChip,editorCategory===x&&s.choiceChipActive]}><Text style={[s.choiceText,editorCategory===x&&s.choiceTextActive]}>{x}</Text></Pressable>)}</View><Text style={s.fieldLabel}>SPENDING DATE (YYYY-MM-DD)</Text><TextInput value={editorDate} onChangeText={setEditorDate} style={s.formInput} maxLength={10}/></>:null}
        {editorKind==='goal'?<><Text style={s.fieldLabel}>TARGET AMOUNT (INR)</Text><View style={s.amountInputBox}><Text style={s.rupee}>₹</Text><TextInput value={editorAmount} onChangeText={setEditorAmount} keyboardType="decimal-pad" placeholder="e.g. 25000" placeholderTextColor="#97A5A8" style={s.amountField}/></View><Text style={s.fieldLabel}>TARGET DATE (OPTIONAL)</Text><TextInput value={editorDate} onChangeText={setEditorDate} style={s.formInput} maxLength={10} placeholder="YYYY-MM-DD"/></>:null}
        {editorKind==='contribute'?<><Text style={s.fieldHint}>DayPilot records your progress; it does not move money.</Text><View style={s.amountInputBox}><Text style={s.rupee}>₹</Text><TextInput value={editorAmount} onChangeText={setEditorAmount} keyboardType="decimal-pad" placeholder="e.g. 500" placeholderTextColor="#97A5A8" style={s.amountField} autoFocus/></View></>:null}
        {editorKind==='habit'?<Text style={s.fieldHint}>Keep it tiny and repeatable. Check in once per day and look back on your streak.</Text>:null}
        <View style={{marginTop:22}}><PrimaryButton title={editorKind==='task'?'Save task':editorKind==='expense'?'Save expense':editorKind==='goal'?'Create goal':editorKind==='habit'?'Create habit':'Save contribution'} onPress={()=>{void saveEditor();}}/></View>
      </ScrollView></View></KeyboardAvoidingView></View></Modal>;
  };

  const renderFocus=()=> <Modal visible={focusVisible} transparent animationType="fade" onRequestClose={()=>{setFocusVisible(false);setFocusRunning(false);}}><View style={s.focusOverlay}><LinearGradient colors={['#101D37','#2F3C77','#674F9F']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.focusSheet}><View pointerEvents="none" style={s.focusOrb}/><Pressable style={s.focusClose} onPress={()=>{setFocusVisible(false);setFocusRunning(false);}}><Feather name="x" size={22} color="#FFFFFF"/></Pressable><View style={s.focusIcon}><Feather name="target" size={25} color="#E5DBFF"/></View><Text style={s.focusEyebrow}>ONE THING AT A TIME</Text><Text style={s.focusTitle}>Focus sprint</Text><Text style={s.focusSub}>Twenty-five minutes for one meaningful thing.</Text><View style={s.timerRing}><View style={s.timerInner}><Text style={s.timerText}>{String(Math.floor(focusSeconds/60)).padStart(2,'0')}:{String(focusSeconds%60).padStart(2,'0')}</Text><Text style={s.timerLabel}>{focusRunning?'YOU ARE IN IT':'READY WHEN YOU ARE'}</Text></View></View><Text style={s.focusTip}>Put away distractions. Breathe. Start with the next tiny action.</Text><View style={s.focusButtons}><Pressable onPress={()=>{if(focusSeconds===0)setFocusSeconds(25*60);setFocusRunning(v=>!v);}} style={s.focusPrimary}><Feather name={focusRunning?'pause':'play'} size={17} color={C.navy}/><Text style={s.focusPrimaryText}>{focusRunning?'Pause sprint':focusSeconds===0?'Start again':'Start focus'}</Text></Pressable><Pressable onPress={()=>{setFocusRunning(false);setFocusSeconds(25*60);}} style={s.focusSecondary}><Feather name="rotate-ccw" size={16} color="#FFFFFF"/><Text style={s.focusSecondaryText}>Reset</Text></Pressable></View><Text style={s.focusSessions}>{focusSessions} focus sprint{focusSessions===1?'':'s'} completed this session</Text></LinearGradient></View></Modal>;

  if(!ready||!bootAnimDone)return <SafeAreaView style={s.splashSafe}><StatusBar barStyle="light-content" backgroundColor="#091A28"/><LinearGradient colors={['#091A28','#123C4C','#08785F']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.splash}><View pointerEvents="none" style={s.splashPlanet1}/><View pointerEvents="none" style={s.splashPlanet2}/><Animated.View style={[s.splashHalo,{opacity:splashGlow,transform:[{scale:splashGlow.interpolate({inputRange:[0,1],outputRange:[.78,1.18]})}]}]}/><Animated.View style={[s.splashLogo,{transform:[{scale:splashScale},{rotate:splashRotation.interpolate({inputRange:[0,1],outputRange:['-18deg','0deg']})}]}]}><BrandMark size={82}/></Animated.View><Animated.Text style={[s.splashTitle,{opacity:splashGlow}]}>DayPilot</Animated.Text><Text style={s.splashTagline}>Find your rhythm. Make your days count.</Text><ActivityIndicator color="#75F5C8" size="small" style={{marginTop:26}}/><Text style={s.splashFoot}>YOUR LIFE, IN A BETTER ORBIT</Text></LinearGradient></SafeAreaView>;
  if(bootError)return <SafeAreaView style={s.splashSafe}><Text style={s.bootError}>{bootError}</Text><Text style={s.bootErrorSmall}>Close and reopen DayPilot. Your previous SubSathi data is stored separately.</Text></SafeAreaView>;

  return <SafeAreaView edges={['top']} style={s.safeArea}><StatusBar barStyle="dark-content" backgroundColor={C.paper}/><Animated.View style={[s.appContent,{opacity:screenFade}]}>{tab==='Today'?renderToday():tab==='Plan'?renderPlan():tab==='Money'?renderMoney():renderCoach()}</Animated.View>
    <View style={[s.bottomNav,{paddingBottom:Math.max(insets.bottom,Platform.OS==='android'?8:0),height:66+Math.max(insets.bottom,8)}]}>{([['Today','sun'],['Plan','check-square'],['Money','pie-chart'],['Coach','compass']] as [Tab,keyof typeof Feather.glyphMap][]).map(([name,icon])=><Pressable key={name} accessibilityRole="button" accessibilityLabel={name} onPress={()=>setTab(name)} style={s.navItem}><View style={[s.navIconWrap,tab===name&&s.navIconActive]}><Feather name={icon} size={19} color={tab===name?C.greenDark:'#87979C'}/></View><Text style={[s.navLabel,tab===name&&s.navLabelActive]}>{name}</Text></Pressable>)}</View>
    {renderEditor()}{renderFocus()}
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safeArea:{flex:1,backgroundColor:C.paper},appContent:{flex:1,minHeight:0},
  splashSafe:{flex:1,backgroundColor:'#091A28'},splash:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:28,overflow:'hidden'},
  splashPlanet1:{position:'absolute',width:320,height:320,borderRadius:160,top:-128,right:-125,borderWidth:1,borderColor:'rgba(210,255,239,0.09)',backgroundColor:'rgba(255,255,255,0.025)'},
  splashPlanet2:{position:'absolute',width:380,height:380,borderRadius:190,bottom:-210,left:-148,borderWidth:1,borderColor:'rgba(210,255,239,0.09)',backgroundColor:'rgba(18,168,121,0.08)'},
  splashHalo:{position:'absolute',width:180,height:180,borderRadius:90,backgroundColor:'rgba(59,239,176,0.11)',borderWidth:1,borderColor:'rgba(160,255,217,0.22)'},
  splashLogo:{width:132,height:132,borderRadius:42,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.08)',borderWidth:1,borderColor:'rgba(197,255,229,0.34)',marginBottom:25,shadowColor:'#34E3AD',shadowOffset:{width:0,height:8},shadowOpacity:.36,shadowRadius:26,elevation:12},
  splashTitle:{fontSize:44,fontWeight:'900',letterSpacing:-1.8,color:'#F5FFF9'},splashTagline:{marginTop:9,fontSize:13,color:'#B7DED1',textAlign:'center',lineHeight:20},splashFoot:{position:'absolute',bottom:48,fontSize:9,letterSpacing:1.8,color:'#AEDCCB',fontWeight:'800'},
  bootError:{margin:24,marginTop:60,color:'#FFFFFF',fontSize:19,fontWeight:'700',textAlign:'center'},bootErrorSmall:{marginHorizontal:25,color:'#B7DED1',textAlign:'center',lineHeight:21},
  brandMark:{backgroundColor:C.greenDark,alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:C.green,shadowOffset:{width:0,height:4},shadowOpacity:.19,shadowRadius:7,elevation:4},brandOrbit:{position:'absolute',borderWidth:1.6,borderColor:'rgba(255,255,255,0.50)',transform:[{rotate:'34deg'}]},brandSpark:{position:'absolute',right:'19%',top:'19%',backgroundColor:'#9CFFDD'},
  scrollContent:{paddingHorizontal:19,paddingTop:12,paddingBottom:24},topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:23},brandLockup:{flexDirection:'row',alignItems:'center',gap:10},brandName:{fontSize:21,fontWeight:'900',letterSpacing:-.7,color:C.ink},brandTag:{fontSize:10,color:C.muted,marginTop:2},coachOrb:{width:42,height:42,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:C.mint,borderWidth:1,borderColor:'#C4EEDC'},
  greeting:{fontSize:25,color:C.ink,fontWeight:'900',letterSpacing:-.8},todayDate:{marginTop:4,fontSize:12,color:C.muted,marginBottom:16},
  hero:{borderRadius:28,padding:20,minHeight:222,overflow:'hidden',shadowColor:'#103940',shadowOffset:{width:0,height:12},shadowOpacity:.16,shadowRadius:18,elevation:6},heroOrb1:{position:'absolute',width:190,height:190,borderRadius:95,right:-73,top:-77,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',backgroundColor:'rgba(255,255,255,0.045)'},heroOrb2:{position:'absolute',width:135,height:135,borderRadius:68,right:44,bottom:-89,borderWidth:1,borderColor:'rgba(190,255,220,0.13)',backgroundColor:'rgba(190,255,220,0.07)'},
  heroHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},heroEyebrow:{color:'#B6DAD1',fontSize:9,letterSpacing:1.35,fontWeight:'800'},heroTitle:{color:'#FFFFFF',fontSize:19,fontWeight:'900',marginTop:7,letterSpacing:-.4},heroBadge:{width:47,height:47,borderRadius:17,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.14)'},
  scoreRow:{flexDirection:'row',alignItems:'center',gap:15,marginTop:21},scoreRingOuter:{width:88,height:88,borderRadius:44,borderWidth:5,borderColor:'rgba(139,245,202,0.70)',alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.08)'},scoreRingInner:{width:72,height:72,borderRadius:36,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(8,38,49,0.32)'},scoreNumber:{fontSize:25,fontWeight:'900',color:'#FFFFFF'},scorePct:{color:'#B6DAD1',fontSize:9,marginTop:-2},scoreCopy:{flex:1},scoreHeadline:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},scoreBody:{color:'#C2E0D9',fontSize:10,lineHeight:15,marginTop:5},heroMiniRow:{flexDirection:'row',flexWrap:'wrap',gap:11,marginTop:10},heroMini:{flexDirection:'row',alignItems:'center',gap:4},heroMiniText:{color:'#D4F7EB',fontSize:9,fontWeight:'700'},heroFooter:{color:'#AED7CC',fontSize:10,marginTop:17,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.13)',paddingTop:12},
  quickActions:{flexDirection:'row',justifyContent:'space-between',marginTop:19,marginBottom:21},quickAction:{alignItems:'center',width:'23%'},quickIcon:{width:51,height:51,borderRadius:18,alignItems:'center',justifyContent:'center'},quickLabel:{color:C.ink,fontSize:10,fontWeight:'700',marginTop:8},pressed:{opacity:.84,transform:[{scale:.98}]},
  dailyCheckCard:{padding:15,backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:22,marginBottom:23},dailyCheckTop:{flexDirection:'row',alignItems:'center',gap:10},dailyCheckIcon:{width:42,height:42,borderRadius:15,backgroundColor:C.mint,alignItems:'center',justifyContent:'center'},dailyCheckEyebrow:{color:C.greenDark,fontSize:8,fontWeight:'900',letterSpacing:1.05},dailyCheckTitle:{color:C.ink,fontSize:13,fontWeight:'900',marginTop:4},dailyCheckBody:{color:C.muted,fontSize:11,lineHeight:17,marginTop:11},inlineCTA:{flexDirection:'row',alignItems:'center',gap:4,marginTop:11,alignSelf:'flex-start'},inlineCTAText:{color:C.greenDark,fontSize:11,fontWeight:'900'},
  sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12,marginTop:1},sectionTitle:{fontSize:16,color:C.ink,fontWeight:'900',letterSpacing:-.35},actionText:{color:C.greenDark,fontSize:11,fontWeight:'800'},tag:{alignSelf:'flex-start',borderRadius:20,paddingHorizontal:9,paddingVertical:6},tagText:{fontSize:9,fontWeight:'900'},
  habitScroll:{gap:10,paddingBottom:22},habitCard:{width:142,minHeight:145,backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:21,padding:13},habitCardDone:{borderColor:'#AFE4CD',backgroundColor:'#F4FFF9'},habitIcon:{width:42,height:42,borderRadius:15,alignItems:'center',justifyContent:'center'},habitTitle:{color:C.ink,fontSize:12,fontWeight:'800',lineHeight:16,marginTop:10,minHeight:32},habitMeta:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},habitStatus:{alignSelf:'flex-start',marginTop:10,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:6,borderRadius:10,backgroundColor:C.mint},habitStatusDone:{backgroundColor:C.green},habitStatusText:{fontSize:9,color:C.greenDark,fontWeight:'900'},addHabitCard:{borderStyle:'dashed',backgroundColor:'#FBFDFC',alignItems:'center',justifyContent:'center'},addHabitCircle:{width:40,height:40,borderRadius:14,backgroundColor:C.mint,alignItems:'center',justifyContent:'center'},
  panel:{paddingHorizontal:14,paddingVertical:5,backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:20,marginBottom:21},taskRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#F0F4F2'},taskRowDone:{opacity:.72},checkCircle:{width:24,height:24,borderRadius:9,borderWidth:1.6,borderColor:'#C6D7D0',alignItems:'center',justifyContent:'center',backgroundColor:C.white},checkCircleDone:{backgroundColor:C.green,borderColor:C.green},taskCopy:{flex:1,minWidth:0},taskTitle:{fontSize:12,fontWeight:'800',color:C.ink},taskTitleDone:{textDecorationLine:'line-through',color:C.muted},taskMeta:{fontSize:9,color:C.muted,marginTop:4},priorityDot:{width:7,height:7,borderRadius:4,marginHorizontal:4},showAll:{padding:12,alignItems:'center'},
  emptyCard:{backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderStyle:'dashed',padding:22,borderRadius:22,alignItems:'center',marginBottom:22},emptyIcon:{width:54,height:54,borderRadius:19,backgroundColor:C.mint,alignItems:'center',justifyContent:'center'},emptyTitle:{marginTop:12,fontSize:15,color:C.ink,fontWeight:'900',textAlign:'center'},emptyBody:{marginTop:7,marginBottom:14,fontSize:11,color:C.muted,lineHeight:17,textAlign:'center'},
  primaryButton:{borderRadius:14,backgroundColor:C.green,paddingHorizontal:16,paddingVertical:13,minHeight:45,alignItems:'center',justifyContent:'center'},primaryButtonText:{color:'#FFFFFF',fontSize:12,fontWeight:'900'},secondaryButton:{borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.white,paddingHorizontal:16,paddingVertical:13,minHeight:45,alignItems:'center',justifyContent:'center'},secondaryButtonText:{color:C.ink,fontSize:12,fontWeight:'800'},
  reminderRow:{flexDirection:'row',alignItems:'center',gap:11,padding:13,borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:C.white,marginTop:2},reminderIcon:{width:39,height:39,borderRadius:13,backgroundColor:C.mint,alignItems:'center',justifyContent:'center'},reminderTitle:{color:C.ink,fontSize:11,fontWeight:'900'},reminderBody:{color:C.muted,fontSize:9,lineHeight:14,marginTop:4},footerNote:{textAlign:'center',color:'#8A9A9F',fontSize:9,lineHeight:15,marginTop:15,marginHorizontal:8},
  bottomNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-around',backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.line,paddingHorizontal:10},navItem:{width:'24%',alignItems:'center',justifyContent:'center',gap:3},navIconWrap:{width:45,height:30,borderRadius:11,justifyContent:'center',alignItems:'center'},navIconActive:{backgroundColor:C.mint},navLabel:{color:'#89999D',fontSize:9,fontWeight:'700'},navLabelActive:{color:C.greenDark,fontWeight:'900'},
  pageHeader:{marginTop:9,marginBottom:20},pageEyebrow:{color:C.greenDark,fontSize:9,fontWeight:'900',letterSpacing:1.4,marginBottom:8},pageTitle:{color:C.ink,fontSize:30,fontWeight:'900',letterSpacing:-1.2},pageSub:{color:C.muted,fontSize:12,marginTop:7,lineHeight:18},
  planSummary:{padding:15,borderRadius:20,flexDirection:'row',alignItems:'center',gap:12,marginBottom:17},planSummaryIcon:{width:45,height:45,borderRadius:15,backgroundColor:'rgba(255,255,255,0.8)',alignItems:'center',justifyContent:'center'},planSummaryTitle:{color:C.ink,fontSize:13,fontWeight:'900'},planSummaryBody:{color:'#5C7774',fontSize:10,lineHeight:15,marginTop:5},planButtons:{flexDirection:'row',gap:9,marginBottom:18},searchBox:{height:48,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.white,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:9,marginBottom:12},searchInput:{flex:1,color:C.ink,fontSize:12,paddingVertical:7},filterRow:{flexDirection:'row',gap:8,marginBottom:18},filterChip:{borderRadius:16,borderWidth:1,borderColor:C.line,backgroundColor:C.white,paddingHorizontal:17,paddingVertical:8},filterChipActive:{backgroundColor:C.navy,borderColor:C.navy},filterText:{fontSize:10,color:C.muted,fontWeight:'800'},filterTextActive:{color:'#FFFFFF'},planHabitRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#EEF3F1'},miniCheck:{width:32,height:32,borderRadius:11,backgroundColor:C.mint,alignItems:'center',justifyContent:'center'},miniCheckDone:{backgroundColor:C.green},
  moneyHero:{borderRadius:25,padding:20,marginBottom:17,shadowColor:C.shadow,shadowOffset:{width:0,height:10},shadowOpacity:.16,shadowRadius:16,elevation:5},moneyHeroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},moneyHeroEyebrow:{color:'#B8D6E6',fontSize:9,fontWeight:'800',letterSpacing:1.2},moneyHeroTotal:{color:'#FFFFFF',fontSize:34,fontWeight:'900',letterSpacing:-1,marginTop:8},moneyHeroIcon:{width:49,height:49,borderRadius:17,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'},budgetTextRow:{flexDirection:'row',justifyContent:'space-between',marginTop:18,marginBottom:8},budgetLabel:{color:'#D4E7F1',fontSize:10,fontWeight:'800'},progressTrack:{width:'100%',height:7,borderRadius:5,overflow:'hidden'},progressFill:{height:'100%',borderRadius:5},moneyHeroFoot:{color:'#C3E6E6',fontSize:10,marginTop:10},
  budgetEditor:{padding:14,borderRadius:18,backgroundColor:C.white,borderWidth:1,borderColor:C.line,marginBottom:21},budgetEditorCopy:{marginBottom:11},cardTitle:{color:C.ink,fontSize:12,fontWeight:'900'},cardSub:{color:C.muted,fontSize:10,lineHeight:15,marginTop:5},budgetInputRow:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.line,borderRadius:13,paddingLeft:13,backgroundColor:'#FBFDFC'},rupee:{color:C.ink,fontSize:19,fontWeight:'800'},budgetInput:{flex:1,paddingHorizontal:10,paddingVertical:12,fontSize:17,color:C.ink,fontWeight:'800'},budgetSave:{width:39,height:39,borderRadius:11,backgroundColor:C.green,alignItems:'center',justifyContent:'center',marginRight:5},categoryRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#F0F4F2'},categoryDot:{width:10,height:10,borderRadius:5},categoryTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},categoryName:{color:C.ink,fontSize:11,fontWeight:'800'},categoryAmount:{color:C.ink,fontSize:11,fontWeight:'900'},
  expenseRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#EEF3F1'},expenseIcon:{width:40,height:40,borderRadius:14,backgroundColor:C.mint,alignItems:'center',justifyContent:'center'},expenseAmount:{color:C.ink,fontSize:12,fontWeight:'900'},deleteHint:{color:'#93A2A5',fontSize:8,marginTop:3},goalCard:{padding:15,backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:19,marginBottom:11},goalHeader:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:13},goalIcon:{width:40,height:40,borderRadius:14,backgroundColor:C.purplePale,alignItems:'center',justifyContent:'center'},goalTitle:{color:C.ink,fontSize:12,fontWeight:'900'},goalMeta:{color:C.muted,fontSize:10,marginTop:4},goalPercent:{color:C.purple,fontSize:13,fontWeight:'900'},goalActions:{flexDirection:'row',justifyContent:'space-between',marginTop:13},deleteGoalText:{color:C.red,fontSize:10,fontWeight:'800'},goalEmpty:{backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:19,padding:16,marginBottom:17},
  coachHero:{borderRadius:25,padding:18,marginBottom:17,overflow:'hidden'},coachHeroTop:{flexDirection:'row',alignItems:'center',gap:10},coachAvatar:{width:47,height:47,borderRadius:17,backgroundColor:'rgba(255,255,255,0.17)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.2)'},coachHeroTitle:{color:'#FFFFFF',fontSize:14,fontWeight:'900'},coachHeroSub:{color:'#D7E3FA',fontSize:9,lineHeight:14,marginTop:4},coachMetrics:{flexDirection:'row',gap:10,marginTop:18,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.16)',paddingTop:13},coachMetric:{flex:1},coachMetricValue:{color:'#FFFFFF',fontSize:14,fontWeight:'900'},coachMetricLabel:{color:'#C8D7F0',fontSize:8,marginTop:5},
  chatPanel:{backgroundColor:C.white,borderRadius:20,borderWidth:1,borderColor:C.line,padding:11,marginBottom:21},chatBubble:{borderRadius:16,padding:12,marginBottom:9,maxWidth:'96%'},chatYou:{alignSelf:'flex-end',backgroundColor:C.mint,borderBottomRightRadius:5},chatCoach:{alignSelf:'flex-start',backgroundColor:'#F3F6FA',borderBottomLeftRadius:5},chatRole:{color:C.greenDark,fontSize:8,fontWeight:'900',letterSpacing:1,marginBottom:5},chatText:{color:C.ink,fontSize:11,lineHeight:17},chatInputRow:{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:5},chatInput:{flex:1,minHeight:45,maxHeight:100,borderRadius:13,borderWidth:1,borderColor:C.line,backgroundColor:C.paper,paddingHorizontal:12,paddingVertical:10,color:C.ink,fontSize:11},sendButton:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:C.green},promptGrid:{flexDirection:'row',flexWrap:'wrap',gap:9,marginBottom:20},promptCard:{width:'48%',minHeight:86,flexGrow:1,flexBasis:'44%',backgroundColor:C.white,borderRadius:16,borderWidth:1,borderColor:C.line,padding:12,justifyContent:'space-between},promptIcon:{width:31,height:31,borderRadius:11,backgroundColor:C.mint,alignItems:'center',justifyContent:'center'},promptLabel:{marginTop:8,flex:1,color:C.ink,fontSize:10,fontWeight:'900'},focusPrompt:{padding:14,borderRadius:18,borderWidth:1,borderColor:'#E1D8FD',backgroundColor:'#F7F3FF',flexDirection:'row',gap:11,alignItems:'center'},focusPromptIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#EBE3FF',alignItems:'center',justifyContent:'center'},
  modalOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(8,25,34,0.50)'},modalKeyboard:{width:'100%'},modalSheet:{maxHeight:'92%',backgroundColor:C.paper,borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:20,paddingTop:10,paddingBottom:20},modalHandle:{alignSelf:'center',width:42,height:4,borderRadius:3,backgroundColor:'#CBD8D2',marginBottom:15},modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},modalTitle:{color:C.ink,fontSize:22,fontWeight:'900',letterSpacing:-.5},modalSubtitle:{color:C.muted,fontSize:11,marginTop:4},modalClose:{width:38,height:38,borderRadius:13,backgroundColor:C.white,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},fieldLabel:{color:'#63777D',fontSize:9,fontWeight:'900',letterSpacing:1.1,marginTop:16,marginBottom:8},formInput:{minHeight:48,borderRadius:13,borderWidth:1,borderColor:C.line,backgroundColor:C.white,paddingHorizontal:13,paddingVertical:11,color:C.ink,fontSize:12},fieldHint:{fontSize:10,color:C.muted,lineHeight:16,marginTop:8},choiceRow:{flexDirection:'row',gap:8},categoryChoices:{flexDirection:'row',flexWrap:'wrap',gap:7},choiceChip:{borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:C.white,paddingHorizontal:14,paddingVertical:10},choiceChipActive:{backgroundColor:C.mint,borderColor:C.green},choiceText:{fontSize:10,color:C.muted,fontWeight:'800'},choiceTextActive:{color:C.greenDark},amountInputBox:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.line,borderRadius:13,backgroundColor:C.white,paddingLeft:14},amountField:{flex:1,minHeight:49,color:C.ink,fontSize:18,fontWeight:'800',paddingHorizontal:10},
  focusOverlay:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(6,14,29,0.76)',padding:18},focusSheet:{width:'100%',maxWidth:480,borderRadius:29,padding:22,alignItems:'center',overflow:'hidden'},focusOrb:{position:'absolute',width:240,height:240,borderRadius:120,top:-135,right:-60,backgroundColor:'rgba(255,255,255,0.06)'},focusClose:{alignSelf:'flex-end',width:36,height:36,borderRadius:12,backgroundColor:'rgba(255,255,255,0.13)',alignItems:'center',justifyContent:'center'},focusIcon:{width:54,height:54,borderRadius:19,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center',justifyContent:'center',marginTop:3},focusEyebrow:{color:'#CFC5FF',fontSize:9,letterSpacing:1.8,fontWeight:'900',marginTop:15},focusTitle:{color:'#FFFFFF',fontSize:29,fontWeight:'900',marginTop:7},focusSub:{color:'#D8DAF3',fontSize:11,lineHeight:17,textAlign:'center',marginTop:6},timerRing:{width:208,height:208,borderRadius:104,borderWidth:5,borderColor:'rgba(193,176,255,0.78)',alignItems:'center',justifyContent:'center',marginTop:25,backgroundColor:'rgba(255,255,255,0.045)'},timerInner:{width:185,height:185,borderRadius:93,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.055)'},timerText:{color:'#FFFFFF',fontSize:44,fontWeight:'900',letterSpacing:-1.5},timerLabel:{color:'#CAC8F2',fontSize:8,letterSpacing:1.4,marginTop:6,fontWeight:'900'},focusTip:{color:'#DFE0F6',fontSize:10,textAlign:'center',lineHeight:16,marginTop:17,maxWidth:290},focusButtons:{flexDirection:'row',gap:9,marginTop:20},focusPrimary:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#A8F7D8',paddingHorizontal:18,paddingVertical:13,borderRadius:14},focusPrimaryText:{color:C.navy,fontSize:11,fontWeight:'900'},focusSecondary:{flexDirection:'row',alignItems:'center',gap:7,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.30)',paddingHorizontal:14,paddingVertical:13},focusSecondaryText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},focusSessions:{color:'#BBBFE5',fontSize:9,marginTop:19},
});
export default function App(){return <SafeAreaProvider><DayPilotApp/></SafeAreaProvider>;}
