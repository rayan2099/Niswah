/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Info, 
  Lock, 
  Bell, 
  Star, 
  Calendar as CalendarIcon,
  Globe,
  BookOpen,
  Target,
  Activity,
  ShieldCheck,
  Zap,
  Sparkles,
  Search,
  MapPin,
  CheckCircle2,
  X,
  Navigation,
  Heart,
  Baby,
  Droplets,
  Moon,
  EyeOff,
  Trash2
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import * as api from '../api/index.ts';
import { DBUser } from '../api/db-types.ts';
import { Madhhab } from '../logic/types.ts';
import { popularCities } from '../logic/constants.ts';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { cn } from '../utils/cn.ts';

// --- TYPES ---

type Language = 'ar' | 'en';

interface OnboardingData {
  language: Language;
  madhhab: Madhhab | null;
  birth_year: number;
  goal_flags: string[];
  last_period_date: string | null;
  avg_cycle_length: number;
  avg_haid_duration: number;
  conditions: string[];
  privacy_setup: {
    method: 'biometric' | 'pin' | 'skip';
    anonymous_mode: boolean;
  };
  notification_prefs: Record<string, boolean>;
  location: {
    city: string;
    country: string;
    cityAr: string;
    countryAr: string;
    lat?: number;
    lon?: number;
  };
}

const CURRENT_YEAR = new Date().getFullYear();

const INITIAL_DATA: OnboardingData = {
  language: 'en',
  madhhab: null,
  birth_year: CURRENT_YEAR - 28,
  goal_flags: [],
  last_period_date: null,
  avg_cycle_length: 28,
  avg_haid_duration: 5,
  conditions: [],
  privacy_setup: {
    method: 'skip',
    anonymous_mode: false,
  },
  notification_prefs: {
    prayer_updates: true,
    period_prediction: true,
    ovulation_alert: true,
    ghusl_reminder: true,
    daily_insights: true,
    ramadan_qadha: true,
  },
  location: {
    city: '',
    country: '',
    cityAr: '',
    countryAr: '',
    lat: 0,
    lon: 0,
  },
};

// --- COMPONENTS ---

const NiswahToggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    role="switch"
    aria-checked={value}
    dir="ltr"
    onClick={() => onChange(!value)}
    className={`relative h-8 w-[52px] flex-shrink-0 rounded-full border border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 ${
      value ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
    }`}
  >
    <span className={`pointer-events-none absolute left-[2px] top-[2px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_7px_rgba(15,23,42,0.28)] ring-1 ring-black/5 transition-transform duration-200 ease-out ${
      value ? 'translate-x-[20px]' : 'translate-x-0'
    }`} />
  </button>
);

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const progress = Math.max(0, Math.min(100, (current / total) * 100));
  return (
    <div className="fixed left-0 right-0 top-0 z-40 px-5 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-md rounded-full border border-white/80 bg-white/85 p-2 shadow-sm shadow-rose-950/5 backdrop-blur">
        <div className="h-2 overflow-hidden rounded-full bg-rose-50">
          <motion.div
            initial={false}
            animate={{ width: `${progress}%` }}
            className="h-full rounded-full bg-gradient-to-l from-rose-500 via-pink-400 to-emerald-500"
          />
        </div>
      </div>
    </div>
  );
};

// --- SCREENS ---

const Screen1Splash = ({ onNext }: { onNext: () => void }) => {
  const { t, isRTL } = useTranslation();

  return (
    <div className="flex min-h-full flex-col items-center justify-center space-y-8 text-center">
      <div className="flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-36 h-36 rounded-[38px] bg-white border border-rose-100 flex items-center justify-center overflow-hidden shadow-xl shadow-rose-950/5"
        >
          <img src="/logo.svg" alt="Niswah Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-7 space-y-3"
        >
          <h1 className="text-4xl font-serif font-black text-rose-900">
            {isRTL ? 'ابدئي بثقة' : 'Begin with clarity'}
          </h1>
          <p className="mx-auto max-w-xs text-sm leading-7 text-gray-500">
            {isRTL
              ? 'تتبّع صحي وفقهي للحمل والدورة والنفاس، بخصوصية تناسبك من أول يوم.'
              : 'A private health and fiqh companion for cycle, pregnancy, and postpartum care.'}
          </p>
        </motion.div>
      </div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        onClick={onNext}
        className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors"
      >
        {t('get_started')}
      </motion.button>
    </div>
  );
};

