import React, { useState } from 'react';
import {
  Sprout,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSuppliers, useMyDeferrals, useCreateDeferral, type Supplier, type Deferral } from '@/hooks/useDeferrals';
import { formatNaira, koboToNaira } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ─── Status config ────────────────────────────────────────────────────────────

type DeferralStatus = 'PENDING' | 'ACTIVE' | 'REPAID' | 'DEFAULTED' | 'CANCELLED';

const STATUS_CONFIG: Record<DeferralStatus, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
}> = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
  ACTIVE: {
    label: 'Active',
    icon: CheckCircle2,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
  },
  REPAID: {
    label: 'Repaid',
    icon: CheckCircle2,
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.1)',
  },
  DEFAULTED: {
    label: 'Defaulted',
    icon: AlertTriangle,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.1)',
  },
};

// ─── Custom date picker ───────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function DatePicker({
                      value,
                      onChange,
                    }: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const today = new Date();
  const selected = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [open, setOpen] = useState(false);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
      i < firstDay ? null : i - firstDay + 1
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const select = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    onChange(iso);
    setOpen(false);
  };

  const isSelected = (day: number) =>
      selected &&
      selected.getFullYear() === viewYear &&
      selected.getMonth() === viewMonth &&
      selected.getDate() === day;

  const isPast = (day: number) =>
      new Date(viewYear, viewMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const displayValue = selected
      ? selected.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Select date';

  return (
      <div className="relative">
        {/* Trigger */}
        <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between transition-colors"
            style={{
              backgroundColor: 'hsl(var(--muted))',
              color: selected ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              border: `1px solid ${open ? '#22c55e' : 'hsl(var(--border))'}`,
            }}
        >
          <span className={selected ? 'font-medium' : ''}>{displayValue}</span>
          <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className="flex-shrink-0 text-muted-foreground"
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
          >
            <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Calendar dropdown */}
        {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div
                  className="absolute left-0 right-0 z-20 mt-1.5 rounded-xl p-4 shadow-2xl"
                  style={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                  }}
              >
                {/* Month nav */}
                <div className="flex items-center justify-between mb-3">
                  <button
                      type="button"
                      onClick={prevMonth}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      style={{ backgroundColor: 'hsl(var(--muted))' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <span className="text-sm font-semibold" style={{ fontFamily: '"DM Serif Display", serif' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
                  <button
                      type="button"
                      onClick={nextMonth}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      style={{ backgroundColor: 'hsl(var(--muted))' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4.5 2L8.5 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map((d) => (
                      <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                        {d}
                      </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {cells.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const past = isPast(day);
                    const sel = isSelected(day);
                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={past}
                            onClick={() => select(day)}
                            className="relative h-8 w-full rounded-lg text-xs font-medium transition-all flex items-center justify-center"
                            style={{
                              backgroundColor: sel ? '#22c55e' : 'transparent',
                              color: sel
                                  ? '#fff'
                                  : past
                                      ? 'hsl(var(--muted-foreground) / 0.4)'
                                      : 'hsl(var(--foreground))',
                              cursor: past ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              if (!past && !sel)
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                    'hsl(var(--muted))';
                            }}
                            onMouseLeave={(e) => {
                              if (!past && !sel)
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                            }}
                        >
                          {day}
                        </button>
                    );
                  })}
                </div>

                {/* Quick shortcuts */}
                <div className="mt-3 pt-3 flex gap-2" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                  {[
                    { label: '+3 months', months: 3 },
                    { label: '+6 months', months: 6 },
                    { label: '+9 months', months: 9 },
                  ].map((s) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + s.months);
                    const iso = d.toISOString().split('T')[0];
                    return (
                        <button
                            key={s.label}
                            type="button"
                            onClick={() => { onChange(iso); setOpen(false); }}
                            className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors"
                            style={{
                              backgroundColor: 'hsl(var(--muted))',
                              color: 'hsl(var(--muted-foreground))',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = 'hsl(var(--foreground))';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.color = 'hsl(var(--muted-foreground))';
                            }}
                        >
                          {s.label}
                        </button>
                    );
                  })}
                </div>
              </div>
            </>
        )}
      </div>
  );
}

// ─── Request dialog ───────────────────────────────────────────────────────────

