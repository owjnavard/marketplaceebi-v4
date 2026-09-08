import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive, ArchiveRestore, Eye, LayoutGrid, Lock, MessageSquareQuote,
  Pencil, Plus, Rows3, Unlock, Wallet,
} from 'lucide-react'
import { PanelHead } from '@/layouts/PanelLayout'
import { Badge, Button, Card, Empty, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import type { Inquiry, InquiryStatus, Seller } from '@/lib/api/types'
import { INQUIRY_STATUSES, inquiryStatusLabel, inquiryStatusTone } from '@/lib/labels'
import { cn, toFa, toman } from '@/lib/utils'
import { useToasts } from '@/store'
import { InquiryDrawer } from './InquiryDrawer'

/* ══════════════════════════════════════════════════════════════
   صفحه استعلام‌ها — مشترک بین پنل خریدار و فروشنده

   یک صفحه با دو نقش. تفاوت‌ها:
   • خریدار: استعلام جدید می‌سازد، پیشنهادها را می‌بیند و می‌پذیرد،
     و تغییرات پیشنهادی فروشنده را تأیید یا رد می‌کند.
   • فروشنده: پیشنهاد ثبت یا رد می‌کند و — اگر خریدار اجازه داده
     باشد — اقلام را تغییر می‌دهد.

   دو نوع نمایش دارد: کارتی و ردیفی.
   ══════════════════════════════════════════════════════════════ */

export default function Inquiries({ role }: { role: 'buyer' | 'seller' }) {
  const [rows, setRows] = useState<Inquiry[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'card' | 'row'>('card')
  const [status, setStatus] = useState<InquiryStatus | 'all'>('all')
  const [open, setOpen] = useState<Inquiry | null>(null)
  const [editing, setEditing] = useState(false)
  const push = useToasts((s) => s.push)

  const load = () => {
    setLoading(true)
    void Promise.all([api.inquiries(role), api.sellers()]).then(([i, s]) => {
      setRows(i)
      setSellers(s)
      setLoading(false)
      // اگر پنجره باز است، نسخه تازه همان استعلام را نشان بده
      setOpen((cur) => (cur ? i.find((x) => x.id === cur.id) ?? null : null))
    })
  }

  useEffect(load, [role])

  const counts = useMemo(() => {
    const m = {} as Record<InquiryStatus | 'all', number>
    m.all = rows.length
    for (const st of INQUIRY_STATUSES) m[st] = rows.filter((r) => r.status === st).length
    return m
  }, [rows])

  const list = useMemo(
    () =>
      rows
        // آرشیوشده‌ها فقط وقتی نمایش داده می‌شوند که فیلترشان انتخاب شود
        .filter((r) => (status === 'all' ? r.status !== 'archived' : r.status === status))
        .sort((a, b) => b.code.localeCompare(a.code)),
    [rows, status],
  )

  if (loading) return <Spinner />

  const archive = async (r: Inquiry, on: boolean) => {
    await api.setInquiryStatus(r.id, on ? 'archived' : 'sent')
    push(on ? 'استعلام آرشیو شد' : 'استعلام از آرشیو خارج شد')
    load()
  }

  return (
    <>
      <PanelHead
        title={role === 'buyer' ? 'درخواست‌ها' : 'استعلام‌های دریافتی'}
        description={
          role === 'buyer'
            ? 'استعلام‌هایی که ثبت کرده‌اید و پیشنهادهای دریافتی'
            : 'درخواست‌های خریداران؛ پیشنهاد ثبت کنید یا رد کنید'
        }
        action={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-line">
              {([['card', <LayoutGrid size={16} key="c" />], ['row', <Rows3 size={16} key="r" />]] as const).map(
                ([v, icon]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-label={v === 'card' ? 'نمایش کارتی' : 'نمایش ردیفی'}
                    aria-pressed={view === v}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center transition-colors',
                      view === v ? 'bg-steel-800 text-white' : 'bg-paper text-steel-500 hover:bg-steel-50',
                    )}
                  >
                    {icon}
                  </button>
                ),
              )}
            </div>
            {role === 'buyer' && (
              <Link to="/rfq">
                <Button variant="signal"><Plus size={16} />استعلام جدید</Button>
              </Link>
            )}
          </div>
        }
      />

      {/* فیلتر وضعیت */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <StatusChip active={status === 'all'} onClick={() => setStatus('all')} label="همه" n={counts.all} />
        {INQUIRY_STATUSES.map((st) => (
          <StatusChip
            key={st}
            active={status === st}
            onClick={() => setStatus(st)}
            label={inquiryStatusLabel[st]}
            n={counts[st] ?? 0}
          />
        ))}
      </div>

      {list.length === 0 ? (
        <Empty
          icon={<MessageSquareQuote size={20} />}
          title={status === 'all' ? 'استعلامی وجود ندارد' : `استعلامی با وضعیت «${inquiryStatusLabel[status]}» نیست`}
          description={role === 'buyer' && status === 'all' ? 'برای یک پروژه استعلام بفرستید تا فروشندگان پیشنهاد بدهند.' : undefined}
          action={
            role === 'buyer' && status === 'all' ? (
              <Link to="/rfq"><Button>ثبت اولین استعلام</Button></Link>
            ) : undefined
          }
        />
      ) : view === 'card' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <InquiryCard
              key={r.id}
              inquiry={r}
              role={role}
              onOpen={(edit) => {
                setOpen(r)
                setEditing(edit)
              }}
              onArchive={archive}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-right">
              <thead>
                <tr className="border-b border-line bg-steel-50 text-[12.5px] font-bold text-steel-500">
                  <th className="w-32 px-4 py-3">کد</th>
                  <th className="px-4 py-3">عنوان</th>
                  <th className="w-28 px-4 py-3">اقلام</th>
                  <th className="w-40 px-4 py-3">پیشنهادها</th>
                  <th className="w-36 px-4 py-3">وضعیت</th>
                  <th className="w-44 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const best = r.offers.length ? Math.min(...r.offers.map((o) => o.total)) : 0
                  return (
                    <tr
                      key={r.id}
                      onClick={() => { setOpen(r); setEditing(false) }}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-steel-50/70"
                    >
                      <td className="px-4 py-3">
                        <span className="code text-[12.5px] font-bold text-steel-700">{r.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-[14px] font-bold text-steel-900">{r.title}</p>
                        <p className="num mt-0.5 text-[12px] text-steel-400">{r.createdAt}</p>
                      </td>
                      <td className="num px-4 py-3 text-[13px] text-steel-600">{toFa(r.lines.length)} قلم</td>
                      <td className="px-4 py-3">
                        {r.offers.length ? (
                          <span className="num text-[13px] text-steel-700">
                            <span className="font-extrabold">{toFa(r.offers.length)}</span> — از {toman(best)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-steel-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={inquiryStatusTone[r.status]}>{inquiryStatusLabel[r.status]}</Badge>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          inquiry={r}
                          role={role}
                          onOpen={(edit) => { setOpen(r); setEditing(edit) }}
                          onArchive={archive}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {open && (
        <InquiryDrawer
          inquiry={open}
          role={role}
          sellers={sellers}
          startInEdit={editing}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
    </>
  )
}

/* ── اجزای کمکی ─────────────────────────────────────────────── */

function StatusChip({
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

function RowActions({
  inquiry, role, onOpen, onArchive,
}: {
  inquiry: Inquiry
  role: 'buyer' | 'seller'
  onOpen: (edit: boolean) => void
  onArchive: (r: Inquiry, on: boolean) => void
}) {
  const archived = inquiry.status === 'archived'
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" variant="outline" onClick={() => onOpen(false)}>
        <Eye size={14} />
        مشاهده
      </Button>
      {role === 'buyer' ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpen(true)}>
            <Pencil size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onArchive(inquiry, !archived)}>
            {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="signal" onClick={() => onOpen(true)}>
          <Wallet size={14} />
          پیشنهاد
        </Button>
      )}
    </div>
  )
}

function InquiryCard({
  inquiry, role, onOpen, onArchive,
}: {
  inquiry: Inquiry
  role: 'buyer' | 'seller'
  onOpen: (edit: boolean) => void
  onArchive: (r: Inquiry, on: boolean) => void
}) {
  const best = inquiry.offers.length ? Math.min(...inquiry.offers.map((o) => o.total)) : 0
  const pendingAmendments = inquiry.amendments?.filter((a) => a.status === 'pending').length ?? 0

  return (
    <Card className={cn('flex flex-col p-5', inquiry.status === 'archived' && 'opacity-70')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="code text-[12px] font-bold text-steel-500">{inquiry.code}</span>
            <Badge tone={inquiryStatusTone[inquiry.status]}>{inquiryStatusLabel[inquiry.status]}</Badge>
            <Badge tone={inquiry.allowSellerEdit ? 'muted' : 'steel'}>
              {inquiry.allowSellerEdit ? <Unlock size={10} /> : <Lock size={10} />}
              {inquiry.allowSellerEdit ? 'ویرایش فروشنده مجاز' : 'فقط قیمت‌گذاری'}
            </Badge>
          </div>
          <h3 className="text-[15px] font-extrabold leading-7 text-steel-900">{inquiry.title}</h3>
          <p className="num mt-1 text-[12.5px] text-steel-400">
            {toFa(inquiry.lines.length)} قلم — ثبت {inquiry.createdAt}
          </p>
        </div>
      </div>

      {inquiry.offers.length > 0 && (
        <div className="mb-3 rounded-xl bg-signal-50 px-4 py-2.5">
          <p className="text-[13px] text-steel-700">
            <span className="num font-extrabold">{toFa(inquiry.offers.length)}</span> پیشنهاد
            {best > 0 && <> — از <span className="num font-extrabold">{toman(best)}</span> تومان</>}
          </p>
        </div>
      )}

      {pendingAmendments > 0 && role === 'buyer' && (
        <div className="mb-3 rounded-xl border border-notice/25 bg-notice-soft px-4 py-2.5">
          <p className="text-[13px] font-semibold text-notice">
            <span className="num">{toFa(pendingAmendments)}</span> پیشنهاد تغییر در انتظار تأیید شماست
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onOpen(false)}>
          <Eye size={15} />
          مشاهده استعلام
        </Button>
        {role === 'buyer' ? (
          <>
            <Button variant="ghost" onClick={() => onOpen(true)}>
              <Pencil size={15} />
              ویرایش
            </Button>
            <Button
              variant="ghost"
              onClick={() => onArchive(inquiry, inquiry.status !== 'archived')}
              title={inquiry.status === 'archived' ? 'خروج از آرشیو' : 'آرشیو'}
            >
              {inquiry.status === 'archived' ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </Button>
          </>
        ) : (
          <Button variant="signal" onClick={() => onOpen(true)}>
            <Wallet size={15} />
            ثبت پیشنهاد
          </Button>
        )}
      </div>
    </Card>
  )
}
