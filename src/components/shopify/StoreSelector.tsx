import React from "react";
import { ShopifyStoreConnection } from "../../types.ts";

interface StoreSelectorProps {
  stores: ShopifyStoreConnection[];
  selectedStoreId?: string;
  onSelect: (storeId: string) => void;
}

export default function StoreSelector({
  stores,
  selectedStoreId,
  onSelect,
}: StoreSelectorProps) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">StoreSelector</h3>
        <p className="text-xs text-slate-400 mt-1">Switch between connected Shopify stores and manage multiple live sync targets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {stores.map((store) => (
          <button
            key={store.id}
            onClick={() => onSelect(store.id)}
            className={`text-left rounded-xl border p-4 transition ${
              selectedStoreId === store.id
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-white font-semibold">{store.shopName}</h4>
              <span className="px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                {store.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">{store.shopDomain}</p>
            <p className="text-[11px] text-slate-500 mt-2">
              {store.connectionMode} · {store.isDefault ? "Default" : "Connected"}
            </p>
          </button>
        ))}
        {stores.length === 0 && (
          <div className="border border-dashed border-slate-800 rounded-xl p-4 text-xs text-slate-500">
            No Shopify stores connected yet.
          </div>
        )}
      </div>
    </div>
  );
}
