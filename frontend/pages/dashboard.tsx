/**
 * pages/dashboard.tsx
 * User dashboard — shows posted jobs, applications, and wallet balance.
 */
import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";
import WalletAddressDisplay from "@/components/WalletAddressDisplay";
import clsx from "clsx";
import BulkJobActionBar from "@/components/BulkJobActionBar";
import ExtendJobModal from "@/components/ExtendJobModal";
import ProfileCompletenessWidget from "@/components/ProfileCompletenessWidget";
import XlmPriceWidget from "@/components/XlmPriceWidget";
import BuyXLMModal from "@/components/BuyXLMModal";
import WithdrawToBankModal from "@/components/WithdrawToBankModal";

import DashboardTabContent from "@/components/dashboard-tabs/DashboardTabContent";
import { useDashboard, type Tab } from "@/hooks/useDashboard";
import { formatXLM } from "@/utils/format";

const LOW_BALANCE_THRESHOLD_XLM = 5;
const IS_CONTRACT_MOCK_DEV_MODE =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_USE_CONTRACT_MOCK === "true";
const CATEGORY_ICONS: Record<string, string> = {
  web: "Web",
  mobile: "Mobile",
  design: "Design",
  writing: "Writing",
  marketing: "Marketing",
};

interface DashboardProps {
  publicKey: string | null;
  onConnect: (pk: string) => void;
}