const Screen2Language = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, setLanguage, isRTL } = useTranslation();
  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'ar', label: t('arabic'), native: 'العربية' },
    { code: 'en', label: t('english'), native: 'English' },
  ];

  const handleSelect = (code: Language) => {
    update({ language: code });
    setLanguage(code);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2 leading-tight">
          {t('choose_language')}
        </h1>
        <p className="text-sm text-gray-400 text-center mb-8 leading-relaxed">
          {t('language_desc')}
        </p>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {languages.map((lang) => (
            <motion.button
              key={lang.code}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(lang.code)}
              className={cn(
                "p-5 rounded-3xl border transition-all flex items-center justify-between relative",
                data.language === lang.code 
                  ? "border-rose-200 bg-rose-50 text-rose-800 shadow-sm" 
                  : "border-black/5 bg-white text-gray-500 hover:border-rose-100"
              )}
            >
              <div className={cn("flex flex-col", isRTL ? "text-right" : "text-left")}>
                <span className="text-lg font-bold">{lang.native}</span>
                <span className="text-xs opacity-60">{lang.label}</span>
              </div>
              {data.language === lang.code && (
                <motion.div layoutId="lang-check" className="grid h-8 w-8 place-items-center rounded-full bg-white text-rose-500 shadow-sm">
                  <Check className="w-4 h-4" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
      
      <button 
        onClick={onNext}
        className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex items-center justify-center"
      >
        <span>{t('continue')}</span>
        <ChevronRight className="mr-2 w-5 h-5 rtl:rotate-180" />
      </button>
    </div>
  );
};

const Screen3Madhhab = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  const [showInfo, setShowInfo] = useState(false);
  const madhhabs: { id: Madhhab; label: string; rule: string }[] = [
    { id: 'HANAFI', label: t('hanafi'), rule: t('hanafi_rule_onboarding') },
    { id: 'MALIKI', label: t('maliki'), rule: t('maliki_rule_onboarding') },
    { id: 'SHAFII', label: t('shafii'), rule: t('shafii_rule_onboarding') },
    { id: 'HANBALI', label: t('hanbali'), rule: t('hanbali_rule_onboarding') },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <div className={cn("mb-6", isRTL ? "text-right" : "text-left")}>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">{t('madhhab_question')}</h1>
          <p className="mt-2 text-sm text-gray-400 leading-6">{t('madhhab_desc')}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {madhhabs.map((m) => (
            <motion.button
              key={m.id}
              whileTap={{ scale: 1.04 }}
              onClick={() => update({ madhhab: m.id })}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-28",
                isRTL ? "text-right" : "text-left",
                data.madhhab === m.id 
                  ? "border-rose-300 bg-rose-50 shadow-sm" 
                  : "border-black/5 bg-white hover:border-rose-100"
              )}
            >
              <span className={cn("text-lg font-bold", data.madhhab === m.id ? "text-rose-800" : "text-gray-700")}>{m.label}</span>
              <span className="text-[11px] leading-5 text-gray-400 font-semibold">{m.rule}</span>
            </motion.button>
          ))}
        </div>

        <button 
          onClick={() => setShowInfo(true)}
          className="w-full flex items-center justify-center text-rose-400 text-sm font-medium hover:underline mt-6"
        >
          <Info className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} /> {t('not_sure_madhhab')}
        </button>
      </div>

      <button 
        disabled={!data.madhhab}
        onClick={onNext}
        className={cn(
          "w-full py-4 rounded-2xl font-bold text-lg active:scale-95 transition-transform flex items-center justify-center",
          data.madhhab 
            ? "bg-rose-500 text-white shadow-lg shadow-rose-100" 
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        <span>{t('continue')}</span>
        <ChevronRight className="mr-2 w-5 h-5 rtl:rotate-180" />
      </button>

      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={() => setShowInfo(false)}
          >
            <motion.div 
              className="bg-white w-full rounded-t-[32px] p-8 space-y-6 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />
              <h3 className="text-xl font-bold">{t('about_madhhabs')}</h3>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p><strong>{t('hanafi')}:</strong> {t('hanafi_summary')}</p>
                <p><strong>{t('maliki')}:</strong> {t('maliki_summary')}</p>
                <p><strong>{t('shafii')} & {t('hanbali')}:</strong> {t('shafii_summary')}</p>
                <p>{t('scholar_consult_note')}</p>
              </div>
              <button 
                onClick={() => setShowInfo(false)}
                className="w-full py-4 bg-rose-400 text-white rounded-2xl font-bold"
              >
                {t('got_it')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Screen4Goals = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  const [validationMsg, setValidationMsg] = useState('');

  const GOALS = [
    { id: 'goal_track_cycle', icon: CalendarIcon },
    { id: 'goal_understand_fiqh', icon: BookOpen },
    { id: 'goal_postpartum', icon: Baby },
    { id: 'goal_get_pregnant', icon: Heart },
    { id: 'goal_irregular_bleeding', icon: Droplets },
    { id: 'goal_general_health', icon: Activity },
    { id: 'goal_spiritual_wellness', icon: Moon },
  ];

  const toggleGoal = (id: string) => {
    const next = data.goal_flags.includes(id)
      ? data.goal_flags.filter(g => g !== id)
      : [...data.goal_flags, id];
    update({ goal_flags: next });
    if (next.length > 0) setValidationMsg('');
  };

  const handleContinue = () => {
    if (data.goal_flags.length === 0) {
      setValidationMsg(t('error_select_at_least_one' as any));
      return;
    }
    onNext();
  };

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2 leading-tight", isRTL ? "text-right" : "text-left")}>{t('goals_question')}</h1>
        <p className={cn("text-sm text-gray-400 mb-8 leading-relaxed", isRTL ? "text-right" : "text-left")}>{t('select_all_apply')}</p>

        <div className="grid grid-cols-1 gap-3 mt-6" dir={isRTL ? "rtl" : "ltr"}>
          {GOALS.map(goal => (
            <motion.button
              key={goal.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleGoal(goal.id)}
              className={cn(
                "flex items-center justify-between gap-4 rounded-3xl border p-4 text-sm font-bold transition-all",
                data.goal_flags.includes(goal.id)
                  ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
                  : 'bg-white border-black/5 text-gray-700'
              )}
            >
              <div className={cn("flex items-center gap-3", isRTL ? "flex-row-reverse text-right" : "text-left")}>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-rose-500 shadow-sm">
                  <goal.icon className="h-5 w-5" />
                </span>
                <span>{t(goal.id as any)}</span>
              </div>
              {data.goal_flags.includes(goal.id) && <CheckCircle2 className="h-5 w-5 text-rose-500" />}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={handleContinue}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex items-center justify-center"
        >
          <span>{t('continue')}</span>
          <ChevronRight className="mr-2 w-5 h-5 rtl:rotate-180" />
        </button>
        {validationMsg && (
          <p className="text-center text-sm text-rose-500 mt-2">{validationMsg}</p>
        )}
      </div>
    </div>
  );
};

const ScreenLocation = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const handleCitySelect = async (city: any) => {
    update({
      location: {
        city: city.nameEn || city.name,
        country: city.countryEn || city.country,
        cityAr: city.name,
        countryAr: city.country,
        lat: city.lat,
        lon: city.lon || city.lng
      }
    });

    // Save immediately as requested
    try {
      const lat = typeof city.lat === 'string' ? parseFloat(city.lat) : city.lat;
      const lon = typeof city.lon === 'string' ? parseFloat(city.lon) : (typeof city.lng === 'string' ? parseFloat(city.lng) : city.lng);
      
      await api.updateUser({
        prayerLat: lat,
        prayerLon: lon,
        location_lat: lat,
        location_lng: lon,
        location_name: city.name,
        prayerCity: city.nameEn || city.name,
        prayerCountry: city.countryEn || city.country,
        prayerCityAr: city.name,
        prayerCountryAr: city.country
      });
    } catch (err) {
      console.error("Failed to save location immediately", err);
    }
    
    onNext();
  };

  useEffect(() => {
    const searchCities = async () => {
      const trimmedQuery = query.trim().replace(/[،,.;]$/, '');
      if (trimmedQuery.length >= 2) {
        // First check local popular cities
        const localFiltered = popularCities.filter(c => 
          c.name.includes(trimmedQuery) || 
          c.nameEn.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
          c.country.includes(trimmedQuery) ||
          c.countryEn.toLowerCase().includes(trimmedQuery.toLowerCase())
        );

        // If we have local results, show them first
        if (localFiltered.length > 0) {
          setSuggestions(localFiltered.slice(0, 6));
          // If it's a very specific match, we might not need API search
          if (localFiltered.some(c => c.name === trimmedQuery || c.nameEn.toLowerCase() === trimmedQuery.toLowerCase())) {
            return;
          }
        }

        // Try external search for more results
        setIsLoading(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmedQuery)}&addressdetails=1&limit=5&accept-language=${isRTL ? 'ar' : 'en'}`);
          const results = await response.json();
          
          const apiSuggestions = results.map((item: any) => ({
            name: item.address.city || item.address.town || item.address.village || item.display_name.split(',')[0],
            nameEn: item.display_name.split(',')[0], // Fallback
            country: item.address.country,
            countryEn: item.address.country, // Fallback
            lat: item.lat,
            lon: item.lon
          }));
          
          // Combine local and API suggestions, avoiding duplicates if possible
          setSuggestions(prev => {
            const combined = [...localFiltered];
            apiSuggestions.forEach((api: any) => {
              if (!combined.some(c => c.name === api.name)) {
                combined.push(api);
              }
            });
            return combined.slice(0, 8);
          });
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
      }
    };

    const timeoutId = setTimeout(searchCities, 500);
    return () => clearTimeout(timeoutId);
  }, [query, isRTL]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=${isRTL ? 'ar' : 'en'}`);
          const result = await response.json();
          
          if (result.address) {
            const city = result.address.city || result.address.town || result.address.village || result.address.state;
            const country = result.address.country;
            
            await handleCitySelect({
              name: city,
              nameEn: city,
              country: country,
              countryEn: country,
              lat: latitude,
              lon: longitude
            });
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          alert("Could not determine your location name. Please search manually.");
        } finally {
          setIsDetecting(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsDetecting(false);
        alert("Could not access your location. Please search manually.");
      }
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2 leading-tight", isRTL ? "text-right" : "text-left")}>{t('location_title')}</h1>
        <p className={cn("text-sm text-gray-400 mb-8 leading-relaxed", isRTL ? "text-right" : "text-left")}>{t('location_desc')}</p>

        <div className="space-y-4 relative">
          <button
            onClick={handleDetectLocation}
            disabled={isDetecting}
            className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold flex items-center justify-center space-x-2 hover:bg-rose-100 transition-all"
          >
            {isDetecting ? (
              <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Navigation className="w-5 h-5" />
            )}
            <span>{isDetecting ? t('detecting' as any) : t('use_current_location' as any)}</span>
          </button>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder={t('enter_city_name')}
              className={cn("w-full py-4 bg-white border-2 border-black/5 rounded-2xl text-sm focus:border-rose-300 outline-none transition-all", isRTL ? "pl-12 pr-4 text-right" : "pl-12 pr-4 text-left")}
              dir={isRTL ? "rtl" : "ltr"}
            />
            {isLoading && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {isFocused && query.trim().length >= 2 && !isLoading && suggestions.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-black/5 shadow-xl p-4 text-center text-gray-500 text-sm"
              >
                {t('no_results')}
              </motion.div>
            )}

            {isFocused && suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-black/5 shadow-xl overflow-hidden"
              >
                {suggestions.map((city, i) => (
                  <button
                    key={i}
                    onClick={() => handleCitySelect(city)}
                    className="w-full p-4 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0 text-right"
                    dir="rtl"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-bold text-gray-800">{city.name}</span>
                      <span className="text-[10px] text-gray-400">{city.country}</span>
                    </div>
                    <MapPin className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Popular Cities Quick Select */}
          {!query && (
            <div className="space-y-3 pt-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">{t('popular_cities' as any)}</h3>
              <div className="grid grid-cols-2 gap-2">
                {popularCities.slice(0, 6).map((city, i) => (
                  <button
                    key={i}
                    onClick={() => handleCitySelect(city)}
                    className="p-3 bg-white border border-black/5 rounded-xl text-xs font-bold text-gray-700 hover:border-rose-200 hover:bg-rose-50 transition-all text-right"
                    dir="rtl"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <button 
        onClick={onNext}
        className="w-full py-4 text-gray-400 text-sm font-medium hover:text-rose-400"
      >
        {t('skip_for_now')}
      </button>
    </div>
  );
};

const Screen5LastPeriod = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date | null>(data.last_period_date ? new Date(data.last_period_date) : null);
  const [validationMsg, setValidationMsg] = useState('');

  const handleSelect = (date: Date) => {
    setSelectedDate(date);
    update({ last_period_date: date.toISOString() });
    setValidationMsg('');
  };

  const handleContinue = () => {
    if (!selectedDate) {
      setValidationMsg(t('error_select_date' as any));
      return;
    }
    onNext();
  };

  const handleNotSure = () => {
    const estimated = subDays(new Date(), 28);
    handleSelect(estimated);
    onNext();
  };

  const weekDays = isRTL 
    ? [t('sat'), t('fri'), t('thu'), t('wed'), t('tue'), t('mon'), t('sun')]
    : [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2 leading-tight", isRTL ? "text-right" : "text-left")}>{t('last_period_question')}</h1>
        <p className={cn("text-sm text-gray-400 mb-8 leading-relaxed", isRTL ? "text-right" : "text-left")}>{t('last_period_hint' as any)}</p>
        
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-black/5">
          <div className="grid grid-cols-7 gap-2 text-center mb-4">
            {weekDays.map((d, index) => (
              <span key={`${d}-${index}`} className="text-[10px] font-bold text-gray-300 uppercase">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 31 }).map((_, i) => {
              const date = subDays(new Date(), 30 - i);
              const isSelected = selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(date)}
                  className={cn(
                    "aspect-square rounded-full text-sm font-bold flex items-center justify-center transition-all",
                    isSelected ? "bg-rose-300 text-white" : isToday ? "text-rose-400 ring-1 ring-rose-400" : "text-gray-700 hover:bg-rose-50"
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={handleContinue}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex items-center justify-center"
        >
          <span>{t('continue')}</span>
          <ChevronRight className="mr-2 w-5 h-5 rtl:rotate-180" />
        </button>
        {validationMsg && (
          <p className="text-center text-sm text-rose-500 mt-2">{validationMsg}</p>
        )}
        <button 
          onClick={handleNotSure}
          className="w-full text-center text-gray-400 text-sm font-medium hover:text-rose-400"
        >
          {t('not_sure')}
        </button>
      </div>
    </div>
  );
};

const Screen6CycleLength = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2 leading-tight", isRTL ? "text-right" : "text-left")}>{t('cycle_length_question')}</h1>
        <p className={cn("text-sm text-gray-400 mb-8 leading-relaxed", isRTL ? "text-right" : "text-left")}>{t('cycle_length_desc')}</p>

        <div className="flex flex-col items-center space-y-7 mt-8">
          <motion.div 
            key={data.avg_cycle_length}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full rounded-[32px] border border-rose-100 bg-white p-7 text-center shadow-xl shadow-rose-950/5"
          >
            <div className="text-6xl font-serif font-bold text-rose-500">
              {data.avg_cycle_length}
              <span className="ms-2 text-xl text-rose-800/40">{t('days')}</span>
            </div>
            <p className="mt-3 text-xs font-bold text-gray-400">
              {isRTL ? 'يمكنك تعديلها لاحقاً من الملف الشخصي' : 'You can edit this later in Profile'}
            </p>
          </motion.div>

          <input 
            type="range" 
            min="21" 
            max="40" 
            value={data.avg_cycle_length}
            onChange={(e) => update({ avg_cycle_length: parseInt(e.target.value) })}
            className="w-full h-2 bg-rose-50 rounded-lg appearance-none cursor-pointer accent-rose-400"
          />
          
          <div className="flex justify-between w-full text-xs font-bold text-gray-300 uppercase tracking-widest">
            <span>21 {t('days')}</span>
            <span>40 {t('days')}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={onNext}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex items-center justify-center"
        >
          <span>{t('continue')}</span>
          <ChevronRight className="mr-2 w-5 h-5 rtl:rotate-180" />
        </button>
        <button 
          onClick={() => { update({ avg_cycle_length: 28 }); onNext(); }}
          className="w-full text-center text-gray-400 text-sm font-medium hover:text-rose-400"
        >
          {t('not_sure')}
        </button>
      </div>
    </div>
  );
};

const Screen7PeriodDuration = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  const maxDays = data.madhhab === 'HANAFI' ? 10 : 15;
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2 leading-tight", isRTL ? "text-right" : "text-left")}>{t('period_duration_question')}</h1>
        <p className={cn("text-sm text-gray-400 mb-8 leading-relaxed", isRTL ? "text-right" : "text-left")}>{t('period_duration_desc')}</p>

        <div className="flex flex-col items-center space-y-7 mt-8">
          <motion.div 
            key={data.avg_haid_duration}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full rounded-[32px] border border-rose-100 bg-white p-7 text-center shadow-xl shadow-rose-950/5"
          >
            <div className="text-6xl font-serif font-bold text-rose-500">
              {data.avg_haid_duration}
              <span className="ms-2 text-xl text-rose-800/40">{t('days')}</span>
            </div>
            <p className="mt-3 text-xs font-bold text-gray-400">
              {isRTL ? 'نستخدمها كبداية فقط ثم تتحسن التوقعات مع التسجيل' : 'This is only a starting point; predictions improve as you log'}
            </p>
          </motion.div>

          <input 
            type="range" 
            min="2" 
            max={maxDays} 
            value={data.avg_haid_duration}
            onChange={(e) => update({ avg_haid_duration: parseInt(e.target.value) })}
            className="w-full h-2 bg-rose-50 rounded-lg appearance-none cursor-pointer accent-rose-400"
          />
          
          <div className="text-center">
            <p className="text-xs font-bold text-rose-800/40 uppercase tracking-widest">
              {data.madhhab === 'HANAFI' ? t('hanafi_max_10') : t('other_max_15')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={onNext}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex items-center justify-center"
        >
          <span>{t('continue')}</span>
          <ChevronRight className="mr-2 w-5 h-5 rtl:rotate-180" />
        </button>
        <button 
          onClick={() => { update({ avg_haid_duration: 5 }); onNext(); }}
          className="w-full text-center text-gray-400 text-sm font-medium hover:text-rose-400"
        >
          {t('not_sure')}
        </button>
      </div>
    </div>
  );
};

const Screen8Conditions = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  const [validationMsg, setValidationMsg] = useState('');
  const age = Math.max(12, Math.min(60, CURRENT_YEAR - data.birth_year));
  const conditions = [
    t('cond_pcos'),
    t('cond_endo'),
    t('cond_thyroid'),
    t('cond_fibroids'),
    t('cond_none'),
    t('cond_prefer_not_to_say')
  ];

  const toggleCondition = (c: string) => {
    setValidationMsg('');
    if (c === t('cond_none') || c === t('cond_prefer_not_to_say')) {
      update({ conditions: [c] });
    } else {
      const filtered = data.conditions.filter(item => item !== t('cond_none') && item !== t('cond_prefer_not_to_say'));
      const next = filtered.includes(c) ? filtered.filter(item => item !== c) : [...filtered, c];
      update({ conditions: next });
    }
  };

  const handleContinue = () => {
    if (data.conditions.length === 0) {
      setValidationMsg(t('error_select_at_least_one' as any));
      return;
    }
    onNext();
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2 leading-tight", isRTL ? "text-right" : "text-left")}>{t('conditions_question')}</h1>
        <p className={cn("text-sm text-gray-400 mb-8 leading-relaxed", isRTL ? "text-right" : "text-left")}>{t('conditions_desc')}</p>

        <div className="mb-6 rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className={cn(isRTL ? 'text-right' : 'text-left')}>
              <p className="text-sm font-bold text-emerald-700">{isRTL ? 'العمر' : 'Age'}</p>
              <p className="mt-1 text-xs leading-6 text-emerald-900/55">
                {isRTL ? 'يساعدنا في جعل النصائح الصحية والتقارير أكثر دقة.' : 'This helps tailor health guidance and reports.'}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
              <span className="block text-2xl font-black text-emerald-800">{age}</span>
              <span className="text-[11px] font-bold text-emerald-600/70">{isRTL ? 'سنة' : 'years'}</span>
            </div>
          </div>
          <input
            type="range"
            min="12"
            max="60"
            value={age}
            onChange={(e) => update({ birth_year: CURRENT_YEAR - Number(e.target.value) })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white accent-emerald-600"
            aria-label={isRTL ? 'العمر' : 'Age'}
          />
          <div className="mt-2 flex justify-between text-[11px] font-bold text-emerald-900/35">
            <span>12</span>
            <span>60</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 mt-6" dir={isRTL ? "rtl" : "ltr"}>
          {conditions.map((c) => (
            <motion.button
              key={c}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleCondition(c)}
              className={cn(
                "flex items-center justify-between rounded-3xl border p-4 transition-all text-sm font-bold",
                data.conditions.includes(c)
                  ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
                  : 'bg-white border-black/5 text-gray-700'
              )}
            >
              <span>{c}</span>
              {data.conditions.includes(c) && <CheckCircle2 className="h-5 w-5 text-rose-500" />}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <button 
          onClick={handleContinue}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex items-center justify-center"
        >
          <span>{t('continue')}</span>
          <ChevronRight className="mr-2 w-5 h-5 rtl:rotate-180" />
        </button>
        {validationMsg && (
          <p className="text-center text-sm text-rose-500 mt-2">{validationMsg}</p>
        )}
      </div>
    </div>
  );
};

const Screen9Privacy = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2 leading-tight", isRTL ? "text-right" : "text-left")}>{t('privacy_title')}</h1>
        <p className={cn("text-sm text-gray-400 mb-10 leading-relaxed", isRTL ? "text-right" : "text-left")}>{t('privacy_desc')}</p>

        {/* Anonymous mode — the only option */}
        <div className="bg-white border border-rose-100 rounded-[28px] p-5 shadow-xl shadow-rose-950/5">
          <div className={cn("flex items-center justify-between gap-4", isRTL && "flex-row-reverse")}>
            <NiswahToggle 
              value={data.privacy_setup.anonymous_mode} 
              onChange={(v) => update({ privacy_setup: { ...data.privacy_setup, anonymous_mode: v } })} 
            />
            <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
              <div className="font-bold text-gray-800">{t('anonymous_mode')}</div>
              <div className="text-sm text-gray-500 mt-1">{t('anonymous_mode_desc')}</div>
            </div>
          </div>
        </div>

        {/* Privacy assurance cards */}
        <div className="mt-6 space-y-3">
          {[
            { icon: Lock, title: t('privacy_assurance_1_title' as any), sub: t('privacy_assurance_1_sub' as any) },
            { icon: EyeOff, title: t('privacy_assurance_2_title' as any), sub: t('privacy_assurance_2_sub' as any) },
            { icon: Trash2, title: t('privacy_assurance_3_title' as any), sub: t('privacy_assurance_3_sub' as any) },
          ].map(item => (
            <div key={item.title} dir={isRTL ? "rtl" : "ltr"} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <item.icon className="h-5 w-5" />
              </span>
              <div className={cn("min-w-0 flex-1", isRTL ? "text-right" : "text-left")}>
                <div className="text-sm font-bold text-gray-700">{item.title}</div>
                <div className="text-xs text-gray-400">{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform"
      >
        {t('continue')}
      </button>
    </div>
  );
};

const Screen10Notifications = ({ data, update, onNext }: { data: OnboardingData; update: (d: Partial<OnboardingData>) => void; onNext: () => void }) => {
  const { t, isRTL } = useTranslation();
  const options = [
    { id: 'prayer_updates', label: t('prayer_updates'), sub: t('prayer_updates_sub') },
    { id: 'period_prediction', label: t('period_prediction'), sub: t('period_prediction_sub') },
    { id: 'ovulation_alert', label: t('ovulation_alert'), sub: t('ovulation_alert_sub') },
    { id: 'ghusl_reminder', label: t('ghusl_reminder'), sub: t('ghusl_reminder_sub') },
    { id: 'daily_insights', label: t('daily_insights_notif'), sub: t('daily_insights_sub') },
    { id: 'ramadan_qadha', label: t('ramadan_qadha_notif'), sub: t('ramadan_qadha_sub') },
  ];

  const toggle = (id: string) => {
    update({ notification_prefs: { ...data.notification_prefs, [id]: !data.notification_prefs[id] } });
  };

  const enableAll = () => {
    const allArr = options.map(o => o.id);
    const allPrefs = { ...data.notification_prefs };
    allArr.forEach(id => { allPrefs[id] = true; });
    update({ notification_prefs: allPrefs });
    onNext();
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1">
        <h1 className={cn("text-3xl font-bold text-gray-900 mb-2", isRTL ? "text-right" : "text-left")}>{t('notifications_title')}</h1>
        <p className={cn("text-sm text-gray-400 mb-8", isRTL ? "text-right" : "text-left")}>{t('notifications_desc')}</p>

        <div className="space-y-3 max-h-[54vh] overflow-y-auto custom-scrollbar">
          {options.map((opt) => (
            <div key={opt.id} className={cn("flex items-center justify-between gap-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm", isRTL && "flex-row-reverse")}>
              <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
                <p className="font-bold text-sm text-gray-800">{opt.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-gray-400">{opt.sub}</p>
              </div>
              <NiswahToggle 
                value={data.notification_prefs[opt.id]} 
                onChange={() => toggle(opt.id)} 
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <button 
          onClick={enableAll}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold shadow-lg shadow-rose-100 active:scale-95 transition-transform"
        >
          {t('enable_recommended')}
        </button>
        <button 
          onClick={onNext}
          className="w-full py-4 text-gray-400 text-sm font-medium hover:text-rose-400 flex items-center justify-center"
        >
          <span>{t('choose_own')}</span>
          <ChevronRight className="ml-1 w-4 h-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
};

const Screen11Welcome = ({ onComplete, isCompleting }: { onComplete: () => void; isCompleting: boolean }) => {
  const { t, isRTL } = useTranslation();
  return (
    <div className="w-full space-y-7 text-center">
      <div className="w-20 h-20 bg-rose-50 rounded-[28px] flex items-center justify-center mx-auto mb-2">
        <Sparkles className="w-10 h-10 text-rose-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-serif font-bold text-rose-800">
          {isRTL ? 'أصبحتِ جاهزة للبدء' : 'You are ready to begin'}
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          {isRTL
            ? 'جهزنا تجربتك حسب مذهبك وبياناتك الصحية، ويمكنك تعديل كل شيء لاحقاً من الملف الشخصي.'
            : 'Your experience is now set around your fiqh preference and health profile. You can edit everything later.'}
        </p>
      </div>

      <div className="rounded-[28px] border border-rose-100 bg-white p-5 shadow-xl shadow-rose-950/5">
        <div className="grid grid-cols-1 gap-3">
          {[
            { icon: Sparkles, label: t('feat_nisa_ai') },
            { icon: Activity, label: t('feat_insights') },
            { icon: BookOpen, label: t('feat_journeys') },
            { icon: ShieldCheck, label: t('feat_privacy') }
          ].map((feat, i) => (
            <div key={i} dir={isRTL ? "rtl" : "ltr"} className="flex items-center gap-3 rounded-2xl bg-rose-50/60 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-rose-500 shadow-sm">
                <feat.icon className="w-4 h-4" />
              </span>
              <span className="flex-1 text-right text-xs font-bold text-rose-800">{feat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={onComplete}
        disabled={isCompleting}
        className={cn(
          "w-full py-5 text-white rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center",
          isCompleting ? "bg-rose-400 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
        )}
      >
        {isCompleting ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          t('get_started')
        )}
      </button>
    </div>
  );
};

// --- MAIN COMPONENT ---

export const Onboarding = ({ onFinish }: { onFinish: (userData: DBUser) => void }) => {
  const { isRTL, t } = useTranslation();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [direction, setDirection] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const nextStep = () => {
    setDirection(1);
    if (step === 12) {
      complete();
    } else {
      setStep(s => Math.min(s + 1, 12));
    }
  };

  const prevStep = () => {
    if (step === 3 && !data.madhhab) return; // Cannot go back from Screen 3 without selection
    setDirection(-1);
    setStep(s => Math.max(s - 1, 1));
  };

  const complete = async () => {
    try {
      setIsCompleting(true);
      // Save to database with a local-first fallback.
      const { data: savedUser } = await api.upsertUser({
        madhhab: data.madhhab as Madhhab,
        language: data.language,
        birth_year: data.birth_year,
        avg_cycle_length: data.avg_cycle_length,
        avg_haid_duration: data.avg_haid_duration,
        goal_flags: data.goal_flags,
        conditions: data.conditions,
        notification_prefs: data.notification_prefs,
        anonymous_mode: data.privacy_setup.anonymous_mode,
        onboarding_completed: true,
        premium_status: true,
        prayerCity: data.location.city,
        prayerCountry: data.location.country,
        prayerCityAr: data.location.cityAr,
        prayerCountryAr: data.location.countryAr,
        prayerLat: data.location.lat,
        prayerLon: data.location.lon,
        location_lat: data.location.lat,
        location_lng: data.location.lon,
        location_name: data.location.city,
        manual_prayer_offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
      });

      if (data.last_period_date) {
        // Background sync cycle entry
        await api.logCycleEntry({
          date: data.last_period_date.split('T')[0],
          time_logged: data.last_period_date,
          fiqh_state: 'HAID'
        });
      }
      
      // If we have any user data in localStorage (savedUser returns it), complete
      if (savedUser) {
        onFinish(savedUser);
      } else {
        const { data: fallbackUser } = await api.getUser();
        if (fallbackUser) {
          onFinish(fallbackUser);
        } else {
          throw new Error("Critical error: User session not initialized.");
        }
      }
    } catch (err: any) {
      console.error("Non-blocking onboarding save error", err);
      const { data: fallbackUser } = await api.getUser();
      if (fallbackUser) {
        onFinish(fallbackUser);
      } else {
        alert("Something went wrong. Please check your connection and try again.");
      }
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#FDFCFB]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-rose-50 via-emerald-50/50 to-transparent" />
      <div className="pointer-events-none absolute -right-24 top-20 h-56 w-56 rounded-full bg-rose-100/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-20 h-56 w-56 rounded-full bg-emerald-100/50 blur-3xl" />
      {step > 2 && step < 12 && <ProgressBar current={step - 2} total={9} />}
      
      {step > 3 && step < 12 && (
        <button 
          onClick={prevStep}
          className={cn(
            "absolute top-[max(18px,env(safe-area-inset-top))] z-50 grid h-10 w-10 place-items-center rounded-2xl bg-white/80 text-gray-400 shadow-sm backdrop-blur hover:text-rose-400",
            isRTL ? "right-6" : "left-6"
          )}
        >
          <ChevronLeft className={cn("w-6 h-6", isRTL && "rotate-180")} />
        </button>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ x: direction > 0 ? (isRTL ? -100 : 100) : (isRTL ? 100 : -100), opacity: 0, scale: 0.96 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: direction > 0 ? (isRTL ? 100 : -100) : (isRTL ? -100 : 100), opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative mx-auto flex h-full w-full max-w-md flex-col items-center overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(84px,calc(env(safe-area-inset-top)+76px))] sm:px-6"
        >
          {step === 1 && <Screen1Splash onNext={nextStep} />}
          {step === 2 && <Screen2Language data={data} update={updateData} onNext={nextStep} />}
          {step === 3 && <Screen3Madhhab data={data} update={updateData} onNext={nextStep} />}
          {step === 4 && <Screen4Goals data={data} update={updateData} onNext={nextStep} />}
          {step === 5 && <ScreenLocation data={data} update={updateData} onNext={nextStep} />}
          {step === 6 && <Screen5LastPeriod data={data} update={updateData} onNext={nextStep} />}
          {step === 7 && <Screen6CycleLength data={data} update={updateData} onNext={nextStep} />}
          {step === 8 && <Screen7PeriodDuration data={data} update={updateData} onNext={nextStep} />}
          {step === 9 && <Screen8Conditions data={data} update={updateData} onNext={nextStep} />}
          {step === 10 && <Screen9Privacy data={data} update={updateData} onNext={nextStep} />}
          {step === 11 && <Screen10Notifications data={data} update={updateData} onNext={nextStep} />}
          {step === 12 && <Screen11Welcome onComplete={nextStep} isCompleting={isCompleting} />}
        </motion.div>
      </AnimatePresence>
      
      {isCompleting && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full"
          />
          <p className="text-xs font-bold text-rose-900 uppercase animate-pulse">{t('preparing_app' as any)}</p>
        </div>
      )}
    </div>
  );
};
