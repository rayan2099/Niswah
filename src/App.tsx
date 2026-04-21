/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { Onboarding } from './components/Onboarding.tsx';
import * as api from './api/index.ts';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Calendar as CalendarIcon, 
  BarChart2, 
  User as UserIcon,
  Sparkles,
  Users,
  AlertTriangle
} from 'lucide-react';
import { State, Madhhab } from './logic/types.ts';
import * as logic from './logic/index.ts';

import { LanguageProvider, useTranslation } from './i18n/LanguageContext.tsx';
import { CycleProvider, useCycleData } from './contexts/CycleContext.tsx';

import { HapticService } from './services/HapticService.ts';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
          <h1 className="text-2xl font-serif font-bold text-rose-900 mb-2">Something went wrong</h1>
          <p className="text-rose-700 mb-6 max-w-md">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-rose-600 text-white rounded-full font-bold shadow-lg shadow-rose-200"
          >
            Refresh App
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-black/5 rounded text-left text-xs overflow-auto max-w-full">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load tab components
const Today = lazy(() => import('./components/Today.tsx').then(m => ({ default: m.Today })));
const Calendar = lazy(() => import('./components/Calendar.tsx').then(m => ({ default: m.Calendar })));
const Discover = lazy(() => import('./components/Discover.tsx').then(m => ({ default: m.Discover })));
const Profile = lazy(() => import('./components/Profile.tsx').then(m => ({ default: m.Profile })));
const Insights = lazy(() => import('./components/Insights.tsx').then(m => ({ default: m.Insights })));
const NiswahAI = lazy(() => import('./components/NiswahAI.tsx').then(m => ({ default: m.NiswahAI })));
const DreamInterpreter = lazy(() => import('./components/DreamInterpreter.tsx').then(m => ({ default: m.DreamInterpreter })));
const Community = lazy(() => import('./components/Community.tsx').then(m => ({ default: m.Community })));

type Tab = 'today' | 'calendar' | 'insights' | 'discover' | 'community' | 'profile';

const LoadingSpinner = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-12">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full"
      />
    </div>
  );
};

const BackendStatus = () => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/v8-ping');
        if (res.ok) setStatus('online');
        else setStatus('offline');
      } catch (e) {
        setStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-gray-100 shadow-sm text-[10px] font-medium">
      <div className={`w-1.5 h-1.5 rounded-full ${
        status === 'online' ? 'bg-green-500 animate-pulse' : 
        status === 'offline' ? 'bg-red-500' : 'bg-amber-500'
      }`} />
      <span className="text-gray-500">v8.0 {status}</span>
    </div>
  );
};

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { AuthScreen } from './components/Auth';
import { notificationService } from './services/NotificationService.ts';

import { PWAInstallBanner } from './components/PWAInstallBanner';

