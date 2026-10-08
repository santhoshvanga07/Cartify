import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { inr } from '../../components/ProductCard';

const REPORTS = [
  { key: 'sales', label: 'Daily sales', blurb: 'Orders, units, GST and net revenue per day. Cancelled and returned orders excluded.' },
  { key: 'orders', label: 'Orders', blurb: 'Every order placed in the period, any status.' },
  { key: 'products', label: 'Products', blurb: 'Units sold and revenue per product, including products that sold nothing.' },
];

// Local calendar date as YYYY-MM-DD. toISOString() would give the UTC date,
// which is "yesterday" for the first 5½ hours of every Indian day.
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MONEY = /rs\)|subtotal|discount|gst|shipping|total|price/i;
const SUMMARY_LABEL = {
  orders: 'Orders', units: 'Units', net: 'Net revenue', gst: 'GST collected', discount: 'Discounts',
  products: 'Products', unsold: 'Sold nothing', lowStock: 'Low stock (≤ 5)',
};

const AdminReports = () => {
  const [report, setReport] = useState('sales');
  const [range, setRange] = useState(() => ({
    from: ymd(new Date(Date.now() - 29 * 86400000)),
    to: ymd(new Date()),
  }));
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/reports/${report}`, { params: range });
      setData(data);
    } catch (err) {
      setData(null);
      toast.error(err.response?.data?.message || 'Could not run the report');
    }
  }, [report, range]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Downloaded through axios rather than a plain link: the request has to
   * carry the auth cookie and come back as a file, and a failure should show
   * a toast rather than a raw JSON error page.
   */
  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/reports/${report}`, { params: { ...range, format: 'csv' }, responseType: 'blob' });
      const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || `${report}.csv`;
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the report');
    } finally {
      setDownloading(false);
    }
  };

  const current = REPORTS.find((r) => r.key === report);
  const fmt = (col, value) =>
    value == null ? '—'
      : col.key === 'date' && String(value).includes('T') ? new Date(value).toLocaleString('en-IN')
      : typeof value === 'number' && MONEY.test(col.label) ? inr(value)
      : String(value);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setReport(r.key)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              report === r.key ? 'bg-ink text-white' : 'bg-surface text-body hover:text-ink'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-body">{current.blurb}</p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="from">
            From
          </label>
          <input
            id="from"
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="to">
            To
          </label>
          <input
            id="to"
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
            className="field"
          />
        </div>
        <button onClick={download} disabled={downloading || !data} className="btn btn-primary">
          {downloading ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>

      {data?.summary && (
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(data.summary).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface px-4 py-3">
              <p className="text-xs text-muted">{SUMMARY_LABEL[k] || k}</p>
              <p className="mt-0.5 text-lg text-ink">{['net', 'gst', 'discount'].includes(k) ? inr(v) : v}</p>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="mt-6 overflow-x-auto rounded-xl bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {data.columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-4 py-3 font-normal">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {data.columns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-4 py-2.5 text-body">
                      {fmt(c, row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={data.columns.length} className="px-4 py-8 text-center text-sm text-muted">
                    Nothing in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {data.rows.length > 50 && (
            <p className="px-4 py-3 text-xs text-muted">
              Showing 50 of {data.rows.length} rows - download the CSV for all of them.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminReports;
