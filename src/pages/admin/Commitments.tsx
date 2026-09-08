import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Handshake, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { PanelHead } from '@/layouts/PanelLayout'
import { Badge, Button, Card, Empty, Field, Input, Modal, Select } from '@/components/ui'
import {
  loadTemplates, saveTemplates, systemLabel,
  type CommitmentSide, type CommitmentTemplate, type SystemKind,
} from '@/features/rfq/inquiry'
import { cn } from '@/lib/utils'
import { useToasts } from '@/store'

const EMPTY: CommitmentTemplate = {
  id: '', title: '', defaultSide: 'seller', systems: [], order: 99,
}

/* ══════════════════════════════════════════════════════════════
   قالب تعهدات

   این قالب‌ها مبنای ساخت خودکار تعهدات در مرحله «ارسال به شرکت
   پیمانکار» هستند. برای هر نوع آسانسور می‌توان تعهد مخصوص تعریف
   کرد؛ اگر هیچ نوعی انتخاب نشود، برای همه اعمال می‌شود.

   نکته: کاربر در استعلام نمی‌تواند تعهد الگو را حذف کند — فقط
   جابه‌جا و قیمت‌گذاری. حذف فقط از همین صفحه ممکن است.
   ══════════════════════════════════════════════════════════════ */
export default function Commitments() {
  const [rows, setRows] = useState<CommitmentTemplate[]>([])
  const [editing, setEditing] = useState<CommitmentTemplate | null>(null)
  const [deleting, setDeleting] = useState<CommitmentTemplate | null>(null)
  const push = useToasts((s) => s.push)

  const load = () => setRows(loadTemplates().sort((a, b) => a.order - b.order))
  useEffect(load, [])

  const persist = (list: CommitmentTemplate[]) => {
    const ordered = list.map((r, i) => ({ ...r, order: i + 1 }))
    saveTemplates(ordered)
    setRows(ordered)
  }

  const move = (id: string, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    persist(next)
  }

  const save = (t: CommitmentTemplate) => {
    if (t.title.trim().length < 3) {
      push('عنوان تعهد را کامل بنویسید.', 'error')
      return
    }
    const exists = rows.some((r) => r.id === t.id)
    const rec = exists ? t : { ...t, id: `ct${Date.now()}`, order: rows.length + 1 }
    persist(exists ? rows.map((r) => (r.id === rec.id ? rec : r)) : [...rows, rec])
    push(exists ? 'قالب تعهد به‌روز شد' : 'قالب تعهد اضافه شد')
    setEditing(null)
  }

  const remove = () => {
    if (!deleting) return
    persist(rows.filter((r) => r.id !== deleting.id))
    push(`«${deleting.title}» حذف شد`)
    setDeleting(null)
  }

  return (
    <>
      <PanelHead
        title="قالب تعهدات"
        description="تعهدات هر استعلام از روی این قالب‌ها ساخته می‌شوند. برای هر نوع آسانسور می‌توانید تعهد اختصاصی تعریف کنید."
        action={<Button variant="signal" onClick={() => setEditing({ ...EMPTY })}><Plus size={16} />تعهد جدید</Button>}
      />

      <Card className="mb-4 flex items-start gap-2.5 border-notice/25 bg-notice-soft p-4">
        <Lock size={16} className="mt-0.5 shrink-0 text-notice" />
        <p className="text-[13px] leading-7 text-notice">
          کاربر هنگام ثبت استعلام نمی‌تواند این تعهدات را حذف کند؛ فقط می‌تواند بین کارفرما و
          پیمانکار جابه‌جایشان کند و قیمت بگذارد. حذف فقط از همین صفحه ممکن است.
        </p>
      </Card>

      {rows.length === 0 ? (
        <Empty icon={<Handshake size={20} />} title="هنوز قالبی تعریف نشده" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead>
                <tr className="border-b border-line bg-steel-50 text-[12.5px] font-bold text-steel-500">
                  <th className="w-16 px-3 py-3">ترتیب</th>
                  <th className="px-4 py-3">عنوان تعهد</th>
                  <th className="w-36 px-4 py-3">پیش‌فرض بر عهده</th>
                  <th className="px-4 py-3">برای نوع سیستم</th>
                  <th className="w-24 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-steel-50/60">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => move(r.id, -1)}
                          disabled={i === 0}
                          className="rounded-lg p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-800 disabled:opacity-30"
                          aria-label="بالا"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => move(r.id, 1)}
                          disabled={i === rows.length - 1}
                          className="rounded-lg p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-800 disabled:opacity-30"
                          aria-label="پایین"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-[14px] font-bold text-steel-900">{r.title}</p>
                      {r.fromPartsTotal && (
                        <p className="mt-0.5 text-[12px] text-verify">قیمتش خودکار از جمع لیست قطعات می‌آید</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.defaultSide === 'seller' ? 'steel' : 'muted'}>
                        {r.defaultSide === 'seller' ? 'پیمانکار' : 'کارفرما'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.systems.length === 0 ? (
                        <span className="text-[13px] text-steel-500">همه انواع</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.systems.map((k) => <Badge key={k} tone="muted">{systemLabel[k]}</Badge>)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          className="rounded-lg p-1.5 text-steel-400 hover:bg-steel-100 hover:text-steel-800"
                          aria-label="ویرایش"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleting(r)}
                          className="rounded-lg p-1.5 text-steel-400 hover:bg-alert-soft hover:text-alert"
                          aria-label="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && <TemplateForm value={editing} onClose={() => setEditing(null)} onSave={save} />}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="حذف قالب تعهد"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>انصراف</Button>
            <Button variant="danger" onClick={remove}>حذف کن</Button>
          </>
        }
      >
        <p className="text-[14px] leading-7 text-steel-600">
          «{deleting?.title}» از قالب‌ها حذف می‌شود و در استعلام‌های بعدی ساخته نمی‌شود.
          استعلام‌های ثبت‌شده قبلی تغییری نمی‌کنند.
        </p>
      </Modal>
    </>
  )
}

function TemplateForm({
  value, onClose, onSave,
}: {
  value: CommitmentTemplate
  onClose: () => void
  onSave: (t: CommitmentTemplate) => void
}) {
  const [form, setForm] = useState(value)
  const set = <K extends keyof CommitmentTemplate>(k: K, v: CommitmentTemplate[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const toggle = (k: SystemKind) =>
    set('systems', form.systems.includes(k) ? form.systems.filter((x) => x !== k) : [...form.systems, k])

  return (
    <Modal
      open
      onClose={onClose}
      title={form.id ? 'ویرایش قالب تعهد' : 'قالب تعهد جدید'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button variant="signal" onClick={() => onSave(form)}>ذخیره</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="عنوان تعهد" required>
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="مثلاً داربست‌بندی چاه"
          />
        </Field>

        <Field label="پیش‌فرض بر عهده" required>
          <Select value={form.defaultSide} onChange={(e) => set('defaultSide', e.target.value as CommitmentSide)}>
            <option value="seller">پیمانکار (فروشنده)</option>
            <option value="buyer">کارفرما (خریدار)</option>
          </Select>
        </Field>

        <Field label="برای کدام انواع آسانسور؟" hint="هیچ‌کدام = همه" group>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(systemLabel) as SystemKind[]).map((k) => (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors',
                  form.systems.includes(k)
                    ? 'border-steel-800 bg-steel-800 text-white'
                    : 'border-line bg-paper text-steel-600 hover:border-steel-300',
                )}
              >
                {systemLabel[k]}
              </button>
            ))}
          </div>
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-steel-50 px-4 py-3.5">
          <input
            type="checkbox"
            checked={!!form.fromPartsTotal}
            onChange={(e) => set('fromPartsTotal', e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-[13.5px] leading-7 text-steel-600">
            <span className="block font-bold text-steel-800">قیمت خودکار از لیست قطعات</span>
            برای تعهدی مثل «خرید اجناس» که مبلغش جمع لیست قطعات است و نباید دستی وارد شود.
          </span>
        </label>
      </div>
    </Modal>
  )
}
