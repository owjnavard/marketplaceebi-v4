import { useEffect, useState } from 'react'
import { FileText, ImageIcon, ShoppingBag, StickyNote } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { PanelHead } from '@/layouts/PanelLayout'
import { OrderDetailModal } from '@/components/DetailModals'
import { Badge, Button, Empty, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import type { Order, OrderEvidence, OrderStatus, Product } from '@/lib/api/types'
import { orderStatusLabel, orderStatusTone } from '@/lib/labels'
import { cn, toFa, toman } from '@/lib/utils'
import { useToasts } from '@/store'
import { SELLER_ID } from './Dashboard'

/* ══════════════════════════════════════════════════════════════
   سفارش‌های فروشنده

   تفاوت مهم با پنل مدیر: فروشنده نمی‌تواند وضعیت را همین‌طوری جلو
   ببرد. هر تغییر وضعیت باید مدرک داشته باشد — شماره حواله، تصویر
   بارنامه یا دست‌کم یک توضیح. مدرک در تاریخچه سفارش می‌ماند و در
   پنجره جزئیات دیده می‌شود.
   ══════════════════════════════════════════════════════════════ */

const EVIDENCE_KINDS: { key: OrderEvidence['kind']; label: string; hint: string; icon: React.ReactNode }[] = [
  { key: 'waybill', label: 'شماره حواله', hint: 'شماره حواله یا بارنامه', icon: <FileText size={15} /> },
  { key: 'photo', label: 'تصویر', hint: 'نام فایل تصویر بارنامه یا تحویل', icon: <ImageIcon size={15} /> },
  { key: 'note', label: 'توضیح', hint: 'اگر مدرکی ندارید، دلیل تغییر را بنویسید', icon: <StickyNote size={15} /> },
]

export default function SellerOrders() {
  const [rows, setRows] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Order | null>(null)
  const [changing, setChanging] = useState<{ order: Order; status: OrderStatus } | null>(null)

  const load = () => {
    setLoading(true)
    void Promise.all([api.orders('seller'), api.allProducts()]).then(([r, p]) => {
      setRows(r.filter((o) => o.lines.some((l) => l.sellerId === SELLER_ID)))
      setProducts(p)
      setLoading(false)
      setDetail((cur) => (cur ? r.find((x) => x.id === cur.id) ?? null : null))
    })
  }

  useEffect(load, [])

  const myTotal = (o: Order) =>
    o.lines.filter((l) => l.sellerId === SELLER_ID).reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  const columns: Column<Order>[] = [
    {
      key: 'code', header: 'کد', value: (r) => r.code, sortable: true, width: '110px',
      cell: (r) => <span className="code text-[13px] font-bold text-steel-700">{r.code}</span>,
    },
    {
      key: 'buyer', header: 'خریدار', value: (r) => r.address.fullName,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-steel-900">{r.address.fullName || '—'}</p>
          <p className="num mt-0.5 text-[12px] text-steel-400">{r.address.city || r.address.province}</p>
        </div>
      ),
    },
    {
      key: 'items', header: 'اقلام شما', value: (r) => r.lines.length, secondary: true,
      cell: (r) => {
        const mine = r.lines.filter((l) => l.sellerId === SELLER_ID)
        return (
          <div className="min-w-0">
            <p className="truncate text-[13px] text-steel-700">{mine[0]?.name}</p>
            {mine.length > 1 && (
              <p className="num text-[12px] text-steel-400">و {toFa(mine.length - 1)} قلم دیگر</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'total', header: 'سهم شما', value: (r) => myTotal(r), sortable: true, align: 'end',
      cell: (r) => <span className="num font-bold text-steel-900">{toman(myTotal(r))}</span>,
    },
    {
      key: 'evidence', header: 'مدارک', value: (r) => r.evidence?.length ?? 0, secondary: true,
      cell: (r) =>
        r.evidence?.length ? (
          <span className="num text-[13px] text-steel-600">{toFa(r.evidence.length)} مدرک</span>
        ) : (
          <span className="text-[13px] text-steel-300">—</span>
        ),
    },
    {
      key: 'status', header: 'وضعیت', align: 'end', value: (r) => r.status, width: '180px',
      cell: (r) =>
        r.status === 'cancelled' || r.status === 'delivered' ? (
          <Badge tone={orderStatusTone[r.status]}>{orderStatusLabel[r.status]}</Badge>
        ) : (
          <Select
            value={r.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setChanging({ order: r, status: e.target.value as OrderStatus })}
            className="h-9 text-[13px]"
          >
            {(['pending_payment', 'processing', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((s) => (
              <option key={s} value={s}>{orderStatusLabel[s]}</option>
            ))}
          </Select>
        ),
    },
  ]

  return (
    <>
      <PanelHead
        title="سفارش‌ها"
        description="سفارش‌هایی که شامل کالاهای شماست. برای تغییر وضعیت، ثبت مدرک الزامی است."
      />

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        searchPlaceholder="جستجو در کد سفارش یا نام خریدار…"
        onRowClick={(r) => setDetail(r)}
        empty={<Empty icon={<ShoppingBag size={20} />} title="هنوز سفارشی دریافت نکرده‌اید" />}
      />

      {detail && (
        <OrderDetailModal order={detail} products={products} onClose={() => setDetail(null)} />
      )}

      {changing && (
        <EvidenceModal
          order={changing.order}
          status={changing.status}
          onClose={() => setChanging(null)}
          onDone={() => {
            setChanging(null)
            load()
          }}
        />
      )}
    </>
  )
}

/* ── ثبت مدرک هنگام تغییر وضعیت ─────────────────────────────── */
function EvidenceModal({
  order, status, onClose, onDone,
}: {
  order: Order
  status: OrderStatus
  onClose: () => void
  onDone: () => void
}) {
  const [kind, setKind] = useState<OrderEvidence['kind']>('waybill')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const push = useToasts((s) => s.push)

  const active = EVIDENCE_KINDS.find((k) => k.key === kind)!

  const submit = async () => {
    if (reference.trim().length < 3) {
      setError('برای ثبت تغییر وضعیت باید مدرک یا توضیح وارد کنید.')
      return
    }
    setBusy(true)
    try {
      await api.setOrderStatus(order.id, status, {
        status,
        kind,
        reference: reference.trim(),
        note: note.trim() || undefined,
        at: 'همین حالا',
      })
      push(`وضعیت سفارش به «${orderStatusLabel[status]}» تغییر کرد`)
      onDone()
    } catch {
      push('تغییر وضعیت انجام نشد.', 'error')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="تغییر وضعیت سفارش"
      subtitle={`${order.code} — به «${orderStatusLabel[status]}»`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button variant="signal" loading={busy} onClick={submit}>ثبت و تغییر وضعیت</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-steel-50 px-4 py-3 text-[13px] leading-7 text-steel-600">
          تغییر وضعیت بدون مدرک ثبت نمی‌شود. مدرک در تاریخچه سفارش می‌ماند و خریدار و مدیر
          آن را می‌بینند.
        </p>

        <Field label="نوع مدرک" required group>
          <div className="grid grid-cols-3 gap-2">
            {EVIDENCE_KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => { setKind(k.key); setError('') }}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[12.5px] font-semibold transition-colors',
                  kind === k.key
                    ? 'border-steel-800 bg-steel-800 text-white'
                    : 'border-line bg-paper text-steel-600 hover:border-steel-300',
                )}
              >
                {k.icon}
                {k.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={active.label} hint={active.hint} required error={error}>
          <Input
            value={reference}
            onChange={(e) => { setReference(e.target.value); setError('') }}
            invalid={!!error}
            className={kind === 'waybill' ? 'num' : undefined}
            placeholder={
              kind === 'waybill' ? '۱۲۳۴۵۶۷۸' : kind === 'photo' ? 'barnameh-1403-09-12.jpg' : 'توضیح کوتاه'
            }
          />
        </Field>

        <Field label="توضیح تکمیلی" hint="اختیاری">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="نام راننده، شرکت باربری، زمان تحویل…" />
        </Field>
      </div>
    </Modal>
  )
}
