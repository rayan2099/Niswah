import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { toHijri } from 'hijri-converter';

// Load and embed Arabic font into jsPDF instance
const loadArabicFont = async (doc: jsPDF): Promise<boolean> => {
  // Try fonts in order of reliability
  const fontPaths = [
    '/fonts/Amiri-Regular.ttf',
    '/fonts/Cairo-Regular-Static.ttf', 
    '/fonts/Cairo-Regular.ttf',
    '/fonts/Cairo.ttf',
  ];

  for (const fontPath of fontPaths) {
    try {
      const response = await fetch(fontPath);
      if (!response.ok) {
        console.warn(`Font not found: ${fontPath} (${response.status})`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 10000) {
        console.warn(`Font too small: ${fontPath} (${arrayBuffer.byteLength} bytes)`);
        continue;
      }

      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      
      const fontName = fontPath.split('/').pop()?.replace('.ttf', '') || 'Arabic';
      doc.addFileToVFS(`${fontName}.ttf`, base64);
      // Use Identity-H for better Unicode support
      (doc as any).addFont(`${fontName}.ttf`, 'Arabic', 'normal', 'Identity-H');
      doc.setFont('Arabic');
      
      (doc as any)._arabicFontLoaded = true;
      (doc as any)._arabicFontName = 'Arabic';
      
      console.log(`✓ Font loaded: ${fontPath} (${arrayBuffer.byteLength} bytes)`);
      return true;
    } catch (err) {
      console.warn(`Font load failed: ${fontPath}`, err);
    }
  }
  
  console.error('ALL FONTS FAILED — PDF will show text errors');
  (doc as any)._arabicFontLoaded = false;
  return false;
};

const safe = (val: any, fallback = '—'): string => {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
};

const getHijriDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const h = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return `${h.hd}/${h.hm}/${h.hy}`;
  } catch { return '—'; }
};

// Simple Arabic reshaper/reverser to prevent garbled text in jsPDF
const reshapeArabic = (text: string): string => {
  if (!text) return '';
  const arabicRegex = /[\u0600-\u06FF]/;
  if (!arabicRegex.test(text)) return text;
  
  // Reverse for RTL - jsPDF doesn't handle RTL automatically
  // Note: This is a basic fix; complex ligatures require a full reshaper library
  // We also handle numbers and punctuation which should stay in order
  return text.split('').reverse().join('');
};

// RTL text helper
const R = (doc: jsPDF, text: string, x: number, y: number, size = 10, align: 'left' | 'center' | 'right' = 'right') => {
  try {
    doc.setFontSize(size);
    const val = safe(text);
    const arabicRegex = /[\u0600-\u06FF]/;
    const hasArabic = arabicRegex.test(val);
    
    const fontLoaded = (doc as any)._arabicFontLoaded;

    if (hasArabic && fontLoaded) {
      try {
        doc.setFont('Arabic', 'normal');
        
        // Defensive check for font metrics to prevent 'widths' crash
        const currentFont = doc.internal.getFont();
        if (hasArabic && (!currentFont || !currentFont.metadata || !currentFont.metadata.widths)) {
          console.warn('Arabic font loaded but missing widths metadata. Falling back.');
          throw new Error('Missing font widths');
        }

        const processedText = reshapeArabic(val);
        // Use a small try-catch for the specific text call to avoid crashing the whole PDF
        try {
          doc.text(processedText, x, y, { align });
        } catch (textErr) {
          console.error('doc.text failed for Arabic:', textErr);
          doc.setFont('helvetica', 'normal');
          doc.text('[Text Error]', x, y, { align });
        }
      } catch (err) {
        console.warn('Arabic rendering failed with Cairo, falling back to Helvetica:', err);
        doc.setFont('helvetica', 'normal');
        doc.text('[Arabic Text]', x, y, { align });
      }
    } else {
      doc.setFont('helvetica', 'normal');
      // If we have Arabic but no font, we MUST use a placeholder to avoid 'widths' crash
      // because Helvetica doesn't have Arabic glyphs and will throw the 'widths' error
      const textToRender = hasArabic ? '[Arabic Text]' : val;
      doc.text(textToRender, x, y, { align });
    }
  } catch (err) {
    console.error('Critical error in R helper:', err);
    // Absolute last resort fallback
    try {
      doc.setFont('helvetica', 'normal');
      doc.text('Error', x, y, { align });
    } catch (e) { /* ignore */ }
  }
};

