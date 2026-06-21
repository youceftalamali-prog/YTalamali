import React from "react";
import { PaymentHistoryItem } from "../../types.ts";

interface PaymentHistoryProps {
  payments: PaymentHistoryItem[];
}

export default function PaymentHistory({ payments }: PaymentHistoryProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">PaymentHistory</h3>
        <p className="text-xs text-slate-400 mt-1">Track successful, pending, failed, and refunded billing events.</p>
      </div>

      <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
        {payments.map((payment) => (
          <div key={payment.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{payment.currency} {payment.amount.toFixed(2)}</p>
                <p className="text-slate-500 mt-1">{payment.description}</p>
              </div>
              <span className="px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 uppercase text-[10px] font-mono">
                {payment.status}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 text-slate-500">
              <span>{payment.paymentMethod}</span>
              <span>{new Date(payment.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
        {payments.length === 0 && (
          <div className="text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
            No payment history available yet.
          </div>
        )}
      </div>
    </div>
  );
}
