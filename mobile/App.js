import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase, supabaseConfigError } from './src/lib/supabase';
import {
  createBudget, createCategory, createTransaction, deleteBudget, deleteCategory,
  deleteTransaction, getBudgetSpending, getFinancialTotals, getLargestExpenses,
  getMonthlyCashflow, listBudgets, listCategories, listRecentTransactions,
  listTransactions, updateBudget, updateCategory, updateProfile, updateTransaction,
} from './src/services/finance';

const C = {
  ink: '#10251f', muted: '#73827b', green: '#176b51', green2: '#248466',
  pale: '#e8f3ed', paper: '#f5f7f3', white: '#ffffff', line: '#e5ebe6',
  red: '#c84e4e', amber: '#c1842d', navy: '#1d3932',
};
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => today().slice(0, 7);
const shiftMonth = (month, delta) => {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
};
const monthLabel = (month) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (value, currency = 'GHS') => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0); }
  catch { return `${currency} ${(Number(value) || 0).toFixed(2)}`; }
};
const humanDate = (value) => {
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const friendlyError = (e) => e?.message || 'Something went wrong. Please try again.';
function authErrorMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '');
  if (/email address not authorized/i.test(message)) return 'Supabase’s built-in email sender only delivers to project team addresses. Configure a custom SMTP provider in Supabase Auth settings.';
  if (/email rate limit|over_email_send_rate_limit|too many requests|after \d+ seconds/i.test(`${code} ${message}`)) return 'Supabase temporarily rate limited email delivery. Wait before requesting another email, or configure a custom SMTP provider in Supabase Auth settings.';
  if (/user_already_exists|user already registered|already registered/i.test(`${code} ${message}`)) return 'An account may already use this email. Try signing in or use Forgot password.';
  if (/weak_password|password should be at least|password is too short/i.test(`${code} ${message}`)) return 'Choose a stronger password with at least 8 characters.';
  if (/invalid email|email_address_invalid/i.test(`${code} ${message}`)) return 'Enter a valid email address and try again.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Request another confirmation email if the link did not arrive.';
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match. Check them and try again.';
  return message || 'Something went wrong. Please try again.';
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [section, setSection] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(monthNow());
  const [profile, setProfile] = useState({ full_name: '', currency: 'GHS' });
  const [data, setData] = useState({ transactions: [], transactionCount: 0, categories: [], budgets: [], spent: {}, totals: {}, trend: [], biggest: [], recent: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const handledAuthUrls = useRef(new Set());

  useEffect(() => {
    if (supabaseConfigError) { setAuthReady(true); return undefined; }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') setResetMode(true);
    });
    supabase.auth.getSession().then(({ data: result }) => {
      setSession(result.session);
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    return () => subscription.unsubscribe();
  }, []);

  const handleAuthUrl = useCallback(async (url) => {
    const isInstalledCallback = typeof url === 'string' && url.startsWith('spendwise://auth/callback');
    const isExpoGoCallback = typeof url === 'string' && /^exp:\/\//i.test(url) && url.includes('/--/auth/callback');
    if ((!isInstalledCallback && !isExpoGoCallback) || handledAuthUrls.current.has(url)) return;
    handledAuthUrls.current.add(url);
    try {
      const parsed = new URL(url);
      const params = parsed.searchParams;
      const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token') || params.get('access_token');
      const refreshToken = hash.get('refresh_token') || params.get('refresh_token');
      const tokenHash = params.get('token_hash') || hash.get('token_hash');
      const type = params.get('type') || hash.get('type') || 'signup';
      const code = params.get('code');
      const callbackError = params.get('error_description') || params.get('error') || hash.get('error_description') || hash.get('error');
      if (callbackError) {
        Alert.alert('Email link problem', callbackError);
        return;
      }
      let authError;
      if (accessToken && refreshToken) {
        ({ error: authError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
      } else if (tokenHash) {
        ({ error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
      } else if (code) {
        ({ error: authError } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        Alert.alert('Link could not be used', 'This email link is missing its sign-in details. Request a new link and open it on this device.');
        return;
      }
      if (authError) Alert.alert(type === 'recovery' ? 'Password link expired' : 'Confirmation failed', authErrorMessage(authError));
      else if (type === 'recovery') setResetMode(true);
      else Alert.alert('Email confirmed', 'Your SpendWise account is ready.');
    } catch (error) {
      Alert.alert('Confirmation failed', authErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(handleAuthUrl).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, [handleAuthUrl]);

  const user = session?.user;
  const refresh = useCallback(async () => {
    if (!user) return;
    setBusy(true); setError('');
    const month = selectedMonth;
    try {
      const [categories, txResult, budgets, spent, totals, trend, biggest, recent, profileRow] = await Promise.all([
        listCategories(user.id), listTransactions(user.id, {}, 0), listBudgets(user.id, month),
        getBudgetSpending(user.id, month), getFinancialTotals(user.id, month),
        getMonthlyCashflow(user.id, month, 6), getLargestExpenses(user.id, month),
        listRecentTransactions(user.id), supabase.from('profiles').select('full_name,currency').eq('id', user.id).maybeSingle(),
      ]);
      if (profileRow.error) throw profileRow.error;
      setData({ transactions: txResult.transactions, transactionCount: txResult.count, categories, budgets, spent, totals, trend, biggest, recent });
      setProfile(profileRow.data || { full_name: '', currency: 'GHS' });
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  }, [user, selectedMonth]);

  useEffect(() => { refresh(); }, [refresh]);

  const wrapped = async (fn, successMessage) => {
    try { await fn(); setForm(null); setError(''); await refresh(); if (successMessage) Alert.alert('Saved', successMessage); return { ok: true }; }
    catch (e) { const message = friendlyError(e); setError(message); return { ok: false, error: message }; }
  };

  if (!authReady) return <Splash />;
  if (supabaseConfigError) return <ConfigurationScreen />;
  if (session && resetMode) return <ResetPasswordScreen onComplete={() => setResetMode(false)} />;
  if (!session) return <AuthScreen />;

  const screen = section || tab;
  const title = section || tab;
  const initial = (profile.full_name || user.email || 'S').trim().charAt(0).toUpperCase();
  const pageProps = { data, profile, setProfile, error, busy, refresh, setForm, setTab, selectedMonth, setSelectedMonth, wrapped, user };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
      <View style={styles.topbar}>
        <View style={styles.brandMark}><Text style={styles.brandGlyph}>S</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.brandName}>SpendWise</Text><Text style={styles.brandCaption}>YOUR MONEY, IN FOCUS</Text></View>
        <Pressable style={styles.avatar} onPress={() => { setSection('Settings'); setTab('More'); }}><Text style={styles.avatarText}>{initial}</Text></Pressable>
      </View>
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHeading}>
          <View><Text style={styles.eyebrow}>{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text><Text style={styles.heading}>{title}</Text></View>
          {busy ? <ActivityIndicator color={C.green} /> : <Pressable onPress={refresh} style={styles.refresh}><Text style={styles.refreshText}>↻</Text></Pressable>}
        </View>
        {error ? <Notice text={error} onClose={() => setError('')} /> : null}
        {screen === 'Overview' && <Overview {...pageProps} />}
        {screen === 'Activity' && <TransactionsPage {...pageProps} />}
        {screen === 'Budgets' && <BudgetsPage {...pageProps} />}
        {screen === 'Insights' && <InsightsPage {...pageProps} />}
        {screen === 'Categories' && <CategoriesPage {...pageProps} />}
        {screen === 'Settings' && <SettingsPage {...pageProps} signOut={async () => { const { error: e } = await supabase.auth.signOut({ scope: 'local' }); if (e) setError(e.message); }} />}
        {screen === 'More' && <MorePage onNavigate={(next) => setSection(next)} onSignOut={async () => { const { error: e } = await supabase.auth.signOut({ scope: 'local' }); if (e) setError(e.message); }} email={user.email} />}
      </ScrollView>
      {!section && <View style={styles.tabbar}>{['Overview', 'Activity', 'Budgets', 'Insights', 'More'].map((item) => <Pressable key={item} style={styles.tabItem} onPress={() => { setTab(item); setSection(''); }}><Text style={[styles.tabIcon, tab === item && styles.tabSelected]}>{({ Overview: '⌂', Activity: '↕', Budgets: '▤', Insights: '⌁', More: '•••' })[item]}</Text><Text style={[styles.tabLabel, tab === item && styles.tabLabelSelected]}>{item}</Text></Pressable>)}</View>}
      {!!section && <View style={styles.backbar}><Pressable onPress={() => setSection('')} style={styles.backButton}><Text style={styles.backText}>‹  Back to More</Text></Pressable></View>}
      <FinanceModal visible={!!form} form={form} setForm={setForm} data={data} currency={profile.currency} onSave={async (value) => {
        if (!form) return;
        const { kind, record } = form;
        return wrapped(async () => {
          if (kind === 'transaction') return record?.id ? updateTransaction(user.id, record.id, value) : createTransaction(user.id, value);
          if (kind === 'budget') return record?.id ? updateBudget(user.id, record.id, value) : createBudget(user.id, value);
          if (kind === 'category') return record?.id ? updateCategory(user.id, record.id, value) : createCategory(user.id, value);
        });
      }} />
    </SafeAreaView>
  );
}

function Splash() { return <View style={styles.center}><ActivityIndicator size="large" color={C.green} /><Text style={styles.muted}>Opening your money dashboard…</Text></View>; }
function ConfigurationScreen() { return <View style={styles.center}><Text style={styles.logoBig}>SpendWise</Text><Text style={styles.authTitle}>Connect your Supabase project</Text><Text style={styles.mutedCenter}>Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to mobile/.env.local, then restart Expo.</Text></View>; }

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [name, setName] = useState('');
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [working, setWorking] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const redirectTo = Linking.createURL('auth/callback');
  const submit = async () => {
    setWorking(true); setMessage(''); setError('');
    try {
      const normalizedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
      if (mode === 'forgot') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
        if (e) throw e;
        const redirectHint = redirectTo.startsWith('exp://')
          ? 'For Expo Go, allow exp://**/--/auth/callback in Supabase Auth → URL Configuration → Redirect URLs.'
          : 'For an installed app, allow spendwise://auth/callback in Supabase Auth → URL Configuration → Redirect URLs.';
        setMessage(`If an account uses that address, a password reset link has been sent. ${redirectHint}`);
      } else if (mode === 'register') {
        if (name.trim().length < 1 || name.trim().length > 80) throw new Error('Enter a name between 1 and 80 characters.');
        if (password.length < 8) throw new Error('Choose a password with at least 8 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const { data, error: e } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo } });
        if (e) throw e;
        if (data.session) setMessage('Account created. You are signed in.');
        else if (data.user?.identities?.length === 0) setMessage('An account may already use this email. Try signing in or use Forgot password.');
        else {
          setConfirmationPending(true);
          const redirectHint = redirectTo.startsWith('exp://')
            ? 'For Expo Go, allow exp://**/--/auth/callback in Supabase Auth → URL Configuration → Redirect URLs.'
            : 'For an installed app, allow spendwise://auth/callback in Supabase Auth → URL Configuration → Redirect URLs.';
          setMessage(`Check your inbox, then open the confirmation link on this iPhone to finish signing up. ${redirectHint}`);
        }
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (e) throw e;
      }
    } catch (e) { setError(authErrorMessage(e)); }
    finally { setWorking(false); }
  };
  const resend = async () => {
    setWorking(true); setError(''); setMessage('');
    try {
      const { error: e } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo } });
      if (e) throw e;
      setConfirmationPending(true);
      const redirectHint = redirectTo.startsWith('exp://')
        ? 'For Expo Go, allow exp://**/--/auth/callback in Supabase Auth → URL Configuration → Redirect URLs.'
        : 'For an installed app, allow spendwise://auth/callback in Supabase Auth → URL Configuration → Redirect URLs.';
      setMessage(`If this account needs confirmation, a new email is on its way. Open the link on this iPhone. ${redirectHint}`);
    }
    catch (e) { setError(authErrorMessage(e)); } finally { setWorking(false); }
  };
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.authWrap}><ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
    <View style={styles.brandMarkLarge}><Text style={styles.brandGlyphLarge}>S</Text></View><Text style={styles.logoBig}>SpendWise</Text><Text style={styles.authSub}>A clearer view of your everyday money.</Text>
    <View style={styles.authCard}><Text style={styles.eyebrow}>{mode === 'login' ? 'WELCOME BACK' : mode === 'forgot' ? 'ACCOUNT RECOVERY' : 'GET STARTED'}</Text><Text style={styles.authTitle}>{mode === 'login' ? 'Sign in to your account' : mode === 'forgot' ? 'Reset your password' : 'Create your account'}</Text>
      {mode === 'register' && <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" autoComplete="name" returnKeyType="next" />}
      <Field label="Email address" value={email} onChangeText={(value) => { setEmail(value); setConfirmationPending(false); setMessage(''); setError(''); }} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType={mode === 'forgot' ? 'send' : 'next'} />
      {mode !== 'forgot' && <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'register' ? 'new-password' : 'password'} textContentType={mode === 'register' ? 'newPassword' : 'password'} />}
      {mode === 'register' && <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter it again" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={submit} />}
      {error ? <Notice text={error} /> : null}{message ? <Notice text={message} success /> : null}
      <PrimaryButton title={working ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : confirmationPending ? 'Confirmation email sent' : 'Create account'} onPress={submit} disabled={working || !email || (mode !== 'forgot' && !password) || (mode === 'register' && (!name.trim() || !confirmPassword || confirmationPending))} />
      {mode === 'login' && <Pressable disabled={working || !email} onPress={resend} style={styles.linkButton}><Text style={styles.link}>Resend confirmation email</Text></Pressable>}
      {mode === 'register' && confirmationPending && <Pressable disabled={working} onPress={resend} style={styles.linkButton}><Text style={styles.link}>{working ? 'Sending…' : 'Resend confirmation email'}</Text></Pressable>}
      {mode === 'login' && <Pressable onPress={() => { setMode('forgot'); setError(''); setMessage(''); }} style={styles.linkButton}><Text style={styles.link}>Forgot password?</Text></Pressable>}
      <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMessage(''); setConfirmationPending(false); }} style={styles.switchMode}><Text style={styles.muted}>{mode === 'login' ? 'New to SpendWise? ' : 'Already have an account? '}<Text style={styles.link}>{mode === 'login' ? 'Create one' : 'Sign in'}</Text></Text></Pressable>
    </View><Text style={styles.secureNote}>Your financial information is private and protected by your account.</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function ResetPasswordScreen({ onComplete }) {
  const [password, setPassword] = useState(''); const [working, setWorking] = useState(false); const [error, setError] = useState('');
  const save = async () => { setWorking(true); setError(''); try { const { error: e } = await supabase.auth.updateUser({ password }); if (e) throw e; Alert.alert('Password updated', 'You can continue using SpendWise.'); onComplete(); } catch (e) { setError(authErrorMessage(e)); } finally { setWorking(false); } };
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.authWrap}><View style={styles.authContent}><View style={styles.brandMarkLarge}><Text style={styles.brandGlyphLarge}>S</Text></View><Text style={styles.logoBig}>SpendWise</Text><Text style={styles.authSub}>Choose a new password for your account.</Text><View style={styles.authCard}><Text style={styles.authTitle}>Set a new password</Text><Field label="New password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />{error ? <Notice text={error} /> : null}<PrimaryButton title={working ? 'Saving…' : 'Update password'} onPress={save} disabled={working || password.length < 8} /></View></View></KeyboardAvoidingView></SafeAreaView>;
}

function Overview({ data, profile, setForm, setTab, selectedMonth }) {
  const currency = profile.currency || 'GHS'; const net = data.totals.monthIncome - data.totals.monthExpenses;
  return <>
    <View style={styles.heroCard}><Text style={styles.heroLabel}>{monthLabel(selectedMonth).toUpperCase()} · NET CASH FLOW</Text><Text style={styles.heroAmount}>{money(net, currency)}</Text><View style={styles.heroStats}><View><Text style={styles.heroStatLabel}>INCOME</Text><Text style={styles.heroStatValue}>{money(data.totals.monthIncome, currency)}</Text></View><View style={styles.heroDivider} /><View><Text style={styles.heroStatLabel}>SPENDING</Text><Text style={styles.heroStatValue}>{money(data.totals.monthExpenses, currency)}</Text></View></View><View style={styles.heroOrb} /></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Quick actions</Text></View><View style={styles.quickRow}><Pressable style={styles.quickCard} onPress={() => setForm({ kind: 'transaction', initial: { type: 'expense', transactionDate: today() } })}><Text style={styles.quickIcon}>＋</Text><Text style={styles.quickLabel}>Add expense</Text></Pressable><Pressable style={styles.quickCard} onPress={() => setForm({ kind: 'transaction', initial: { type: 'income', transactionDate: today() } })}><Text style={[styles.quickIcon, styles.quickIconIncome]}>↗</Text><Text style={styles.quickLabel}>Add income</Text></Pressable></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recent activity</Text><Pressable onPress={() => setTab?.('Activity')}><Text style={styles.link}>See all</Text></Pressable></View>
    <View style={styles.card}>{data.recent.length ? data.recent.slice(0, 5).map((item) => <TransactionRow key={item.id} item={item} currency={currency} />) : <EmptyState title="No activity yet" body="Add your first transaction and it will appear here." />}</View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Spending plans</Text><Text style={styles.mutedSmall}>{data.budgets.length} budgets this month</Text></View>
    <View style={styles.card}>{data.budgets.slice(0, 3).map((budget) => { const spent = data.spent[budget.category_id] || 0; const ratio = Math.min(spent / Number(budget.amount), 1); return <View key={budget.id} style={styles.budgetPreview}><View style={styles.rowBetween}><Text style={styles.rowTitle}>{budget.category?.name || 'Category'}</Text><Text style={styles.rowMeta}>{money(spent, currency)} / {money(budget.amount, currency)}</Text></View><Progress value={ratio} danger={spent > budget.amount} /></View>; })}{!data.budgets.length && <EmptyState title="Set a monthly budget" body="Create a plan for an expense category." />}</View>
  </>;
}

function TransactionsPage({ data, profile, setForm, wrapped, user }) {
  const [filter, setFilter] = useState('all'); const currency = profile.currency || 'GHS';
  const [more, setMore] = useState(false);
  const [older, setOlder] = useState([]);
  useEffect(() => { setOlder([]); setMore(false); }, [data.transactions]);
  const rows = filter === 'all' ? data.transactions : data.transactions.filter((x) => x.type === filter);
  const fullRows = [...rows, ...older.filter((x) => filter === 'all' || x.type === filter)];
  const loadedCount = data.transactions.length + older.length;
  const loadMore = async () => { setMore(true); try { const page = await listTransactions(user.id, {}, data.transactions.length + older.length); setOlder((old) => [...old, ...page.transactions]); } catch (e) { Alert.alert('Could not load more', friendlyError(e)); } finally { setMore(false); } };
  return <><View style={styles.actionLine}><Text style={styles.mutedSmall}>{filter === 'all' ? `${fullRows.length} of ${data.transactionCount} transactions` : `${fullRows.length} ${filter === 'expense' ? 'expenses' : 'income records'}`}</Text><PrimaryButton compact title="＋ Add" onPress={() => setForm({ kind: 'transaction', initial: { type: 'expense', transactionDate: today() } })} /></View><View style={styles.filters}>{['all', 'expense', 'income'].map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterPill, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'all' ? 'All' : item === 'expense' ? 'Expenses' : 'Income'}</Text></Pressable>)}</View><View style={styles.card}>{fullRows.length ? fullRows.map((item) => <TransactionRow key={item.id} item={item} currency={currency} actions={<><SmallAction title="Edit" onPress={() => setForm({ kind: 'transaction', record: item, initial: { type: item.type, amount: String(item.amount), description: item.description || '', categoryId: item.category_id, transactionDate: item.transaction_date } })} /><SmallAction danger title="Delete" onPress={() => Alert.alert('Delete transaction?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => wrapped(() => deleteTransaction(user.id, item.id)) }])} /></>} />) : <EmptyState title="No transactions found" body="Add income or an expense to start tracking." />}</View>{loadedCount < data.transactionCount ? <PrimaryButton title={more ? 'Loading…' : 'Load more transactions'} onPress={loadMore} disabled={more} /> : null}</>;
}

function BudgetsPage({ data, profile, setForm, wrapped, user, selectedMonth, setSelectedMonth }) {
  const currency = profile.currency || 'GHS';
  return <><MonthChooser month={selectedMonth} onChange={setSelectedMonth} /><View style={styles.actionLine}><Text style={styles.mutedSmall}>Monthly expense limits</Text><PrimaryButton compact title="＋ Budget" onPress={() => setForm({ kind: 'budget', initial: { budgetMonth: selectedMonth, amount: '' } })} /></View><View style={styles.card}>{data.budgets.length ? data.budgets.map((item) => { const spent = data.spent[item.category_id] || 0; const ratio = spent / Number(item.amount); return <View key={item.id} style={styles.budgetItem}><View style={styles.rowBetween}><View><Text style={styles.rowTitle}>{item.category?.name || 'Category'}</Text><Text style={styles.rowMeta}>{money(spent, currency)} spent of {money(item.amount, currency)}</Text></View><View style={styles.inlineActions}><SmallAction title="Edit" onPress={() => setForm({ kind: 'budget', record: item, initial: { budgetMonth: item.budget_month.slice(0, 7), amount: String(item.amount), categoryId: item.category_id } })} /><SmallAction danger title="Delete" onPress={() => Alert.alert('Delete budget?', 'Your transactions will remain unchanged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => wrapped(() => deleteBudget(user.id, item.id)) }])} /></View></View><Progress value={ratio} danger={ratio > 1} /><Text style={[styles.budgetStatus, ratio > 1 && styles.negative]}>{ratio > 1 ? `${money(spent - item.amount, currency)} over budget` : `${money(item.amount - spent, currency)} remaining`}</Text></View>; }) : <EmptyState title="No budgets for this month" body="Set a spending limit to keep your plans on track." />}</View></>;
}

function InsightsPage({ data, profile, selectedMonth, setSelectedMonth }) {
  const currency = profile.currency || 'GHS'; const max = Math.max(...data.trend.map((x) => Math.max(x.income, x.expenses)), 1);
  return <><MonthChooser month={selectedMonth} onChange={setSelectedMonth} /><View style={styles.metricGrid}><Metric label="ALL-TIME INCOME" value={money(data.totals.totalIncome, currency)} tint="green" /><Metric label="ALL-TIME SPENDING" value={money(data.totals.totalExpenses, currency)} tint="rose" /></View><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Six month cash flow</Text></View><View style={styles.card}><View style={styles.legend}><Text style={styles.legendIncome}>● Income</Text><Text style={styles.legendExpense}>● Expenses</Text></View><View style={styles.chart}>{data.trend.map((row) => <View key={row.month} style={styles.chartColumn}><View style={styles.barPair}><View style={[styles.bar, styles.barIncome, { height: Math.max(5, (row.income / max) * 116) }]} /><View style={[styles.bar, styles.barExpense, { height: Math.max(5, (row.expenses / max) * 116) }]} /></View><Text style={styles.chartLabel}>{new Date(`${row.month}T12:00:00Z`).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' })}</Text></View>)}</View></View><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Largest expenses in {monthLabel(selectedMonth)}</Text></View><View style={styles.card}>{data.biggest.length ? data.biggest.map((item) => <View key={item.id} style={styles.rankRow}><View style={styles.rankDot}><Text style={styles.rankText}>{item.category?.slice(0, 1)?.toUpperCase() || '•'}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.description || item.category}</Text><Text style={styles.rowMeta}>{item.category} · {humanDate(item.date)}</Text></View><Text style={[styles.amount, styles.negative]}>{money(item.amount, currency)}</Text></View>) : <EmptyState title="No expenses this month" body="Expenses will appear here as you record them." />}</View></>;
}

function MonthChooser({ month, onChange }) { return <View style={styles.monthChooser}><Pressable onPress={() => onChange(shiftMonth(month, -1))} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable><Text style={styles.monthText}>{monthLabel(month)}</Text><Pressable onPress={() => onChange(shiftMonth(month, 1))} style={styles.monthArrow}><Text style={styles.monthArrowText}>›</Text></Pressable></View>; }

function CategoriesPage({ data, setForm, wrapped, user }) {
  return <><View style={styles.actionLine}><Text style={styles.mutedSmall}>{data.categories.length} personal categories</Text><PrimaryButton compact title="＋ Category" onPress={() => setForm({ kind: 'category', initial: { type: 'expense', name: '' } })} /></View>{['expense', 'income'].map((type) => <View key={type}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{type === 'expense' ? 'Expenses' : 'Income'}</Text></View><View style={styles.card}>{data.categories.filter((x) => x.type === type).map((item) => <View key={item.id} style={styles.rowBetween}><Text style={styles.rowTitle}>{item.name}</Text><View style={styles.inlineActions}><SmallAction title="Edit" onPress={() => setForm({ kind: 'category', record: item, initial: { name: item.name, type: item.type } })} /><SmallAction danger title="Delete" onPress={() => Alert.alert('Delete category?', 'Categories used by transactions or budgets cannot be deleted.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => wrapped(() => deleteCategory(user.id, item.id)) }])} /></View></View>)}</View></View>)}</>;
}

function SettingsPage({ profile, setProfile, wrapped, user, signOut }) {
  const [name, setName] = useState(profile.full_name); const [currency, setCurrency] = useState(profile.currency || 'GHS');
  useEffect(() => { setName(profile.full_name); setCurrency(profile.currency || 'GHS'); }, [profile]);
  return <><View style={styles.card}><Text style={styles.sectionTitle}>Personal details</Text><Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" /><Text style={styles.fieldLabel}>DISPLAY CURRENCY</Text><View style={styles.currencyChoices}>{['GHS', 'USD', 'EUR', 'GBP'].map((c) => <Pressable key={c} onPress={() => setCurrency(c)} style={[styles.currencyChoice, currency === c && styles.currencySelected]}><Text style={[styles.currencyText, currency === c && styles.currencyTextSelected]}>{c}</Text></Pressable>)}</View><PrimaryButton title="Save profile" onPress={() => wrapped(async () => { const data = await updateProfile(user.id, { fullName: name, currency }); setProfile(data); })} /></View><View style={[styles.card, styles.accountCard]}><Text style={styles.sectionTitle}>Account</Text><Text style={styles.rowMeta}>{user.email}</Text><Pressable style={styles.signOutButton} onPress={signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable></View></>;
}

function MorePage({ onNavigate, onSignOut, email }) { return <View style={styles.card}>{[['Categories', 'Manage income and expense labels', '◈'], ['Settings', 'Profile, currency and account', '⚙']].map(([title, hint, icon]) => <Pressable key={title} style={styles.moreItem} onPress={() => onNavigate(title)}><View style={styles.moreIcon}><Text style={styles.moreIconText}>{icon}</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{hint}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}<View style={styles.moreEmail}><Text style={styles.rowMeta}>Signed in as</Text><Text style={styles.rowTitle}>{email}</Text></View><Pressable style={styles.signOutButton} onPress={onSignOut}><Text style={styles.signOutText}>Sign out</Text></Pressable></View>; }

function FinanceModal({ visible, form, setForm, data, currency, onSave }) {
  const [values, setValues] = useState({}); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  useEffect(() => { setValues(form?.initial || {}); setFormError(''); }, [form]);
  if (!form) return null;
  const patch = (key, value) => setValues((old) => ({ ...old, [key]: value }));
  const kind = form.kind; const title = `${form.record ? 'Edit' : 'Add'} ${kind === 'transaction' ? 'transaction' : kind}`;
  const categories = data.categories.filter((x) => kind === 'budget' ? x.type === 'expense' : x.type === (values.type || 'expense'));
  const save = async () => { setSaving(true); setFormError(''); try { const result = await onSave(values); if (result?.ok === false) setFormError(result.error); } catch (e) { setFormError(friendlyError(e)); } finally { setSaving(false); } };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setForm(null)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalShade}><Pressable style={styles.modalBackdrop} onPress={() => setForm(null)} /><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.rowBetween}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={() => setForm(null)}><Text style={styles.modalClose}>×</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 22 }}>
    {kind === 'transaction' && <><Text style={styles.fieldLabel}>TYPE</Text><View style={styles.segment}>{['expense', 'income'].map((type) => <Pressable key={type} onPress={() => { patch('type', type); patch('categoryId', ''); }} style={[styles.segmentButton, values.type === type && styles.segmentActive]}><Text style={[styles.segmentText, values.type === type && styles.segmentTextActive]}>{type === 'expense' ? 'Expense' : 'Income'}</Text></Pressable>)}</View><Field label="Amount" value={values.amount || ''} onChangeText={(v) => patch('amount', v)} placeholder="0.00" keyboardType="decimal-pad"/><Field label="Description" value={values.description || ''} onChangeText={(v) => patch('description', v)} placeholder="What was it for?"/><Field label="Date (YYYY-MM-DD)" value={values.transactionDate || today()} onChangeText={(v) => patch('transactionDate', v)} placeholder={today()} />{categoryPicker(categories, values.categoryId, (v) => patch('categoryId', v))}</>}
    {kind === 'budget' && <><Field label="Monthly amount" value={values.amount || ''} onChangeText={(v) => patch('amount', v)} placeholder="0.00" keyboardType="decimal-pad"/><Field label="Month (YYYY-MM)" value={values.budgetMonth || monthNow()} onChangeText={(v) => patch('budgetMonth', v)} placeholder={monthNow()} />{categoryPicker(categories, values.categoryId, (v) => patch('categoryId', v))}</>}
    {kind === 'category' && <><Field label="Category name" value={values.name || ''} onChangeText={(v) => patch('name', v)} placeholder="e.g. Groceries"/><Text style={styles.fieldLabel}>CATEGORY TYPE</Text><View style={styles.segment}>{['expense', 'income'].map((type) => <Pressable key={type} onPress={() => patch('type', type)} style={[styles.segmentButton, values.type === type && styles.segmentActive]}><Text style={[styles.segmentText, values.type === type && styles.segmentTextActive]}>{type === 'expense' ? 'Expense' : 'Income'}</Text></Pressable>)}</View></>}
    {categories.length === 0 && kind !== 'category' ? <Notice text="Create a matching category first in More → Categories." /> : null}
    {formError ? <Notice text={formError} /> : null}<PrimaryButton title={saving ? 'Saving…' : `Save ${kind}`} disabled={saving} onPress={save}/>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}

function categoryPicker(categories, selected, onSelect) { return <View style={{ marginBottom: 16 }}><Text style={styles.fieldLabel}>CATEGORY</Text><View style={styles.choiceWrap}>{categories.map((item) => <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.choiceChip, selected === item.id && styles.choiceSelected]}><Text style={[styles.choiceText, selected === item.id && styles.choiceTextSelected]}>{item.name}</Text></Pressable>)}</View></View>; }
function Field({ label, ...props }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label.toUpperCase()}</Text><TextInput accessibilityLabel={label} selectionColor={C.green} placeholderTextColor="#a2aea7" style={styles.input} {...props} /></View>; }
function PrimaryButton({ title, onPress, disabled, compact }) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, compact && styles.primaryCompact, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}><Text style={[styles.primaryText, compact && styles.primaryCompactText]}>{title}</Text></Pressable>; }
function Notice({ text, success, onClose }) { return <View accessibilityRole="alert" style={[styles.notice, success && styles.noticeSuccess]}><Text style={[styles.noticeText, success && styles.noticeSuccessText]}>{text}</Text>{onClose ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onClose}><Text style={styles.noticeClose}>×</Text></Pressable> : null}</View>; }
function EmptyState({ title, body }) { return <View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>↗</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>; }
function TransactionRow({ item, currency, actions }) { const income = item.type === 'income'; const amount = Number(item.amount) || 0; return <View style={styles.transactionRow}><View style={[styles.txIcon, income && styles.txIconIncome]}><Text style={[styles.txIconText, income && styles.txIconTextIncome]}>{income ? '↗' : '↙'}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.rowTitle}>{item.description?.trim() || item.category?.name || 'Transaction'}</Text><Text style={styles.rowMeta}>{item.category?.name || 'Uncategorized'} · {humanDate(item.transaction_date)}</Text></View><View style={styles.txAmountWrap}><Text style={[styles.amount, income ? styles.positive : styles.negative]}>{income ? '+' : '−'}{money(amount, currency)}</Text>{actions ? <View style={styles.inlineActions}>{actions}</View> : null}</View></View>; }
function SmallAction({ title, onPress, danger }) { return <Pressable onPress={onPress} style={styles.smallAction}><Text style={[styles.smallActionText, danger && styles.dangerText]}>{title}</Text></Pressable>; }
function Progress({ value, danger }) { return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(value, 1)) * 100}%` }, danger && styles.progressDanger]} /></View>; }
function Metric({ label, value, tint }) { return <View style={styles.metricCard}><View style={[styles.metricDot, tint === 'rose' && styles.metricDotRose]} /><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} style={styles.metricValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, page: { flex: 1 }, pageContent: { paddingHorizontal: 20, paddingBottom: 30 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, backgroundColor: C.paper }, brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, brandGlyph: { color: 'white', fontSize: 22, fontWeight: '800' }, brandName: { color: C.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }, brandCaption: { fontSize: 8, color: C.muted, letterSpacing: 1.4, marginTop: 2, fontWeight: '700' }, avatar: { width: 37, height: 37, borderRadius: 20, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.green, fontWeight: '800', fontSize: 15 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 18 }, eyebrow: { color: C.green2, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 6 }, heading: { color: C.ink, fontWeight: '800', fontSize: 27, letterSpacing: -0.7 }, refresh: { width: 38, height: 38, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }, refreshText: { fontSize: 25, color: C.green, lineHeight: 28 },
  heroCard: { position: 'relative', overflow: 'hidden', backgroundColor: C.navy, borderRadius: 22, padding: 22, marginBottom: 25 }, heroOrb: { position: 'absolute', width: 160, height: 160, borderRadius: 90, right: -50, top: -65, backgroundColor: '#31594c', opacity: 0.38 }, heroLabel: { color: '#bed0c7', fontSize: 9, letterSpacing: 1.3, fontWeight: '800' }, heroAmount: { color: C.white, fontSize: 34, fontWeight: '800', letterSpacing: -1.2, marginTop: 10, marginBottom: 25 }, heroStats: { flexDirection: 'row', alignItems: 'center' }, heroStatLabel: { color: '#a8bdb3', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 7 }, heroStatValue: { color: C.white, fontSize: 15, fontWeight: '700' }, heroDivider: { height: 31, width: 1, backgroundColor: '#5c7169', marginHorizontal: 26 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 }, sectionTitle: { color: C.ink, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }, link: { color: C.green, fontSize: 12, fontWeight: '800' }, quickRow: { flexDirection: 'row', gap: 11, marginBottom: 21 }, quickCard: { flex: 1, borderRadius: 17, padding: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, quickIcon: { fontSize: 22, fontWeight: '700', color: C.green, marginBottom: 10 }, quickIconIncome: { color: '#497ab0' }, quickLabel: { fontSize: 12, color: C.ink, fontWeight: '700' }, card: { backgroundColor: C.white, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 8, borderColor: C.line, borderWidth: 1, marginBottom: 18 },
  transactionRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomColor: C.line, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 }, txIcon: { width: 35, height: 35, borderRadius: 13, backgroundColor: '#fff0eb', alignItems: 'center', justifyContent: 'center' }, txIconIncome: { backgroundColor: '#e8f2fb' }, txIconText: { color: '#cb6f4d', fontWeight: '800', fontSize: 17 }, txIconTextIncome: { color: '#5287bd' }, rowTitle: { fontSize: 12, color: C.ink, fontWeight: '700' }, rowMeta: { fontSize: 10, color: C.muted, marginTop: 4 }, amount: { fontWeight: '800', fontSize: 11, textAlign: 'right' }, positive: { color: C.green }, negative: { color: C.red }, txAmountWrap: { alignItems: 'flex-end', gap: 5 },
  budgetPreview: { paddingVertical: 11 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressTrack: { height: 6, backgroundColor: '#e9eeea', borderRadius: 10, marginTop: 10, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 10, backgroundColor: C.green2 }, progressDanger: { backgroundColor: C.red }, mutedSmall: { color: C.muted, fontSize: 11 }, rowMetaSmall: { color: C.muted, fontSize: 10 },
  tabbar: { flexDirection: 'row', backgroundColor: C.white, borderTopColor: C.line, borderTopWidth: 1, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 5 : 10 }, tabItem: { flex: 1, alignItems: 'center', gap: 3 }, tabIcon: { fontSize: 19, color: '#9da9a2', fontWeight: '700' }, tabSelected: { color: C.green }, tabLabel: { color: '#849189', fontSize: 9, fontWeight: '600' }, tabLabelSelected: { color: C.green, fontWeight: '800' }, backbar: { paddingHorizontal: 20, paddingVertical: 13, backgroundColor: C.white, borderTopColor: C.line, borderTopWidth: 1 }, backButton: { alignSelf: 'flex-start' }, backText: { color: C.green, fontWeight: '700', fontSize: 13 },
  center: { flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }, muted: { fontSize: 12, color: C.muted }, mutedCenter: { color: C.muted, fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 310 },
  authWrap: { flex: 1 }, authContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 23, paddingTop: 36 }, brandMarkLarge: { width: 54, height: 54, borderRadius: 19, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 11 }, brandGlyphLarge: { fontSize: 31, color: C.white, fontWeight: '900' }, logoBig: { fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: -0.7 }, authSub: { color: C.muted, fontSize: 12, marginTop: 6, marginBottom: 26 }, authCard: { width: '100%', maxWidth: 450, backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 21 }, authTitle: { fontSize: 19, color: C.ink, fontWeight: '800', marginBottom: 17, letterSpacing: -0.4 }, secureNote: { color: C.muted, fontSize: 10, marginTop: 18, textAlign: 'center', maxWidth: 280 },
  field: { marginBottom: 15 }, fieldLabel: { fontSize: 9, color: C.muted, fontWeight: '800', letterSpacing: 0.8, marginBottom: 7 }, input: { height: 47, borderRadius: 12, borderColor: C.line, borderWidth: 1, backgroundColor: '#fcfdfb', paddingHorizontal: 13, color: C.ink, fontSize: 13 }, primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: C.green, marginTop: 5 }, primaryText: { color: C.white, fontSize: 13, fontWeight: '800' }, primaryCompact: { minHeight: 35, paddingHorizontal: 14, borderRadius: 10, marginTop: 0 }, primaryCompactText: { fontSize: 11 }, buttonDisabled: { opacity: 0.5 }, buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] }, linkButton: { paddingVertical: 13, alignItems: 'center' }, switchMode: { alignItems: 'center', marginTop: 5, paddingVertical: 7 },
  notice: { flexDirection: 'row', padding: 11, backgroundColor: '#fff1ef', borderRadius: 11, marginBottom: 13, alignItems: 'center' }, noticeText: { flex: 1, color: '#9f3f39', fontSize: 11, lineHeight: 16 }, noticeSuccess: { backgroundColor: '#eaf6ee' }, noticeSuccessText: { color: C.green }, noticeClose: { color: C.muted, fontSize: 20, marginLeft: 10 },
  actionLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, filters: { flexDirection: 'row', gap: 7, marginBottom: 14 }, filterPill: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 20 }, filterActive: { backgroundColor: C.pale, borderColor: '#d1e6d8' }, filterText: { fontSize: 10, fontWeight: '700', color: C.muted }, filterTextActive: { color: C.green }, inlineActions: { flexDirection: 'row', gap: 5 }, smallAction: { paddingHorizontal: 7, paddingVertical: 5, backgroundColor: '#f3f6f3', borderRadius: 7 }, smallActionText: { color: C.green, fontSize: 9, fontWeight: '800' }, dangerText: { color: C.red },
  monthChooser: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'flex-start', minWidth: 188, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 7, paddingVertical: 4, marginBottom: 15 }, monthArrow: { width: 31, height: 30, alignItems: 'center', justifyContent: 'center' }, monthArrowText: { color: C.green, fontSize: 24, lineHeight: 27, fontWeight: '500' }, monthText: { color: C.ink, fontSize: 11, fontWeight: '800' },
  budgetItem: { paddingVertical: 15, borderBottomColor: C.line, borderBottomWidth: StyleSheet.hairlineWidth }, budgetStatus: { fontSize: 10, color: C.green, marginTop: 7 }, metricGrid: { flexDirection: 'row', gap: 10 }, metricCard: { flex: 1, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 }, metricDot: { width: 7, height: 7, backgroundColor: C.green2, borderRadius: 5, marginBottom: 10 }, metricDotRose: { backgroundColor: '#d36c62' }, metricLabel: { fontSize: 8, color: C.muted, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 }, metricValue: { fontSize: 14, color: C.ink, fontWeight: '800' }, legend: { flexDirection: 'row', gap: 14, marginVertical: 10 }, legendIncome: { fontSize: 10, color: C.green, fontWeight: '700' }, legendExpense: { fontSize: 10, color: '#d17b62', fontWeight: '700' }, chart: { height: 154, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingTop: 10 }, chartColumn: { flex: 1, alignItems: 'center' }, barPair: { height: 122, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }, bar: { width: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4 }, barIncome: { backgroundColor: C.green2 }, barExpense: { backgroundColor: '#e8a28b' }, chartLabel: { color: C.muted, fontSize: 9, marginTop: 8 }, rankRow: { minHeight: 65, flexDirection: 'row', gap: 10, alignItems: 'center', borderBottomColor: C.line, borderBottomWidth: StyleSheet.hairlineWidth }, rankDot: { width: 31, height: 31, borderRadius: 11, backgroundColor: C.pale, justifyContent: 'center', alignItems: 'center' }, rankText: { color: C.green, fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 12 }, emptyIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, emptyIconText: { color: C.green, fontSize: 20 }, emptyTitle: { color: C.ink, fontWeight: '800', fontSize: 12 }, emptyBody: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 5, lineHeight: 16, maxWidth: 240 },
  moreItem: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 66, borderBottomColor: C.line, borderBottomWidth: StyleSheet.hairlineWidth }, moreIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' }, moreIconText: { color: C.green, fontSize: 17, fontWeight: '800' }, chevron: { color: '#9aa59e', fontSize: 23 }, moreEmail: { paddingTop: 18, paddingBottom: 9 }, signOutButton: { alignItems: 'center', borderColor: '#f0d2d0', borderWidth: 1, borderRadius: 11, paddingVertical: 12, marginTop: 10, marginBottom: 10 }, signOutText: { color: C.red, fontWeight: '800', fontSize: 12 },
  currencyChoices: { flexDirection: 'row', gap: 7, marginBottom: 17 }, currencyChoice: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }, currencySelected: { borderColor: C.green, backgroundColor: C.pale }, currencyText: { color: C.muted, fontWeight: '700', fontSize: 11 }, currencyTextSelected: { color: C.green }, accountCard: { marginTop: 2 },
  modalShade: { flex: 1, justifyContent: 'flex-end' }, modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,28,22,0.38)' }, modalSheet: { maxHeight: '90%', borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: C.paper, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 24 }, modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 4, backgroundColor: '#cbd5ce', marginBottom: 15 }, modalTitle: { color: C.ink, fontSize: 18, fontWeight: '800', marginBottom: 15 }, modalClose: { color: C.muted, fontSize: 27, marginTop: -12 }, segment: { flexDirection: 'row', backgroundColor: '#e9eee9', borderRadius: 11, padding: 3, marginBottom: 15 }, segmentButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 }, segmentActive: { backgroundColor: C.white }, segmentText: { color: C.muted, fontSize: 11, fontWeight: '700' }, segmentTextActive: { color: C.green }, choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choiceChip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }, choiceSelected: { backgroundColor: C.pale, borderColor: C.green }, choiceText: { color: C.muted, fontSize: 10, fontWeight: '700' }, choiceTextSelected: { color: C.green },
});
