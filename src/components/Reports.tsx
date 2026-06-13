import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { differenceInCalendarDays, format } from 'date-fns';
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

const daysPhrase = (days: number): string => {
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  if (days <= 10) return `${days} أيام`;
  return `${days} يوماً`;
};

const stateLabel = (state: any): string => ({
  HAID: 'حيض',
  TAHARA: 'طهارة',
  ISTIHADAH: 'استحاضة',
  NIFAS: 'نفاس',
}[state] || 'غير محدد');

const moodLabel = (mood: any): string => {
  const labels = ['حزين', 'عادي', 'سعيد', 'مبتهج', 'غاضب'];
  const index = Number.isFinite(Number(mood)) ? Number(mood) : 2;
  return labels[index] || 'غير محدد';
};

const symptomLabel = (key: string): string => ({
  cramps: 'تقلصات',
  mood: 'تقلبات مزاجية',
  headache: 'صداع',
  bloating: 'انتفاخ',
  backache: 'ألم الظهر',
  nausea: 'غثيان',
  fatigue: 'تعب',
  acne: 'حبوب البشرة',
  tender_breasts: 'ألم/حساسية الثدي',
}[key] || key);

const hasMentalEntryData = (entry: any): boolean => Boolean(
  entry?.feeling ||
  entry?.notes ||
  entry?.mood !== undefined ||
  entry?.sleep_quality !== undefined ||
  entry?.energy_level !== undefined ||
  (entry?.symptoms && Object.values(entry.symptoms).some(value => Number(value) > 0))
);

const averageScore = (entries: any[], key: 'energy_level' | 'sleep_quality'): string => {
  const values = entries
    .map(entry => Number(entry?.[key]))
    .filter(value => Number.isFinite(value) && value > 0);
  if (values.length === 0) return '—';
  return `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}/5`;
};

const countBy = <T extends string>(values: T[]): Record<T, number> => values.reduce((acc, value) => {
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {} as Record<T, number>);

const topEntries = (counts: Record<string, number>, limit = 3): string[] => Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, limit)
  .map(([label, count]) => `${label} (${count})`);

const includesAny = (text: string, words: string[]) => words.some(word => text.includes(word));

const buildNotePatternInsights = (entries: any[]): string[] => {
  const noteText = entries
    .map(entry => `${entry?.feeling || ''} ${entry?.notes || ''}`)
    .join(' ')
    .toLowerCase();

  const insights: string[] = [];
  if (includesAny(noteText, ['نوم', 'سهر', 'متأخر', 'تعبت', 'تعب'])) {
    insights.push('ملاحظاتك تلمّح إلى أن النوم والسهر يؤثران على طاقتك ومزاجك. جرّبي وقت تهدئة ثابت قبل النوم ولو لعشرين دقيقة.');
  }
  if (includesAny(noteText, ['ماء', 'شرب', 'جفاف', 'صداع'])) {
    insights.push('تكرر في الملاحظات ما يرتبط بالماء أو الصداع. تذكير لطيف بالماء ووجبة خفيفة قد يجعل اليوم أهدأ.');
  }
  if (includesAny(noteText, ['ظهر', 'بطن', 'ألم', 'تقلص'])) {
    insights.push('ظهرت إشارات ألم في الملاحظات. إن تكررت، سجّلي وقتها وشدتها وما سبقها؛ هذا يساعدك ويساعد الطبيبة عند الحاجة.');
  }
  if (includesAny(noteText, ['قلق', 'توتر', 'خوف', 'ضيق', 'حساسة'])) {
    insights.push('عند القلق أو الحساسية، لا تضغطي على نفسك. سجّلي الشعور، خذي نفساً هادئاً، واطلبي دعماً لطيفاً من شخص آمن.');
  }
  if (includesAny(noteText, ['ذكر', 'دعاء', 'صلاة', 'مشي', 'راحة', 'تنفس'])) {
    insights.push('جميل أنك تلاحظين ما يخفف عليك؛ الذكر، التنفس، المشي الخفيف أو الراحة ظهرت كأدوات دعم في سجلك.');
  }

  return insights.length > 0
    ? insights
    : ['ملاحظاتك المكتوبة هي أهم جزء في التقرير. كلما كتبتِ بجملة قصيرة عمّا ساعدك أو أتعبك، صار التقرير أقدر على فهم نمطك بلطف.'];
};

