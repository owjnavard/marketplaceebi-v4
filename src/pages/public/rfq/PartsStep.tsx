import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown, HelpCircle, Percent, Plus, RotateCcw, Save, ShoppingCart,
  Store, Trash2, X,
} from 'lucide-react'
import { Badge, Button, Card, Input, Select, Stars } from '@/components/ui'
import { PartSchematic, schematicFor } from '@/components/PartSchematic'
import { api } from '@/lib/api'
import type { Category, Product, Seller } from '@/lib/api/types'
import { canSeePartnerPrice, partnerMargin, partnerPrice } from '@/lib/partner'
import { helpFor, SETTING_HELP } from '@/features/rfq/help'
import {
  buildParts, landingDoorLabel, machineRoomLabel, PART_GROUPS, SPEED_STEPS, systemLabel,
  type BuildSettings, type InquirySpec, type LandingDoorKind, type MachineRoom,
  type PartGroup, type PartLine, type Suspension, type SystemKind,
} from '@/features/rfq/inquiry'
import { cn, toEn, toFa, toman } from '@/lib/utils'
import { useAuth, useCart, useToasts } from '@/store'

const num = (v: string) => Number(toEn(v).replace(/[^\d.]/g, '')) || 0

/** سه صفحه‌ای که در ستون چپ جابه‌جا می‌شوند */
type Pane = 'parts' | 'help' | 'shop'