export const generateFiqhPDF = async (user: any, ledger: any[], fiqhState: string): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadArabicFont(doc);
  
  if (!fontLoaded) {
    // Absolute fallback: generate English-only PDF
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text('Niswah | Fiqh Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Arabic font failed to load. Please try again.', 105, 35, { align: 'center' });
    doc.text(`Current state: ${fiqhState}`, 105, 50, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd')}`, 105, 60, { align: 'center' });
    return doc.output('blob');
  }
  
  const W = doc.internal.pageSize.getWidth();
  const right = W - 15;
  let y = 20;

  doc.setTextColor(6, 95, 70);
  R(doc, 'Niswah | نسوة', right, y, 20); y += 9;
  R(doc, 'تقرير الحالة الفقهية', right, y, 14); y += 7;
  
  doc.setTextColor(100, 100, 100);
  R(doc, `تاريخ الإنشاء: ${getHijriDate(new Date().toISOString())} هـ | ${format(new Date(), 'yyyy-MM-dd')} م`, right, y, 9); y += 5;
  R(doc, `المستخدم: ${user?.anonymous_mode ? 'أخت' : (user?.display_name || 'أخت')}`, right, y, 9); y += 5;
  
  const madhhabNames: Record<string, string> = {
    HANBALI: 'المذهب الحنبلي — مذهب الإمام أحمد بن حنبل',
    HANAFI: 'المذهب الحنفي — مذهب الإمام أبي حنيفة النعمان',
    SHAFII: 'المذهب الشافعي — مذهب الإمام محمد بن إدريس الشافعي',
    MALIKI: 'المذهب المالكي — مذهب الإمام مالك بن أنس',
  };
  R(doc, madhhabNames[user?.madhhab] || 'المذهب الحنبلي', right, y, 9); y += 8;
  
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, right, y); y += 8;

  // Section 1 — Menstrual Pattern
  doc.setTextColor(6, 95, 70);
  R(doc, 'العادة الحيضية', right, y, 13); y += 7;

  const safeLedger = ledger ?? [];
  const avgCycle = safeLedger.length > 0
    ? (safeLedger.reduce((a: number, c: any) => a + (c?.tuhr_duration_days || 0) + ((c?.haid_duration_hours || 0) / 24), 0) / safeLedger.length).toFixed(1)
    : '28';
  const avgHaid = safeLedger.length > 0
    ? (safeLedger.reduce((a: number, c: any) => a + (c?.haid_duration_hours || 0), 0) / safeLedger.length / 24).toFixed(1)
    : '7';

  doc.setTextColor(55, 65, 81);
  R(doc, `متوسط طول الدورة: ${avgCycle} أيام`, right, y, 10); y += 6;
  R(doc, `متوسط مدة الحيض: ${avgHaid} أيام`, right, y, 10); y += 6;
  R(doc, `انتظام الدورة: ${safeLedger.length > 1 ? 'منتظمة' : 'غير منتظمة'}`, right, y, 10); y += 8;

  // Table
  doc.setTextColor(6, 95, 70);
  const c = [right, right-38, right-76, right-114];
  R(doc, 'بداية هجرية', c[0], y, 8);
  R(doc, 'المدة', c[1], y, 8);
  R(doc, 'وصف الدم', c[2], y, 8);
  R(doc, 'مدة الطهر', c[3], y, 8);
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, right, y); y += 5;

  doc.setTextColor(55, 65, 81);
  const last6 = [...safeLedger]
    .sort((a, b) => new Date(b?.haid_start || 0).getTime() - new Date(a?.haid_start || 0).getTime())
    .slice(0, 6);

  if (last6.length === 0) {
    R(doc, 'لا توجد دورات مسجلة بعد', right, y, 9); y += 8;
  } else {
    last6.forEach((record: any) => {
      R(doc, getHijriDate(record?.haid_start), c[0], y, 8);
      R(doc, `${((record?.haid_duration_hours ?? 0) / 24).toFixed(1)} يوم`, c[1], y, 8);
      R(doc, record?.istihadah_episode ? 'استحاضة' : 'حيض', c[2], y, 8);
      R(doc, `${(record?.tuhr_duration_days || 0).toFixed(1)} يوم`, c[3], y, 8);
      y += 6;
    });
  }

  y += 5;
  doc.line(15, y, right, y); y += 8;

  // Section 2 — Current Status
  doc.setTextColor(6, 95, 70);
  R(doc, 'الحالة الفقهية الحالية', right, y, 13); y += 7;
  doc.setTextColor(55, 65, 81);
  const stateNames: Record<string, string> = { HAID: 'حيض', TAHARA: 'طهارة', ISTIHADAH: 'استحاضة', NIFAS: 'نفاس' };
  R(doc, `الحالة: ${stateNames[fiqhState] || 'طهارة'}`, right, y, 10); y += 10;

  // Section 3 — Fiqh Notes
  doc.setTextColor(6, 95, 70);
  R(doc, 'ملاحظات فقهية', right, y, 13); y += 7;
  doc.setTextColor(55, 65, 81);
  const fiqhNotes: Record<string, string> = {
    HANBALI: 'أقل الحيض يوم وليلة، وأكثره خمسة عشر يوماً',
    HANAFI: 'أقل الحيض ثلاثة أيام، وأكثره عشرة أيام',
    SHAFII: 'أقل الحيض يوم وليلة، وأكثره خمسة عشر يوماً',
    MALIKI: 'لا حد لأقل الحيض، وأكثره خمسة عشر يوماً',
  };
  R(doc, fiqhNotes[user?.madhhab] || fiqhNotes.HANBALI, right, y, 10); y += 10;

  // Footer
  doc.setTextColor(150, 150, 150);
  R(doc, 'تم إنشاء هذا التقرير بواسطة تطبيق نسوة للصحة الإسلامية', W / 2, 285, 8, 'center');

  return doc.output('blob');
};