const buildCycleAwareInsight = (entry: any, user: any): string => {
  if (user?.pregnant) {
    return 'بما أنك في وضع الحمل، اربطي بين المزاج والنوم والأعراض والحركة أو الزيارات الطبية. أي نزيف، ألم شديد، نقص واضح في حركة الجنين، أو أفكار إيذاء النفس يحتاج تواصلاً طبياً فورياً.';
  }

  switch (entry?.fiqh_state) {
    case 'HAID':
      return 'آخر متابعة كانت أثناء الحيض. في الشهر القادم، جهّزي أيام الحيض براحة أكثر، ماء، مسكن مناسب إن كانت الطبيبة تسمح، ومساحة نفسية أخف بدون لوم.';
    case 'TAHARA':
      return 'آخر متابعة كانت في الطهارة. هذه فترة مناسبة لفهم طاقتك الطبيعية ومزاجك خارج أيام الدم، وهذا يساعد نسوة على تمييز التغيرات قبل الحيض.';
    case 'ISTIHADAH':
      return 'ظهرت حالة استحاضة في السجل. احتفظي بملاحظات واضحة عن اللون والكمية والمدة، واسألي أهل العلم أو الطبيبة عند الالتباس.';
    case 'NIFAS':
      return 'آخر متابعة كانت في النفاس. ركزي على التعافي، النوم قدر الإمكان، الدعم القريب، ومراجعة الطبيبة عند النزيف الشديد أو الحزن العميق المستمر.';
    default:
      return 'كل متابعة تضيف قطعة صغيرة للصورة: الحالة، النوم، الطاقة، المزاج، والأعراض معاً تعطينا فهماً أصدق من رقم واحد.';
  }
};

