import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, Phone, Send, User } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import { SpecStep } from './rfq/SpecStep'
import { PartsStep } from './rfq/PartsStep'
import { SendStep } from './rfq/SendStep'
import { api } from '@/lib/api'
import type { Product, Seller } from '@/lib/api/types'
import { canSeePartnerPrice, partnerPrice } from '@/lib/partner'
import {
  DEFAULT_SETTINGS, buildParts, commitmentsFrom, deriveStops, emptySpec,
  type BuildSettings, type Commitment, type InquirySpec, type PartLine, type PaymentTerms,
} from '@/features/rfq/inquiry'
import { cn, toFa } from '@/lib/utils'
import { useAuth, useToasts } from '@/store'

/* ══════════════════════════════════════════════════════════════
   استعلام — جریان سه‌مرحله‌ای نسخه ۳

   ۱) مشخصات پروژه و آسانسور، با جدول توقف‌ها
   ۲) لیست قطعات: تنظیمات سمت راست، اقلام سمت چپ
   ۳) ارسال به شرکت پیمانکار: تعهدات، پرداخت، انتخاب شرکت
   ══════════════════════════════════════════════════════════════ */

const STEPS = ['مشخصات پروژه', 'لیست قطعات', 'ارسال به پیمانکار']

export default function Rfq() {
  const [step, setStep] = useState(0)
  const [spec, setSpec] = useState<InquirySpec>(emptySpec)
  const [settings, setSettings] = useState<BuildSettings>(DEFAULT_SETTINGS)
  const [lines, setLines] = useState<PartLine[]>([])
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [terms, setTerms] = useState<PaymentTerms>({
    method: 'mixed', prepayment: 30, chequeMonths: 3, note: '',
  })
  const [chosen, setChosen] = useState<string[]>([])
  const [showContact, setShowContact] = useState(true)
  /* آیا فروشنده اجازه تغییر اقلام و شرایط را دارد؟ خریدار تعیین می‌کند */
  const [allowSellerEdit, setAllowSellerEdit] = useState(true)
  /* تأیید نهایی ارسال، جایی که تصمیم نمایش اطلاعات تماس گرفته می‌شود */
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [doneCode, setDoneCode] = useState<string | null>(null)

  const user = useAuth((s) => s.user)
  const push = useToasts((s) => s.push)
  const navigate = useNavigate()

  const derived = useMemo(() => deriveStops(spec.stopRows, spec.stops), [spec.stopRows, spec.stops])

  /* جمع قابل محاسبه لیست قطعات — همین عدد وارد تعهد «خرید اجناس»
     در مرحله بعد می‌شود، پس اینجا یک‌بار حساب می‌شود نه دو جا */
  const [products, setProducts] = useState<Product[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])

  useEffect(() => {
    void Promise.all([api.products({ perPage: 100 }), api.sellers()]).then(([p, sl]) => {
      setProducts(p.items)
      setSellers(sl)
    })
  }, [])

  const partnerView = canSeePartnerPrice(user, sellers.find((s) => s.id === 's1') ?? null)

  const partsTotal = useMemo(
    () =>
      lines
        .filter((l) => l.selected && l.productId)
        .reduce((sum, l) => {
          const p = products.find((x) => x.id === l.productId)
          if (!p || p.price == null) return sum
          const unit = partnerView ? (partnerPrice(p) ?? p.price) : p.price
          return sum + unit * l.quantity
        }, 0),
    [lines, products, partnerView],
  )

  /* تعهدات از قالب‌های مدیر ساخته می‌شوند و به نوع سیستم بستگی دارند.
     تعهداتی که کاربر دستی اضافه یا جابه‌جا کرده حفظ می‌شوند. */
  const buildCommitments = () =>
    setCommitments((old) => {
      const fresh = commitmentsFrom(settings.system, partsTotal)
      const custom = old.filter((c) => !c.template)
      return [
        ...fresh.map((f) => {
          const prev = old.find((o) => o.id === f.id)
          return prev ? { ...f, side: prev.side, price: f.auto ? f.price : prev.price } : f
        }),
        ...custom,
      ]
    })

  const goNext = () => {
    if (step === 0) {
      if (!spec.projectName.trim()) {
        push('نام پروژه را وارد کنید.', 'error')
        return
      }
      if (!spec.city.trim()) {
        push('شهر پروژه را وارد کنید.', 'error')
        return
      }
      if (lines.length === 0) setLines(buildParts(spec, settings))
    }
    if (step === 1) buildCommitments()
    setStep((s) => s + 1)
    window.scrollTo({ top: 0 })
  }

  const submit = async () => {
    if (!user) {
      navigate('/login?next=/rfq')
      return
    }
    setConfirmOpen(false)
    setBusy(true)
    try {
      const selected = lines.filter((l) => l.selected)
      const inquiry = await api.createInquiry({
        kind: 'project',
        buyerId: user.id,
        title: `${spec.projectName} — ${spec.elevatorName}`,
        note: [
          spec.elevatorNote,
          `کاربری: ${spec.usage}`,
          terms.note,
          chosen.length ? `ارسال به ${toFa(chosen.length)} شرکت منتخب` : 'ارسال به همه شرکت‌های واجد شرایط',
          showContact ? 'اطلاعات تماس نمایش داده می‌شود' : 'اطلاعات تماس مخفی است',
        ].filter(Boolean).join(' — '),
        allowSellerEdit,
        lines: selected.map((l, i) => ({
          id: `l${i + 1}`,
          productId: l.productId,
          partKey: l.group,
          title: l.title,
          description: l.detail,
          quantity: l.quantity,
          unit: l.unit,
        })),
      })
      setDoneCode(inquiry.code)
    } catch {
      push('ثبت استعلام انجام نشد. دوباره تلاش کنید.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (doneCode) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20">
        <Card className="p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-verify-soft text-verify">
            <CheckCircle2 size={28} />
          </span>
          <h1 className="text-xl font-extrabold text-steel-900">استعلام ارسال شد</h1>
          <p className="mt-2 text-[14px] leading-8 text-steel-500">
            کد پیگیری <span className="code font-bold text-steel-900">{doneCode}</span> است.
            پیشنهادها را در پنل خود مقایسه کنید.
          </p>
          <div className="mt-6 flex gap-2">
            <Link to="/panel/inquiries" className="flex-1">
              <Button variant="signal" className="w-full">استعلام‌های من</Button>
            </Link>
            <Link to="/products" className="flex-1">
              <Button variant="outline" className="w-full">ادامه گشت‌وگذار</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-8">
      <div className="mb-6">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.2em] text-signal-600">استعلام پروژه</p>
        <h1 className="text-2xl font-extrabold text-steel-900">
          {['مشخصات پروژه و آسانسور را وارد کنید',
            'لیست قطعات را بسازید و تنظیم کنید',
            'تعهدات را مشخص و برای پیمانکاران بفرستید'][step]}
        </h1>
      </div>

      {/* گام‌ها */}
      <ol className="mb-6 flex overflow-hidden rounded-2xl border border-line bg-paper">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3.5 text-right transition-colors',
                i === step ? 'bg-steel-800 text-white' : i < step ? 'text-steel-700 hover:bg-steel-50' : 'text-steel-300',
              )}
            >
              <span
                className={cn(
                  'num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold',
                  i === step ? 'bg-signal-400 text-steel-900' : i < step ? 'bg-verify text-white' : 'bg-steel-100',
                )}
              >
                {i < step ? <Check size={14} /> : toFa(i + 1)}
              </span>
              <span className="hidden text-[14px] font-bold sm:block">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && <SpecStep spec={spec} setSpec={setSpec} />}
      {step === 1 && (
        <PartsStep
          spec={spec}
          settings={settings}
          setSettings={setSettings}
          lines={lines}
          setLines={setLines}
        />
      )}
      {step === 2 && (
        <SendStep
          spec={spec}
          lines={lines}
          partsTotal={partsTotal}
          commitments={commitments}
          setCommitments={setCommitments}
          terms={terms}
          setTerms={setTerms}
          chosen={chosen}
          setChosen={setChosen}
        />
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ArrowRight size={16} />
          مرحله قبل
        </Button>

        {step < 2 ? (
          <Button variant="signal" size="lg" onClick={goNext}>
            {step === 0 ? 'ساخت لیست قطعات' : 'ادامه به ارسال'}
            <ArrowLeft size={17} />
          </Button>
        ) : (
          <Button
            variant="signal"
            size="lg"
            loading={busy}
            onClick={() => (user ? setConfirmOpen(true) : submit())}
          >
            <Send size={17} />
            {user ? 'ارسال به شرکت پیمانکار' : 'ورود و ارسال'}
          </Button>
        )}
      </div>

      {/* تأیید ارسال — انتخاب نمایش اطلاعات تماس اینجا انجام می‌شود */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="ارسال درخواست"
        subtitle={`${spec.projectName || 'پروژه بدون نام'} — ${spec.elevatorName}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>انصراف</Button>
            <Button variant="signal" loading={busy} onClick={submit}>
              <Send size={16} />
              ارسال نهایی
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <dl className="divide-y divide-line rounded-xl border border-line">
            {[
              { l: 'اقلام انتخاب‌شده', v: `${toFa(lines.filter((l) => l.selected).length)} قلم` },
              { l: 'گیرندگان', v: chosen.length ? `${toFa(chosen.length)} شرکت منتخب` : 'همه شرکت‌های واجد شرایط' },
            ].map((r) => (
              <div key={r.l} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13.5px]">
                <dt className="text-steel-500">{r.l}</dt>
                <dd className="num font-bold text-steel-900">{r.v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="mb-2 text-[13.5px] font-bold text-steel-800">
              اطلاعات تماس شما برای شرکت‌ها نمایش داده شود؟
            </p>
            <div className="grid gap-2">
              {([
                [true, 'نمایش داده شود', 'شرکت‌ها می‌توانند مستقیم با شما تماس بگیرند.', <Eye size={16} key="a" />],
                [false, 'مخفی بماند', 'ارتباط فقط از طریق سامانه انجام می‌شود.', <EyeOff size={16} key="b" />],
              ] as const).map(([val, title, desc, icon]) => (
                <button
                  key={String(val)}
                  onClick={() => setShowContact(val)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3.5 text-right transition-colors',
                    showContact === val ? 'border-steel-800 bg-steel-50' : 'border-line hover:border-steel-300',
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-steel-500">{icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold text-steel-900">{title}</span>
                    <span className="block text-[12.5px] leading-6 text-steel-500">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13.5px] font-bold text-steel-800">
              فروشنده اجازه تغییر اقلام و شرایط را داشته باشد؟
            </p>
            <div className="grid gap-2">
              {([
                [true, 'اجازه دارد', 'فروشنده می‌تواند اقلام را عوض کند، ولی تغییرات برای شما نمایش داده می‌شود و باید تأیید کنید.'],
                [false, 'اجازه ندارد', 'فروشنده فقط می‌تواند روی همین اقلام قیمت بدهد.'],
              ] as const).map(([val, title, desc]) => (
                <button
                  key={String(val)}
                  onClick={() => setAllowSellerEdit(val)}
                  className={cn(
                    'rounded-xl border p-3.5 text-right transition-colors',
                    allowSellerEdit === val ? 'border-steel-800 bg-steel-50' : 'border-line hover:border-steel-300',
                  )}
                >
                  <span className="block text-[13.5px] font-bold text-steel-900">{title}</span>
                  <span className="block text-[12.5px] leading-6 text-steel-500">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {showContact && (
            <div className="rounded-xl bg-steel-50 px-4 py-3">
              <p className="mb-2 text-[12.5px] font-bold text-steel-700">آنچه نمایش داده می‌شود</p>
              <ul className="space-y-1.5 text-[13px] text-steel-600">
                <li className="flex items-center gap-2">
                  <User size={13} className="text-steel-400" />
                  {spec.clientName || user?.name || '—'}
                </li>
                <li className="num flex items-center gap-2">
                  <Phone size={13} className="text-steel-400" />
                  {user?.phone ?? '—'}
                </li>
                {spec.reps.length > 0 && (
                  <li className="flex items-center gap-2">
                    <User size={13} className="text-steel-400" />
                    {toFa(spec.reps.length)} نماینده با شماره تماس
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {step === 0 && derived.travel > 0 && (
        <p className="mt-3 text-center text-[13px] text-steel-400">
          کورس محاسبه‌شده: <span className="num font-bold text-steel-700">{toFa(derived.travel)}</span> متر
          — <span className="num font-bold text-steel-700">{toFa(derived.landingDoors)}</span> درب طبقه
        </p>
      )}
    </div>
  )
}
