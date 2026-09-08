import { toFa } from '@/lib/utils'

/* ══════════════════════════════════════════════════════════════
   دامنه استعلام — نسخه ۳

   جریان سه‌مرحله‌ای: مشخصات پروژه و آسانسور ← لیست قطعات ←
   ارسال به شرکت پیمانکار.

   نکته کلیدی این نسخه: چند عدد مهم دیگر از کاربر پرسیده نمی‌شوند،
   بلکه از جدول توقف‌ها **محاسبه** می‌شوند — تعداد ورودی کابین،
   تعداد درب طبقات و کورس حرکت. این کار هم خطای انسانی را کم می‌کند
   و هم باعث می‌شود لیست قطعات با واقعیت چاه بخواند.
   ══════════════════════════════════════════════════════════════ */

/* ── کاربری پروژه ───────────────────────────────────────────── */
export type ProjectUsage = 'residential' | 'commercial' | 'hospital' | 'industrial'

export const usageLabel: Record<ProjectUsage, string> = {
  residential: 'مسکونی',
  commercial: 'اداری، تجاری و هتل',
  hospital: 'بیمارستانی',
  industrial: 'صنعتی',
}

/* ── مراحل انجام‌شده ────────────────────────────────────────── */
export const PROGRESS_STAGES = [
  { key: 'survey', label: 'برداشت و طراحی آسانسور' },
  { key: 'steelwork', label: 'آهنکشی' },
  { key: 'rails', label: 'ریل‌گذاری' },
  { key: 'doors', label: 'نصب درب' },
  { key: 'mechanical', label: 'مکانیک' },
  { key: 'revision', label: 'ریویزیون / کارگاهی' },
  { key: 'commissioning', label: 'راه‌اندازی' },
  // استاندارد عمداً قابل انتخاب نیست؛ نتیجه فرایند است نه مرحله‌ای که
  // کاربر خودش اعلام کند
  { key: 'standard', label: 'استاندارد', locked: true },
] as const

export type ProgressStage = (typeof PROGRESS_STAGES)[number]['key']

/* ── نماینده کارفرما ────────────────────────────────────────── */
export interface Representative {
  id: string
  name: string
  phone: string
  role: string
}

/* ── جدول توقف‌ها ───────────────────────────────────────────── */
export interface StopRow {
  /** ۰ = چاهک، ۱ تا n = توقف‌ها؛ بالاترین ردیف اورهد را هم نگه می‌دارد */
  index: number
  label: string
  /** ارتفاع سقف بر حسب سانتی‌متر */
  ceiling: number | null
  /**
   * فاصله تا طبقه بعد بر حسب سانتی‌متر.
   * در ردیف چاهک: ارتفاع چاهک. در بالاترین ردیف: ارتفاع اورهد.
   */
  height: number | null
  entryFront: boolean
  entryRear: boolean
  entrySide: boolean
}

/**
 * پر کردن خودکار یک ستون: مقدار داده‌شده روی همه ردیف‌هایی که هنوز
 * خالی‌اند می‌نشیند. ردیف چاهک و بالاترین ردیف (اورهد) کنار گذاشته
 * می‌شوند چون مقدارشان معنای دیگری دارد.
 */
export function autoFillColumn(
  rows: StopRow[],
  stops: number,
  field: 'ceiling' | 'height',
  value: number,
  onlyEmpty = true,
): StopRow[] {
  return rows.map((r) => {
    if (r.index === 0) return r
    if (field === 'height' && r.index === stops) return r
    if (onlyEmpty && r[field] != null) return r
    return { ...r, [field]: value }
  })
}

export function makeStops(count: number, prev: StopRow[] = []): StopRow[] {
  const labels = ['P', 'G']
  const rows: StopRow[] = [
    { index: 0, label: 'PIT', ceiling: null, height: null, entryFront: false, entryRear: false, entrySide: false },
  ]
  for (let i = 1; i <= count; i++) {
    rows.push({
      index: i,
      label: labels[i - 1] ?? String(i - 2),
      ceiling: null,
      height: null,
      entryFront: true,
      entryRear: false,
      entrySide: false,
    })
  }
  // مقادیری که کاربر قبلاً پر کرده حفظ می‌شوند
  return rows.map((r) => {
    const old = prev.find((x) => x.index === r.index)
    return old ? { ...r, ...old, index: r.index } : r
  })
}

