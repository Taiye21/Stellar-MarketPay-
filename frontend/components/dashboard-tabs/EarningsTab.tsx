import dynamic from "next/dynamic";

const EarningsChart = dynamic(() => import("@/components/EarningsChart"), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading earnings chart" className="animate-pulse bg-market-900/30 h-64 rounded-xl" />,
});

export default function EarningsTab({ publicKey }: { publicKey: string }) {
  return <EarningsChart publicKey={publicKey} />;
}