export default function Dashboard({ publicKey, onConnect }: DashboardProps) {
  const dashboard = useDashboard(publicKey);
  const {
    tab,
    setTab,
    canViewSpending,
    myJobs,
    myApplications,
    jobApplications,
    myInvitations,
    talentPool,
    balance,
    usdcBalance,
    notificationCount,
    loading,
    selectedJobIds,
    setSelectedJobIds,
    bulkLoading,
    extendModalJob,
    setExtendModalJob,
    showWithdraw,
    setShowWithdraw,
    showBuyXLM,
    setShowBuyXLM,
    withdrawHistory,
    setWithdrawHistory,
    savedSearches,
    alertMatchesDismissed,
    setAlertMatchesDismissed,
    alertMatches,
    checklistItems,
    progress,
    loadWithdrawHistory,
    refreshBalances,
    handleResetContractMock,
    handleJobExtended,
    handleBulkCancel,
    handleBulkExtend,
    handleBulkBoost
  } = dashboard;

  if (!publicKey) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-bold text-amber-100 mb-3">
            Dashboard
          </h1>
          <p className="text-amber-800">
            Connect your wallet to view your jobs and applications
          </p>
        </div>
        <WalletConnect onConnect={onConnect} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-3xl font-bold text-amber-100">Dashboard</h1>
            {notificationCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-market-400/15 px-2.5 py-1 text-xs font-semibold text-market-300 border border-market-400/25">
                {notificationCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <WalletAddressDisplay address={publicKey} />
          </div>
          <Link
            href="/post-job"
            className="btn-primary text-sm py-2.5 px-5 flex-shrink-0"
          >
            + Post a Job
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="card bg-gradient-to-br from-ink-800 to-ink-900 border-market-500/18">
              <p className="label mb-2">XLM Balance</p>
              {balance !== null ? (
                <p className="font-display text-4xl font-bold text-amber-100">
                  {parseFloat(balance).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}
                  <span className="text-market-400 text-2xl ml-2">XLM</span>
                </p>
              ) : (
                <div className="h-10 w-48 bg-market-500/8 rounded-xl animate-pulse" />
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setShowBuyXLM(true)}
                  className={
                    parseFloat(balance || "0") < LOW_BALANCE_THRESHOLD_XLM
                      ? "btn-primary text-xs py-1.5 px-3"
                      : "btn-secondary text-xs py-1.5 px-3"
                  }
                >
                  Buy XLM
                </button>
                <button
                  onClick={() => setShowWithdraw(true)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Withdraw to Bank
                </button>
                {IS_CONTRACT_MOCK_DEV_MODE && (
                  <button
                    onClick={handleResetContractMock}
                    className="btn-secondary text-xs py-1.5 px-3 border-red-400/30 text-red-300 hover:bg-red-400/10"
                    title="Mock-only: clears locally persisted escrow test data"
                  >
                    Reset Mock
                  </button>
                )}
              </div>
              {IS_CONTRACT_MOCK_DEV_MODE && (
                <p className="mt-2 text-xs text-amber-700">
                  Mock-only contract escrow state is persisted in this browser for
                  local development and can be cleared with Reset Mock.
                </p>
              )}
            </div>

            {usdcBalance !== null && (
              <div className="card bg-gradient-to-br from-ink-800 to-ink-900 border-blue-500/18">
                <p className="label mb-2">USDC Balance</p>
                <p className="font-display text-4xl font-bold text-amber-100">
                  {parseFloat(usdcBalance).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}
                  <span className="text-blue-400 text-2xl ml-2">USDC</span>
                </p>
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            <XlmPriceWidget />
          </div>
        </div>

        {/* Profile completeness widget */}
        {!progress.isComplete && (
          <div className="mb-6">
            <ProfileCompletenessWidget
              completionPercentage={progress.completionPercentage}
              isComplete={progress.isComplete}
              checklistItems={checklistItems}
            />
          </div>
        )}

        {/* Job alert matches banner */}
        {!alertMatchesDismissed && alertMatches.length > 0 && (
          <div className="mb-6 rounded-xl border border-market-500/30 bg-market-500/8 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <BellIcon className="w-4 h-4 text-market-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-market-300">
                  {alertMatches.length} new job
                  {alertMatches.length !== 1 ? "s" : ""} matching your alerts
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/jobs"
                  className="text-xs text-market-400 hover:text-market-300 underline whitespace-nowrap"
                >
                  Browse all →
                </Link>
                <button
                  onClick={() => setAlertMatchesDismissed(true)}
                  className="text-amber-800 hover:text-amber-500 transition-colors text-lg leading-none"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {alertMatches.slice(0, 3).map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 bg-ink-900/50 hover:bg-market-500/10 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-amber-100 truncate font-medium">
                      {job.title}
                    </p>
                    <p className="text-xs text-amber-800">
                      {CATEGORY_ICONS[job.category] ?? ""} {job.category} ·{" "}
                      {formatXLM(job.budget)}
                    </p>
                  </div>
                  <span className="text-market-400 text-xs ml-2 flex-shrink-0">
                    View →
                  </span>
                </Link>
              ))}
              {alertMatches.length > 3 && (
                <p className="text-xs text-amber-800 px-3">
                  +{alertMatches.length - 3} more —{" "}
                  <Link
                    href="/jobs"
                    className="text-market-400 hover:underline"
                  >
                    see all
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}

      {/* Tabs */}
      {(() => {
        const totalProposalCount = (() => {
          let count = 0;
          jobApplications.forEach((apps) => { count += apps.length; });
          return count;
        })();
        const tabIds: Tab[] = [
          "posted",
          "applied",
          "proposals",
          "invitations",
          "analytics",
          "earnings",
          "swap",
          ...(canViewSpending ? (["spending"] as Tab[]) : []),
          "send",
          "edit_profile",
          "templates",
          "price_alerts",
          "withdrawals",
          "saved_searches",
          "talent_pool",
        ];
        const tabLabel = (t: Tab): string =>
          t === "posted" ? `Jobs Posted (${myJobs.length})` :
          t === "applied" ? `Applications (${myApplications.length})` :
          t === "proposals" ? `Proposals (${totalProposalCount})` :
          t === "invitations" ? `Invitations${myInvitations.length > 0 ? ` (${myInvitations.length})` : ""}` :
          t === "analytics" ? "Job Analytics" :
          t === "earnings" ? "Earnings" :
          t === "swap" ? "Swap earnings" :
          t === "spending" ? "Spending" :
          t === "send" ? "Send" :
          t === "templates" ? "Templates" :
          t === "price_alerts" ? "Price Alerts" :
          t === "withdrawals" ? `Withdrawals (${withdrawHistory.length})` :
          t === "saved_searches" ? `Saved Searches${savedSearches.length > 0 ? ` (${savedSearches.length})` : ""}` :
          t === "talent_pool" ? `Talent Pool${talentPool.length > 0 ? ` (${talentPool.length})` : ""}` :
          "Edit Profile";

        return (
          <>
            {/* Desktop/tablet: horizontal tab row — sm and up. */}
            <div className="hidden sm:flex border-b border-market-500/10 mb-6 overflow-x-auto">
              {tabIds.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={clsx("px-6 py-3 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap", tab === t ? "border-market-400 text-market-300" : "border-transparent text-amber-700 hover:text-amber-400")}>
                  {tabLabel(t)}
                </button>
              ))}
            </div>

            {/* Mobile: dropdown — Issue #859. A 13-item horizontal tab bar
                overflows and truncates on narrow screens; a native select
                is both compact and gets the OS's own accessible picker UI
                for free. */}
            <div className="sm:hidden mb-6">
              <label htmlFor="dashboard-tab-select" className="sr-only">
                Dashboard section
              </label>
              <select
                id="dashboard-tab-select"
                value={tab}
                onChange={(e) => setTab(e.target.value as Tab)}
                className="w-full px-4 py-3 rounded-xl bg-ink-900/60 border border-market-500/20 text-sm font-medium text-amber-100"
              >
                {tabIds.map((t) => (
                  <option key={t} value={t}>
                    {tabLabel(t)}
                  </option>
                ))}
              </select>
            </div>
          </>
        );
      })()}

        {loading ? (
          <div className="space-y-6 animate-pulse">
            {/* Balance cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card h-24" />
              <div className="card h-24" />
              <div className="card h-24" />
            </div>

            {/* Tab content skeleton */}
            <div className="card space-y-4">
              <div className="h-6 w-32 bg-market-500/10 rounded" />
              <div className="space-y-3">
                <div className="h-16 bg-market-500/8 rounded" />
                <div className="h-16 bg-market-500/8 rounded" />
                <div className="h-16 bg-market-500/8 rounded" />
              </div>
            </div>
          </div>
        ) : (
          <DashboardTabContent publicKey={publicKey} state={dashboard} />
        )}

        {showBuyXLM && (
          <BuyXLMModal
            publicKey={publicKey}
            onClose={() => setShowBuyXLM(false)}
            onComplete={refreshBalances}
          />
        )}
        {showWithdraw && (
          <WithdrawToBankModal
            publicKey={publicKey}
            onClose={() => {
              setShowWithdraw(false);
              setWithdrawHistory(loadWithdrawHistory());
              refreshBalances();
            }}
          />
        )}
      </div>

      <BulkJobActionBar
        selectedCount={selectedJobIds.size}
        onCancel={handleBulkCancel}
        onExtend={handleBulkExtend}
        onBoost={handleBulkBoost}
        onClearSelection={() => setSelectedJobIds(new Set())}
        loading={bulkLoading}
      />

      {extendModalJob && (
        <ExtendJobModal
          job={extendModalJob}
          onClose={() => setExtendModalJob(null)}
          onExtended={handleJobExtended}
        />
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}