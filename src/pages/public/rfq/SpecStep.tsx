import { useMemo, useState } from 'react'
import { ChevronDown, Info, MapPin, Pencil, Plus, Table2, Trash2, Wand2 } from 'lucide-react'
import { Button, Card, Field, Input, NumberStepper, Select } from '@/components/ui'
import { MapPicker } from '@/components/MapPicker'
import { CAPACITIES, centerOf, citiesOf, PROVINCE_NAMES } from '@/lib/iran'
import {
  autoFillColumn, deriveStops, makeStops, PROGRESS_STAGES, usageLabel,
  type InquirySpec, type ProgressStage, type ProjectUsage, type Representative,
} from '@/features/rfq/inquiry'
import { cn, toEn, toFa } from '@/lib/utils'
import { useAuth } from '@/store'

const num = (v: string) => Number(toEn(v).replace(/[^\d.]/g, '')) || 0

export function SpecStep({
  spec, setSpec,
}: {
  spec: InquirySpec
  setSpec: (updater: (s: InquirySpec) => InquirySpec) => void
}) {
  const [showTable, setShowTable] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const user = useAuth((s) => s.user)
  const isSeller = user?.role === 'seller'

  const set = <K extends keyof InquirySpec>(k: K, v: InquirySpec[K]) =>
    setSpec((s) => ({ ...s, [k]: v }))

  const derived = useMemo(() => deriveStops(spec.stopRows, spec.stops), [spec.stopRows, spec.stops])

  const setStops = (n: number) => {
    const count = Math.min(50, Math.max(2, n))
    setSpec((s) => ({ ...s, stops: count, stopRows: makeStops(count, s.stopRows) }))
  }

  const setRow = (index: number, patch: Partial<InquirySpec['stopRows'][number]>) =>
    setSpec((s) => ({
      ...s,
      stopRows: s.stopRows.map((r) => (r.index === index ? { ...r, ...patch } : r)),
    }))

  /**
   * پر کردن ستون.
   * وقتی کاربر اولین مقدار یک ستون را وارد می‌کند، همان مقدار روی
   * ردیف‌های خالی می‌نشیند — چون در عمل ارتفاع طبقات معمولاً یکسان
   * است و تایپ دوباره‌اش برای ۵۰ توقف بی‌معنی است. اگر ردیفی را
   * دستی عوض کند، دست نمی‌خورد.
   */
  const applyColumn = (field: 'ceiling' | 'height', value: number, onlyEmpty: boolean) =>
    setSpec((st) => ({ ...st, stopRows: autoFillColumn(st.stopRows, st.stops, field, value, onlyEmpty) }))

  const setCell = (index: number, field: 'ceiling' | 'height', value: number | null) => {
    setSpec((st) => {
      const rows = st.stopRows.map((r) => (r.index === index ? { ...r, [field]: value } : r))
      // اولین مقدار معتبر ستون، بقیه خالی‌ها را هم پر می‌کند
      const isFirstValue =
        value != null &&
        st.stopRows.filter((r) => r.index >= 1 && r.index !== index && r[field] != null).length === 0
      return {
        ...st,
        stopRows: isFirstValue ? autoFillColumn(rows, st.stops, field, value, true) : rows,
      }
    })
  }

  const addRep = () =>
    set('reps', [
      ...spec.reps,
      { id: `rp${spec.reps.length + 1}`, name: '', phone: '', role: '' },
    ])

  const setRep = (i: number, patch: Partial<Representative>) =>
    set('reps', spec.reps.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const toggleStage = (k: ProgressStage) =>
    set('doneStages', spec.doneStages.includes(k)
      ? spec.doneStages.filter((x) => x !== k)
      : [...spec.doneStages, k])

  const rowsTopDown = [...spec.stopRows].sort((a, b) => b.index - a.index)

  return (
    <div className="space-y-5">
      {/* ── پروژه ── */}
      <Card>
        <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-extrabold text-steel-900">
          مشخصات پروژه
        </h2>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="نام پروژه" required className="sm:col-span-2">
            <Input
              value={spec.projectName}
              onChange={(e) => set('projectName', e.target.value)}
              placeholder="مثلاً برج مسکونی نیاوران"
            />
          </Field>

          <Field
            label="کارفرما"
            required
            hint={isSeller ? 'انتخاب از مشتریان یا افزودن' : 'نام شما'}
          >
            <Input
              value={spec.clientName || (isSeller ? '' : user?.name ?? '')}
              onChange={(e) => set('clientName', e.target.value)}
              placeholder={isSeller ? 'نام مشتری' : user?.name ?? 'نام خریدار'}
              disabled={!isSeller && !!user}
            />
          </Field>

          <Field label="کاربری پروژه" required>
            <Select value={spec.usage} onChange={(e) => set('usage', e.target.value as ProjectUsage)}>
              {(Object.keys(usageLabel) as ProjectUsage[]).map((u) => (
                <option key={u} value={u}>{usageLabel[u]}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* نمایندگان */}
        <div className="border-t border-line p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[14px] font-bold text-steel-800">نماینده کارفرما یا سرپرست کارگاه</p>
              <p className="text-[12.5px] text-steel-400">اختیاری — می‌توانید چند نفر اضافه کنید</p>
            </div>
            <Button size="sm" variant="outline" onClick={addRep}>
              <Plus size={14} />
              افزودن نماینده
            </Button>
          </div>

          {spec.reps.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line py-5 text-center text-[13px] text-steel-400">
              نماینده‌ای اضافه نشده است.
            </p>
          ) : (
            <div className="space-y-2">
              {spec.reps.map((r, i) => (
                <div key={r.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_150px_150px_40px]">
                  <Input value={r.name} onChange={(e) => setRep(i, { name: e.target.value })} placeholder="نام و نام خانوادگی" className="h-10" />
                  <Input value={r.phone} onChange={(e) => setRep(i, { phone: e.target.value })} placeholder="تلفن" className="num h-10" />
                  <Input value={r.role} onChange={(e) => setRep(i, { role: e.target.value })} placeholder="سمت" className="h-10" />
                  <button
                    onClick={() => set('reps', spec.reps.filter((_, j) => j !== i))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-steel-400 transition-colors hover:bg-alert-soft hover:text-alert"
                    aria-label="حذف نماینده"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* آدرس */}
        <div className="border-t border-line p-5">
          <p className="mb-3 flex items-center gap-2 text-[14px] font-bold text-steel-800">
            <MapPin size={15} className="text-steel-400" />
            آدرس پروژه
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="استان" required>
              <Select
                value={spec.province}
                onChange={(e) =>
                  // با تغییر استان، شهر قبلی دیگر معتبر نیست و پاک می‌شود
                  setSpec((st) => ({ ...st, province: e.target.value, city: '', lat: undefined, lng: undefined }))
                }
              >
                {PROVINCE_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="شهر" required hint="از فهرست همان استان">
              <Select value={spec.city} onChange={(e) => set('city', e.target.value)}>
                <option value="">انتخاب کنید…</option>
                {citiesOf(spec.province).map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="نشانی" className="sm:col-span-2">
              <Input value={spec.address} onChange={(e) => set('address', e.target.value)} placeholder="خیابان، کوچه، پلاک" />
            </Field>
            <Field label="موقعیت روی نقشه" className="sm:col-span-2">
              {spec.lat != null && spec.lng != null ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-verify/30 bg-verify-soft px-4 py-3">
                  <MapPin size={16} className="shrink-0 text-verify" />
                  <span className="num flex-1 text-[13.5px] font-semibold text-steel-800">
                    {toFa(spec.lat.toFixed(5))} , {toFa(spec.lng.toFixed(5))}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setMapOpen(true)}>
                    <Pencil size={14} />
                    تغییر موقعیت
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSpec((st) => ({ ...st, lat: undefined, lng: undefined }))}
                  >
                    حذف
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setMapOpen(true)}>
                  <MapPin size={16} />
                  انتخاب موقعیت روی نقشه
                </Button>
              )}
            </Field>
          </div>
        </div>
      </Card>

      {/* ── آسانسور ── */}
      <Card>
        <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-extrabold text-steel-900">
          مشخصات آسانسور
        </h2>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="تعداد دستگاه مشابه" required hint="پیش‌فرض ۱">
            <NumberStepper value={spec.units} min={1} max={99} onChange={(n) => set('units', n)} suffix="دستگاه" />
          </Field>
          <Field label="نام آسانسور" required>
            <Input value={spec.elevatorName} onChange={(e) => set('elevatorName', e.target.value)} />
          </Field>
          <Field label="توضیح مختصر">
            <Input
              value={spec.elevatorNote}
              onChange={(e) => set('elevatorNote', e.target.value)}
              placeholder="ضلع غربی، سمت چپ"
            />
          </Field>

          <Field label="حداکثر ظرفیت" hint="نفر — کیلوگرم" required className="sm:col-span-2">
            <Select
              value={`${spec.capacityPersons}-${spec.capacityKg}`}
              onChange={(e) => {
                const [p, k] = e.target.value.split('-').map(Number)
                setSpec((st) => ({ ...st, capacityPersons: p, capacityKg: k }))
              }}
            >
              {CAPACITIES.map((c) => (
                <option key={`${c.persons}-${c.kg}`} value={`${c.persons}-${c.kg}`}>
                  {toFa(c.persons)} نفر — {toFa(c.kg)} کیلوگرم
                </option>
              ))}
            </Select>
          </Field>
          <Field label="تعداد توقف" hint="۲ تا ۵۰" required>
            <NumberStepper value={spec.stops} min={2} max={50} onChange={setStops} suffix="توقف" />
          </Field>
        </div>

        {/* مراحل انجام‌شده */}
        <div className="border-t border-line p-5">
          <p className="mb-1 text-[14px] font-bold text-steel-800">مراحل انجام‌شده</p>
          <p className="mb-3 text-[12.5px] text-steel-400">
            هر مرحله‌ای که تیک بخورد، از فهرست خدمات اجرا حذف می‌شود.
          </p>
          <div className="flex flex-wrap gap-2">
            {PROGRESS_STAGES.map((s) => {
              const locked = 'locked' in s && s.locked
              const on = spec.doneStages.includes(s.key)
              return (
                <button
                  key={s.key}
                  disabled={locked}
                  onClick={() => toggleStage(s.key)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                    locked && 'cursor-not-allowed border-dashed border-line text-steel-300',
                    !locked && on && 'border-verify bg-verify-soft text-verify',
                    !locked && !on && 'border-line bg-paper text-steel-600 hover:border-steel-300',
                  )}
                  title={locked ? 'استاندارد نتیجه فرایند است و انتخابی نیست' : undefined}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* ── جدول توقف‌ها ── */}
      <Card>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right"
        >
          <span className="flex items-center gap-2.5">
            <Table2 size={17} className="text-steel-400" />
            <span>
              <span className="block text-[15px] font-extrabold text-steel-900">جدول توقف‌ها</span>
              <span className="block text-[12.5px] text-steel-400">
                برای ثبت دقیق‌تر اطلاعات و آسانسورهای خاص
              </span>
            </span>
          </span>
          <ChevronDown size={18} className={cn('shrink-0 text-steel-400 transition-transform', showTable && 'rotate-180')} />
        </button>

        {showTable && (
          <div className="border-t border-line">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-steel-50 px-5 py-3">
              <span className="flex items-center gap-1.5 text-[12.5px] text-steel-500">
                <Wand2 size={14} />
                پر کردن یکسان همه ردیف‌ها:
              </span>
              <ColumnFill label="ارتفاع سقف" placeholder="۲۵۰" onApply={(v) => applyColumn('ceiling', v, false)} />
              <ColumnFill label="فاصله طبقات" placeholder="۳۰۰" onApply={(v) => applyColumn('height', v, false)} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-right">
                <thead>
                  <tr className="border-b border-line bg-steel-50 text-[12.5px] font-bold text-steel-500">
                    <th className="px-4 py-3">توقف</th>
                    <th className="px-4 py-3">شاخص</th>
                    <th className="px-4 py-3">ارتفاع سقف (cm)</th>
                    <th className="px-4 py-3">فاصله / ارتفاع (cm)</th>
                    <th className="px-3 py-3 text-center">ورودی جلو</th>
                    <th className="px-3 py-3 text-center">ورودی پشت</th>
                    <th className="px-3 py-3 text-center">ورودی جانبی</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsTopDown.map((r) => {
                    const isPit = r.index === 0
                    const isTop = r.index === spec.stops
                    return (
                      <tr
                        key={r.index}
                        className={cn('border-b border-line last:border-0', (isPit || isTop) && 'bg-signal-50/50')}
                      >
                        <td className="px-4 py-2.5">
                          <span className="num font-bold text-steel-800">
                            {isPit ? 'چاهک' : toFa(r.index)}
                          </span>
                          {isTop && <span className="mr-1.5 text-[12px] text-signal-700">(اورهد)</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {isPit ? (
                            <span className="code rounded-md bg-steel-200 px-2 py-1 text-[12px] font-bold text-steel-700">PIT</span>
                          ) : (
                            <Input value={r.label} onChange={(e) => setRow(r.index, { label: e.target.value })} className="code h-9 w-20 text-center" />
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            value={r.ceiling != null ? toFa(r.ceiling) : ''}
                            onChange={(e) => setCell(r.index, 'ceiling', num(e.target.value) || null)}
                            className="num h-9 w-24"
                            inputMode="numeric"
                            disabled={isPit}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            value={r.height != null ? toFa(r.height) : ''}
                            onChange={(e) =>
                              isPit || isTop
                                ? setRow(r.index, { height: num(e.target.value) || null })
                                : setCell(r.index, 'height', num(e.target.value) || null)
                            }
                            className="num h-9 w-24"
                            inputMode="numeric"
                            placeholder={isPit ? 'ارتفاع پیت' : isTop ? 'ارتفاع اورهد' : ''}
                          />
                        </td>
                        {([['entryFront', r.entryFront], ['entryRear', r.entryRear], ['entrySide', r.entrySide]] as const).map(
                          ([key, val]) => (
                            <td key={key} className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={val}
                                disabled={isPit}
                                onChange={(e) => setRow(r.index, { [key]: e.target.checked })}
                                className="h-4 w-4 disabled:opacity-30"
                              />
                            </td>
                          ),
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* ── مقادیر محاسبه‌شده ── */}
      <Card className="border-signal-300 bg-signal-50/60 p-5">
        <p className="mb-3 flex items-center gap-2 text-[14px] font-bold text-steel-900">
          <Info size={15} className="text-signal-600" />
          محاسبه‌شده از جدول توقف‌ها
        </p>
        <dl className="grid gap-3 sm:grid-cols-4">
          {[
            { l: 'تعداد ورودی کابین', v: toFa(derived.cabinEntries), u: 'ورودی' },
            { l: 'تعداد درب طبقات', v: toFa(derived.landingDoors), u: 'درب' },
            { l: 'کورس حرکت', v: derived.travel ? toFa(derived.travel) : '—', u: 'متر' },
            { l: 'ارتفاع پیت / اورهد', v: `${derived.pitDepth ? toFa(derived.pitDepth) : '—'} / ${derived.overhead ? toFa(derived.overhead) : '—'}`, u: 'cm' },
          ].map((r) => (
            <div key={r.l} className="rounded-xl bg-paper px-4 py-3">
              <dt className="text-[12px] text-steel-400">{r.l}</dt>
              <dd className="num mt-0.5 text-[17px] font-extrabold text-steel-900">
                {r.v}
                <span className="mr-1.5 text-[12px] font-normal text-steel-400">{r.u}</span>
              </dd>
            </div>
          ))}
        </dl>
        {derived.travel === 0 && (
          <p className="mt-3 text-[12.5px] leading-6 text-notice">
            کورس حرکت صفر است — ستون «فاصله» را در جدول توقف‌ها پر کنید تا لیست قطعات درست
            محاسبه شود.
          </p>
        )}
      </Card>

      <MapPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        value={spec.lat != null && spec.lng != null ? { lat: spec.lat, lng: spec.lng } : undefined}
        center={centerOf(spec.province)}
        onPick={(pos) => setSpec((st) => ({ ...st, lat: pos.lat, lng: pos.lng }))}
      />
    </div>
  )
}

/* ── پر کردن یکجای یک ستون جدول ─────────────────────────────── */
function ColumnFill({
  label, placeholder, onApply,
}: {
  label: string; placeholder: string; onApply: (v: number) => void
}) {
  const [v, setV] = useState('')
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-line bg-paper px-2 py-1">
      <span className="text-[12.5px] text-steel-500">{label}</span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          const n = num(v)
          if (n) onApply(n)
        }}
        placeholder={placeholder}
        inputMode="numeric"
        className="num h-8 w-16 rounded-lg border border-line px-2 text-center text-[13px] focus:border-steel-500 focus:outline-none"
      />
      <button
        onClick={() => {
          const n = num(v)
          if (n) onApply(n)
        }}
        className="rounded-lg bg-steel-800 px-2.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-steel-700"
      >
        اعمال
      </button>
    </div>
  )
}