/** مقادیری که از جدول توقف‌ها به‌دست می‌آیند */
export interface DerivedStops {
  /** تعداد ستون‌هایی که حداقل یک تیک دارند */
  cabinEntries: number
  /** مجموع تیک‌های هر سه ستون */
  landingDoors: number
  /** جمع فاصله طبقات، بدون چاهک و بدون ردیف اورهد — بر حسب متر */
  travel: number
  pitDepth: number | null
  overhead: number | null
}

export function deriveStops(rows: StopRow[], stops: number): DerivedStops {
  const floors = rows.filter((r) => r.index >= 1)

  const cabinEntries =
    (floors.some((r) => r.entryFront) ? 1 : 0) +
    (floors.some((r) => r.entryRear) ? 1 : 0) +
    (floors.some((r) => r.entrySide) ? 1 : 0)

  const landingDoors = floors.reduce(
    (n, r) => n + (r.entryFront ? 1 : 0) + (r.entryRear ? 1 : 0) + (r.entrySide ? 1 : 0),
    0,
  )

  // کورس: از توقف ۱ تا توقف (n−1) — یعنی فاصله‌های بین طبقات
  const travelCm = rows
    .filter((r) => r.index >= 1 && r.index <= stops - 1)
    .reduce((sum, r) => sum + (r.height ?? 0), 0)

  return {
    cabinEntries,
    landingDoors,
    travel: Math.round((travelCm / 100) * 100) / 100,
    pitDepth: rows.find((r) => r.index === 0)?.height ?? null,
    overhead: rows.find((r) => r.index === stops)?.height ?? null,
  }
}

/* ── تنظیمات لیست قطعات ─────────────────────────────────────── */
export type BuildMode = 'package' | 'custom'
export type SystemKind = 'traction-gearless' | 'traction-geared' | 'hydraulic-indirect' | 'hydraulic-direct'
export type MachineRoom = 'above' | 'below' | 'beside' | 'none'
export type LandingDoorKind = 'auto' | 'swing' | 'mixed'

export const systemLabel: Record<SystemKind, string> = {
  'traction-gearless': 'کششی گیرلس',
  'traction-geared': 'کششی گیربکس',
  'hydraulic-indirect': 'هیدرولیک غیرمستقیم',
  'hydraulic-direct': 'هیدرولیک مستقیم',
}

export const machineRoomLabel: Record<MachineRoom, string> = {
  above: 'بالای چاله',
  below: 'پایین چاله',
  beside: 'کنار چاله',
  none: 'بدون موتورخانه',
}

export const landingDoorLabel: Record<LandingDoorKind, string> = {
  auto: 'اتوماتیک',
  swing: 'لولایی',
  mixed: 'ترکیبی (اتوماتیک و لولایی)',
}

export const SPEED_STEPS = [0.2, 0.63, 1, 1.6, 2.5, 4, 6, 10] as const
export type Suspension = 1 | 2 | 4 | 8

export interface BuildSettings {
  mode: BuildMode
  system: SystemKind
  machineRoom: MachineRoom
  landingDoor: LandingDoorKind
  speed: number
  suspension: Suspension
  karaSling: boolean
  cwtSafetyGear: boolean
}

export const DEFAULT_SETTINGS: BuildSettings = {
  mode: 'custom',
  system: 'traction-gearless',
  machineRoom: 'none',
  landingDoor: 'auto',
  speed: 1,
  suspension: 2,
  karaSling: false,
  cwtSafetyGear: false,
}

