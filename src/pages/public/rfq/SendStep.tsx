import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight, Check, Eye, Lock, MapPin, Plus, ShieldCheck, Trash2,
} from 'lucide-react'
import { Badge, Button, Card, Field, Input, Select, Spinner, Stars, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import type { Seller } from '@/lib/api/types'
import {
  paymentLabel,
  type Commitment, type InquirySpec, type PartLine, type PaymentMethod, type PaymentTerms,
} from '@/features/rfq/inquiry'
import { cn, toEn, toFa, toman } from '@/lib/utils'

const num = (v: string) => Number(toEn(v).replace(/[^\d.]/g, '')) || 0

export function SendStep({
  spec, lines, partsTotal,
  commitments, setCommitments,
  terms, setTerms,
  chosen, setChosen,
}: {
  spec: InquirySpec
  lines: PartLine[]
  partsTotal: number
  commitments: Commitment[]
  setCommitments: (u: (c: Commitment[]) => Commitment[]) => void
  terms: PaymentTerms
  setTerms: (u: (t: PaymentTerms) => PaymentTerms) => void
  chosen: string[]
  setChosen: (u: (c: string[]) => string[]) => void
}) {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyLocal, setOnlyLocal] = useState(false)
  const [onlyLicensed, setOnlyLicensed] = useState(false)

  useEffect(() => {
    void api.sellers().then((s) => {
      setSellers(s.filter((x) => x.status === 'approved'))
      setLoading(false)
    })
  }, [])

  /* قیمت خرید اجناس از لیست قطعات می‌آید و دستی نیست */
  useEffect(() => {
    setCommitments((cs) => cs.map((c) => (c.auto ? { ...c, price: partsTotal } : c)))
  }, [partsTotal])

  const move = (id: string) =>
    setCommitments((cs) =>
      cs.map((c) =>
        c.id === id
          ? { ...c, side: c.side === 'buyer' ? 'seller' : 'buyer', price: c.side === 'buyer' ? c.price : null }
          : c,
      ),
    )

  const addCommitment = (side: 'buyer' | 'seller') => {
    const title = window.prompt('عنوان تعهد جدید:')
    if (!title?.trim()) return
    setCommitments((cs) => [
      ...cs,
      { id: `cx${Date.now()}`, title: title.trim(), side, price: null },
    ])
  }

  const sellerSide = commitments.filter((c) => c.side === 'seller')
  const buyerSide = commitments.filter((c) => c.side === 'buyer')
  const grandTotal = sellerSide.reduce((s, c) => s + (c.price ?? 0), 0)
  const unpriced = sellerSide.filter((c) => c.price == null).length

  /* فقط شرکت‌های پیمانکاری آسانسور — ارسال به تولیدکننده یا بازرگانی
     در این مرحله بی‌معنی است، چون طرف قرارداد اجرا باید پیمانکار باشد */
  const list = useMemo(
    () =>
      sellers.filter(
        (s) =>
          s.group === 'contractor' &&
          (!onlyLocal || s.province === spec.province) &&
          (!onlyLicensed || s.licensed),
      ),
    [sellers, onlyLocal, onlyLicensed, spec.province],
  )

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      {/* ── تعهدات ── */}
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-extrabold text-steel-900">انتخاب تعهدات</h2>
          <p className="mt-1 text-[13px] leading-7 text-steel-500">
            هر تعهد را می‌توانید به طرف مقابل منتقل کنید. تعهدی که بر عهده پیمانکار باشد باید
            قیمت داشته باشد؛ مجموع همان قیمت‌ها، مبلغ نهایی پیشنهاد را می‌سازد.
          </p>
        </div>

        <div className="grid gap-px bg-line md:grid-cols-2">
          {([
            ['buyer', 'تعهدات کارفرما (خریدار)', buyerSide],
            ['seller', 'تعهدات پیمانکار (فروشنده)', sellerSide],
          ] as const).map(([side, title, rows]) => (
            <div key={side} className="bg-paper p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-steel-800">
                  {title}
                  <Badge tone={side === 'seller' ? 'steel' : 'muted'}>{toFa(rows.length)}</Badge>
                </h3>
                <Button size="sm" variant="outline" onClick={() => addCommitment(side)}>
                  <Plus size={14} />
                  افزودن
                </Button>
              </div>

              <div className="space-y-2">
                {rows.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-steel-400">
                    تعهدی در این ستون نیست.
                  </p>
                )}
                {rows.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-steel-800">
                        {c.title}
                        {c.template && (
                          <Lock size={12} className="shrink-0 text-steel-300" aria-label="تعهد الگو — قابل حذف نیست" />
                        )}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => move(c.id)}
                          title="انتقال به طرف مقابل"
                          className="rounded-lg p-1.5 text-steel-400 transition-colors hover:bg-steel-100 hover:text-steel-800"
                        >
                          <ArrowLeftRight size={15} />
                        </button>
                        {/* تعهدات الگو حذف نمی‌شوند؛ فقط جابه‌جا و قیمت‌گذاری */}
                        {!c.template && (
                          <button
                            onClick={() => setCommitments((cs) => cs.filter((x) => x.id !== c.id))}
                            title="حذف تعهد"
                            className="rounded-lg p-1.5 text-steel-400 transition-colors hover:bg-alert-soft hover:text-alert"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {side === 'seller' && (
                      <div className="mt-2">
                        {c.auto ? (
                          <p className="num rounded-lg bg-steel-50 px-3 py-2 text-[13px] font-bold text-steel-800">
                            {toman(c.price ?? 0)}
                            <span className="mr-1.5 text-[11.5px] font-normal text-steel-400">
                              تومان — از لیست قطعات
                            </span>
                          </p>
                        ) : (
                          <Input
                            value={c.price != null ? toFa(c.price.toLocaleString('en-US')) : ''}
                            onChange={(e) =>
                              setCommitments((cs) =>
                                cs.map((x) => (x.id === c.id ? { ...x, price: num(e.target.value) || null } : x)),
                              )
                            }
                            placeholder="قیمت — تومان"
                            className="num h-9"
                            inputMode="numeric"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-steel-50 px-5 py-4">
          <div>
            {unpriced > 0 && (
              <p className="text-[13px] text-notice">
                <span className="num font-bold">{toFa(unpriced)}</span> تعهد پیمانکار هنوز قیمت ندارد.
              </p>
            )}
          </div>
          <div className="text-left">
            <p className="text-[12.5px] text-steel-500">مجموع تعهدات پیمانکار</p>
            <p className="num text-xl font-extrabold text-steel-900">
              {toman(grandTotal)}
              <span className="mr-1.5 text-[12px] font-normal text-steel-400">تومان</span>
            </p>
          </div>
        </div>
      </Card>

      {/* ── نحوه پرداخت ── */}
      <Card>
        <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-extrabold text-steel-900">
          نحوه پرداخت
        </h2>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="روش پرداخت" required>
            <Select value={terms.method} onChange={(e) => setTerms((t) => ({ ...t, method: e.target.value as PaymentMethod }))}>
              {(Object.keys(paymentLabel) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{paymentLabel[m]}</option>
              ))}
            </Select>
          </Field>
          <Field label="پیش‌پرداخت" hint="درصد">
            <Input
              value={toFa(terms.prepayment)}
              onChange={(e) => setTerms((t) => ({ ...t, prepayment: Math.min(100, num(e.target.value)) }))}
              className="num"
              inputMode="numeric"
            />
          </Field>
          <Field label="مدت چک" hint="ماه">
            <Input
              value={toFa(terms.chequeMonths)}
              onChange={(e) => setTerms((t) => ({ ...t, chequeMonths: num(e.target.value) }))}
              className="num"
              inputMode="numeric"
              disabled={terms.method === 'cash'}
            />
          </Field>
          <Field label="شرایط تکمیلی" hint="تهاتر، مرحله‌بندی پرداخت، ضمانت‌نامه…" className="sm:col-span-3">
            <Textarea
              value={terms.note}
              onChange={(e) => setTerms((t) => ({ ...t, note: e.target.value }))}
              placeholder="مثلاً: ۳۰٪ پیش‌پرداخت، ۴۰٪ پس از تحویل اجناس، ۳۰٪ پس از راه‌اندازی."
            />
          </Field>
        </div>

        {terms.prepayment > 0 && grandTotal > 0 && (
          <p className="border-t border-line bg-steel-50 px-5 py-3 text-[13px] text-steel-600">
            پیش‌پرداخت معادل{' '}
            <span className="num font-extrabold text-steel-900">
              {toman(Math.round((grandTotal * terms.prepayment) / 100))}
            </span>{' '}
            تومان می‌شود.
          </p>
        )}
      </Card>

      {/* ── انتخاب پیمانکار ── */}
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-extrabold text-steel-900">انتخاب شرکت پیمانکار</h2>
          <p className="mt-1 text-[13px] leading-7 text-steel-500">
            اگر هیچ شرکتی انتخاب نکنید، درخواست برای همه شرکت‌های واجد شرایط ارسال می‌شود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-steel-50 px-5 py-3">
          {([
            [onlyLocal, setOnlyLocal, `فقط شرکت‌های بومی (${spec.province})`],
            [onlyLicensed, setOnlyLicensed, 'فقط شرکت‌های مجوزدار'],
          ] as const).map(([val, setter, label], i) => (
            <label
              key={i}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors',
                val ? 'border-steel-800 bg-steel-800 text-white' : 'border-line bg-paper text-steel-600',
              )}
            >
              <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className="h-4 w-4" />
              {label}
            </label>
          ))}

          <span className="num mr-auto text-[13px] text-steel-500">
            {toFa(list.length)} شرکت واجد شرایط
          </span>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2">
          {list.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-line py-8 text-center text-[13.5px] text-steel-400">
              با این فیلترها شرکتی پیدا نشد. فیلترها را کمتر کنید.
            </p>
          )}
          {list.map((s) => {
            const on = chosen.includes(s.id)
            return (
              <button
                key={s.id}
                onClick={() => setChosen((c) => (on ? c.filter((x) => x !== s.id) : [...c, s.id]))}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border p-4 text-right transition-colors',
                  on ? 'border-steel-800 bg-steel-50' : 'border-line hover:border-steel-300',
                )}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold text-white"
                  style={{ background: s.logoColor }}
                >
                  {s.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[14px] font-extrabold text-steel-900">
                    {s.name}
                    {s.verified && <ShieldCheck size={13} className="shrink-0 text-verify" />}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-steel-400">
                    <span className="flex items-center gap-1"><MapPin size={11} />{s.province}</span>
                    <span>شرکت پیمانکاری آسانسور</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Stars value={s.rating} size={11} />
                    {s.licensed && <Badge tone="verify">مجوزدار</Badge>}
                    {s.province === spec.province && <Badge tone="muted">بومی</Badge>}
                  </div>
                </div>
                {on && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-steel-800 text-white">
                    <Check size={13} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="border-t border-line px-5 py-4">
          <p className="flex items-start gap-2 text-[13px] leading-7 text-steel-500">
            <Eye size={14} className="mt-1 shrink-0" />
            هنگام ارسال، از شما پرسیده می‌شود که شماره تماس و اطلاعات مشتری برای شرکت‌ها
            نمایش داده شود یا نه.
          </p>
        </div>
      </Card>

      {/* ── خلاصه ── */}
      <Card className="border-signal-300 bg-signal-50/60 p-5">
        <h3 className="mb-3 text-[14px] font-extrabold text-steel-900">خلاصه ارسال</h3>
        <dl className="grid gap-3 sm:grid-cols-4">
          {[
            { l: 'اقلام لیست', v: toFa(lines.filter((l) => l.selected).length), u: 'قلم' },
            { l: 'تعهدات پیمانکار', v: toFa(sellerSide.length), u: 'مورد' },
            { l: 'مبلغ کل', v: toman(grandTotal), u: 'تومان' },
            { l: 'گیرندگان', v: chosen.length ? toFa(chosen.length) : 'همه', u: 'شرکت' },
          ].map((r) => (
            <div key={r.l} className="rounded-xl bg-paper px-4 py-3">
              <dt className="text-[12px] text-steel-400">{r.l}</dt>
              <dd className="num mt-0.5 text-[16px] font-extrabold text-steel-900">
                {r.v}
                <span className="mr-1.5 text-[11.5px] font-normal text-steel-400">{r.u}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
