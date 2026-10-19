import EditProfileTab from "@/components/dashboard-tabs/EditProfileTab";
import SendTab from "@/components/dashboard-tabs/SendTab";
import ReferralsTab from "@/components/dashboard-tabs/ReferralsTab";
import SpendingTab from "@/components/dashboard-tabs/SpendingTab";
import EarningsTab from "@/components/dashboard-tabs/EarningsTab";
import PostedJobsTab from "@/components/dashboard-tabs/PostedJobsTab";
import AppliedJobsTab from "@/components/dashboard-tabs/AppliedJobsTab";
import InvitationsTab from "@/components/dashboard-tabs/InvitationsTab";
import TemplatesPanel from "./TemplatesPanel";
import PriceAlertsTab from "@/components/dashboard-tabs/PriceAlertsTab";
import WithdrawalsTab from "@/components/dashboard-tabs/WithdrawalsTab";
import SavedSearchesTab from "@/components/dashboard-tabs/SavedSearchesTab";
import AnalyticsTab from "@/components/dashboard-tabs/AnalyticsTab";
import SwapEarningsTab from "@/components/dashboard-tabs/SwapEarningsTab";
import ProposalsTab from "@/components/dashboard-tabs/ProposalsTab";
import TalentPoolTab from "@/components/dashboard-tabs/TalentPoolTab";
import type { ReactNode } from "react";
import type { DashboardState } from "@/hooks/useDashboard";

export default function DashboardTabContent({ publicKey, state }: { publicKey: string; state: DashboardState }) {
  const { toast, myJobs, myApplications, jobApplications, myInvitations, talentPool, setTalentPool, balance, usdcBalance, extendModalJob, setExtendModalJob, confirmDeleteSearch, setConfirmDeleteSearch, setShowWithdraw, withdrawHistory, savedSearches, savedSearchesLoading, minPrice, setMinPrice, maxPrice, setMaxPrice, emailEnabled, setEmailEnabled, alertEmail, setAlertEmail, selectedJob, setSelectedJob, extendingJob, router, refreshBalances, handleExtendJob, handleRepost, handleJobExtended, handleDeclineInvitation, handleSavePriceAlerts, handleToggleSavedSearch, handleConfirmDeleteSearch } = state;
  // ── Tab render map (replaces the previous 14-level ternary chain) ────────
  const tabContent: Record<string, ReactNode> = {
    posted: (
      <PostedJobsTab
        myJobs={myJobs}
        onExtendJob={handleExtendJob}
        onRepost={handleRepost}
        extendModalJob={extendModalJob}
        onJobExtended={handleJobExtended}
        onCloseExtendModal={() => setExtendModalJob(null)}
      />
    ),
    applied: <AppliedJobsTab myApplications={myApplications} />,
    proposals: (
      <ProposalsTab
        myJobs={myJobs}
        jobApplications={jobApplications}
        publicKey={publicKey}
      />
    ),
    invitations: (
      <InvitationsTab
        myInvitations={myInvitations}
        onDecline={handleDeclineInvitation}
      />
    ),
    analytics: (
      <AnalyticsTab
        myJobs={myJobs}
        selectedJob={selectedJob}
        extendingJob={extendingJob}
        onSelectJob={setSelectedJob}
        onExtend={(job) => handleExtendJob(job.id)}
      />
    ),
    earnings: <EarningsTab publicKey={publicKey} />,
    swap: (
      <SwapEarningsTab
        publicKey={publicKey}
        xlmBalance={balance}
        usdcBalance={usdcBalance}
        onSwapComplete={refreshBalances}
      />
    ),
    spending: (
      <SpendingTab publicKey={publicKey} />
    ),
    send: <SendTab publicKey={publicKey} />,
    edit_profile: <EditProfileTab publicKey={publicKey} />,
    price_alerts: (
      <PriceAlertsTab
        minPrice={minPrice}
        maxPrice={maxPrice}
        emailEnabled={emailEnabled}
        alertEmail={alertEmail}
        onMinPriceChange={setMinPrice}
        onMaxPriceChange={setMaxPrice}
        onEmailEnabledChange={setEmailEnabled}
        onAlertEmailChange={setAlertEmail}
        onSave={handleSavePriceAlerts}
      />
    ),
    withdrawals: (
      <WithdrawalsTab
        withdrawHistory={withdrawHistory}
        onWithdraw={() => setShowWithdraw(true)}
      />
    ),
    saved_searches: (
      <SavedSearchesTab
        savedSearches={savedSearches}
        savedSearchesLoading={savedSearchesLoading}
        onBrowse={() => router.push("/jobs")}
        onToggleInApp={handleToggleSavedSearch}
        confirmDeleteSearch={confirmDeleteSearch}
        onRequestRemove={setConfirmDeleteSearch}
        onCancelRemove={() => setConfirmDeleteSearch(null)}
        onConfirmRemove={handleConfirmDeleteSearch}
      />
    ),
    referrals: <ReferralsTab publicKey={publicKey} />,
    talent_pool: (
      <TalentPoolTab
        entries={talentPool}
        openJobs={myJobs.filter((j) => j.status === "open")}
        onRemoved={(id) => setTalentPool((prev) => prev.filter((e) => e.id !== id))}
        onInvited={() => toast.success("Invitation sent!")}
      />
    ),
  };

  return <>
    <div hidden={state.tab !== "templates"}><TemplatesPanel publicKey={publicKey} /></div>
    {state.tab !== "templates" && (tabContent[state.tab] ?? <EditProfileTab publicKey={publicKey} />)}
  </>;
}
