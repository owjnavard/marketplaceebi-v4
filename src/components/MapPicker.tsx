import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Minus, Plus } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { cn, toFa } from '@/lib/utils'

/* ══════════════════════════════════════════════════════════════
   انتخاب موقعیت روی نقشه

   کاربر نباید طول و عرض جغرافیایی تایپ کند؛ روی نقشه کلیک می‌کند.

   کاشی‌های نقشه از یک آدرس قابل تنظیم گرفته می‌شوند. پیش‌فرض
   OpenStreetMap است، ولی اگر روی هاست ایرانی سرعتش خوب نبود، فقط
   همین یک ثابت را به سرویس داخلی (نشان، پارسی‌مپ و…) تغییر دهید.

   اگر کاشی‌ها بارگذاری نشوند — اینترنت قطع باشد یا سرویس در دسترس
   نباشد — نقشه به یک شبکه مختصاتی ساده برمی‌گردد و همچنان کار
   می‌کند. انتخاب موقعیت هیچ‌وقت به‌خاطر نبود تصویر متوقف نمی‌شود.
   ══════════════════════════════════════════════════════════════ */

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE = 256

/* تبدیل مختصات جغرافیایی به مختصات کاشی (Web Mercator) */
function lngToX(lng: number, z: number) {
  return ((lng + 180) / 360) * Math.pow(2, z)
}
function latToY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z)
}
function xToLng(x: number, z: number) {
  return (x / Math.pow(2, z)) * 360 - 180
}
function yToLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export function MapPicker({
  open,
  onClose,
  value,
  center,
  onPick,
}: {
  open: boolean
  onClose: () => void
  value?: { lat: number; lng: number }
  /** مرکز اولیه وقتی هنوز موقعیتی انتخاب نشده — معمولاً مرکز استان */
  center: { lat: number; lng: number }
  onPick: (pos: { lat: number; lng: number }) => void
}) {
  const start = value ?? center
  const [zoom, setZoom] = useState(12)
  const [pos, setPos] = useState(start)
  const [tilesOk, setTilesOk] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 420 })

  /* با باز شدن دوباره، از مقدار فعلی شروع کن */
  useEffect(() => {
    if (open) setPos(value ?? center)
  }, [open])

  useEffect(() => {
    if (!open) return
    const measure = () => {
      const el = boxRef.current
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  /* کاشی‌هایی که باید رسم شوند تا کادر پر شود */
  const tiles = useMemo(() => {
    const cx = lngToX(pos.lng, zoom)
    const cy = latToY(pos.lat, zoom)
    const cols = Math.ceil(size.w / TILE) + 2
    const rows = Math.ceil(size.h / TILE) + 2
    const list: { key: string; x: number; y: number; left: number; top: number }[] = []

    for (let i = -Math.floor(cols / 2); i <= Math.floor(cols / 2); i++) {
      for (let j = -Math.floor(rows / 2); j <= Math.floor(rows / 2); j++) {
        const tx = Math.floor(cx) + i
        const ty = Math.floor(cy) + j
        if (tx < 0 || ty < 0 || tx >= 2 ** zoom || ty >= 2 ** zoom) continue
        list.push({
          key: `${zoom}/${tx}/${ty}`,
          x: tx,
          y: ty,
          left: size.w / 2 + (tx - cx) * TILE,
          top: size.h / 2 + (ty - cy) * TILE,
        })
      }
    }
    return list
  }, [pos, zoom, size])

  /* کلیک روی نقشه = جابه‌جایی نشانگر به همان نقطه */
  const onMapClick = (e: React.MouseEvent) => {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - r.left - size.w / 2
    const dy = e.clientY - r.top - size.h / 2
    const cx = lngToX(pos.lng, zoom) + dx / TILE
    const cy = latToY(pos.lat, zoom) + dy / TILE
    setPos({ lat: yToLat(cy, zoom), lng: xToLng(cx, zoom) })
  }

  /* کشیدن نقشه */
  const drag = useRef<{ x: number; y: number; lat: number; lng: number } | null>(null)
  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, lat: pos.lat, lng: pos.lng }
  }
  const onMove = (e: React.MouseEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x) / TILE
    const dy = (e.clientY - d.y) / TILE
    const cx = lngToX(d.lng, zoom) - dx
    const cy = latToY(d.lat, zoom) - dy
    setPos({ lat: yToLat(cy, zoom), lng: xToLng(cx, zoom) })
  }
  const onUp = () => {
    drag.current = null
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="انتخاب موقعیت روی نقشه"
      subtitle="روی نقشه کلیک کنید یا آن را بکشید تا نشانگر روی محل پروژه بنشیند"
      size="lg"
      footer={
        <>
          <span className="num ml-auto text-[13px] text-steel-500">
            {toFa(pos.lat.toFixed(5))} , {toFa(pos.lng.toFixed(5))}
          </span>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button variant="signal" onClick={() => { onPick(pos); onClose() }}>
            تأیید این موقعیت
          </Button>
        </>
      }
    >
      <div className="relative overflow-hidden rounded-2xl border border-line">
        <div
          ref={boxRef}
          onClick={onMapClick}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          className={cn(
            'relative h-[420px] w-full cursor-crosshair select-none',
            !tilesOk && 'bg-steel-50',
          )}
        >
          {tilesOk ? (
            tiles.map((t) => (
              <img
                key={t.key}
                src={TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(t.x)).replace('{y}', String(t.y))}
                alt=""
                draggable={false}
                onError={() => setTilesOk(false)}
                className="pointer-events-none absolute"
                style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
              />
            ))
          ) : (
            /* حالت بدون اینترنت: شبکه مختصاتی ساده */
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          )}

          {/* نشانگر مرکز */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
              <path
                d="M17 43C17 43 32 26.5 32 17A15 15 0 1 0 2 17c0 9.5 15 26 15 26z"
                fill="#f5a800"
                stroke="#1e2a38"
                strokeWidth="2.5"
              />
              <circle cx="17" cy="17" r="5.5" fill="#1e2a38" />
            </svg>
          </div>

          {/* بزرگ‌نمایی */}
          <div className="absolute left-3 top-3 flex flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-plate">
            {([['+', () => setZoom((z) => Math.min(18, z + 1))], ['−', () => setZoom((z) => Math.max(5, z - 1))]] as const).map(
              ([label, fn], i) => (
                <button
                  key={label}
                  onClick={(e) => { e.stopPropagation(); fn() }}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center text-steel-700 transition-colors hover:bg-steel-100',
                    i === 0 && 'border-b border-line',
                  )}
                  aria-label={i === 0 ? 'بزرگ‌نمایی' : 'کوچک‌نمایی'}
                >
                  {i === 0 ? <Plus size={16} /> : <Minus size={16} />}
                </button>
              ),
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setPos(center); setZoom(12) }}
            className="absolute left-3 bottom-3 flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] font-semibold text-steel-700 shadow-plate transition-colors hover:bg-steel-50"
          >
            <Crosshair size={14} />
            بازگشت به مرکز شهر
          </button>
        </div>
      </div>

      {!tilesOk && (
        <p className="mt-3 rounded-xl bg-notice-soft px-4 py-3 text-[13px] leading-7 text-notice">
          تصویر نقشه بارگذاری نشد. انتخاب موقعیت همچنان کار می‌کند و مختصات ثبت می‌شود.
          برای نمایش تصویر، در فایل <span className="code">MapPicker.tsx</span> مقدار
          <span className="code"> TILE_URL</span> را به یک سرویس نقشه داخلی تغییر دهید.
        </p>
      )}
    </Modal>
  )
}
