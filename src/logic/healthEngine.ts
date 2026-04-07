export interface HealthCondition {
  id: string;
  nameAr: string;
  nameEn: string;
  phase: 'before' | 'during' | 'after' | 'any';
  relatedSymptoms: string[];
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
  warningSign: string;
  requiresDoctor: boolean;
}

export const CONDITIONS: HealthCondition[] = [
  {
    id: 'primary_dysmenorrhea',
    nameAr: 'عسر الطمث الأولي',
    nameEn: 'Primary Dysmenorrhea',
    phase: 'during',
    relatedSymptoms: ['cramps', 'backache'],
    severity: 'medium',
    suggestions: [
      'كمادات دافئة على البطن والظهر',
      'إيبوبروفين 400mg قبل بدء الألم بساعة',
      'تمارين الاسترخاء واليوغا الخفيفة',
      'تقليل الكافيين والملح قبل الدورة بأسبوع',
      'المشي الخفيف يساعد على تخفيف التشنجات',
    ],
    warningSign: 'إذا كان الألم يمنعك من ممارسة أنشطتك اليومية أو لم يستجب للمسكنات',
    requiresDoctor: false,
  },
  {
    id: 'pms',
    nameAr: 'متلازمة ما قبل الحيض (PMS)',
    nameEn: 'Premenstrual Syndrome',
    phase: 'before',
    relatedSymptoms: ['mood', 'bloating', 'headache', 'breastpain', 'fatigue'],
    severity: 'low',
    suggestions: [
      'تقليل الملح والسكر والكافيين في الأسبوع الأخير',
      'ممارسة الرياضة المعتدلة بانتظام',
      'النوم الكافي (7-8 ساعات يومياً)',
      'مكمل المغنيسيوم قد يخفف الأعراض (استشيري طبيبتك)',
      'تدوين الأعراض يومياً لمعرفة النمط',
    ],
    warningSign: 'إذا أثرت الأعراض بشكل كبير على علاقاتك أو عملك (قد يكون PMDD)',
    requiresDoctor: false,
  },
  {
    id: 'menorrhagia',
    nameAr: 'غزارة الطمث',
    nameEn: 'Menorrhagia',
    phase: 'during',
    relatedSymptoms: ['heavy_flow', 'clots', 'fatigue'],
    severity: 'high',
    suggestions: [
      'تتبعي كمية النزيف بدقة (عدد الفوط في اليوم)',
      'الحديد والأطعمة الغنية به للوقاية من الأنيميا',
      'تجنبي الأسبرين (يزيد النزيف)',
      'الراحة الكافية وشرب السوائل',
    ],
    warningSign: 'نزيف يستلزم تغيير الفوطة كل ساعة أو أقل لعدة ساعات متتالية',
    requiresDoctor: true,
  },
  {
    id: 'pmdd',
    nameAr: 'الاضطراب المزعج السابق للحيض (PMDD)',
    nameEn: 'Premenstrual Dysphoric Disorder',
    phase: 'before',
    relatedSymptoms: ['mood', 'anxiety', 'depression', 'irritability'],
    severity: 'high',
    suggestions: [
      'توثيق الأعراض النفسية لمدة شهرين على الأقل',
      'تقنيات إدارة التوتر (التأمل، التنفس العميق)',
      'الدعم النفسي والحديث مع شخص موثوق',
      'تجنبي العزل الاجتماعي في هذه الفترة',
    ],
    warningSign: 'إذا شعرتِ بأفكار سلبية حادة أو عجز عن القيام بالحياة اليومية',
    requiresDoctor: true,
  },
  {
    id: 'endometriosis_suspected',
    nameAr: 'احتمال بطانة الرحم المهاجرة',
    nameEn: 'Suspected Endometriosis',
    phase: 'during',
    relatedSymptoms: ['cramps', 'backache', 'pain_intercourse', 'heavy_flow'],
    severity: 'high',
    suggestions: [
      'وثّقي الألم بدقة (الموقع، الشدة، المدة)',
      'الحرارة المحلية لتخفيف الألم المؤقت',
      'تجنبي الأنشطة الشاقة في ذروة الألم',
    ],
    warningSign: 'ألم شديد ومتكرر خاصة مع النزيف الغزير — يستلزم تصوير بالسونار',
    requiresDoctor: true,
  },
  {
    id: 'iron_deficiency',
    nameAr: 'نقص الحديد المرتبط بالحيض',
    nameEn: 'Menstrual Iron Deficiency',
    phase: 'after',
    relatedSymptoms: ['fatigue', 'dizziness', 'headache'],
    severity: 'medium',
    suggestions: [
      'تناولي الأطعمة الغنية بالحديد: العدس، السبانخ، اللحم الأحمر',
      'فيتامين C يساعد على امتصاص الحديد',
      'تجنبي الشاي والقهوة مع وجبات الحديد',
      'فحص دم شامل لقياس مستوى الهيموجلوبين',
    ],
    warningSign: 'إرهاق شديد مع شحوب واضح في الوجه والأظافر',
    requiresDoctor: false,
  },
  {
    id: 'pcos_suspected',
    nameAr: 'احتمال تكيس المبايض',
    nameEn: 'Suspected PCOS',
    phase: 'any',
    relatedSymptoms: ['irregular_cycle', 'heavy_flow', 'acne'],
    severity: 'high',
    suggestions: [
      'تتبعي انتظام الدورة لمدة 3 أشهر على الأقل',
      'الرياضة المنتظمة تساعد على تنظيم الهرمونات',
      'نظام غذائي منخفض السكر والكربوهيدرات المكررة',
    ],
    warningSign: 'دورة غير منتظمة بشكل متكرر مع زيادة الوزن أو نمو شعر زائد',
    requiresDoctor: true,
  },
];