/* ── مشخصات کامل استعلام ────────────────────────────────────── */
export interface InquirySpec {
  projectName: string
  clientId: string
  clientName: string
  reps: Representative[]
  usage: ProjectUsage
  province: string
  city: string
  address: string
  lat?: number
  lng?: number
  /** تعداد دستگاه آسانسور مشابه */
  units: number
  elevatorName: string
  elevatorNote: string
  doneStages: ProgressStage[]
  capacityPersons: number
  capacityKg: number
  stops: number
  stopRows: StopRow[]
}

export function emptySpec(): InquirySpec {
  return {
    projectName: '',
    clientId: '',
    clientName: '',
    reps: [],
    usage: 'residential',
    province: 'تهران',
    city: '',
    address: '',
    units: 1,
    elevatorName: 'L1',
    elevatorNote: '',
    doneStages: [],
    capacityPersons: 6,
    capacityKg: 450,
    stops: 4,
    stopRows: makeStops(4),
  }
}

/* ══════════════════════════════════════════════════════════════
   تولید لیست قطعات

   قطعات بر اساس تنظیمات و اعداد محاسبه‌شده از جدول توقف‌ها ساخته
   می‌شوند. هر قلم یک گروه دارد تا در صفحه لیست قابل فیلتر باشد.
   ══════════════════════════════════════════════════════════════ */

export const PART_GROUPS = [
  { key: 'complete', label: 'آسانسور کامل' },
  { key: 'door-rail', label: 'درب و ریل' },
  { key: 'mechanical', label: 'مکانیکال' },
  { key: 'electrical', label: 'الکتریکال' },
  { key: 'execution', label: 'اجرا' },
] as const

export type PartGroup = (typeof PART_GROUPS)[number]['key']

export interface PartLine {
  id: string
  group: PartGroup
  /** مرحله اجرایی این قلم — برای فیلتر شدن بر اساس مراحل انجام‌شده */
  stage: ProgressStage | 'any'
  title: string
  detail: string
  /** تعدادی که سیستم حساب کرده — مبنای دکمه «بازگشت به مقدار محاسبه‌شده» */
  computedQty: number
  quantity: number
  unit: string
  categoryId: string
  productId?: string
  selected: boolean
  /** قلم دستی که کاربر اضافه کرده، نه محاسبه‌شده */
  custom?: boolean
}

const R = (n: number) => Math.max(1, Math.ceil(n))

