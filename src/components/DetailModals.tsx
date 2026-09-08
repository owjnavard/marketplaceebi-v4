import { Link } from 'react-router-dom'
import { FileText, MapPin, Percent, ShieldCheck } from 'lucide-react'
import { Badge, Button, Modal, Stars } from '@/components/ui'
import { PartSchematic, schematicFor } from '@/components/PartSchematic'
import type { Order, Product, Seller } from '@/lib/api/types'
import {
  orderStatusLabel, orderStatusTone, pricingModeLabel, productStageLabel,
  productStatusLabel, productStatusTone, sellerGroupLabel, sellerStatusLabel,
  sellerStatusTone, stockLabel, stockTone,
} from '@/lib/labels'
import { toFa, toman } from '@/lib/utils'

/* ══════════════════════════════════════════════════════════════
   پنجره‌های جزئیات

   در پنل مدیر و فروشنده، کلیک روی هر ردیف یا کارت باید اطلاعات
   کامل همان رکورد را نشان بدهد. این سه پنجره در همه آن صفحه‌ها
   مشترک‌اند تا نمایش اطلاعات یکدست بماند.
   ══════════════════════════════════════════════════════════════ */

/* ── پروفایل فروشگاه ────────────────────────────────────────── */
export function SellerDetail({
  seller, products, onClose,
}: {
  seller: Seller
  products: Product[]
  onClose: () => void
}) {
  const mine = products.filter((p) => p.sellerId === seller.id)

  return (
    <Modal
      open
      onClose={onClose}
      title={seller.name}
      subtitle={seller.legalName}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>بستن</Button>
          <Link to={`/sellers/${seller.id}`}>
            <Button variant="outline">صفحه عمومی فروشگاه</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white"
            style={{ background: seller.logoColor }}
          >
            {seller.name.charAt(0)}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={sellerStatusTone[seller.status]}>{sellerStatusLabel[seller.status]}</Badge>
            <Badge tone="muted">{sellerGroupLabel[seller.group]}</Badge>
            {seller.verified && <Badge tone="verify"><ShieldCheck size={11} />احراز شده</Badge>}
            {seller.licensed && <Badge tone="verify">مجوزدار</Badge>}
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { l: 'استان و شهر', v: `${seller.province} — ${seller.city}` },
            { l: 'تلفن', v: seller.phone },
            { l: 'عضویت از', v: seller.memberSince },
            { l: 'امتیاز', v: `${toFa(seller.rating)} از ۵` },
            { l: 'تعداد نظر', v: toFa(seller.reviewCount) },
            { l: 'میانگین پاسخ', v: `${toFa(seller.responseHours)} ساعت` },
            { l: 'کالاهای ثبت‌شده', v: toFa(mine.length) },
            { l: 'کالاهای منتشرشده', v: toFa(mine.filter((p) => p.status === 'approved').length) },
            { l: 'نرخ کمیسیون', v: `${toFa(seller.commissionRate)}٪` },
          ].map((r) => (
            <div key={r.l} className="rounded-xl bg-steel-50 px-4 py-2.5">
              <dt className="text-[12px] text-steel-400">{r.l}</dt>
              <dd className="num mt-0.5 text-[14px] font-bold text-steel-900">{r.v}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-1.5 text-[13px] font-bold text-steel-700">معرفی فروشگاه</p>
          <p className="rounded-xl border border-line px-4 py-3 text-[13.5px] leading-8 text-steel-600">
            {seller.about}
          </p>
        </div>

        {mine.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-bold text-steel-700">
              کالاها <span className="num font-normal text-steel-400">({toFa(mine.length)})</span>
            </p>
            <div className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {mine.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="h-8 w-8 shrink-0 text-steel-300">
                    <PartSchematic kind={schematicFor(p.categoryId)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-steel-900">{p.name}</p>
                    <p className="code text-[11.5px] text-steel-400">{p.partNumber}</p>
                  </div>
                  <Badge tone={productStatusTone[p.status]}>{productStatusLabel[p.status]}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── مشخصات محصول ───────────────────────────────────────────── */
export function ProductDetailModal({
  product, seller, onClose, showPartner,
}: {
  product: Product
  seller?: Seller
  onClose: () => void
  showPartner?: boolean
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={product.name}
      subtitle={`${product.partNumber} — ${product.brand}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>بستن</Button>
          <Link to={`/products/${product.id}`}>
            <Button variant="outline">صفحه عمومی محصول</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="h-24 w-24 shrink-0 rounded-2xl border border-line bg-steel-50 p-3 text-steel-300">
            <PartSchematic kind={schematicFor(product.categoryId)} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge tone={productStatusTone[product.status]}>{productStatusLabel[product.status]}</Badge>
              <Badge tone={stockTone[product.stockState]}>{stockLabel[product.stockState]}</Badge>
              <Badge tone="muted">{pricingModeLabel[product.pricingMode]}</Badge>
              {product.isService && <Badge tone="verify">خدمت</Badge>}
            </div>
            <p className="text-[13.5px] leading-7 text-steel-600">{product.shortDescription}</p>
            <div className="mt-2 flex items-center gap-2">
              <Stars value={product.rating} size={12} />
              <span className="num text-[12.5px] text-steel-400">({toFa(product.reviewCount)} نظر)</span>
            </div>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { l: 'قیمت', v: product.price != null ? `${toman(product.price)} تومان` : 'استعلامی' },
            { l: 'حداقل سفارش', v: `${toFa(product.minOrderQty)} عدد` },
            { l: 'موجودی', v: toFa(product.stockQty) },
            { l: 'مرحله اجرایی', v: productStageLabel[product.stage] },
            { l: 'فروش موفق', v: toFa(product.soldCount) },
            { l: 'فروشنده', v: seller?.name ?? '—' },
          ].map((r) => (
            <div key={r.l} className="rounded-xl bg-steel-50 px-4 py-2.5">
              <dt className="text-[12px] text-steel-400">{r.l}</dt>
              <dd className="num mt-0.5 text-[14px] font-bold text-steel-900">{r.v}</dd>
            </div>
          ))}
        </dl>

        {showPartner && !!product.partnerDiscount && (
          <div className="flex items-center gap-2.5 rounded-xl bg-verify-soft px-4 py-3">
            <Percent size={16} className="shrink-0 text-verify" />
            <p className="text-[13px] text-verify">
              تخفیف همکاری <span className="num font-extrabold">{toFa(product.partnerDiscount)}٪</span>
              {product.price != null && (
                <>
                  {' '}— قیمت همکاری{' '}
                  <span className="num font-extrabold">
                    {toman(Math.round(product.price * (1 - product.partnerDiscount / 100)))}
                  </span>{' '}
                  تومان
                </>
              )}
            </p>
          </div>
        )}

        {product.tiers && product.tiers.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-bold text-steel-700">پله‌های قیمت</p>
            <div className="overflow-hidden rounded-xl border border-line">
              {product.tiers.map((t, i) => (
                <div key={i} className="flex justify-between border-b border-line px-4 py-2 text-[13px] last:border-0">
                  <span className="num text-steel-600">
                    {toFa(t.minQty)}{t.maxQty ? ` تا ${toFa(t.maxQty)}` : ' به بالا'}
                  </span>
                  <span className="num font-bold text-steel-900">
                    {t.price != null ? toman(t.price) : 'استعلامی'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {product.specs.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-bold text-steel-700">مشخصات فنی</p>
            <dl className="divide-y divide-line rounded-xl border border-line">
              {product.specs.map((sp) => (
                <div key={sp.key} className="flex items-baseline justify-between gap-4 px-4 py-2">
                  <dt className="text-[13px] text-steel-500">{sp.label}</dt>
                  <dd className="num text-[13px] font-semibold text-steel-900">
                    {sp.value}{sp.unit ? ` ${sp.unit}` : ''}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {product.description && (
          <div>
            <p className="mb-1.5 text-[13px] font-bold text-steel-700">توضیحات</p>
            <p className="whitespace-pre-line rounded-xl border border-line px-4 py-3 text-[13.5px] leading-8 text-steel-600">
              {product.description}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── جزئیات سفارش ───────────────────────────────────────────── */
export function OrderDetailModal({
  order, products, onClose, footer,
}: {
  order: Order
  products: Product[]
  onClose: () => void
  footer?: React.ReactNode
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`سفارش ${order.code}`}
      subtitle={`ثبت ${order.createdAt} — آخرین تغییر ${order.updatedAt}`}
      size="lg"
      footer={footer ?? <Button variant="ghost" onClick={onClose}>بستن</Button>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
          {order.inquiryId && <Badge tone="muted">از استعلام ساخته شده</Badge>}
        </div>

        <div className="overflow-hidden rounded-xl border border-line">
          {order.lines.map((l) => {
            const p = products.find((x) => x.id === l.productId)
            return (
              <div key={l.productId} className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-0">
                <span className="h-10 w-10 shrink-0 text-steel-300">
                  <PartSchematic kind={p ? schematicFor(p.categoryId) : 'panel'} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-steel-900">{l.name}</p>
                  <p className="code text-[11.5px] text-steel-400">{l.partNumber}</p>
                </div>
                <span className="num shrink-0 text-[12.5px] text-steel-500">
                  {toFa(l.quantity)} × {toman(l.unitPrice)}
                </span>
                <span className="num w-28 shrink-0 text-left text-[13.5px] font-extrabold text-steel-900">
                  {toman(l.unitPrice * l.quantity)}
                </span>
              </div>
            )
          })}
        </div>

        <dl className="grid gap-3 sm:grid-cols-4">
          {[
            { l: 'جمع کالاها', v: toman(order.subtotal) },
            { l: 'ارسال', v: order.shipping ? toman(order.shipping) : '—' },
            { l: 'کمیسیون', v: toman(order.commission) },
            { l: 'مبلغ کل', v: toman(order.total) },
          ].map((r) => (
            <div key={r.l} className="rounded-xl bg-steel-50 px-4 py-2.5">
              <dt className="text-[12px] text-steel-400">{r.l}</dt>
              <dd className="num mt-0.5 text-[14px] font-bold text-steel-900">{r.v}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-steel-700">
            <MapPin size={14} className="text-steel-400" />
            نشانی تحویل
          </p>
          <div className="space-y-1 rounded-xl border border-line px-4 py-3 text-[13px] leading-7 text-steel-600">
            <p className="font-bold text-steel-900">{order.address.fullName || '—'}</p>
            <p className="num">{order.address.phone}</p>
            <p>{order.address.province} — {order.address.city}</p>
            <p>{order.address.line}</p>
            {order.address.postalCode && <p className="num text-steel-400">کد پستی: {order.address.postalCode}</p>}
          </div>
        </div>

        {/* مدارک ثبت‌شده هنگام تغییر وضعیت */}
        {order.evidence && order.evidence.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-steel-700">
              <FileText size={14} className="text-steel-400" />
              مدارک تغییر وضعیت
            </p>
            <div className="space-y-2">
              {order.evidence.map((e, i) => (
                <div key={i} className="rounded-xl border border-line px-4 py-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={orderStatusTone[e.status]}>{orderStatusLabel[e.status]}</Badge>
                    <span className="num text-[12px] text-steel-400">{e.at}</span>
                  </div>
                  <p className="text-[13px] text-steel-600">
                    {e.kind === 'waybill' ? 'شماره حواله: ' : e.kind === 'photo' ? 'تصویر: ' : 'توضیح: '}
                    <span className="num font-semibold text-steel-900">{e.reference}</span>
                  </p>
                  {e.note && <p className="mt-1 text-[12.5px] leading-6 text-steel-500">{e.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
