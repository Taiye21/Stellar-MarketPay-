import dynamic from "next/dynamic";

const ReferralDashboard = dynamic(() => import("@/components/ReferralDashboard"), {
  loading: () => <div className="animate-pulse bg-market-900/30 h-64 rounded-xl" />,
  ssr: false,
});

export default function ReferralsTab({ publicKey }: { publicKey: string }) {
  return <ReferralDashboard publicKey={publicKey} />;
}