export function buildParts(spec: InquirySpec, st: BuildSettings): PartLine[] {
  const d = deriveStops(spec.stopRows, spec.stops)
  const travel = d.travel || (spec.stops - 1) * 3
  const out: PartLine[] = []
  let seq = 0

  const add = (
    group: PartGroup,
    title: string,
    detail: string,
    qty: number,
    unit: string,
    categoryId: string,
    stage: ProgressStage | 'any' = 'any',
  ) => {
    // اگر مرحله مربوط به این قلم قبلاً انجام شده، اصلاً پیشنهاد نمی‌شود
    if (stage !== 'any' && spec.doneStages.includes(stage)) return
    out.push({
      id: `pl${++seq}`,
      group,
      title,
      detail,
      computedQty: qty,
      quantity: qty,
      unit,
      categoryId,
      stage,
      selected: true,
    })
  }

  /* ── حالت پکیج: فقط یک قلم ────────────────────────────────── */
  if (st.mode === 'package') {
    add(
      'complete',
      `پکیج کامل آسانسور ${systemLabel[st.system]}`,
      `${toFa(spec.stops)} توقف — ${toFa(spec.capacityKg)} کیلوگرم — ${toFa(st.speed)} متر بر ثانیه`,
      spec.units,
      'پکیج',
      'c1',
    )
    return out
  }

  const hydraulic = st.system.startsWith('hydraulic')
  const u = spec.units

  /* ── مکانیکال ─────────────────────────────────────────────── */
  if (hydraulic) {
    add('mechanical', 'پاور یونیت هیدرولیک', `ظرفیت ${toFa(spec.capacityKg)} کیلوگرم`, u, 'دستگاه', 'c1', 'mechanical')
    add(
      'mechanical',
      'سیلندر هیدرولیک',
      travel > 6 ? 'تلسکوپی دو مرحله‌ای' : 'تک مرحله‌ای',
      u,
      'دستگاه',
      'c1',
      'mechanical',
    )
  } else {
    const kw = spec.capacityKg <= 450 ? 4 : spec.capacityKg <= 630 ? 5.5 : spec.capacityKg <= 1000 ? 7.5 : 11
    add(
      'mechanical',
      st.machineRoom === 'none' ? 'موتور کشش گیرلس' : `موتور کشش ${systemLabel[st.system]}`,
      `${toFa(kw)} کیلووات — ${toFa(spec.capacityKg)} کیلوگرم — ${toFa(st.speed)} m/s`,
      u,
      'دستگاه',
      'c1',
    )
    add('mechanical', 'وزنه تعادل و یوک', `تعلیق ۱:${toFa(st.suspension)}`, u, 'ست', 'c7', 'mechanical')
  }

  add('mechanical', 'کابین آسانسور', `${toFa(spec.capacityPersons)} نفره — ${toFa(d.cabinEntries || 1)} ورودی`, u, 'دستگاه', 'c7', 'mechanical')

  if (st.karaSling) {
    add('mechanical', 'یوک کارا سلینگی', 'سیستم کارا سلینگی انتخاب شده است', u, 'ست', 'c7', 'mechanical')
  }

  /* ── درب و ریل ────────────────────────────────────────────── */
  const railSticks = R(travel / 5) + 1
  const cabinRail = spec.capacityKg <= 630 ? 'T-89' : 'T-114'
  add('door-rail', `ریل راهنمای کابین ${cabinRail}`, `${toFa(railSticks)} شاخه ۵ متری برای کورس ${toFa(travel)} متر`, railSticks * u, 'شاخه', 'c4', 'rails')

  if (!hydraulic) {
    add('door-rail', 'ریل راهنمای وزنه تعادل T-70', `${toFa(railSticks)} شاخه ۵ متری`, railSticks * u, 'شاخه', 'c4', 'rails')
  }

  const brackets = R(travel / (st.speed > 1.6 || spec.capacityKg > 1000 ? 2 : 2.5)) * 2
  add('door-rail', 'براکت و اتصالات ریل', st.speed > 1.6 ? 'فاصله ۲ متر به دلیل سرعت بالا' : 'فاصله استاندارد ۲٫۵ متر', brackets * u, 'عدد', 'c4', 'steelwork')

  const doorCount = d.landingDoors || spec.stops
  const doorWidth = spec.capacityKg <= 630 ? 800 : spec.capacityKg <= 1000 ? 900 : 1100

  if (st.landingDoor === 'mixed') {
    const autoCount = Math.ceil(doorCount / 2)
    add('door-rail', 'درب طبقه اتوماتیک', `عرض ${toFa(doorWidth)} میلی‌متر`, autoCount * u, 'دستگاه', 'c2', 'doors')
    add('door-rail', 'درب طبقه لولایی', `عرض ${toFa(doorWidth)} میلی‌متر`, (doorCount - autoCount) * u, 'دستگاه', 'c2', 'doors')
  } else {
    add(
      'door-rail',
      st.landingDoor === 'auto' ? 'درب طبقه اتوماتیک' : 'درب طبقه لولایی',
      `عرض ${toFa(doorWidth)} میلی‌متر — از جدول توقف‌ها: ${toFa(doorCount)} درب`,
      doorCount * u,
      'دستگاه',
      'c2',
      'doors',
    )
  }

  if (st.landingDoor !== 'swing') {
    add('door-rail', 'اپراتور و درب کابین', `${toFa(d.cabinEntries || 1)} ورودی کابین`, (d.cabinEntries || 1) * u, 'دستگاه', 'c2', 'doors')
  }

  /* ── سیم‌بکسل و ایمنی ─────────────────────────────────────── */
  if (!hydraulic) {
    const ropes = spec.capacityKg <= 450 ? 3 : spec.capacityKg <= 1000 ? 4 : 6
    const len = (travel + 10) * ropes
    add('mechanical', 'سیم‌بکسل فولادی', `${toFa(ropes)} رشته — حدود ${toFa(len)} متر`, len * u, 'متر', 'c6', 'mechanical')
  }

  add('mechanical', 'پاراشوت (ترمز ایمنی)', st.speed > 0.63 ? 'تدریجی' : 'آنی', u, 'ست', 'c5', 'mechanical')
  add('mechanical', 'گاورنر محدودکننده سرعت', `تنظیم برای ${toFa(st.speed)} متر بر ثانیه`, u, 'دستگاه', 'c5', 'mechanical')
  add('mechanical', 'بافر چاهک', st.speed > 1 ? 'روغنی' : 'فنری', (hydraulic ? 1 : 2) * u, 'دستگاه', 'c5', 'mechanical')

  if (st.cwtSafetyGear) {
    add('mechanical', 'کادر وزنه پاراشوت‌دار', 'مطابق انتخاب در تنظیمات', u, 'ست', 'c5', 'mechanical')
  }

  /* ── الکتریکال ────────────────────────────────────────────── */
  add(
    'electrical',
    'تابلو فرمان و درایو',
    `${toFa(spec.stops)} توقف — ${hydraulic ? 'کنترل هیدرولیک' : 'VVVF'}${st.machineRoom === 'none' ? ' — بدون موتورخانه' : ''}`,
    u,
    'دستگاه',
    'c3',
    'commissioning',
  )
  add('electrical', 'شاسی و نمایشگر طبقات', `${toFa(spec.stops)} ست طبقه و ۱ ست کابین`, (spec.stops + 1) * u, 'ست', 'c8', 'commissioning')
  add('electrical', 'روشنایی کابین با باتری اضطراری', 'الزام استاندارد', u, 'دستگاه', 'c8', 'commissioning')
  add('electrical', 'سیستم ارتباط اضطراری', 'آیفون کابین', u, 'دستگاه', 'c8', 'commissioning')
  add('electrical', 'تراول کابل', `حدود ${toFa(Math.round(travel / 2 + 6))} متر`, Math.round(travel / 2 + 6) * u, 'متر', 'c8', 'revision')

  if (spec.usage === 'hospital' || spec.usage === 'commercial' || spec.stops >= 8) {
    add('electrical', 'سیستم نجات اضطراری (ARV)', 'رساندن کابین به نزدیک‌ترین طبقه در قطعی برق', u, 'دستگاه', 'c3', 'commissioning')
  }
  add('electrical', 'سنسور اضافه‌بار', `تنظیم روی ${toFa(spec.capacityKg)} کیلوگرم`, u, 'دستگاه', 'c8', 'commissioning')

  /* ── اجرا ─────────────────────────────────────────────────── */
  const remaining = PROGRESS_STAGES.filter(
    (s) => !('locked' in s && s.locked) && !spec.doneStages.includes(s.key),
  )
  for (const stage of remaining) {
    add('execution', `اجرای ${stage.label}`, `برای ${toFa(spec.units)} دستگاه`, u, 'پروژه', 'c9')
  }
  add('execution', 'تست بار و اخذ استاندارد', 'شامل مدارک و گزارش بازرسی', u, 'پروژه', 'c9')

  return out
}