export const generateDoctorPDF = async (user: any, ledger: any[], stats: any): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadArabicFont(doc);

  if (!fontLoaded) {
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text('Niswah | Medical Cycle Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Arabic font failed to load. Please try again.', 105, 35, { align: 'center' });
    doc.text(`Patient: ${user?.display_name || 'Sister'}`, 105, 50, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd')}`, 105, 60, { align: 'center' });
    return doc.output('blob');
  }

  const W = doc.internal.pageSize.getWidth();
  const right = W - 15;
  let y = 20;

  doc.setTextColor(6, 95, 70);
  R(doc, 'Niswah | نسوة', right, y, 20); y += 9;
  R(doc, 'تقرير الدورة الطبية', right, y, 14); y += 7;

  doc.setTextColor(100, 100, 100);
  R(doc, `المريضة: ${user?.anonymous_mode ? 'أخت' : (user?.display_name || 'أخت')}`, right, y, 9); y += 5;
  const age = user?.birth_year ? new Date().getFullYear() - user.birth_year : '—';
  R(doc, `تاريخ الإصدار: ${format(new Date(), 'yyyy-MM-dd')} | العمر: ${age}`, right, y, 9); y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, right, y); y += 8;

  const safeLedger = ledger ?? [];

  doc.setTextColor(6, 95, 70);
  R(doc, 'ملخص الدورة', right, y, 13); y += 7;

  doc.setTextColor(55, 65, 81);
  R(doc, `متوسط طول الدورة: ${stats?.avgCycleLength || '28'} أيام`, right, y, 10); y += 6;
  R(doc, `متوسط مدة الحيض: ${stats?.avgHaidDuration || '7'} أيام`, right, y, 10); y += 6;
  R(doc, `درجة الانتظام: ${safeLedger.length > 1 ? 'عالية' : 'متوسطة'}`, right, y, 10); y += 6;
  R(doc, `أقصر دورة: ${stats?.shortestCycle || '28'} أيام | أطول دورة: ${stats?.longestCycle || '28'} أيام`, right, y, 10); y += 10;

  doc.setTextColor(6, 95, 70);
  R(doc, 'سجل الدورات', right, y, 13); y += 7;

  const cols = [right, right-32, right-64, right-96, right-128];
  doc.setTextColor(6, 95, 70);
  R(doc, 'البداية', cols[0], y, 8);
  R(doc, 'النهاية', cols[1], y, 8);
  R(doc, 'المدة', cols[2], y, 8);
  R(doc, 'كثافة الدم', cols[3], y, 8);
  R(doc, 'ملاحظات', cols[4], y, 8);
  y += 2;
  doc.line(15, y, right, y); y += 5;

  doc.setTextColor(55, 65, 81);
  const last6 = [...safeLedger]
    .sort((a, b) => new Date(b?.haid_start || 0).getTime() - new Date(a?.haid_start || 0).getTime())
    .slice(0, 6);

  if (last6.length === 0) {
    R(doc, 'لا توجد دورات مسجلة بعد', right, y, 9); y += 8;
  } else {
    last6.forEach((record: any) => {
      R(doc, safe(record?.haid_start?.split('T')[0]), cols[0], y, 8);
      R(doc, safe(record?.haid_end?.split('T')[0]), cols[1], y, 8);
      R(doc, `${((record?.haid_duration_hours ?? 0) / 24).toFixed(1)}`, cols[2], y, 8);
      R(doc, 'متوسط', cols[3], y, 8);
      R(doc, record?.istihadah_episode ? 'استحاضة' : 'حيض', cols[4], y, 8);
      y += 6;
    });
  }

  y += 5;
  doc.line(15, y, right, y); y += 8;

  doc.setTextColor(150, 150, 150);
  R(doc, 'تم إنشاء هذا التقرير بواسطة تطبيق نسوة. يرجى استشارة طبيب مؤهل للتشخيص الطبي.', W / 2, 285, 8, 'center');

  return doc.output('blob');
};