export const analyzeSymptoms = (
  symptoms: Record<string, number>,
  cycleData: { avgCycleLength: number; isRegular: boolean; avgHaidDuration: number },
  fiqhState: string
): HealthCondition[] => {
  const activeSymptoms = Object.keys(symptoms).filter(k => symptoms[k] > 0);
  
  return CONDITIONS.filter(condition => {
    const matchCount = condition.relatedSymptoms.filter(s => 
      activeSymptoms.includes(s)
    ).length;
    return matchCount >= 1;
  }).sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
};

export const generateSmartAlerts = (
  ledger: any[],
  avgHaidDuration: number,
  avgCycleLength: number,
  symptomHistory: Record<string, number[]>
): Array<{ type: 'warning' | 'info' | 'success'; titleAr: string; bodyAr: string }> => {
  const alerts = [];
  
  // Check for repeated severe cramps
  const crampHistory = symptomHistory?.cramps || [];
  const severeCramps = crampHistory.filter(v => v >= 3).length;
  if (severeCramps >= 3) {
    alerts.push({
      type: 'warning' as const,
      titleAr: 'تشنجات متكررة لـ 3 دورات أو أكثر',
      bodyAr: 'يُنصح بمتابعة طبية للتأكد من السبب',
    });
  }
  
  // Check for long periods
  if (avgHaidDuration > 7) {
    alerts.push({
      type: 'warning' as const,
      titleAr: `مدة الحيض أطول من المعتاد (${avgHaidDuration.toFixed(0)} أيام)`,
      bodyAr: 'المعدل الطبيعي 3-7 أيام — استشيري طبيبتك',
    });
  }
  
  // Cycle regularity
  if (ledger.length >= 3 && avgCycleLength >= 21 && avgCycleLength <= 35) {
    alerts.push({
      type: 'success' as const,
      titleAr: 'انتظام الدورة ممتاز',
      bodyAr: `متوسط ${avgCycleLength} يوماً — ضمن النطاق الطبيعي`,
    });
  }
  
  return alerts;
};