/* ── تعهدات طرفین ───────────────────────────────────────────── */
export type CommitmentSide = 'buyer' | 'seller'

export interface Commitment {
  id: string
  title: string
  side: CommitmentSide
  /** اگر بر عهده فروشنده باشد، باید قیمت بگیرد */
  price: number | null
  /** قیمت از لیست قطعات می‌آید و دستی نیست */
  auto?: boolean
  /**
   * تعهد الگو که مدیر تعریف کرده است.
   * طبق نیازمندی، تعهدات الگو قابل حذف نیستند — فقط می‌شود آن‌ها را
   * بین دو طرف جابه‌جا و قیمت‌گذاری کرد. فقط تعهدی که خود کاربر
   * اضافه کرده حذف می‌شود.
   */
  template?: boolean
}

/**
 * قالب تعهد که در پنل مدیر تعریف می‌شود.
 * `systems` خالی یعنی برای همه انواع آسانسور اعمال می‌شود.
 */
export interface CommitmentTemplate {
  id: string
  title: string
  defaultSide: CommitmentSide
  systems: SystemKind[]
  /** قیمتش از جمع لیست قطعات می‌آید، نه ورودی دستی */
  fromPartsTotal?: boolean
  order: number
}

export const DEFAULT_COMMITMENT_TEMPLATES: CommitmentTemplate[] = [
  { id: 'ct1', title: 'خرید اجناس و قطعات', defaultSide: 'seller', systems: [], fromPartsTotal: true, order: 1 },
  { id: 'ct2', title: 'حمل تا پروژه', defaultSide: 'seller', systems: [], order: 2 },
  { id: 'ct3', title: 'باربری و تخلیه در محل', defaultSide: 'buyer', systems: [], order: 3 },
  { id: 'ct4', title: 'داربست‌بندی چاه', defaultSide: 'buyer', systems: [], order: 4 },
  { id: 'ct5', title: 'برق‌رسانی موقت کارگاهی', defaultSide: 'buyer', systems: [], order: 5 },
  { id: 'ct6', title: 'اجرای آهنکشی و ریل‌گذاری', defaultSide: 'seller', systems: [], order: 6 },
  { id: 'ct7', title: 'نصب مکانیکال و راه‌اندازی', defaultSide: 'seller', systems: [], order: 7 },
  { id: 'ct8', title: 'اخذ تأییدیه استاندارد', defaultSide: 'seller', systems: [], order: 8 },
  { id: 'ct9', title: 'تأمین محل نگهداری تجهیزات', defaultSide: 'buyer', systems: [], order: 9 },
  { id: 'ct10', title: 'بیمه مسئولیت کارگاه', defaultSide: 'buyer', systems: [], order: 10 },
  { id: 'ct11', title: 'چاه‌کنی و اجرای فونداسیون سیلندر', defaultSide: 'buyer', systems: ['hydraulic-direct'], order: 11 },
  { id: 'ct12', title: 'تأمین و نصب مخزن روغن', defaultSide: 'seller', systems: ['hydraulic-direct', 'hydraulic-indirect'], order: 12 },
  { id: 'ct13', title: 'اجرای سکوی موتورخانه', defaultSide: 'buyer', systems: ['traction-geared', 'traction-gearless'], order: 13 },
]