const buildMentalStateSections = (entries: any[] = [], user: any = null): ReportSection[] => {
  const mentalEntries = [...entries]
    .filter(hasMentalEntryData)
    .sort((a, b) => new Date(b?.time_logged || b?.date || 0).getTime() - new Date(a?.time_logged || a?.date || 0).getTime());

  if (mentalEntries.length === 0) return [];

  const latest = mentalEntries[0];
  const datedEntries = mentalEntries
    .map(entry => entry?.date || entry?.time_logged)
    .filter(Boolean)
    .sort();
  const startDate = datedEntries[0] || '—';
  const endDate = datedEntries[datedEntries.length - 1] || '—';
  const moodCounts = countBy(mentalEntries.map(entry => moodLabel(entry?.mood)));
  const stateCounts = countBy(mentalEntries.map(entry => stateLabel(entry?.fiqh_state)));
  const lowSleepDays = mentalEntries.filter(entry => Number(entry?.sleep_quality) > 0 && Number(entry.sleep_quality) <= 2).length;
  const lowEnergyDays = mentalEntries.filter(entry => Number(entry?.energy_level) > 0 && Number(entry.energy_level) <= 2).length;
  const stableDays = mentalEntries.filter(entry => [2, 3].includes(Number(entry?.mood)) && Number(entry?.energy_level || 0) >= 3).length;
  const lowSleepLowEnergy = mentalEntries.filter(entry => Number(entry?.sleep_quality) <= 2 && Number(entry?.energy_level) <= 2).length;
  const activeSymptoms = latest?.symptoms
    ? Object.entries(latest.symptoms)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => `${symptomLabel(key)} (${value}/3)`)
    : [];
  const symptomCounts = mentalEntries.reduce((acc: Record<string, number>, entry) => {
    Object.entries(entry?.symptoms || {}).forEach(([key, value]) => {
      if (Number(value) > 0) acc[symptomLabel(key)] = (acc[symptomLabel(key)] || 0) + 1;
    });
    return acc;
  }, {});
  const mostCommonSymptoms = topEntries(symptomCounts).join('، ') || 'لا توجد أعراض متكررة واضحة';
  const noteInsights = buildNotePatternInsights(mentalEntries);
  const cycleInsight = buildCycleAwareInsight(latest, user);
  const trendInsight = lowSleepLowEnergy > 0
    ? `في ${daysPhrase(lowSleepLowEnergy)} ظهر انخفاض النوم والطاقة معاً. هذا لا يعني تشخيصاً، لكنه وقت مناسب لتخفيف المهام وطلب المساندة.`
    : 'لم يظهر تكرار واضح لاجتماع انخفاض النوم والطاقة، وهذا مؤشر مطمئن نسبياً مع استمرار التسجيل.';

  return [
    {
      title: 'ملخص الشهر',
      rows: [
        ['الفترة التي يغطيها التقرير', `${safe(startDate)} إلى ${safe(endDate)}`],
        ['عدد المتابعات', `${mentalEntries.length}`],
        ['متوسط الطاقة', averageScore(mentalEntries, 'energy_level')],
        ['متوسط النوم', averageScore(mentalEntries, 'sleep_quality')],
        ['أيام مستقرة نسبياً', `${stableDays}`],
        ['أيام نوم منخفض', `${lowSleepDays}`],
        ['أيام طاقة منخفضة', `${lowEnergyDays}`],
        ['أكثر الحالات ظهوراً', topEntries(stateCounts).join('، ') || '—'],
      ],
    },
    {
      title: 'آخر متابعة',
      rows: [
        ['التاريخ', safe(latest?.date)],
        ['حالة الدورة', stateLabel(latest?.fiqh_state)],
        ['المزاج', moodLabel(latest?.mood)],
        ['الطاقة', latest?.energy_level ? `${latest.energy_level}/5` : '—'],
        ['النوم', latest?.sleep_quality ? `${latest.sleep_quality}/5` : '—'],
        ['الأعراض الظاهرة', activeSymptoms.length > 0 ? activeSymptoms.join('، ') : 'لا توجد أعراض مسجلة في آخر متابعة'],
      ],
      paragraphs: [
        latest?.feeling ? `ملاحظة شعورية: ${latest.feeling}` : '',
        latest?.notes ? `ملاحظاتك: ${latest.notes}` : '',
      ].filter(Boolean),
    },
    {
      title: 'ما فهمته نسوة من سجلك',
      paragraphs: [
        `أكثر المزاجات ظهوراً: ${topEntries(moodCounts).join('، ') || 'لا يوجد نمط واضح بعد'}.`,
        `أكثر الأعراض تكراراً: ${mostCommonSymptoms}.`,
        trendInsight,
        cycleInsight,
        ...noteInsights,
      ],
    },
    {
      title: 'خطة لطيفة للشهر القادم',
      paragraphs: [
        'اختاري عادة صغيرة واحدة فقط للأسبوع القادم: نوم أهدأ، ماء أكثر، مشي خفيف، أو ملاحظة قصيرة قبل النوم.',
        'إذا تكرر عرض معيّن، سجّلي معه ثلاثة أشياء: النوم، الماء، وما الذي كان يحدث في يومك. هذا يجعل النمط أوضح بدون قسوة على نفسك.',
        'عند أيام الحساسية أو القلق: خذي مساحة، اذكري الله بما يطمئنك، واطلبي دعماً آمناً. لست مطالبة بأن تكوني قوية كل الوقت.',
      ],
    },
    {
      title: 'متى تطلبين دعماً؟',
      paragraphs: [
        'راجعي الطبيبة عند ألم شديد أو متكرر، نزيف غير معتاد، دوخة شديدة، أو أعراض تعطل يومك.',
        'اطلبي مساندة نفسية فوراً إذا ظهرت أفكار إيذاء النفس، حزن عميق مستمر، نوبات هلع، أو شعور بعدم الأمان.',
        'هذا التقرير يساعدك على التنظيم وفهم النمط، ولا يقدم تشخيصاً طبياً أو فتوى شخصية.',
      ],
    },
    {
      title: 'تفاصيل المتابعة اليومية',
      paragraphs: mentalEntries.slice(0, 8).map(entry => {
        const date = safe(entry?.date);
        const mood = moodLabel(entry?.mood);
        const energy = entry?.energy_level ? `${entry.energy_level}/5` : '—';
        const sleep = entry?.sleep_quality ? `${entry.sleep_quality}/5` : '—';
        const state = stateLabel(entry?.fiqh_state);
        const note = entry?.feeling || entry?.notes ? `\nملاحظة: ${safe(entry?.feeling || entry?.notes)}` : '';
        return `${date}\n${state} · المزاج: ${mood}\nالطاقة: ${energy} · النوم: ${sleep}${note}`;
      }),
    },
  ];
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

const estimateSectionWeight = (section: ReportSection): number => {
  const rowWeight = (section.rows?.length || 0) * 0.75;
  const paragraphWeight = (section.paragraphs || []).reduce((sum, paragraph) => (
    sum + 0.85 + Math.ceil(paragraph.length / 150) * 0.45
  ), 0);
  return 1.1 + rowWeight + paragraphWeight;
};

