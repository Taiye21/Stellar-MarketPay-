import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchClientSpendingAnalytics } from "@/lib/api";
import { usePriceContext } from "@/contexts/PriceContext";
import type { ClientSpendingAnalytics } from "@/utils/types";

const ClientSpendingTab = dynamic(() => import("@/components/ClientSpendingTab"), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading spending chart" className="animate-pulse bg-market-900/30 h-64 rounded-xl" />,
});

/** Spending requests and chart filters do not update the dashboard shell. */
export default function SpendingTab({ publicKey }: { publicKey: string }) {
  const { xlmPriceUsd } = usePriceContext();
  const [analytics, setAnalytics] = useState<ClientSpendingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAnalytics(null);
    fetchClientSpendingAnalytics(publicKey)
      .then((value) => { if (active) setAnalytics(value); })
      .catch(() => { if (active) setAnalytics(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [publicKey]);

  return <ClientSpendingTab analytics={analytics} loading={loading} xlmPriceUsd={xlmPriceUsd} />;
}