const TEMPLATE_KEY = 'am.commitmentTemplates'

/** قالب‌های ذخیره‌شده مدیر؛ اگر چیزی ذخیره نشده باشد، پیش‌فرض‌ها */
export function loadTemplates(): CommitmentTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY)
    if (raw) return JSON.parse(raw) as CommitmentTemplate[]
  } catch {
    /* دیتای خراب را نادیده بگیر */
  }
  return DEFAULT_COMMITMENT_TEMPLATES
}

export function saveTemplates(list: CommitmentTemplate[]) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list))
}

/** ساخت تعهدات یک استعلام از روی قالب‌های مربوط به همان نوع سیستم */
export function commitmentsFrom(
  system: SystemKind,
  partsTotal: number,
  templates = loadTemplates(),
): Commitment[] {
  return templates
    .filter((t) => t.systems.length === 0 || t.systems.includes(system))
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      id: t.id,
      title: t.title,
      side: t.defaultSide,
      price: t.fromPartsTotal ? partsTotal : null,
      auto: t.fromPartsTotal,
      template: true,
    }))
}

/* ── شرایط پرداخت ───────────────────────────────────────────── */
export type PaymentMethod = 'cash' | 'cheque' | 'mixed' | 'barter'

export const paymentLabel: Record<PaymentMethod, string> = {
  cash: 'نقدی',
  cheque: 'چکی',
  mixed: 'نقد و چک',
  barter: 'تهاتر',
}

export interface PaymentTerms {
  method: PaymentMethod
  /** درصد پیش‌پرداخت */
  prepayment: number
  chequeMonths: number
  note: string
}