export function PartsStep({
  spec, settings, setSettings, lines, setLines,
}: {
  spec: InquirySpec
  settings: BuildSettings
  setSettings: (u: (s: BuildSettings) => BuildSettings) => void
  lines: PartLine[]
  setLines: (u: (l: PartLine[]) => PartLine[]) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [group, setGroup] = useState<PartGroup | 'all'>('all')
  const [pane, setPane] = useState<Pane>('parts')
  const [helpKey, setHelpKey] = useState('mode')
  const [shopFor, setShopFor] = useState<PartLine | null>(null)
  const [showMargin, setShowMargin] = useState(false)
  const [openMain, setOpenMain] = useState(true)
  const [openOther, setOpenOther] = useState(true)

  const user = useAuth((s) => s.user)
  const add = useCart((s) => s.add)
  const push = useToasts((s) => s.push)

  const mySeller = sellers.find((s) => s.id === 's1') ?? null
  const partnerView = canSeePartnerPrice(user, mySeller)

  useEffect(() => {
    void Promise.all([api.products({ perPage: 200 }), api.sellers(), api.categories()]).then(
      ([p, s, c]) => {
        setProducts(p.items)
        setSellers(s)
        setCategories(c)
      },
    )
  }, [])

  /* با تغییر تنظیمات یا مشخصات، لیست دوباره ساخته می‌شود ولی انتخاب
     محصول، تعدادهای ویرایش‌شده و اقلام دستی حفظ می‌شوند */
  useEffect(() => {
    const fresh = buildParts(spec, settings)
    setLines((old) => [
      ...fresh.map((f) => {
        const prev = old.find((o) => o.title === f.title && !o.custom)
        return prev
          ? { ...f, quantity: prev.quantity, productId: prev.productId, selected: prev.selected }
          : f
      }),
      ...old.filter((o) => o.custom),
    ])
  }, [settings, spec.stops, spec.units, spec.capacityKg, spec.doneStages])

  const productOf = (id?: string) => products.find((p) => p.id === id)

  const lineUnitPrice = (l: PartLine): number | null => {
    const p = productOf(l.productId)
    if (!p || p.price == null) return null
    return partnerView ? (partnerPrice(p) ?? p.price) : p.price
  }
  const lineTotal = (l: PartLine) => {
    const u = lineUnitPrice(l)
    return u == null ? null : u * l.quantity
  }

  const mainLines = lines.filter((l) => !l.custom)
  const otherLines = lines.filter((l) => l.custom)
  const inGroup = (l: PartLine) => group === 'all' || l.group === group

  const selected = lines.filter((l) => l.selected)
  const total = selected.reduce((s, l) => s + (lineTotal(l) ?? 0), 0)
  const quoteCount = selected.filter((l) => lineTotal(l) == null).length
  const marginTotal = selected.reduce((s, l) => {
    const p = productOf(l.productId)
    return s + (p ? (partnerMargin(p) ?? 0) : 0) * l.quantity
  }, 0)

  const setLine = (id: string, patch: Partial<PartLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const addCustom = () =>
    setLines((ls) => [
      ...ls,
      {
        id: `custom${Date.now()}`,
        group: group === 'all' ? 'mechanical' : group,
        title: '',
        detail: '',
        computedQty: 1,
        quantity: 1,
        unit: 'عدد',
        categoryId: 'c1',
        stage: 'any',
        selected: true,
        custom: true,
      },
    ])

  const addToCart = () => {
    const ok = selected.filter((l) => l.productId && lineTotal(l) != null)
    if (!ok.length) {
      push('قلمی با محصول و قیمت مشخص انتخاب نشده است.', 'error')
      return
    }
    ok.forEach((l) => add(l.productId!, l.quantity))
    push(`${toFa(ok.length)} قلم به سبد خرید اضافه شد`)
  }

  const saveList = () => {
    try {
      localStorage.setItem('am.savedPartsList', JSON.stringify({ spec, settings, lines }))
      push('لیست قطعات ذخیره شد')
    } catch {
      push('ذخیره لیست انجام نشد.', 'error')
    }
  }

  const openHelp = (key: string) => {
    setHelpKey(key)
    setPane('help')
  }
  const openShop = (l: PartLine) => {
    setShopFor(l)
    setPane('shop')
  }

  const isPackage = settings.mode === 'package'

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* ══ ستون تنظیمات ══ */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-[14px] font-extrabold text-steel-900">
            تنظیمات
          </h2>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            <SettingRow label="۱. نوع آسانسور" helpKey="mode" onHelp={openHelp} required>
              <div className="grid grid-cols-2 gap-2">
                {([['package', 'پکیج'], ['custom', 'ترکیبی']] as const).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setSettings((s) => ({ ...s, mode: v }))}
                    className={cn(
                      'rounded-xl border py-2.5 text-[13px] font-bold transition-colors',
                      settings.mode === v
                        ? 'border-steel-800 bg-steel-800 text-white'
                        : 'border-line bg-paper text-steel-600 hover:border-steel-300',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </SettingRow>

            {isPackage && (
              <p className="rounded-xl bg-signal-50 px-3.5 py-3 text-[12.5px] leading-6 text-steel-600">
                در حالت پکیج بقیه تنظیمات غیرفعال است. بر اساس مشخصات آسانسور، پکیج مورد
                نظر را از فروشگاه انتخاب کنید.
              </p>
            )}

            <fieldset disabled={isPackage} className={cn('space-y-4', isPackage && 'opacity-40')}>
              <SettingRow label="۲. نوع سیستم" helpKey="system" onHelp={openHelp} required>
                <Select value={settings.system} onChange={(e) => setSettings((s) => ({ ...s, system: e.target.value as SystemKind }))}>
                  {(Object.keys(systemLabel) as SystemKind[]).map((k) => (
                    <option key={k} value={k}>{systemLabel[k]}</option>
                  ))}
                </Select>
              </SettingRow>

              <SettingRow label="۳. محل موتورخانه" helpKey="machineRoom" onHelp={openHelp} required>
                <Select value={settings.machineRoom} onChange={(e) => setSettings((s) => ({ ...s, machineRoom: e.target.value as MachineRoom }))}>
                  {(Object.keys(machineRoomLabel) as MachineRoom[]).map((k) => (
                    <option key={k} value={k}>{machineRoomLabel[k]}</option>
                  ))}
                </Select>
              </SettingRow>

              <SettingRow label="۴. نوع درب طبقات" helpKey="landingDoor" onHelp={openHelp} required>
                <Select value={settings.landingDoor} onChange={(e) => setSettings((s) => ({ ...s, landingDoor: e.target.value as LandingDoorKind }))}>
                  {(Object.keys(landingDoorLabel) as LandingDoorKind[]).map((k) => (
                    <option key={k} value={k}>{landingDoorLabel[k]}</option>
                  ))}
                </Select>
              </SettingRow>

              <SettingRow label="۵. سرعت آسانسور" hint="m/s" helpKey="speed" onHelp={openHelp} required>
                <div className="flex flex-wrap gap-1.5">
                  {SPEED_STEPS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setSettings((s) => ({ ...s, speed: v }))}
                      className={cn(
                        'num rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors',
                        settings.speed === v
                          ? 'border-signal-500 bg-signal-400 text-steel-900'
                          : 'border-line bg-paper text-steel-600 hover:border-steel-300',
                      )}
                    >
                      {toFa(v)}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label="۶. سیستم تعلیق" helpKey="suspension" onHelp={openHelp} required>
                <div className="grid grid-cols-4 gap-2">
                  {([1, 2, 4, 8] as Suspension[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setSettings((s) => ({ ...s, suspension: v }))}
                      className={cn(
                        'num rounded-xl border py-2 text-[12.5px] font-bold transition-colors',
                        settings.suspension === v
                          ? 'border-steel-800 bg-steel-800 text-white'
                          : 'border-line bg-paper text-steel-600 hover:border-steel-300',
                      )}
                    >
                      ۱:{toFa(v)}
                    </button>
                  ))}
                </div>
              </SettingRow>

              {([
                ['karaSling', '۷. سیستم کارا سلینگی'],
                ['cwtSafetyGear', '۸. کادر وزنه پاراشوت‌دار'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <label
                    className={cn(
                      'flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                      settings[key] ? 'border-steel-400 bg-steel-50' : 'border-line hover:border-steel-300',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    <span className="text-[13px] font-semibold text-steel-700">{label}</span>
                  </label>
                  <HelpButton onClick={() => openHelp(key)} />
                </div>
              ))}
            </fieldset>
          </div>
        </Card>
      </aside>

      {/* ══ ستون چپ: سه صفحه ══ */}
      <div className="min-w-0">
        {/* سربرگ فریز‌شده */}
        <div className="sticky top-20 z-30 mb-4 rounded-2xl border border-line bg-paper/95 px-3 py-2.5 shadow-plate backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['parts', 'لیست قطعات'],
              ['help', 'راهنمای تنظیمات'],
              ['shop', 'فروشگاه'],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPane(k)}
                className={cn(
                  'rounded-full px-4 py-2 text-[13px] font-bold transition-colors',
                  pane === k ? 'bg-steel-800 text-white' : 'text-steel-500 hover:bg-steel-100',
                )}
              >
                {l}
              </button>
            ))}

            <div className="mr-auto flex items-center gap-3 text-[13px]">
              <span className="text-steel-400">
                <span className="num font-extrabold text-steel-900">{toFa(selected.length)}</span> قلم
              </span>
              <span className="num rounded-full bg-steel-800 px-3 py-1.5 font-extrabold text-white">
                {toman(total)}
              </span>
            </div>
          </div>
        </div>

        {pane === 'parts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <GroupChip active={group === 'all'} onClick={() => setGroup('all')} label="همه" n={lines.length} />
              {PART_GROUPS.map((g) => {
                const n = lines.filter((l) => l.group === g.key).length
                if (!n) return null
                return (
                  <GroupChip key={g.key} active={group === g.key} onClick={() => setGroup(g.key)} label={g.label} n={n} />
                )
              })}
            </div>

            {partnerView && (
              <Card className="flex flex-wrap items-center justify-between gap-3 border-verify/30 bg-verify-soft p-4">
                <div className="flex items-start gap-2.5">
                  <Percent size={16} className="mt-0.5 shrink-0 text-verify" />
                  <p className="text-[13px] leading-7 text-steel-700">
                    شما فروشنده تأییدشده‌اید، پس قیمت‌ها با <span className="font-bold">تخفیف همکاری</span> نمایش داده می‌شوند.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-steel-700">
                  <input type="checkbox" checked={showMargin} onChange={(e) => setShowMargin(e.target.checked)} className="h-4 w-4" />
                  نمایش سود
                </label>
              </Card>
            )}

            <CollapsibleTable
              title="لوازم اصلی"
              count={mainLines.filter(inGroup).length}
              open={openMain}
              onToggle={() => setOpenMain((v) => !v)}
            >
              <PartsTable
                rows={mainLines.filter(inGroup)}
                productOf={productOf}
                unitPrice={lineUnitPrice}
                total={lineTotal}
                partnerView={partnerView}
                showMargin={showMargin}
                onChange={setLine}
                onRemove={(id) => setLines((ls) => ls.filter((x) => x.id !== id))}
                onPick={openShop}
              />
            </CollapsibleTable>

            <CollapsibleTable
              title="سایر لوازم"
              count={otherLines.filter(inGroup).length}
              open={openOther}
              onToggle={() => setOpenOther((v) => !v)}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    addCustom()
                  }}
                >
                  <Plus size={14} />
                  افزودن قلم
                </Button>
              }
            >
              {otherLines.filter(inGroup).length === 0 ? (
                <p className="px-4 py-8 text-center text-[13.5px] text-steel-400">
                  قلمی اضافه نشده است. اقلامی که در لیست محاسبه‌شده نیستند را اینجا اضافه کنید.
                </p>
              ) : (
                <PartsTable
                  rows={otherLines.filter(inGroup)}
                  productOf={productOf}
                  unitPrice={lineUnitPrice}
                  total={lineTotal}
                  partnerView={partnerView}
                  showMargin={showMargin}
                  onChange={setLine}
                  onRemove={(id) => setLines((ls) => ls.filter((x) => x.id !== id))}
                  onPick={openShop}
                  editableTitle
                />
              )}
            </CollapsibleTable>

            <Card className="p-5">
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Stat label="اقلام انتخاب‌شده" value={toFa(selected.length)} />
                <Stat label="نیازمند استعلام" value={toFa(quoteCount)} tone="signal" />
                <Stat label="جمع قابل محاسبه" value={toman(total)} tone="dark" />
              </div>

              {showMargin && partnerView && marginTotal > 0 && (
                <p className="mb-4 rounded-xl bg-verify-soft px-4 py-3 text-[13px] text-verify">
                  سود تخمینی شما از این لیست: <span className="num font-extrabold">{toman(marginTotal)}</span> تومان
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="signal" onClick={addToCart}>
                  <ShoppingCart size={16} />
                  افزودن به سبد خرید
                </Button>
                <Button variant="outline" onClick={saveList}>
                  <Save size={15} />
                  ذخیره لیست
                </Button>
              </div>
            </Card>
          </div>
        )}

        {pane === 'help' && <HelpPane activeKey={helpKey} onSelect={setHelpKey} onBack={() => setPane('parts')} />}

        {pane === 'shop' && (
          <ShopPane
            line={shopFor}
            products={products}
            categories={categories}
            sellers={sellers}
            partnerView={partnerView}
            onBack={() => setPane('parts')}
            onPick={(id) => {
              if (shopFor) setLine(shopFor.id, { productId: id || undefined })
              setPane('parts')
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ── اجزای کوچک ─────────────────────────────────────────────── */

function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="راهنما"
      aria-label="راهنمای این تنظیم"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-steel-300 transition-colors hover:bg-signal-100 hover:text-signal-700"
    >
      <HelpCircle size={17} />
    </button>
  )
}

function SettingRow({
  label, hint, helpKey, onHelp, required, children,
}: {
  label: string
  hint?: string
  helpKey: string
  onHelp: (k: string) => void
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1">
        <span className="flex flex-1 items-baseline gap-1 text-[13px] font-semibold text-steel-700">
          {label}
          {required && <span className="text-alert">*</span>}
          {hint && <span className="font-normal text-steel-400">— {hint}</span>}
        </span>
        <HelpButton onClick={() => onHelp(helpKey)} />
      </div>
      {children}
    </div>
  )
}

function GroupChip({
  active, onClick, label, n,
}: {
  active: boolean; onClick: () => void; label: string; n: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
        active ? 'border-steel-800 bg-steel-800 text-white' : 'border-line bg-paper text-steel-600 hover:border-steel-300',
      )}
    >
      {label}
      <span className="num mr-1.5 opacity-70">{toFa(n)}</span>
    </button>
  )
}

function CollapsibleTable({
  title, count, open, onToggle, action, children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div
        onClick={onToggle}
        className="flex cursor-pointer flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 transition-colors hover:bg-steel-50"
      >
        <span className="flex items-center gap-2.5">
          <ChevronDown size={17} className={cn('text-steel-400 transition-transform', !open && '-rotate-90')} />
          <span className="text-[14px] font-extrabold text-steel-900">{title}</span>
          <span className="num text-[13px] font-normal text-steel-400">({toFa(count)})</span>
        </span>
        {action}
      </div>
      {open && children}
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'signal' | 'dark' }) {
  return (
    <div className={cn('rounded-xl px-4 py-3', tone === 'dark' ? 'bg-steel-800' : 'bg-steel-50')}>
      <p className="text-[12px] text-steel-400">{label}</p>
      <p
        className={cn(
          'num mt-0.5 text-[17px] font-extrabold',
          tone === 'dark' ? 'text-white' : tone === 'signal' ? 'text-signal-700' : 'text-steel-900',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/* ── جدول اقلام ─────────────────────────────────────────────── */
function PartsTable({
  rows, productOf, unitPrice, total, partnerView, showMargin, onChange, onRemove, onPick, editableTitle,
}: {
  rows: PartLine[]
  productOf: (id?: string) => Product | undefined
  unitPrice: (l: PartLine) => number | null
  total: (l: PartLine) => number | null
  partnerView: boolean
  showMargin: boolean
  onChange: (id: string, patch: Partial<PartLine>) => void
  onRemove: (id: string) => void
  onPick: (l: PartLine) => void
  editableTitle?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-right">
        <thead>
          <tr className="border-b border-line bg-steel-50 text-[12.5px] font-bold text-steel-500">
            <th className="w-10 px-3 py-3"></th>
            <th className="w-12 px-2 py-3">ردیف</th>
            <th className="px-3 py-3">عنوان</th>
            <th className="w-28 px-3 py-3">تعداد</th>
            <th className="w-20 px-3 py-3">واحد</th>
            <th className="w-44 px-3 py-3">انتخاب محصول</th>
            <th className="w-32 px-3 py-3">قیمت</th>
            <th className="w-32 px-3 py-3">قیمت کل</th>
            <th className="w-10 px-2 py-3">حذف</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l, i) => {
            const p = productOf(l.productId)
            const u = unitPrice(l)
            const t = total(l)
            return (
              <tr key={l.id} className={cn('border-b border-line last:border-0', !l.selected && 'opacity-45')}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={l.selected}
                    onChange={(e) => onChange(l.id, { selected: e.target.checked })}
                    className="h-4 w-4"
                  />
                </td>
                <td className="num px-2 py-2.5 text-[13px] text-steel-400">{toFa(i + 1)}</td>
                <td className="px-3 py-2.5">
                  {editableTitle ? (
                    <Input
                      value={l.title}
                      onChange={(e) => onChange(l.id, { title: e.target.value })}
                      placeholder="عنوان قلم"
                      className="h-9"
                    />
                  ) : (
                    <>
                      <p className="text-[13.5px] font-bold text-steel-900">{l.title}</p>
                      <p className="text-[12px] text-steel-400">{l.detail}</p>
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Input
                      value={toFa(l.quantity)}
                      onChange={(e) => onChange(l.id, { quantity: Math.max(1, num(e.target.value)) })}
                      className="num h-9 w-16 text-center"
                      inputMode="numeric"
                    />
                    {l.quantity !== l.computedQty && !l.custom && (
                      <button
                        onClick={() => onChange(l.id, { quantity: l.computedQty })}
                        title={`بازگشت به مقدار محاسبه‌شده (${toFa(l.computedQty)})`}
                        className="rounded-lg p-1.5 text-steel-400 transition-colors hover:bg-steel-100 hover:text-steel-800"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {editableTitle ? (
                    <Input
                      value={l.unit}
                      onChange={(e) => onChange(l.id, { unit: e.target.value })}
                      className="h-9 w-16 text-center"
                    />
                  ) : (
                    <span className="text-[13px] text-steel-600">{l.unit}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {p ? (
                    <button
                      onClick={() => onPick(l)}
                      className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-right transition-colors hover:border-steel-400"
                    >
                      <span className="h-7 w-7 shrink-0 text-steel-300">
                        <PartSchematic kind={schematicFor(p.categoryId)} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-steel-800">{p.name}</span>
                    </button>
                  ) : (
                    <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => onPick(l)}>
                      <Store size={14} />
                      انتخاب
                    </Button>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {u != null ? (
                    <div>
                      <span className="num text-[13px] font-bold text-steel-900">{toman(u)}</span>
                      {partnerView && p?.partnerDiscount ? (
                        <span className="block text-[11.5px] text-verify">{toFa(p.partnerDiscount)}٪ همکاری</span>
                      ) : null}
                    </div>
                  ) : (
                    <Badge tone="signal">استعلام</Badge>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {t != null ? (
                    <div>
                      <span className="num text-[13.5px] font-extrabold text-steel-900">{toman(t)}</span>
                      {showMargin && p && partnerMargin(p) != null && (
                        <span className="num block text-[11.5px] text-verify">
                          سود {toman((partnerMargin(p) ?? 0) * l.quantity)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13px] text-steel-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  <button
                    onClick={() => onRemove(l.id)}
                    className="rounded-lg p-1.5 text-steel-400 transition-colors hover:bg-alert-soft hover:text-alert"
                    aria-label="حذف ردیف"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── صفحه راهنمای تنظیمات ───────────────────────────────────── */
function HelpPane({
  activeKey, onSelect, onBack,
}: {
  activeKey: string; onSelect: (k: string) => void; onBack: () => void
}) {
  const h = helpFor(activeKey) ?? SETTING_HELP[0]
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <Card className="h-fit overflow-hidden">
        {SETTING_HELP.map((x) => (
          <button
            key={x.key}
            onClick={() => onSelect(x.key)}
            className={cn(
              'block w-full border-b border-line px-4 py-3 text-right text-[13px] transition-colors last:border-0',
              x.key === activeKey ? 'bg-steel-800 font-bold text-white' : 'text-steel-600 hover:bg-steel-50',
            )}
          >
            {x.title}
          </button>
        ))}
      </Card>

      <Card className="p-6">
        <h2 className="text-[18px] font-extrabold text-steel-900">{h.title}</h2>
        <p className="mt-3 text-[14.5px] leading-9 text-steel-600">{h.body}</p>

        {h.options && (
          <dl className="mt-5 space-y-3">
            {h.options.map((o) => (
              <div key={o.label} className="rounded-xl border border-line p-4">
                <dt className="text-[14px] font-bold text-steel-900">{o.label}</dt>
                <dd className="mt-1 text-[13.5px] leading-8 text-steel-600">{o.text}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5 rounded-xl bg-signal-50 px-4 py-3.5">
          <p className="mb-1 text-[12.5px] font-bold text-signal-700">اثر روی لیست قطعات</p>
          <p className="text-[13.5px] leading-8 text-steel-700">{h.effect}</p>
        </div>

        <Button variant="outline" className="mt-5" onClick={onBack}>بازگشت به لیست قطعات</Button>
      </Card>
    </div>
  )
}

/* ── صفحه فروشگاه برای انتخاب و مقایسه محصول ────────────────── */
function ShopPane({
  line, products, categories, sellers, partnerView, onBack, onPick,
}: {
  line: PartLine | null
  products: Product[]
  categories: Category[]
  sellers: Seller[]
  partnerView: boolean
  onBack: () => void
  onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(line?.categoryId ?? '')
  const [sellerId, setSellerId] = useState('')
  const [compare, setCompare] = useState<string[]>([])

  useEffect(() => setCat(line?.categoryId ?? ''), [line?.id])

  const list = useMemo(
    () =>
      products
        .filter((p) => !cat || p.categoryId === cat)
        .filter((p) => !sellerId || p.sellerId === sellerId)
        .filter((p) => !q || (p.name + p.partNumber + p.brand).includes(q))
        .sort((a, b) => b.rating - a.rating),
    [products, cat, sellerId, q],
  )

  const compared = products.filter((p) => compare.includes(p.id))
  const priceOf = (p: Product) => (partnerView ? (partnerPrice(p) ?? p.price) : p.price)

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-extrabold text-steel-900">فروشگاه</h2>
            {line && (
              <p className="mt-0.5 text-[13px] text-steel-500">
                انتخاب محصول برای: {line.title || 'قلم بدون عنوان'}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={onBack}>بازگشت به لیست</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…" className="h-10 max-w-56" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 max-w-52">
            <option value="">همه دسته‌ها</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="h-10 max-w-52">
            <option value="">همه فروشندگان</option>
            {sellers.filter((s) => s.status === 'approved').map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <span className="num mr-auto self-center text-[13px] text-steel-500">{toFa(list.length)} کالا</span>
        </div>
      </Card>

      {compared.length >= 2 && (
        <Card className="overflow-x-auto">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h3 className="text-[14px] font-extrabold text-steel-900">مقایسه</h3>
            <Button size="sm" variant="ghost" onClick={() => setCompare([])}>پاک کردن</Button>
          </div>
          <table className="w-full min-w-[560px] text-right">
            <tbody>
              {[
                { l: 'نام', f: (p: Product) => p.name },
                { l: 'برند', f: (p: Product) => p.brand },
                { l: 'قیمت', f: (p: Product) => (priceOf(p) != null ? `${toman(priceOf(p)!)} تومان` : 'استعلامی') },
                { l: 'موجودی', f: (p: Product) => (p.stockState === 'in_stock' ? 'موجود' : 'سفارشی') },
                { l: 'امتیاز', f: (p: Product) => toFa(p.rating) },
              ].map((row) => (
                <tr key={row.l} className="border-b border-line last:border-0">
                  <th className="w-24 bg-steel-50 px-4 py-2.5 text-[12.5px] font-bold text-steel-500">{row.l}</th>
                  {compared.map((p) => (
                    <td key={p.id} className="px-4 py-2.5 text-[13px] text-steel-800">{row.f(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => {
          const price = priceOf(p)
          const inCompare = compare.includes(p.id)
          return (
            <Card key={p.id} className="flex flex-col p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="h-12 w-12 shrink-0 text-steel-300">
                  <PartSchematic kind={schematicFor(p.categoryId)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold leading-6 text-steel-900">{p.name}</p>
                  <p className="mt-0.5 text-[12px] text-steel-400">
                    <span className="code">{p.partNumber}</span> — {p.brand}
                  </p>
                  <Stars value={p.rating} size={11} />
                </div>
              </div>

              <div className="mb-3">
                {price != null ? (
                  <>
                    <span className="num text-[15px] font-extrabold text-steel-900">{toman(price)}</span>
                    <span className="mr-1 text-[11.5px] text-steel-400">تومان</span>
                    {partnerView && p.partnerDiscount ? (
                      <span className="block text-[12px] text-verify">{toFa(p.partnerDiscount)}٪ تخفیف همکاری</span>
                    ) : null}
                  </>
                ) : (
                  <Badge tone="signal">قیمت با استعلام</Badge>
                )}
              </div>

              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="signal" className="flex-1" onClick={() => onPick(p.id)}>
                  انتخاب
                </Button>
                <Button
                  size="sm"
                  variant={inCompare ? 'primary' : 'outline'}
                  onClick={() =>
                    setCompare((c) => (inCompare ? c.filter((x) => x !== p.id) : c.length >= 3 ? c : [...c, p.id]))
                  }
                >
                  مقایسه
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {line?.productId && (
        <Button variant="ghost" onClick={() => onPick('')}>
          <X size={15} />
          حذف محصول انتخاب‌شده این ردیف
        </Button>
      )}
    </div>
  )
}
