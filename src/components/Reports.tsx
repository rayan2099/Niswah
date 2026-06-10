import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
      
      return true;
    } catch (err) {
      console.warn(`Font load failed: ${fontPath}`, err);
    }
  }
  
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

type ReportRow = [string, string];

type ReportSection = {
  title: string;
  rows?: ReportRow[];
  paragraphs?: string[];
};

const canUseVisualPdf = () => (
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  !navigator.userAgent.toLowerCase().includes('jsdom')
);

const appendText = (parent: HTMLElement, tag: keyof HTMLElementTagNameMap, text: string, className?: string) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
};

const buildReportPage = (title: string, subtitle: string, meta: string[], sections: ReportSection[]) => {
  const page = document.createElement('div');
  page.dir = 'rtl';
  page.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    'width:794px',
    'min-height:1123px',
    'box-sizing:border-box',
    'padding:56px',
    'background:#fffdfb',
    'color:#374151',
    'font-family:Cairo, Arial, sans-serif',
    'direction:rtl',
    'text-align:right',
    'line-height:1.8',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'border-bottom:1px solid #e5e7eb;padding-bottom:22px;margin-bottom:24px;';
  appendText(header, 'div', 'نسوة | Niswah', 'brand');
  appendText(header, 'h1', title);
  appendText(header, 'p', subtitle);
  page.appendChild(header);

  const style = document.createElement('style');
  style.textContent = `
    .brand { color:#065f46; font-size:24px; font-weight:800; margin-bottom:8px; }
    h1 { color:#8f1d42; font-size:34px; line-height:1.25; margin:0 0 8px; font-weight:800; }
    h2 { color:#065f46; font-size:22px; margin:24px 0 12px; font-weight:800; }
    p { margin:0; font-size:16px; color:#6b7280; }
    .meta { display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; margin:0 0 18px; }
    .meta div, .row { background:#ffffff; border:1px solid #f1dbe3; border-radius:14px; padding:10px 14px; font-size:15px; }
    .row { display:grid; grid-template-columns:180px 1fr; gap:16px; margin-bottom:9px; }
    .label { color:#8f1d42; font-weight:800; }
    .value { color:#374151; overflow-wrap:anywhere; }
    .note { background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px; padding:12px 14px; margin-bottom:10px; font-size:15px; color:#374151; }
    .footer { position:absolute; bottom:36px; left:56px; right:56px; text-align:center; color:#9ca3af; font-size:13px; border-top:1px solid #f3f4f6; padding-top:14px; }
  `;
  page.appendChild(style);

  const metaWrap = document.createElement('div');
  metaWrap.className = 'meta';
  meta.forEach(item => appendText(metaWrap, 'div', item));
  page.appendChild(metaWrap);

  sections.forEach(section => {
    appendText(page, 'h2', section.title);
    section.rows?.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'row';
      appendText(row, 'div', label, 'label');
      appendText(row, 'div', value, 'value');
      page.appendChild(row);
    });
    section.paragraphs?.forEach(text => appendText(page, 'div', text, 'note'));
  });

  appendText(page, 'div', 'تم إنشاء هذا التقرير بواسطة تطبيق نسوة', 'footer');
  return page;
};

const renderVisualPdf = async (title: string, subtitle: string, meta: string[], sections: ReportSection[]): Promise<Blob | null> => {
  if (!canUseVisualPdf()) return null;

  const page = buildReportPage(title, subtitle, meta, sections);
  document.body.appendChild(page);

  try {
    const canvas = await html2canvas(page, {
      backgroundColor: '#fffdfb',
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      logging: false,
    });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    return doc.output('blob');
  } catch (err) {
    console.warn('Visual PDF rendering failed; falling back to text PDF:', err);
    return null;
  } finally {
    page.remove();
  }
};