function RequestDialog({
  supplier,
  onClose,
}: {
  supplier: Supplier;
  onClose: () => void;
}) {
  const create = useCreateDeferral();
  const [amount, setAmount] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount.replace(/,/g, ''));
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!date) { toast.error('Select your expected harvest date'); return; }
    try {
      await create.mutateAsync({
        supplierId: supplier.id,
        amount: parseFloat(amount.replace(/,/g, '')),
        expectedHarvestDate: date,
        notes,
      });
      toast.success(`Deferral request sent to ${supplier.name}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Request failed. Try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          backgroundColor: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ backgroundColor: 'hsl(var(--muted))' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Header */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}
        >
          <Sprout className="w-5 h-5 text-leaf-500" />
        </div>
        <h2
          className="text-xl font-bold mb-0.5"
          style={{ fontFamily: '"DM Serif Display", serif' }}
        >
          Request from {supplier.name}
        </h2>
        <p className="text-xs text-muted-foreground mb-5">
          Agro pays them now. You repay automatically on harvest day.
        </p>
        <div className="h-px w-12 mb-5 bg-leaf-500 rounded-full" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier (read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Supplier
            </label>
            <div
              className="w-full rounded-lg px-3 py-2.5 text-sm font-medium"
              style={{
                backgroundColor: 'hsl(var(--muted))',
                color: 'hsl(var(--foreground))',
              }}
            >
              {supplier.name} · {supplier.region}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Amount (₦)
            </label>
            <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
      ₦
    </span>
              <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amountDisplay}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 8); // max 8 digits = ₦99,999,999
                    setAmount(raw);
                    setAmountDisplay(raw ? Number(raw).toLocaleString('en-NG') : '');
                  }}
                  className="w-full rounded-lg pl-7 pr-16 py-2.5 text-sm font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500"
                  style={{
                    backgroundColor: 'hsl(var(--muted))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                  }}
              />
            </div>
          </div>

          {/* Harvest date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Expected harvest date
            </label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Notes <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="What are the inputs for?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500"
              style={{
                backgroundColor: 'hsl(var(--muted))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={create.isPending}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#16a34a' }}
          >
            {create.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sprout className="w-4 h-4" />
            )}
            {create.isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Supplier card ────────────────────────────────────────────────────────────

function SupplierCard({
  supplier,
  onRequest,
}: {
  supplier: Supplier;
  onRequest: (s: Supplier) => void;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 transition-all"
      style={{
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm leading-tight">{supplier.name}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {supplier.region}
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#16a34a' }}
        >
          Active partner
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Phone className="w-3 h-3" />
        {supplier.contactPhone}
      </div>
      <button
        onClick={() => onRequest(supplier)}
        className="w-full rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
        style={{
          backgroundColor: 'hsl(var(--muted))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(34,197,94,0.1)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#22c55e';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'hsl(var(--muted))';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(var(--border))';
        }}
      >
        Request inputs
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Deferral row ─────────────────────────────────────────────────────────────

function DeferralRow({ deferral }: { deferral: Deferral }) {
  const cfg = STATUS_CONFIG[deferral.status];
  const Icon = cfg.icon;
  const naira = koboToNaira(deferral.amount);
  const repayBy = new Date(deferral.expectedRepayBy).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const isStruck = deferral.status === 'CANCELLED';

  return (
    <div
      className="flex items-center justify-between gap-4 py-4"
      style={{ borderBottom: '1px solid hsl(var(--border))' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: cfg.bg }}
        >
          <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        </div>
        <div className="min-w-0">
          <p
            className={`text-sm font-medium truncate ${isStruck ? 'line-through text-muted-foreground' : ''}`}
          >
            {deferral.supplier.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Repay by {repayBy}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">
            {formatNaira(deferral.amount, { compact: true })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Fee: {formatNaira(deferral.agroFee, { compact: true })}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-full"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Deferrals() {
  const { data: suppliers, isLoading: sLoading } = useSuppliers();
  const { data: deferrals, isLoading: dLoading } = useMyDeferrals();
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>('All');

  const regions = ['All', ...Array.from(new Set((suppliers ?? []).map((s) => s.region))).sort()];

  const filteredSuppliers = (suppliers ?? []).filter(
    (s) => regionFilter === 'All' || s.region === regionFilter
  );

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-1.5">
            Buy now · repay on harvest
          </p>
          <h1
            className="text-5xl font-bold text-foreground leading-none"
            style={{ fontFamily: '"DM Serif Display", serif' }}
          >
            Input Credit
          </h1>
        </div>

        {/* Explainer card */}
        <div
          className="rounded-xl p-5 flex gap-4"
          style={{
            backgroundColor: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
          >
            <Sprout className="w-4 h-4 text-leaf-500" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Buy now, repay on harvest day</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get fertilizer, seed, or chemicals from a partner supplier. Agro pays them
              upfront. When your harvest payment lands, we automatically debit the cost.
              No interest. If your harvest is late, the repayment is late too.
            </p>
          </div>
        </div>

        {/* Suppliers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: '"DM Serif Display", serif' }}
            >
              Partner suppliers
            </h2>
            {/* Region filter */}
            <div className="flex gap-1.5 flex-wrap justify-end">
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className="text-xs px-3 py-1 rounded-full transition-all font-medium"
                  style={{
                    backgroundColor:
                      regionFilter === r
                        ? 'hsl(var(--foreground))'
                        : 'hsl(var(--muted))',
                    color:
                      regionFilter === r
                        ? 'hsl(var(--background))'
                        : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {sLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSuppliers.map((s) => (
                <SupplierCard key={s.id} supplier={s} onRequest={setSelectedSupplier} />
              ))}
            </div>
          )}
        </div>

        {/* My deferrals */}
        <div className="space-y-4">
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: '"DM Serif Display", serif' }}
          >
            My Input Credit
          </h2>

          {dLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !deferrals?.length ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <p className="text-sm text-muted-foreground">
                No deferrals yet. Request inputs from a partner supplier above.
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl px-5"
              style={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            >
              {deferrals.map((d) => (
                <DeferralRow key={d.id} deferral={d} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request dialog */}
      {selectedSupplier && (
        <RequestDialog
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
        />
      )}
    </div>
  );
}