const paginateReportSections = (sections: ReportSection[]): ReportSection[][] => {
  const pages: ReportSection[][] = [];
  let currentPage: ReportSection[] = [];
  let currentWeight = 0;

  sections.forEach(section => {
    const sectionWeight = estimateSectionWeight(section);
    const maxWeight = pages.length === 0 ? 9.2 : 10.2;
    if (currentPage.length > 0 && currentWeight + sectionWeight > maxWeight) {
      pages.push(currentPage);
      currentPage = [];
      currentWeight = 0;
    }
    currentPage.push(section);
    currentWeight += sectionWeight;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages.length > 0 ? pages : [[]];
};

const buildReportPage = (
  title: string,
  subtitle: string,
  meta: string[],
  sections: ReportSection[],
  pageNumber = 1,
  totalPages = 1,
) => {
  const page = document.createElement('div');
  page.dir = 'rtl';
  page.style.cssText = [
    'position:fixed',
    'left:0',
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
    'pointer-events:none',
    'z-index:-1',
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
    .meta div, .row { background:#ffffff; border:1px solid #f1dbe3; border-radius:14px; padding:12px 16px; font-size:15px; }
    .row { display:grid; grid-template-columns:minmax(150px, 190px) minmax(0, 1fr); gap:18px; margin-bottom:10px; direction:rtl; text-align:right; align-items:start; }
    .label { color:#8f1d42; font-weight:800; }
    .value { color:#374151; overflow-wrap:anywhere; word-break:normal; line-height:1.9; }
    .note { background:#f8fafc; border:1px solid #e5e7eb; border-radius:16px; padding:14px 16px; margin-bottom:11px; font-size:15px; color:#374151; direction:rtl; text-align:right; line-height:1.95; overflow-wrap:anywhere; white-space:pre-line; }
    .footer { position:absolute; bottom:36px; left:56px; right:56px; text-align:center; color:#9ca3af; font-size:13px; border-top:1px solid #f3f4f6; padding-top:14px; }
  `;
  page.appendChild(style);

  if (meta.length > 0) {
    const metaWrap = document.createElement('div');
    metaWrap.className = 'meta';
    meta.forEach(item => appendText(metaWrap, 'div', item));
    page.appendChild(metaWrap);
  }

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

  appendText(page, 'div', `تم إنشاء هذا التقرير بواسطة تطبيق نسوة · PDF v3 · صفحة ${pageNumber} من ${totalPages}`, 'footer');
  return page;
};

const renderVisualPdf = async (title: string, subtitle: string, meta: string[], sections: ReportSection[]): Promise<Blob | null> => {
  if (!canUseVisualPdf()) return null;

  try {
    const pages = paginateReportSections(sections);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (const [index, pageSections] of pages.entries()) {
      const page = buildReportPage(
        title,
        index === 0 ? subtitle : 'متابعة التقرير والرؤى المرتبطة بسجلك.',
        index === 0 ? meta : [],
        pageSections,
        index + 1,
        pages.length,
      );
      document.body.appendChild(page);

      try {
        const canvas = await html2canvas(page, {
          backgroundColor: '#fffdfb',
          scale: Math.min(2, window.devicePixelRatio || 1.5),
          useCORS: true,
          logging: false,
        });
        if (index > 0) doc.addPage();
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      } finally {
        page.remove();
      }
    }

    return doc.output('blob');
  } catch (err) {
    console.warn('Visual PDF rendering failed; falling back to text PDF:', err);
    return null;
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

export const generateDoctorPDF = async (user: any, ledger: any[], stats: any, entries: any[] = []): Promise<Blob> => {
  const visualLedger = ledger ?? [];
  const mentalSections = buildMentalStateSections(entries, user);
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
      ...mentalSections,
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

  const mentalEntries = [...(entries || [])]
    .filter(hasMentalEntryData)
    .sort((a, b) => new Date(b?.time_logged || b?.date || 0).getTime() - new Date(a?.time_logged || a?.date || 0).getTime())
    .slice(0, 4);

  if (mentalEntries.length > 0 && y < 245) {
    doc.setTextColor(6, 95, 70);
    R(doc, 'متابعة الحالة النفسية والطاقة', right, y, 13); y += 7;
    doc.setTextColor(55, 65, 81);

    mentalEntries.forEach((entry: any) => {
      const activeSymptoms = entry?.symptoms
        ? Object.entries(entry.symptoms)
          .filter(([, value]) => Number(value) > 0)
          .map(([key, value]) => `${symptomLabel(key)} ${value}/3`)
        : [];
      R(doc, `${safe(entry?.date)}: المزاج ${moodLabel(entry?.mood)} | الطاقة ${entry?.energy_level || '—'}/5 | النوم ${entry?.sleep_quality || '—'}/5`, right, y, 9); y += 5;
      if (entry?.feeling && y < 262) {
        R(doc, `ملاحظة: ${entry.feeling}`, right, y, 8); y += 5;
      }
      if (activeSymptoms.length > 0 && y < 262) {
        R(doc, `الأعراض: ${activeSymptoms.join('، ')}`, right, y, 8); y += 5;
      }
    });

    y += 3;
    doc.line(15, y, right, y); y += 6;
  }

  doc.setTextColor(150, 150, 150);
  R(doc, 'تم إنشاء هذا التقرير بواسطة تطبيق نسوة. يرجى استشارة طبيب مؤهل للتشخيص الطبي.', W / 2, 285, 8, 'center');

  return doc.output('blob');
};

export const generateMentalStatePDF = async (user: any, entries: any[] = []): Promise<Blob> => {
  const mentalEntries = [...entries]
    .filter(hasMentalEntryData)
    .sort((a, b) => new Date(b?.time_logged || b?.date || 0).getTime() - new Date(a?.time_logged || a?.date || 0).getTime());
  const mentalSections = buildMentalStateSections(mentalEntries, user);
  const visualPdf = await renderVisualPdf(
    'تقرير الحالة النفسية',
    'ملخص خاص لمتابعة المزاج والطاقة والنوم والأعراض اليومية المسجلة.',
    [
      `تاريخ الإصدار: ${format(new Date(), 'yyyy-MM-dd')}`,
      `المستخدمة: ${user?.anonymous_mode ? 'أخت' : (user?.display_name || 'أخت')}`,
      `عدد المتابعات: ${mentalEntries.length}`,
    ],
    mentalSections.length > 0
      ? mentalSections
      : [{
        title: 'لا توجد متابعات نفسية بعد',
        paragraphs: [
          'ابدئي من صفحة اليوم أثناء حالة الطهارة عبر بطاقة “كيف نفسيتك اليوم؟”.',
          'بعد التسجيل سيظهر هنا ملخص المزاج والطاقة والنوم والأعراض.',
        ],
      }],
  );
  if (visualPdf) return visualPdf;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadArabicFont(doc);

  if (!fontLoaded) {
    doc.setFont('helvetica');
    doc.setFontSize(14);
    doc.text('Niswah | Mental State Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Report font unavailable. Please try again.', 105, 35, { align: 'center' });
    return doc.output('blob');
  }

  const W = doc.internal.pageSize.getWidth();
  const right = W - 15;
  let y = 20;

  doc.setTextColor(6, 95, 70);
  R(doc, 'Niswah | نسوة', right, y, 20); y += 9;
  R(doc, 'تقرير الحالة النفسية', right, y, 14); y += 7;

  doc.setTextColor(100, 100, 100);
  R(doc, `تاريخ الإصدار: ${format(new Date(), 'yyyy-MM-dd')}`, right, y, 9); y += 5;
  R(doc, `المستخدمة: ${user?.anonymous_mode ? 'أخت' : (user?.display_name || 'أخت')}`, right, y, 9); y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, right, y); y += 8;

  if (mentalEntries.length === 0) {
    doc.setTextColor(55, 65, 81);
    R(doc, 'لا توجد متابعات نفسية مسجلة بعد.', right, y, 10); y += 6;
    R(doc, 'ابدئي من صفحة اليوم أثناء حالة الطهارة عبر بطاقة كيف نفسيتك اليوم؟', right, y, 9);
  } else {
    mentalEntries.slice(0, 8).forEach((entry: any) => {
      const activeSymptoms = entry?.symptoms
        ? Object.entries(entry.symptoms)
          .filter(([, value]) => Number(value) > 0)
          .map(([key, value]) => `${symptomLabel(key)} ${value}/3`)
        : [];
      doc.setTextColor(6, 95, 70);
      R(doc, safe(entry?.date), right, y, 11); y += 6;
      doc.setTextColor(55, 65, 81);
      R(doc, `المزاج ${moodLabel(entry?.mood)} | الطاقة ${entry?.energy_level || '—'}/5 | النوم ${entry?.sleep_quality || '—'}/5`, right, y, 9); y += 5;
      if (entry?.feeling && y < 270) {
        R(doc, `ملاحظة: ${entry.feeling}`, right, y, 8); y += 5;
      }
      if (activeSymptoms.length > 0 && y < 270) {
        R(doc, `الأعراض: ${activeSymptoms.join('، ')}`, right, y, 8); y += 5;
      }
      y += 3;
      if (y > 260) return;
    });
  }

  doc.setTextColor(150, 150, 150);
  R(doc, 'تم إنشاء هذا التقرير بواسطة تطبيق نسوة.', W / 2, 285, 8, 'center');

  return doc.output('blob');
};

export const generatePregnancyPDF = async (user: any, pregnancyRecord: any): Promise<Blob> => {
  const currentWeek = Math.min(40, Math.max(1, Math.round(pregnancyRecord?.current_week || user?.pregnancy_week || 1)));
  const trimester = Math.min(3, Math.max(1, Math.ceil(currentWeek / 13)));
  const dueDate = pregnancyRecord?.due_date ? new Date(pregnancyRecord.due_date) : null;
  const lmpDate = pregnancyRecord?.lmp_date ? new Date(pregnancyRecord.lmp_date) : null;
  const today = new Date();
  const daysRemaining = dueDate ? Math.max(0, differenceInCalendarDays(dueDate, today)) : Math.max(0, (40 - currentWeek) * 7);
  const weeksRemaining = Math.max(0, 40 - currentWeek);
  const dashboardNotes = pregnancyRecord?.weekly_notes?.dashboard || {};
  const movementLogs = Array.isArray(dashboardNotes?.movementLogs) ? dashboardNotes.movementLogs : [];
  const todayMovements = movementLogs.filter((log: any) => {
    if (!log?.at) return false;
    return new Date(log.at).toDateString() === today.toDateString();
  }).length;
  const lastMovement = movementLogs[movementLogs.length - 1]?.at
    ? format(new Date(movementLogs[movementLogs.length - 1].at), 'yyyy-MM-dd HH:mm')
    : 'لا يوجد تسجيل بعد';
  const visitRhythm = currentWeek < 28
    ? 'زيارة متابعة كل 4 أسابيع تقريباً، أو حسب توجيه الطبيبة.'
    : currentWeek < 36
      ? 'زيارة متابعة كل أسبوعين تقريباً، أو حسب توجيه الطبيبة.'
      : 'متابعة أسبوعية غالباً حتى الولادة، أو حسب توجيه الطبيبة.';
  const stage = currentWeek <= 13
    ? 'الثلث الأول: تثبيت الحمل وبداية تكوّن الأعضاء.'
    : currentWeek <= 27
      ? 'الثلث الثاني: نمو أوضح وحركة قد تصبح ملحوظة.'
      : 'الثلث الثالث: استعداد للولادة ومتابعة الحركة والنمو.';

  const visualPdf = await renderVisualPdf(
    'تقرير الحمل',
    'ملخص صحي وتنظيمي للحمل من نسوة، لا يغني عن متابعة الطبيبة أو القابلة.',
    [
      `تاريخ التقرير: ${format(today, 'yyyy-MM-dd')}`,
      `المستخدمة: ${user?.anonymous_mode ? 'أخت' : (user?.display_name || 'أخت')}`,
      `الأسبوع الحالي: ${currentWeek}`,
      `الثلث: ${trimester}`,
    ],
    [
      {
        title: 'ملخص الحمل',
        rows: [
          ['تاريخ آخر دورة مقدر', lmpDate ? format(lmpDate, 'yyyy-MM-dd') : 'غير محدد'],
          ['موعد الولادة المتوقع', dueDate ? format(dueDate, 'yyyy-MM-dd') : 'غير محدد'],
          ['المتبقي حتى الموعد', `${daysPhrase(daysRemaining)} تقريباً`],
          ['الأسابيع المتبقية', `${weeksRemaining} أسبوع تقريباً`],
          ['مرحلة الحمل', stage],
        ],
      },
      {
        title: 'حركة الجنين والمتابعة',
        rows: [
          ['حركات مسجلة اليوم', currentWeek < 20 ? 'قد لا تكون الحركة واضحة قبل الأسبوع 20' : `${todayMovements}`],
          ['آخر تسجيل حركة', currentWeek < 20 ? 'غير مطلوب حالياً' : lastMovement],
          ['إيقاع الزيارات المتوقع', visitRhythm],
        ],
        paragraphs: [
          'راقبي النمط المعتاد لحركة الجنين عندما تصبح الحركة واضحة، وراجعي الطبيبة عند نقص واضح أو مفاجئ.',
          'اكتبي أسئلتك قبل الزيارة: النزيف، الألم، الحركة، الأدوية، الصيام، الصلاة، والولادة.',
        ],
      },
      {
        title: 'ملاحظات مهمة للمسلمة',
        paragraphs: [
          'الأصل أداء الصلاة حسب القدرة، ومع المشقة تأخذ المرأة بالهيئة الأيسر لها بحسب الاستطاعة وتسأل أهل العلم الموثوقين في التفاصيل.',
          'الصيام أثناء الحمل يحتاج تقدير القدرة والمشقة ورأي الطبيبة، خصوصاً مع الجفاف، القيء، الدوخة، أو وجود خطورة طبية.',
          'بعد الولادة يبدأ تتبع النفاس في نسوة لتسهيل معرفة المدة والتنبيهات المتعلقة بالطهارة.',
        ],
      },
      {
        title: 'متى تطلبين رعاية عاجلة؟',
        paragraphs: [
          'نزيف، ألم شديد، نقص واضح في حركة الجنين، صداع شديد مع زغللة، تورم مفاجئ، ألم صدر، ضيق نفس شديد، حرارة عالية، أو أفكار إيذاء النفس.',
          'هذا التقرير للتنظيم والمشاركة ولا يقدم تشخيصاً طبياً.',
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
    doc.text('Niswah | Pregnancy Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Week: ${currentWeek}`, 105, 40, { align: 'center' });
    doc.text(`Due date: ${dueDate ? format(dueDate, 'yyyy-MM-dd') : 'Unknown'}`, 105, 50, { align: 'center' });
    doc.text('This report does not replace medical care.', 105, 65, { align: 'center' });
    return doc.output('blob');
  }

  const W = doc.internal.pageSize.getWidth();
  const right = W - 15;
  let y = 20;

  doc.setTextColor(6, 95, 70);
  R(doc, 'Niswah | نسوة', right, y, 20); y += 9;
  R(doc, 'تقرير الحمل', right, y, 14); y += 7;
  doc.setTextColor(100, 100, 100);
  R(doc, `تاريخ التقرير: ${format(today, 'yyyy-MM-dd')}`, right, y, 9); y += 5;
  R(doc, `الأسبوع الحالي: ${currentWeek} | الثلث: ${trimester}`, right, y, 9); y += 8;
  doc.line(15, y, right, y); y += 8;

  doc.setTextColor(6, 95, 70);
  R(doc, 'ملخص الحمل', right, y, 13); y += 7;
  doc.setTextColor(55, 65, 81);
  R(doc, `موعد الولادة المتوقع: ${dueDate ? format(dueDate, 'yyyy-MM-dd') : 'غير محدد'}`, right, y, 10); y += 6;
  R(doc, `المتبقي حتى الموعد: ${daysPhrase(daysRemaining)} تقريباً`, right, y, 10); y += 6;
  R(doc, stage, right, y, 10); y += 10;

  doc.setTextColor(6, 95, 70);
  R(doc, 'المتابعة والتنبيهات', right, y, 13); y += 7;
  doc.setTextColor(55, 65, 81);
  R(doc, visitRhythm, right, y, 10); y += 6;
  R(doc, currentWeek < 20 ? 'حركة الجنين قد لا تكون واضحة قبل الأسبوع 20.' : `حركات اليوم: ${todayMovements} | آخر تسجيل: ${lastMovement}`, right, y, 10); y += 10;

  doc.setTextColor(6, 95, 70);
  R(doc, 'ملاحظات مهمة', right, y, 13); y += 7;
  doc.setTextColor(55, 65, 81);
  R(doc, 'الصلاة حسب القدرة، والصيام بحسب القدرة والمشقة ورأي الطبيبة عند الحاجة.', right, y, 10); y += 6;
  R(doc, 'راجعي الرعاية الطبية فوراً عند النزيف أو الألم الشديد أو نقص حركة الجنين.', right, y, 10);

  doc.setTextColor(150, 150, 150);
  R(doc, 'تم إنشاء هذا التقرير بواسطة تطبيق نسوة. لا يغني عن المتابعة الطبية.', W / 2, 285, 8, 'center');

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
  const today = new Date();
  const daysUntilPeriod = nextPeriodDate ? differenceInCalendarDays(nextPeriodDate, today) : null;
  const daysUntilFertility = fertilityStart ? differenceInCalendarDays(fertilityStart, today) : null;
  const fertilityEndsIn = fertilityEnd ? differenceInCalendarDays(fertilityEnd, today) : null;
  const visualFertilityRange = fertilityStart && fertilityEnd
    ? `${format(fertilityStart, 'dd/MM/yyyy')} - ${format(fertilityEnd, 'dd/MM/yyyy')}`
    : 'غير محدد بعد';
  const waitingGuidance = fiqhState === 'HAID'
    ? 'الحالة الآن حيض، يلزم الانتظار حتى حصول الطهر والاغتسال قبل المعاشرة.'
    : fiqhState === 'NIFAS'
      ? 'الحالة الآن نفاس، يلزم الانتظار حتى حصول الطهر والاغتسال قبل المعاشرة.'
      : fiqhState === 'ISTIHADAH'
        ? 'الحالة الآن استحاضة، راجعوا الحكم الفقهي المناسب للحالة والمذهب.'
        : 'الحالة الآن طهارة، ولا يظهر منع متعلق بالحيض حسب البيانات الحالية.';
  const periodGuidance = daysUntilPeriod === null
    ? 'لا يوجد موعد موثوق للحيض القادم بعد.'
    : daysUntilPeriod > 0
      ? `متوقع بدء الحيض القادم بعد حوالي ${daysPhrase(daysUntilPeriod)}.`
      : daysUntilPeriod === 0
        ? 'قد يبدأ الحيض المتوقع اليوم حسب بيانات التطبيق.'
        : 'موعد الحيض المتوقع السابق قد مر، يرجى تحديث السجلات إذا تغيرت الحالة.';
  const fertilityGuidance = daysUntilFertility === null || fertilityEndsIn === null
    ? 'نافذة الخصوبة غير محددة بعد لعدم كفاية البيانات.'
    : daysUntilFertility > 0
      ? `تبدأ نافذة الخصوبة المتوقعة بعد ${daysPhrase(daysUntilFertility)} وتستمر تقريباً حتى ${format(fertilityEnd!, 'dd/MM/yyyy')}.`
      : fertilityEndsIn >= 0
        ? `نافذة الخصوبة المتوقعة نشطة الآن، وتنتهي تقريباً بعد ${daysPhrase(fertilityEndsIn)}.`
        : 'نافذة الخصوبة المتوقعة لهذه الدورة انتهت حسب البيانات الحالية.';
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
        title: 'الخلاصة العملية',
        paragraphs: [
          waitingGuidance,
          periodGuidance,
          fertilityGuidance,
          'يرجى مراجعة التطبيق عند تغير الحالة أو نزول دم جديد، لأن الأحكام والتوقعات تعتمد على آخر تسجيل.',
        ],
      },
      {
        title: 'الأيام القادمة',
        rows: [
          ['نافذة الخصوبة المتوقعة', visualFertilityRange],
          ['الحيض المتوقع القادم', nextPeriodDate ? format(nextPeriodDate, 'dd/MM/yyyy') : 'غير محدد بعد'],
          ['متى يلزم الانتباه؟', daysUntilPeriod !== null && daysUntilPeriod > 0 ? `بعد حوالي ${daysPhrase(daysUntilPeriod)}` : periodGuidance],
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
  R(doc, waitingGuidance, right, y, 10); y += 6;
  R(doc, periodGuidance, right, y, 10); y += 10;

  doc.setTextColor(6, 95, 70);
  R(doc, 'الأيام القادمة', right, y, 13); y += 7;

  doc.setTextColor(55, 65, 81);
  R(doc, `الحيض المتوقع القادم: ${nextPeriodDate ? format(nextPeriodDate, 'dd/MM/yyyy') : 'غير محدد بعد'}`, right, y, 10); y += 6;
  const fertilityRange = fertilityStart && fertilityEnd
    ? `${format(fertilityStart, 'dd/MM/yyyy')} - ${format(fertilityEnd, 'dd/MM/yyyy')}`
    : 'غير محدد بعد';
  R(doc, `نافذة الخصوبة: ${fertilityRange}`, right, y, 10); y += 6;
  R(doc, fertilityGuidance, right, y, 10); y += 10;

  doc.setTextColor(6, 95, 70);
  R(doc, 'ملاحظة شرعية', right, y, 13); y += 7;

  doc.setTextColor(55, 65, 81);
  R(doc, 'وفقاً للفقه الإسلامي، يُحرم الجماع خلال فترة الحيض.', right, y, 10); y += 6;
  R(doc, 'جزاك الله خيراً على اهتمامك بصحة زوجتك.', right, y, 10); y += 10;

  doc.setTextColor(150, 150, 150);
  R(doc, 'هذا التقرير خاص وسري — أُعد بموافقة الزوجة عبر تطبيق نسوة', W / 2, 285, 8, 'center');

  return doc.output('blob');
};
