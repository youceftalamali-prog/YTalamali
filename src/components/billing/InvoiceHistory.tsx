import React from "react";
import { BillingInvoice } from "../../types.ts";

interface InvoiceHistoryProps {
  invoices: BillingInvoice[];
}

export default function InvoiceHistory({ invoices }: InvoiceHistoryProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">InvoiceHistory</h3>
        <p className="text-xs text-slate-400 mt-1">Review subscription invoices and download billing documents.</p>
      </div>

      <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{invoice.currency} {invoice.amountPaid.toFixed(2)}</p>
                <p className="text-slate-500 mt-1">{new Date(invoice.createdAt).toLocaleString()}</p>
              </div>
              <span className="px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 uppercase text-[10px] font-mono">
                {invoice.status}
              </span>
            </div>
            {(invoice.hostedInvoiceUrl || invoice.invoicePdfUrl) && (
              <div className="flex gap-2 mt-3">
                {invoice.hostedInvoiceUrl && (
                  <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200">
                    View Invoice
                  </a>
                )}
                {invoice.invoicePdfUrl && (
                  <a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200">
                    PDF
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
        {invoices.length === 0 && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
            No invoices available yet.
          </div>
        )}
      </div>
    </div>
  );
}