function AppContent() {
  const { fiqhState, currentDay: cycleDay, user, refresh } = useCycleData();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isDreamInterpreterOpen, setIsDreamInterpreterOpen] = useState(false);
  const { t, isRTL } = useTranslation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("App Auth State Changed:", user?.uid);
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        refresh();
      }
    });

    // Timeout fallback for authLoading to prevent permanent hanging
    const timeout = setTimeout(() => {
      if (authLoading) {
        console.warn("App: Auth state check timed out, forcing loading to false");
        setAuthLoading(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [refresh, authLoading]);

  useEffect(() => {
    if (user && user.madhhab) {
      setShowOnboarding(false);
    }
  }, [user]);

  useEffect(() => {
    (window as any).openDreamInterpreter = () => setIsDreamInterpreterOpen(true);
    return () => {
      delete (window as any).openDreamInterpreter;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const tab = params.get('tab') as Tab | null;
    if (action === 'start-haid') {
      setActiveTab('today');
      setTimeout(() => { (window as any).__niswah_open_log = true; }, 600);
    }
    if (tab && ['today','calendar','insights','community','profile'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-[#FDFCFB] flex flex-col items-center justify-center gap-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-32 h-32 rounded-[40px] bg-white border border-rose-100 flex items-center justify-center overflow-hidden shadow-sm"
        >
          <img src="/logo.svg" alt="Niswah Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </motion.div>
        
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen onSuccess={async () => {
      console.log("App: Auth Success Callback triggered");
      await refresh();
    }} />;
  }

  if (showOnboarding) {
    return <Onboarding onFinish={async () => {
      await refresh();
      setShowOnboarding(false);
    }} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'today':
        return (
          <Today 
            onOpenAI={() => setIsAIChatOpen(true)} 
            onOpenDreamInterpreter={() => setIsDreamInterpreterOpen(true)}
            onOpenSettings={() => setActiveTab('profile')}
          />
        );
      case 'calendar':
        return <Calendar />;
      case 'insights':
        return <Insights onNavigateToToday={() => setActiveTab('today')} />;
      case 'community':
        return <Community />;
      case 'profile':
        return (
          <Profile />
        );
      default:
        return (
          <Today 
            onOpenAI={() => setIsAIChatOpen(true)} 
            onOpenDreamInterpreter={() => setIsDreamInterpreterOpen(true)}
            onOpenSettings={() => setActiveTab('profile')}
          />
        );
    }
  };

  return (
    <div className="relative min-h-screen bg-[#FDFCFB]">
      {/* Backend Status Diagnostic */}
      <div className="fixed bottom-2 left-2 z-[999] opacity-20 hover:opacity-100 transition-opacity">
        <BackendStatus />
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.3 }}
        >
          <Suspense fallback={<LoadingSpinner />}>
            {renderTab()}
          </Suspense>
        </motion.div>
      </AnimatePresence>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-black/5 px-6 pt-3 pb-8 flex items-center justify-between z-[100]">
        <TabButton 
          active={activeTab === 'today'} 
          onClick={() => setActiveTab('today')} 
          icon={Home} 
          label={t('today')} 
        />
        <TabButton 
          active={activeTab === 'calendar'} 
          onClick={() => setActiveTab('calendar')} 
          icon={CalendarIcon} 
          label={t('calendar')} 
        />
        <TabButton 
          active={activeTab === 'insights'} 
          onClick={() => setActiveTab('insights')} 
          icon={BarChart2} 
          label={t('insights')} 
        />
        
        {/* Floating AI Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsAIChatOpen(true)}
          className="w-14 h-14 bg-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-200 -mt-10 border-4 border-[#FDFCFB] relative overflow-hidden group"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
            className="absolute inset-0 bg-gradient-to-tr from-rose-400 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity"
          />
          <Sparkles className="w-6 h-6 text-white relative z-10" />
        </motion.button>

        <TabButton 
          active={activeTab === 'community'} 
          onClick={() => setActiveTab('community')} 
          icon={Users} 
          label={t('community')} 
        />
        <TabButton 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
          icon={UserIcon} 
          label={t('profile')} 
        />
      </nav>

      {/* Niswah AI Chat Interface */}
      <Suspense fallback={null}>
        <NiswahAI 
          isOpen={isAIChatOpen} 
          onClose={() => setIsAIChatOpen(false)} 
          userContext={{
            madhhab: user?.madhhab || 'HANAFI',
            fiqh_state: fiqhState,
            cycle_day: cycleDay,
            conditions: user?.conditions || [],
            ramadan_active: false,
            pregnant: user?.pregnant || false
          }}
        />
      </Suspense>

      {/* Dream Interpreter */}
      <Suspense fallback={null}>
        <DreamInterpreter 
          isOpen={isDreamInterpreterOpen} 
          onClose={() => setIsDreamInterpreterOpen(false)} 
          userMadhhab={user?.madhhab || 'HANAFI'}
        />
      </Suspense>

      <PWAInstallBanner />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <CycleProvider>
          <AppContent />
        </CycleProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={() => {
        HapticService.light();
        onClick();
      }}
      className="flex flex-col items-center space-y-1 relative"
    >
      <Icon className={`w-6 h-6 transition-colors duration-300 ${active ? 'text-rose-600' : 'text-rose-900/30'}`} />
      <span className={`text-[8px] font-bold uppercase tracking-widest transition-colors duration-300 ${active ? 'text-rose-600' : 'text-rose-900/30'}`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="tab-dot"
          className="absolute -bottom-2 w-1 h-1 bg-rose-600 rounded-full"
        />
      )}
    </button>
  );
}

