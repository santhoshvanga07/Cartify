import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrder } from '../features/orders/orderSlice';
import { inr } from '../components/ProductCard';
import { useSettings } from '../utils/settings';

const date = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A printable tax invoice. "Download PDF" is the browser's own print dialog
 * with "Save as PDF" - no PDF library, and the invoice is plain HTML that
 * looks the same on screen and on paper.
 *
 * Every figure comes from the ORDER, never from the live product: the invoice
 * shows what the customer was charged at the time.
 */
const Invoice = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { current: order, fetchError: error } = useSelector((state) => state.orders);
  // Seller details are platform settings the Super Admin maintains.
  const seller = useSettings();

  useEffect(() => {
    dispatch(fetchOrder(id));
  }, [id, dispatch]);

  if (error) return <p className="px-6 py-20 text-center text-sm text-muted">{error}</p>;
  if (!order || order._id !== id) return <p className="px-6 py-20 text-center text-sm text-muted">Loading…</p>;

  const a = order.shippingAddress;
  const p = order.pricing;
  const taxable = p.subtotal - (p.discount || 0);
  // Intra-state GST splits evenly into central and state tax.
  const halfRate = (p.gstRate ?? 18) / 2;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link to={`/orders/${order._id}`} className="text-sm text-muted hover:text-ink">
          &larr; Back to order
        </Link>
        <button onClick={() => window.print()} className="btn btn-primary">
          Download PDF
        </button>
      </div>

      <article className="card print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="display text-3xl text-ink">{seller.storeName}</p>
            <p className="mt-2 text-xs leading-relaxed text-body">
              {seller.legalName}
              {seller.address && (
                <>
                  <br />
                  {seller.address}
                </>
              )}
              <br />
              {seller.gstin && `GSTIN ${seller.gstin} · `}
              {seller.supportEmail}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Tax invoice</p>
            <p className="mt-2 text-sm text-ink">{order.orderNumber}</p>
            <p className="text-xs text-body">Dated {date(order.createdAt)}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-line py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Billed &amp; shipped to</p>
            <address className="mt-2 not-italic leading-relaxed text-ink">
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 && `, ${a.line2}`}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              {a.phone}
            </address>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-widest text-muted">Payment</p>
            <p className="mt-2 text-ink">
              {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online (Razorpay)'}
            </p>
            <p className="text-body capitalize">{order.paymentStatus}</p>
            {order.paymentDetails?.razorpayPaymentId && (
              <p className="text-xs text-muted">{order.paymentDetails.razorpayPaymentId}</p>
            )}
          </div>
        </section>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="pb-3 font-normal">Item</th>
              <th className="pb-3 text-right font-normal">Qty</th>
              <th className="pb-3 text-right font-normal">Rate</th>
              <th className="pb-3 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.slug} className="border-t border-line">
                <td className="py-3 pr-4 text-ink">
                  {i.name}
                  <span className="block text-xs text-muted">{i.brand}</span>
                </td>
                <td className="py-3 text-right text-body">{i.quantity}</td>
                <td className="py-3 text-right text-body">{inr(i.price)}</td>
                <td className="py-3 text-right text-ink">{inr(i.price * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-6 max-w-xs space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-body">Subtotal</dt>
            <dd className="text-ink">{inr(p.subtotal)}</dd>
          </div>
          {p.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-body">Discount{order.coupon?.code && ` (${order.coupon.code})`}</dt>
              <dd className="text-ink">−{inr(p.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-body">Taxable value</dt>
            <dd className="text-ink">{inr(taxable)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-body">CGST {halfRate}%</dt>
            <dd className="text-ink">{inr(p.gst / 2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-body">SGST {halfRate}%</dt>
            <dd className="text-ink">{inr(p.gst / 2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-body">Shipping</dt>
            <dd className="text-ink">{p.shipping === 0 ? 'Free' : inr(p.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base">
            <dt className="text-ink">Total</dt>
            <dd className="font-medium text-ink">{inr(p.total)}</dd>
          </div>
        </dl>

        <p className="mt-10 text-center text-xs text-muted">
          This is a computer-generated invoice and needs no signature. Thank you for shopping with{' '}
          {seller.storeName}.
        </p>
      </article>
    </div>
  );
};

export default Invoice;
