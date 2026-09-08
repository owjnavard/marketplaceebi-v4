import { useEffect, useMemo, useState } from 'react'
import {
  Check, Lock, Percent, Plus, RotateCcw, Send, Store, Trash2, TriangleAlert, Wallet, X,
} from 'lucide-react'
import { Badge, Button, Card, Field, Input, Modal, Textarea } from '@/components/ui'
import { PartSchematic, schematicFor } from '@/components/PartSchematic'
import { api } from '@/lib/api'
import type {
  Amendment, AmendmentChange, Inquiry, InquiryLine, Product, Seller,
} from '@/lib/api/types'
import { canSeePartnerPrice, partnerMargin, partnerPrice } from '@/lib/partner'
import { inquiryStatusLabel, inquiryStatusTone } from '@/lib/labels'
import { cn, toEn, toFa, toman } from '@/lib/utils'
import { useAuth, useToasts } from '@/store'

const num = (v: string) => Number(toEn(v).replace(/[^\d.]/g, '')) || 0

/** فروشنده جاری در حالت دمو */
const CURRENT_SELLER = 's1'

type Tab = 'items' | 'offers' | 'changes'

export function InquiryDrawer({
  inquiry, role, sellers, startInEdit, onClose, onChanged,
}: {
  inquiry: Inquiry
  role: 'buyer' | 'seller'
  sellers: Seller[]
  startInEdit: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>(startInEdit && role === 'seller' ? 'offers' : 'items')
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<InquiryLine[]>(inquiry.lines)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pickFor, setPickFor] = useState<InquiryLine | null>(null)
  const [offerOpen, setOfferOpen] = useState(startInEdit && role === 'seller')

  const user = useAuth((s) => s.user)
  const push = useToasts((s) => s.push)

  const mySeller = sellers.find((s) => s.id === CURRENT_SELLER) ?? null
  const partnerView = canSeePartnerPrice(user, mySeller)

  /* فروشنده فقط وقتی می‌تواند اقلام را عوض کند که خریدار اجازه داده باشد */
  const canEditItems = role === 'buyer' || inquiry.allowSellerEdit
  const locked = inquiry.status === 'accepted' || inquiry.status === 'archived'

  useEffect(() => {
    void api.products({ perPage: 200 }).then((r) => setProducts(r.items))
  }, [])

  const productOf = (id?: string) => products.find((p) => p.id === id)

  /** قیمتی که این کاربر می‌بیند */
  const priceFor = (p?: Product) => {
    if (!p || p.price == null) return null
    return partnerView ? (partnerPrice(p) ?? p.price) : p.price
  }
  /** قیمتی که خریدار می‌بیند — فروشنده باید هر دو را ببیند */
  const buyerPrice = (p?: Product) => (p?.price ?? null)

  const total = lines.reduce((s, l) => {
    const u = priceFor(productOf(l.productId))
    return s + (u ?? 0) * l.quantity
  }, 0)

  const setLine = (id: string, patch: Partial<InquiryLine>) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    setDirty(true)
  }

  const removeLine = (id: string) => {
    setLines((ls) => ls.filter((l) => l.id !== id))
    setDirty(true)
  }

  const addLine = () => {
    setLines((ls) => [
      ...ls,
      { id: `nl${Date.now()}`, title: '', quantity: 1, unit: 'عدد' },
    ])
    setDirty(true)
  }

  /* تفاوت اقلام فعلی با اقلام اصلی — مبنای پیشنهاد تغییر فروشنده */
  const changes = useMemo<AmendmentChange[]>(() => {
    const out: AmendmentChange[] = []
    for (const orig of inquiry.lines) {
      const now = lines.find((l) => l.id === orig.id)
      if (!now) {
        out.push({ lineId: orig.id, field: 'removed', before: orig.title, after: '—' })
        continue
      }
      if (now.quantity !== orig.quantity) {
        out.push({
          lineId: orig.id,
          field: 'quantity',
          before: `${toFa(orig.quantity)} ${orig.unit}`,
          after: `${toFa(now.quantity)} ${now.unit}`,
        })
      }
      if (now.productId !== orig.productId) {
        out.push({
          lineId: orig.id,
          field: 'product',
          before: productOf(orig.productId)?.name ?? 'بدون محصول',
          after: productOf(now.productId)?.name ?? 'بدون محصول',
        })
      }
    }
    for (const l of lines) {
      if (!inquiry.lines.some((o) => o.id === l.id)) {
        out.push({ lineId: l.id, field: 'added', before: '—', after: l.title || 'قلم جدید' })
      }
    }
    return out
  }, [lines, inquiry.lines, products])

  /* خریدار تغییرات را مستقیم ذخیره می‌کند؛ فروشنده آن را به‌صورت
     «پیشنهاد تغییر» می‌فرستد تا خریدار تأیید کند */
  const saveItems = async () => {
    setBusy(true)
    try {
      if (role === 'buyer') {
        await api.updateInquiryLines(inquiry.id, lines)
        push('اقلام استعلام به‌روز شد')
      } else {
        const note = window.prompt('توضیح تغییرات برای خریدار:') ?? ''
        await api.proposeAmendment(inquiry.id, {
          sellerId: CURRENT_SELLER,
          note,
          changes,
        })
        push('پیشنهاد تغییر برای خریدار ارسال شد')
      }
      setDirty(false)
      onChanged()
    } catch {
      push('ذخیره انجام نشد.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const decideAmendment = async (a: Amendment, accept: boolean) => {
    setBusy(true)
    await api.decideAmendment(inquiry.id, a.id, accept)
    push(accept ? 'تغییرات پذیرفته و روی استعلام اعمال شد' : 'پیشنهاد تغییر رد شد')
    setBusy(false)
    onChanged()
  }

  const decideOffer = async (offerId: string, accept: boolean) => {
    setBusy(true)
    await api.decideOffer(inquiry.id, offerId, accept)
    push(accept ? 'پیشنهاد تأیید شد' : 'پیشنهاد رد شد')
    setBusy(false)
    onChanged()
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={inquiry.title}
        subtitle={`${inquiry.code} — ثبت ${inquiry.createdAt}`}
        size="xl"
        footer={
          <>
            <div className="ml-auto text-right">
              <p className="text-[12px] text-steel-400">
                جمع {partnerView ? 'با تخفیف همکاری' : 'قابل محاسبه'}
              </p>
              <p className="num text-[16px] font-extrabold text-steel-900">{toman(total)}</p>
            </div>
            <Button variant="ghost" onClick={onClose}>بستن</Button>
            {tab === 'items' && dirty && canEditItems && !locked && (
              <Button variant="signal" loading={busy} onClick={saveItems}>
                {role === 'buyer' ? 'ذخیره تغییرات' : 'ارسال پیشنهاد تغییر'}
              </Button>
            )}
            {role === 'seller' && !locked && tab !== 'items' && (
              <Button variant="signal" onClick={() => setOfferOpen(true)}>
                <Wallet size={15} />
                ثبت پیشنهاد
              </Button>
            )}
          </>
        }
      >
        {/* وضعیت و مجوزها */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={inquiryStatusTone[inquiry.status]}>{inquiryStatusLabel[inquiry.status]}</Badge>
          <Badge tone={inquiry.allowSellerEdit ? 'muted' : 'steel'}>
            {inquiry.allowSellerEdit ? 'ویرایش فروشنده مجاز است' : 'فروشنده فقط قیمت می‌دهد'}
          </Badge>
          {inquiry.note && <span className="text-[13px] text-steel-500">{inquiry.note}</span>}
        </div>

        {/* تب‌ها */}
        <div className="mb-4 flex gap-1 border-b border-line">
          {([
            ['items', `اقلام (${toFa(lines.length)})`],
            ['offers', `پیشنهادها (${toFa(inquiry.offers.length)})`],
            ['changes', `تغییرات (${toFa(inquiry.amendments?.length ?? 0)})`],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                'relative px-4 py-2.5 text-[13.5px] font-bold transition-colors',
                tab === k
                  ? 'text-steel-900 after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-signal-400'
                  : 'text-steel-400 hover:text-steel-700',
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── اقلام ── */}
        {tab === 'items' && (
          <div className="space-y-3">
            {!canEditItems && (
              <p className="flex items-start gap-2 rounded-xl bg-steel-50 px-4 py-3 text-[13px] leading-7 text-steel-600">
                <Lock size={15} className="mt-0.5 shrink-0 text-steel-400" />
                خریدار اجازه تغییر اقلام را نداده است. فقط می‌توانید روی همین اقلام پیشنهاد قیمت بدهید.
              </p>
            )}

            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[760px] text-right">
                <thead>
                  <tr className="border-b border-line bg-steel-50 text-[12.5px] font-bold text-steel-500">
                    <th className="w-12 px-3 py-3">ردیف</th>
                    <th className="px-3 py-3">عنوان</th>
                    <th className="w-24 px-3 py-3">تعداد</th>
                    <th className="w-40 px-3 py-3">محصول</th>
                    <th className="w-32 px-3 py-3">
                      {role === 'seller' ? 'قیمت خریدار' : 'قیمت'}
                    </th>
                    {role === 'seller' && partnerView && <th className="w-32 px-3 py-3">قیمت شما</th>}
                    {canEditItems && !locked && <th className="w-10 px-2 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const p = productOf(l.productId)
                    const bp = buyerPrice(p)
                    const mp = priceFor(p)
                    return (
                      <tr key={l.id} className="border-b border-line last:border-0">
                        <td className="num px-3 py-2.5 text-[13px] text-steel-400">{toFa(i + 1)}</td>
                        <td className="px-3 py-2.5">
                          {canEditItems && !locked && !inquiry.lines.some((o) => o.id === l.id) ? (
                            <Input value={l.title} onChange={(e) => setLine(l.id, { title: e.target.value })} className="h-9" placeholder="عنوان قلم" />
                          ) : (
                            <>
                              <p className="text-[13.5px] font-bold text-steel-900">{l.title}</p>
                              {l.description && <p className="text-[12px] text-steel-400">{l.description}</p>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {canEditItems && !locked ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={toFa(l.quantity)}
                                onChange={(e) => setLine(l.id, { quantity: Math.max(1, num(e.target.value)) })}
                                className="num h-9 w-14 text-center"
                                inputMode="numeric"
                              />
                              {inquiry.lines.find((o) => o.id === l.id)?.quantity !== l.quantity && (
                                <button
                                  onClick={() => setLine(l.id, { quantity: inquiry.lines.find((o) => o.id === l.id)!.quantity })}
                                  className="rounded-lg p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-800"
                                  title="بازگشت به مقدار اصلی"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="num text-[13px] font-semibold">{toFa(l.quantity)} {l.unit}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {p ? (
                            <button
                              onClick={() => canEditItems && !locked && setPickFor(l)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-right',
                                canEditItems && !locked && 'transition-colors hover:border-steel-400',
                              )}
                            >
                              <span className="h-6 w-6 shrink-0 text-steel-300">
                                <PartSchematic kind={schematicFor(p.categoryId)} />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-steel-800">{p.name}</span>
                            </button>
                          ) : canEditItems && !locked ? (
                            <Button size="sm" variant="outline" onClick={() => setPickFor(l)}>
                              <Store size={13} />
                              انتخاب
                            </Button>
                          ) : (
                            <Badge tone="signal">استعلامی</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {bp != null ? (
                            <span className="num text-[13px] font-bold text-steel-900">{toman(bp)}</span>
                          ) : (
                            <Badge tone="signal">استعلام</Badge>
                          )}
                        </td>
                        {role === 'seller' && partnerView && (
                          <td className="px-3 py-2.5">
                            {mp != null ? (
                              <div>
                                <span className="num text-[13px] font-bold text-verify">{toman(mp)}</span>
                                {p && partnerMargin(p) != null && (
                                  <span className="num block text-[11.5px] text-steel-400">
                                    سود {toman((partnerMargin(p) ?? 0) * l.quantity)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[13px] text-steel-300">—</span>
                            )}
                          </td>
                        )}
                        {canEditItems && !locked && (
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => removeLine(l.id)}
                              className="rounded-lg p-1.5 text-steel-400 transition-colors hover:bg-alert-soft hover:text-alert"
                              aria-label="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {canEditItems && !locked && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus size={14} />
                  افزودن قلم
                </Button>
                {dirty && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setLines(inquiry.lines)
                      setDirty(false)
                    }}
                  >
                    <RotateCcw size={14} />
                    بازگشت به اقلام اصلی
                  </Button>
                )}
              </div>
            )}

            {dirty && role === 'seller' && changes.length > 0 && (
              <Card className="border-notice/25 bg-notice-soft p-4">
                <p className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-notice">
                  <TriangleAlert size={15} />
                  {toFa(changes.length)} تغییر آماده ارسال
                </p>
                <p className="text-[13px] leading-7 text-notice">
                  این تغییرات مستقیم اعمال نمی‌شوند؛ به‌صورت پیشنهاد برای خریدار ارسال می‌شوند و
                  او باید تأیید کند.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* ── پیشنهادها ── */}
        {tab === 'offers' && (
          <OffersTab
            inquiry={inquiry}
            role={role}
            sellers={sellers}
            busy={busy}
            onDecide={decideOffer}
          />
        )}

        {/* ── تغییرات ── */}
        {tab === 'changes' && (
          <div className="space-y-3">
            {(inquiry.amendments ?? []).length === 0 && (
              <p className="rounded-xl bg-steel-50 px-4 py-6 text-center text-[13.5px] text-steel-500">
                هیچ پیشنهاد تغییری ثبت نشده است.
              </p>
            )}
            {(inquiry.amendments ?? []).map((a) => {
              const seller = sellers.find((s) => s.id === a.sellerId)
              return (
                <Card key={a.id} className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-bold text-steel-900">
                      پیشنهاد تغییر از {seller?.name ?? 'فروشنده'}
                    </p>
                    <Badge tone={a.status === 'accepted' ? 'verify' : a.status === 'rejected' ? 'alert' : 'notice'}>
                      {a.status === 'accepted' ? 'پذیرفته شد' : a.status === 'rejected' ? 'رد شد' : 'در انتظار تأیید'}
                    </Badge>
                  </div>

                  {a.note && <p className="mb-3 text-[13px] leading-7 text-steel-600">{a.note}</p>}

                  <div className="overflow-hidden rounded-xl border border-line">
                    {a.changes.map((c, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5 text-[13px] last:border-0">
                        <Badge tone="muted">
                          {c.field === 'quantity' ? 'تعداد' : c.field === 'product' ? 'محصول' : c.field === 'added' ? 'افزوده' : 'حذف'}
                        </Badge>
                        <span className="text-steel-400 line-through">{c.before}</span>
                        <span className="text-steel-300">←</span>
                        <span className="font-bold text-steel-900">{c.after}</span>
                      </div>
                    ))}
                  </div>

                  {role === 'buyer' && a.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="signal" loading={busy} onClick={() => decideAmendment(a, true)}>
                        <Check size={14} />
                        تأیید تغییرات
                      </Button>
                      <Button size="sm" variant="outline" loading={busy} onClick={() => decideAmendment(a, false)}>
                        <X size={14} />
                        رد
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </Modal>

      {pickFor && (
        <ProductPick
          line={pickFor}
          products={products}
          partnerView={partnerView}
          onClose={() => setPickFor(null)}
          onPick={(id) => {
            setLine(pickFor.id, { productId: id || undefined })
            setPickFor(null)
          }}
        />
      )}

      {offerOpen && (
        <OfferForm
          inquiry={inquiry}
          products={products}
          partnerView={partnerView}
          onClose={() => setOfferOpen(false)}
          onDone={() => {
            setOfferOpen(false)
            onChanged()
          }}
        />
      )}
    </>
  )
}

/* ── تب پیشنهادها ───────────────────────────────────────────── */
function OffersTab({
  inquiry, role, sellers, busy, onDecide,
}: {
  inquiry: Inquiry
  role: 'buyer' | 'seller'
  sellers: Seller[]
  busy: boolean
  onDecide: (offerId: string, accept: boolean) => void
}) {
  if (inquiry.offers.length === 0) {
    return (
      <p className="rounded-xl bg-steel-50 px-4 py-8 text-center text-[13.5px] text-steel-500">
        {role === 'seller'
          ? 'هنوز پیشنهادی ثبت نشده است. با دکمه «ثبت پیشنهاد» قیمت خود را اعلام کنید.'
          : 'هنوز پیشنهادی دریافت نشده است.'}
      </p>
    )
  }

  const cheapest = Math.min(...inquiry.offers.map((o) => o.total))

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {inquiry.offers.map((o) => {
        const seller = sellers.find((s) => s.id === o.sellerId)
        const mine = o.sellerId === CURRENT_SELLER
        return (
          <Card
            key={o.id}
            className={cn(
              'flex flex-col overflow-hidden',
              o.status === 'accepted' && 'border-verify ring-1 ring-verify/25',
              o.status === 'rejected' && 'opacity-55',
            )}
          >
            {o.total === cheapest && o.status === 'submitted' && (
              <div className="bg-signal-50 px-4 py-1.5">
                <Badge tone="signal">کمترین قیمت</Badge>
              </div>
            )}
            <div className="flex-1 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-[14px] font-extrabold text-steel-900">
                  {seller?.name ?? 'فروشنده'}
                  {mine && <span className="mr-2 text-[12px] font-normal text-steel-400">(شما)</span>}
                </p>
                {o.status === 'accepted' && <Badge tone="verify">تأیید شد</Badge>}
                {o.status === 'rejected' && <Badge tone="alert">رد شد</Badge>}
              </div>

              <p className="num text-xl font-extrabold text-steel-900">
                {toman(o.total)}
                <span className="mr-1.5 text-[12px] font-normal text-steel-400">تومان</span>
              </p>

              <dl className="mt-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-steel-500">زمان تحویل</dt>
                  <dd className="num font-bold">{toFa(o.leadTimeDays)} روز</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-steel-500">اعتبار تا</dt>
                  <dd className="num font-bold">{o.validUntil}</dd>
                </div>
              </dl>

              {o.note && (
                <p className="mt-3 rounded-xl bg-steel-50 px-3 py-2 text-[12.5px] leading-6 text-steel-600">{o.note}</p>
              )}
            </div>

            {role === 'buyer' && o.status === 'submitted' && inquiry.status !== 'accepted' && (
              <div className="flex gap-2 border-t border-line p-3">
                <Button size="sm" variant="signal" className="flex-1" loading={busy} onClick={() => onDecide(o.id, true)}>
                  <Check size={14} />
                  تأیید
                </Button>
                <Button size="sm" variant="outline" loading={busy} onClick={() => onDecide(o.id, false)}>
                  <X size={14} />
                  رد
                </Button>
              </div>
            )}

            {role === 'seller' && mine && o.status === 'submitted' && (
              <div className="border-t border-line p-3">
                <Button size="sm" variant="outline" className="w-full" loading={busy} onClick={() => onDecide(o.id, false)}>
                  <X size={14} />
                  پس گرفتن پیشنهاد
                </Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/* ── فرم ثبت پیشنهاد فروشنده ────────────────────────────────── */
function OfferForm({
  inquiry, products, partnerView, onClose, onDone,
}: {
  inquiry: Inquiry
  products: Product[]
  partnerView: boolean
  onClose: () => void
  onDone: () => void
}) {
  const existing = inquiry.offers.find((o) => o.sellerId === CURRENT_SELLER)
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    if (existing) return existing.unitPrices
    // پیش‌فرض: قیمت محصول انتخاب‌شده هر ردیف
    const init: Record<string, number> = {}
    for (const l of inquiry.lines) {
      const p = products.find((x) => x.id === l.productId)
      if (p?.price != null) init[l.id] = p.price
    }
    return init
  })
  const [leadTime, setLeadTime] = useState(existing?.leadTimeDays ?? 14)
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? '۱۴۰۳/۱۰/۱۵')
  const [note, setNote] = useState(existing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const push = useToasts((s) => s.push)

  const total = inquiry.lines.reduce((s, l) => s + (prices[l.id] ?? 0) * l.quantity, 0)
  const filled = inquiry.lines.filter((l) => (prices[l.id] ?? 0) > 0).length

  const submit = async () => {
    if (filled === 0) {
      push('حداقل برای یک ردیف قیمت وارد کنید.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.submitOffer({
        inquiryId: inquiry.id,
        sellerId: CURRENT_SELLER,
        unitPrices: prices,
        total,
        leadTimeDays: leadTime,
        validUntil,
        note: note || undefined,
      })
      push('پیشنهاد شما ارسال شد')
      onDone()
    } catch {
      push('ارسال پیشنهاد انجام نشد.', 'error')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="ثبت پیشنهاد قیمت"
      subtitle={`${inquiry.code} — ${inquiry.title}`}
      size="lg"
      footer={
        <>
          <div className="ml-auto text-right">
            <p className="text-[12px] text-steel-400">جمع پیشنهاد</p>
            <p className="num text-[16px] font-extrabold text-steel-900">{toman(total)}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button variant="signal" loading={busy} onClick={submit}>
            <Send size={15} />
            ارسال پیشنهاد
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {partnerView && (
          <p className="flex items-start gap-2 rounded-xl bg-verify-soft px-4 py-3 text-[13px] leading-7 text-verify">
            <Percent size={15} className="mt-0.5 shrink-0" />
            قیمت پیش‌فرض هر ردیف، قیمت عمومی محصول است. سود شما اختلاف همین عدد با قیمت
            همکاری‌تان خواهد بود.
          </p>
        )}

        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13.5px] font-bold text-steel-800">قیمت واحد هر ردیف</p>
          <span className="num text-[12.5px] text-steel-400">
            {toFa(filled)} از {toFa(inquiry.lines.length)} تکمیل شده
          </span>
        </div>

        <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {inquiry.lines.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-40 flex-1">
                <p className="text-[13px] font-semibold text-steel-900">{l.title}</p>
                <p className="num text-[12px] text-steel-400">{toFa(l.quantity)} {l.unit}</p>
              </div>
              <Input
                value={prices[l.id] ? toFa(prices[l.id].toLocaleString('en-US')) : ''}
                onChange={(e) => setPrices((p) => ({ ...p, [l.id]: num(e.target.value) }))}
                placeholder="قیمت واحد"
                inputMode="numeric"
                className="num h-9 w-36 text-left"
              />
              <span className="num w-32 text-left text-[12.5px] font-bold text-steel-700">
                {prices[l.id] ? toman(prices[l.id] * l.quantity) : '—'}
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="زمان تحویل" hint="روز کاری" required>
            <Input value={toFa(leadTime)} onChange={(e) => setLeadTime(num(e.target.value))} className="num" inputMode="numeric" />
          </Field>
          <Field label="اعتبار پیشنهاد تا" required>
            <Input value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="num" />
          </Field>
        </div>

        <Field label="توضیح برای خریدار" hint="اختیاری">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="شرایط حمل، ضمانت، زمان‌بندی…" />
        </Field>
      </div>
    </Modal>
  )
}

/* ── انتخاب محصول ───────────────────────────────────────────── */
function ProductPick({
  line, products, partnerView, onClose, onPick,
}: {
  line: InquiryLine
  products: Product[]
  partnerView: boolean
  onClose: () => void
  onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const list = products
    .filter((p) => !q || (p.name + p.partNumber + p.brand).includes(q))
    .slice(0, 40)

  return (
    <Modal open onClose={onClose} title="انتخاب محصول" subtitle={line.title} size="lg">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…" className="mb-4" />
      <div className="space-y-2">
        {list.map((p) => {
          const shown = partnerView ? (partnerPrice(p) ?? p.price) : p.price
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-right transition-colors hover:border-steel-400 hover:bg-steel-50"
            >
              <span className="h-10 w-10 shrink-0 text-steel-300">
                <PartSchematic kind={schematicFor(p.categoryId)} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-steel-900">{p.name}</p>
                <p className="text-[12px] text-steel-400"><span className="code">{p.partNumber}</span> — {p.brand}</p>
              </div>
              <span className="num shrink-0 text-[13px] font-bold text-steel-900">
                {shown != null ? toman(shown) : 'استعلامی'}
              </span>
            </button>
          )
        })}
      </div>
      {line.productId && (
        <Button variant="ghost" className="mt-3" onClick={() => onPick('')}>
          <X size={14} />
          حذف محصول این ردیف
        </Button>
      )}
    </Modal>
  )
}
