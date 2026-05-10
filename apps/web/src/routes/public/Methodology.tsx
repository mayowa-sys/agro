import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Banknote, Sprout, ExternalLink, FileText } from 'lucide-react';

export default function Methodology() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 lg:px-12 py-12 lg:py-16">
        {/* Back link */}
        <Link
          to="/app/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {/* Page header */}
        <div className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-leaf mb-3">
            Methodology
          </p>
          <h1 className="font-serif text-4xl lg:text-5xl xl:text-6xl leading-tight mb-5">
            How we calculate{" "}
            <span className="text-leaf">Liberation</span>
          </h1>
          <p className="text-base lg:text-lg text-muted-foreground max-w-3xl leading-relaxed">
            Every naira displayed on the AGRO dashboard is backed by a formula tied to
            published, peer-reviewed research. Below we explain each source, provide the
            data, and link to the original studies so you can verify everything yourself.
          </p>
        </div>

        {/* ─── Middleman discount avoided ─────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-leaf/10">
              <Banknote className="h-6 w-6 text-leaf" />
            </div>
            <div>
              <h2 className="font-serif text-2xl lg:text-3xl">Middleman discount avoided</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Liberation source 1 of 2
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Explanation */}
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 lg:p-8 space-y-5">
              <p className="text-base text-muted-foreground leading-relaxed">
                When a farmer receives harvest payments directly through AGRO's Squad-powered
                accounts rather than selling through chains of intermediaries, they retain the
                full market price. We estimate the discount the farmer{" "}
                <strong className="text-foreground">would have lost</strong> to middlemen
                using a <strong className="text-foreground">30% margin rate</strong>.
              </p>

              <div className="rounded-xl bg-muted/40 p-5 font-mono text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Formula</p>
                <p className="text-foreground text-lg font-semibold">
                  liberation = harvest_inflow × 0.30
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground mb-3">
                  Where the 30% comes from
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Three peer-reviewed studies of Nigerian agricultural value chains document
                  middleman marketing margins between 28% and 42%. AGRO uses 30% — the
                  conservative end of that range.
                </p>
              </div>
            </div>

            {/* Source cards */}
            <div className="space-y-4">
              <a
                href="https://majaf.com.ng/index.php/majaf/article/view/152"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-card p-5 hover:border-leaf/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground group-hover:text-leaf transition-colors">
                    Soybean supply chain, Kwara State (2024)
                  </p>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                </div>
                <p className="text-3xl font-serif font-bold text-leaf mt-2">33.14%</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Market margin from wholesaler soybean supply chain in Baruteen LGA.
                  Mahmud, Nofiu & Lafia. <em>Malete Journal of Accounting and Finance</em>.
                </p>
              </a>

              <a
                href="https://econpapers.repec.org/article/agsajfand/347801.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-card p-5 hover:border-leaf/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground group-hover:text-leaf transition-colors">
                    Yam value chain, South-South Nigeria (2024)
                  </p>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                </div>
                <p className="text-3xl font-serif font-bold text-leaf mt-2">42.1%</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Marketing margin of yam marketers across South-South states.
                  Agbachom et al. AgEcon Search, University of Minnesota.
                </p>
              </a>

              <a
                href="https://www.njaat.com.ng/index.php/jasd/article/view/1202"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-card p-5 hover:border-leaf/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground group-hover:text-leaf transition-colors">
                    Yam marketing, Gombe State (2025)
                  </p>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                </div>
                <p className="text-3xl font-serif font-bold text-leaf mt-2">28.28%</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Wholesaler marketing margin in Gombe metropolis. Hamidu et al.
                  <em> Nigerian Journal of Agriculture and Agricultural Technology</em>.
                </p>
              </a>
            </div>
          </div>

          {/* Context citation */}
          <div className="mt-4 rounded-2xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Broader context: </span>
            BusinessDay (April 2026) reports Nigeria's agricultural value chain loses ~$1.2B
            annually due to information gaps across extended supply chains.{" "}
            <a
              href="https://businessday.ng/agriculture/article/how-nigerias-agricultural-value-chain-loses-1-2-billion-annually/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-leaf hover:underline inline-flex items-center gap-1"
            >
              Read the analysis <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>

        {/* ─── Cash-on-day premium captured ──────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'hsl(22 63% 44% / 0.1)' }}
            >
              <Sprout className="h-6 w-6" style={{ color: '#a0522d' }} />
            </div>
            <div>
              <h2 className="font-serif text-2xl lg:text-3xl">Cash-on-day premium captured</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Liberation source 2 of 2
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Explanation */}
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 lg:p-8 space-y-5">
              <p className="text-base text-muted-foreground leading-relaxed">
                Rural labourers in Nigeria's informal sector routinely wait weeks or months
                to be paid — or are never paid at all. AGRO's gig system guarantees same-day
                payment through Squad. The premium represents the additional value labourers
                gain from avoiding delayed, uncertain, or in-kind payment.
              </p>

              <div className="rounded-xl bg-muted/40 p-5 font-mono text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Formula</p>
                <p className="text-foreground text-lg font-semibold">
                  liberation = wage_amount × 0.10
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground mb-3">
                  Evidence of the problem
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  SBM Intelligence (October 2021) surveyed 3,416 informal-sector workers
                  across Nigeria and found that <strong className="text-foreground">40% were
                  owed wages</strong>, with delays from one month to 20 months. The states
                  with highest wage-delay prevalence include Benue, Ondo, Abia, Ebonyi,
                  Plateau, Imo, Bauchi, Enugu, Oyo, and Ekiti.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  AGRO applies a <strong className="text-foreground">10% premium</strong> — a
                  conservative estimate of the value a labourer gains from guaranteed same-day
                  cash payment versus the uncertain, delayed, or in-kind compensation typical
                  of the informal sector. The actual premium varies by region, skill, and season.
                </p>
              </div>
            </div>

            {/* Source card */}
            <div className="space-y-4">
              <a
                href="https://www.sbmintel.com/2021/10/between-the-lines-a-look-into-delayed-and-unpaid-wages-in-nigerias-informal-sector/"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-card p-5 hover:border-leaf/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground group-hover:text-leaf transition-colors">
                    Delayed & Unpaid Wages in Nigeria's Informal Sector (2021)
                  </p>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                </div>
                <p className="text-3xl font-serif font-bold" style={{ color: '#a0522d' }}>40%</p>
                <p className="text-xs text-muted-foreground mt-2">
                  of 3,416 informal-sector workers surveyed were owed wages.
                  SBM Intelligence, October 2021.
                </p>
              </a>

              <a
                href="https://www.thecable.ng/report-40-of-nigerians-working-in-informal-sector-are-owed-wages/"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-card p-5 hover:border-leaf/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground group-hover:text-leaf transition-colors">
                    Coverage: TheCable (2021)
                  </p>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  News report on the SBM study confirming 40% owed wages, state-by-state
                  breakdown, and worker deterrents to demanding payment.
                </p>
              </a>
            </div>
          </div>
        </section>

        {/* ─── Traceability ──────────────────────────────────────────── */}
        <section className="mb-14 rounded-2xl border border-border bg-card p-6 lg:p-8">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-serif text-2xl lg:text-3xl">Traceability</h2>
              <p className="text-sm text-muted-foreground mt-1">Audit trail</p>
            </div>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
            Every LiberationLog row in AGRO's database stores a{" "}
            <code className="text-sm bg-muted px-1.5 py-0.5 rounded font-mono">
              methodologyNote
            </code>{" "}
            field containing the formula applied, the amount, and references to the sources
            used at the time of recording. This page explains the default methodology.
            Individual rows may use different parameters if the farmer's circumstances
            warrant it (e.g. a different margin for a crop with known value-chain
            characteristics). The database is the source of truth.
          </p>
        </section>

        {/* ─── Full references ───────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-card p-6 lg:p-8">
          <div className="flex items-center gap-4 mb-5">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <h2 className="font-serif text-2xl lg:text-3xl">References</h2>
          </div>
          <ol className="space-y-4 text-sm text-muted-foreground list-decimal list-inside">
            <li className="leading-relaxed">
              Mahmud, H. U., Nofiu, N. B. & Lafia, A. M. (2024). Analysis of Market Margins
              and Marketing Efficiency in the Soybean Supply Chain: Evidence From Baruteen LGA,
              Kwara State. <em>Malete Journal of Accounting and Finance</em>, 4(2), pp. 225–238.{" "}
              <a
                href="https://majaf.com.ng/index.php/majaf/article/view/152"
                target="_blank"
                rel="noopener noreferrer"
                className="text-leaf hover:underline"
              >
                https://majaf.com.ng/index.php/majaf/article/view/152
              </a>
            </li>
            <li className="leading-relaxed">
              Agbachom, E. E., Ettah, O. I., Effiong, J. B., Iyam, M. A., Okeme, I., Uwah,
              E. D., Edet, O. G., Abanyam, V. A. & Ajah, E. A. (2024). Yam Value Chain
              Analysis Among Smallholder Farmers in South-South Nigeria. AgEcon Search,
              University of Minnesota. doi: 10.22004/ag.econ.347801.{" "}
              <a
                href="https://econpapers.repec.org/article/agsajfand/347801.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-leaf hover:underline"
              >
                https://econpapers.repec.org/article/agsajfand/347801.htm
              </a>
            </li>
            <li className="leading-relaxed">
              Hamidu, K., Joseph, M., Tidy, A. S. & Mohammed, R. (2025). Analysis of the
              Marketing Margin of Yam Marketers in Gombe Metropolis, Gombe State Nigeria.
              <em> Nigerian Journal of Agriculture and Agricultural Technology (NJAAT)</em>,
              8(1), pp. 1–8.{" "}
              <a
                href="https://www.njaat.com.ng/index.php/jasd/article/view/1202"
                target="_blank"
                rel="noopener noreferrer"
                className="text-leaf hover:underline"
              >
                https://www.njaat.com.ng/index.php/jasd/article/view/1202
              </a>
            </li>
            <li className="leading-relaxed">
              SBM Intelligence (October 2021). Between the Lines: A Look into Delayed and
              Unpaid Wages in Nigeria's Informal Sector.{" "}
              <a
                href="https://www.sbmintel.com/2021/10/between-the-lines-a-look-into-delayed-and-unpaid-wages-in-nigerias-informal-sector/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-leaf hover:underline"
              >
                sbmintel.com
              </a>
            </li>
            <li className="leading-relaxed">
              Akinrele, C. (April 2026). How Nigeria's agricultural value chain loses $1.2
              billion annually. <em>BusinessDay Nigeria</em>.{" "}
              <a
                href="https://businessday.ng/agriculture/article/how-nigerias-agricultural-value-chain-loses-1-2-billion-annually/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-leaf hover:underline"
              >
                businessday.ng
              </a>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