// jsPDF ships an Arabic shaping plugin. It produces presentation forms that
// render reliably with embedded Arabic TTF fonts.
const reshapeArabic = (text: string): string => {
  if (!text) return '';
  const arabicRegex = /[\u0600-\u06FF]/;
  if (!arabicRegex.test(text)) return text;

  const processor = (jsPDF as any).API?.processArabic;
  return typeof processor === 'function' ? processor(text) : text;
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
        (doc as any).setR2L?.(true);
        const processedText = reshapeArabic(val);
        doc.text(processedText, x, y, { align });
        (doc as any).setR2L?.(false);
      } catch (err) {
        console.warn('Arabic rendering failed; using original text with embedded font fallback:', err);
        doc.setFont('helvetica', 'normal');
        doc.text(val, x, y, { align });
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.text(val, x, y, { align });
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
  const visualLedger = ledger ?? [];
  const visualAvgCycle = visualLedger.length > 0
    ? (visualLedger.reduce((a: number, c: any) => a + (c?.tuhr_duration_days || 0) + ((c?.haid_duration_hours || 0) / 24), 0) / visualLedger.length).toFixed(1)
    : '28';
  const visualAvgHaid = visualLedger.length > 0
    ? (visualLedger.reduce((a: number, c: any) => a + (c?.haid_duration_hours || 0), 0) / visualLedger.length / 24).toFixed(1)
    : '7';
  const visualStateNames: Record<string, string> = { HAID: 'حيض', TAHARA: 'طهارة', ISTIHADAH: 'استحاضة', NIFAS: 'نفاس' };
  const visualMadhhabNames: Record<string, string> = {
    HANBALI: 'المذهب الحنبلي — مذهب الإمام أحمد بن حنبل',
    HANAFI: 'المذهب الحنفي — مذهب الإمام أبي حنيفة النعمان',
    SHAFII: 'المذهب الشافعي — مذهب الإمام محمد بن إدريس الشافعي',
    MALIKI: 'المذهب المالكي — مذهب الإمام مالك بن أنس',
  };
  const visualFiqhNotes: Record<string, string> = {
    HANBALI: 'أقل الحيض يوم وليلة، وأكثره خمسة عشر يوماً.',
    HANAFI: 'أقل الحيض ثلاثة أيام، وأكثره عشرة أيام.',
    SHAFII: 'أقل الحيض يوم وليلة، وأكثره خمسة عشر يوماً.',
    MALIKI: 'لا حد لأقل الحيض، وأكثره خمسة عشر يوماً.',
  };
  const visualPdf = await renderVisualPdf(
    'تقرير الحالة الفقهية',
    'ملخص منظم للحالة الحالية والبيانات المسجلة داخل نسوة.',
    [
      `تاريخ الإنشاء: ${format(new Date(), 'yyyy-MM-dd')} م`,
      `التاريخ الهجري: ${getHijriDate(new Date().toISOString())} هـ`,
      `المستخدمة: ${user?.anonymous_mode ? 'أخت' : (user?.display_name || 'أخت')}`,
      visualMadhhabNames[user?.madhhab] || visualMadhhabNames.HANBALI,
    ],
    [
      {
        title: 'العادة الحيضية',
        rows: [
          ['متوسط طول الدورة', `${visualAvgCycle} أيام`],
          ['متوسط مدة الحيض', `${visualAvgHaid} أيام`],
          ['انتظام الدورة', visualLedger.length > 1 ? 'منتظمة' : 'غير منتظمة بعد'],
        ],
      },
      {
        title: 'الحالة الحالية',
        rows: [['الحالة', visualStateNames[fiqhState] || 'طهارة']],
      },
      {
        title: 'ملاحظات فقهية',
        paragraphs: [visualFiqhNotes[user?.madhhab] || visualFiqhNotes.HANBALI],
      },
    ],
  );
  if (visualPdf) return visualPdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadArabicFont(doc);
  
  if (!fontLoaded) {
    // Absolute fallback: generate English-only PDF
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text('Niswah | Fiqh Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Report font unavailable. Please try again.', 105, 35, { align: 'center' });
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
  const visualLedger = ledger ?? [];
  const age = user?.birth_year ? new Date().getFullYear() - user.birth_year : '—';
  const visualPdf = await renderVisualPdf(
    'تقرير الدورة الطبية',
    'ملخص طبي مبسط للبيانات المسجلة، ولا يغني عن استشارة طبيبة أو طبيب مختص.',
    [
      `تاريخ الإصدار: ${format(new Date(), 'yyyy-MM-dd')}`,
      `المريضة: ${user?.anonymous_mode ? 'أخت' : (user?.display_name || 'أخت')}`,
      `العمر: ${age}`,
      `عدد السجلات: ${visualLedger.length}`,
    ],
    [
      {
        title: 'ملخص الدورة',
        rows: [
          ['متوسط طول الدورة', `${stats?.avgCycleLength || '28'} أيام`],
          ['متوسط مدة الحيض', `${stats?.avgHaidDuration || '7'} أيام`],
          ['درجة الانتظام', visualLedger.length > 1 ? 'عالية' : 'متوسطة'],
          ['أقصر دورة', `${stats?.shortestCycle || '28'} أيام`],
          ['أطول دورة', `${stats?.longestCycle || '28'} أيام`],
        ],
      },
      {
        title: 'آخر السجلات',
        paragraphs: visualLedger.length === 0
          ? ['لا توجد دورات مسجلة بعد.']
          : [...visualLedger]
            .sort((a, b) => new Date(b?.haid_start || 0).getTime() - new Date(a?.haid_start || 0).getTime())
            .slice(0, 6)
            .map((record: any) => {
              const start = safe(record?.haid_start?.split('T')[0]);
              const end = safe(record?.haid_end?.split('T')[0]);
              const days = `${((record?.haid_duration_hours ?? 0) / 24).toFixed(1)} يوم`;
              const note = record?.istihadah_episode ? 'استحاضة' : 'حيض';
              return `البداية: ${start} | النهاية: ${end} | المدة: ${days} | الملاحظة: ${note}`;
            }),
      },
    ],
  );
  if (visualPdf) return visualPdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadArabicFont(doc);

  if (!fontLoaded) {
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text('Niswah | Medical Cycle Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Report font unavailable. Please try again.', 105, 35, { align: 'center' });
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
  const visualStateNames: Record<string, string> = { HAID: 'حيض', TAHARA: 'طهارة', ISTIHADAH: 'استحاضة', NIFAS: 'نفاس' };
  const visualFertilityRange = fertilityStart && fertilityEnd
    ? `${format(fertilityStart, 'dd/MM/yyyy')} - ${format(fertilityEnd, 'dd/MM/yyyy')}`
    : 'غير محدد بعد';
  const visualPdf = await renderVisualPdf(
    'ملخص للزوج',
    'ملخص خاص وسري أُعد بموافقة الزوجة عبر تطبيق نسوة.',
    [
      `تاريخ التقرير: ${format(new Date(), 'yyyy-MM-dd')}`,
      `الحالة الحالية: ${visualStateNames[fiqhState] || 'طهارة'}`,
      `اليوم من الدورة: ${currentDay || 1}`,
      `الحيض المتوقع القادم: ${nextPeriodDate ? format(nextPeriodDate, 'dd/MM/yyyy') : 'غير محدد بعد'}`,
    ],
    [
      {
        title: 'الأيام القادمة',
        rows: [
          ['نافذة الخصوبة', visualFertilityRange],
          ['موعد انتهاء الدورة المتوقع', nextPeriodDate ? format(nextPeriodDate, 'dd/MM/yyyy') : 'غير محدد بعد'],
        ],
      },
      {
        title: 'ملاحظة شرعية',
        paragraphs: [
          'وفقاً للفقه الإسلامي، يُحرم الجماع خلال فترة الحيض.',
          'جزاك الله خيراً على اهتمامك بصحة زوجتك.',
        ],
      },
    ],
  );
  if (visualPdf) return visualPdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadArabicFont(doc);

  if (!fontLoaded) {
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text('Niswah | Summary for Husband', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Report font unavailable. Please try again.', 105, 35, { align: 'center' });
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