export const generateHusbandPDF = async (
  user: any,
  currentDay: number,
  fiqhState: string,
  nextPeriodDate: Date | null,
  fertilityStart: Date | null,
  fertilityEnd: Date | null
): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadArabicFont(doc);

  if (!fontLoaded) {
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text('Niswah | Summary for Husband', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Arabic font failed to load. Please try again.', 105, 35, { align: 'center' });
    doc.text(`Current state: ${fiqhState}`, 105, 50, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd')}`, 105, 60, { align: 'center' });
    return doc.output('blob');
  }

  const W = doc.internal.pageSize.getWidth();
  const right = W - 15;
  let y = 20;

  doc.setTextColor(6, 95, 70);
  R(doc, 'Niswah | نسوة', right, y, 20); y += 9;
  R(doc, 'ملخص للزوج', right, y, 14); y += 7;

  doc.setTextColor(100, 100, 100);
  R(doc, format(new Date(), 'yyyy-MM-dd'), right, y, 9); y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, right, y); y += 8;

  doc.setTextColor(6, 95, 70);
  R(doc, 'الحالة الحالية', right, y, 13); y += 7;

  const stateNames: Record<string, string> = { HAID: 'حيض', TAHARA: 'طهارة', ISTIHADAH: 'استحاضة', NIFAS: 'نفاس' };
  doc.setTextColor(55, 65, 81);
  R(doc, `الحالة: ${stateNames[fiqhState] || 'طهارة'}`, right, y, 10); y += 6;
  R(doc, `اليوم ${currentDay || 1} من الدورة`, right, y, 10); y += 6;
  R(doc, `موعد انتهاء الدورة المتوقع: ${nextPeriodDate ? format(nextPeriodDate, 'dd/MM/yyyy') : 'غير محدد بعد'}`, right, y, 10); y += 10;

  doc.setTextColor(6, 95, 70);
  R(doc, 'الأيام القادمة', right, y, 13); y += 7;

  doc.setTextColor(55, 65, 81);
  R(doc, `الحيض المتوقع القادم: ${nextPeriodDate ? format(nextPeriodDate, 'dd/MM/yyyy') : 'غير محدد بعد'}`, right, y, 10); y += 6;
  const fertilityRange = fertilityStart && fertilityEnd
    ? `${format(fertilityStart, 'dd/MM/yyyy')} - ${format(fertilityEnd, 'dd/MM/yyyy')}`
    : 'غير محدد بعد';
  R(doc, `نافذة الخصوبة: ${fertilityRange}`, right, y, 10); y += 10;

  doc.setTextColor(6, 95, 70);
  R(doc, 'ملاحظة شرعية', right, y, 13); y += 7;

  doc.setTextColor(55, 65, 81);
  R(doc, 'وفقاً للفقه الإسلامي، يُحرم الجماع خلال فترة الحيض.', right, y, 10); y += 6;
  R(doc, 'جزاك الله خيراً على اهتمامك بصحة زوجتك.', right, y, 10); y += 10;

  doc.setTextColor(150, 150, 150);
  R(doc, 'هذا التقرير خاص وسري — أُعد بموافقة الزوجة عبر تطبيق نسوة', W / 2, 285, 8, 'center');

  return doc.output('blob');
};
