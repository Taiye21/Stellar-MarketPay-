import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import {
  fetchMyJobs, fetchMyApplications, fetchApplications, fetchMyInvitations, declineInvitation,
  fetchProfile, fetchPriceAlertPreference, upsertPriceAlertPreference,
  fetchSavedSearches, updateSavedSearch, deleteSavedSearch,
  fetchTalentPool, batchJobOperation, bulkExtendJobs,
} from "@/lib/api";
import type { TalentPoolEntry } from "@/lib/api";
import { getXLMBalance, getUSDCBalance, streamAccountTransactions } from "@/lib/stellar";
import type { Job, Application, JobInvitation, BulkActionResponse } from "@/utils/types";
import { useToast } from "@/components/Toast";
import { useOnboarding } from "@/hooks/useOnboarding";

export type Tab = "posted" | "applied" | "proposals" | "invitations" | "analytics" | "earnings" | "swap" | "spending" | "send" | "edit_profile" | "templates" | "price_alerts" | "withdrawals" | "saved_searches" | "referrals" | "talent_pool";
const REPOST_JOB_PREFILL_STORAGE_KEY = "marketpay_repost_job_prefill";

function syncDashboardNavBadge(count: number) {
  if (typeof document === "undefined") return;

  const navLink = document.querySelector('a[href="/dashboard"]');
  if (!(navLink instanceof HTMLElement)) return;

  navLink.classList.add("relative");

  let badge = navLink.querySelector("[data-dashboard-badge]");
  if (count <= 0) {
    badge?.remove();
    return;
  }

  if (!(badge instanceof HTMLSpanElement)) {
    badge = document.createElement("span");
    badge.setAttribute("data-dashboard-badge", "true");
    badge.className = "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-market-400 text-ink-900 text-[10px] font-bold flex items-center justify-center shadow-[0_0_18px_rgba(251,191,36,0.45)]";
    navLink.appendChild(badge);
  }

  badge.textContent = count > 9 ? "9+" : String(count);
}


export function useDashboard(publicKey: string | null) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("posted");
  const [canViewSpending, setCanViewSpending] = useState(true);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [jobApplications, setJobApplications] = useState<Map<string, Application[]>>(new Map());
  const [myInvitations, setMyInvitations] = useState<JobInvitation[]>([]);
  const [talentPool, setTalentPool] = useState<TalentPoolEntry[]>([]);
  const [balance, setBalance]           = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance]   = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const latestJobsRef = useRef<Job[]>([]);
  const latestApplicationsRef = useRef<Application[]>([]);
  const latestJobApplicationsRef = useRef<Map<string, Application[]>>(new Map());
  const seenNotificationsRef = useRef<Set<string>>(new Set());
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [extendModalJob, setExtendModalJob] = useState<Job | null>(null);
  const [confirmDeleteSearch, setConfirmDeleteSearch] = useState<string | null>(null);

  // ── Missing state declarations (referenced throughout component) ──────────
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showBuyXLM, setShowBuyXLM] = useState(false);
  const [withdrawHistory, setWithdrawHistory] = useState<Array<{ id: string; amount: string; asset: string; fiatCurrency: string }>>([]);
  const [savedSearches, setSavedSearches] = useState<Array<{ id: string; query_params: Record<string, string>; notify_in_app: boolean; notify_email: boolean; created_at: string }>>([]);
  const [savedSearchesLoading, setSavedSearchesLoading] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [alertMatchesDismissed, setAlertMatchesDismissed] = useState(false);
  const [alertMatches, setAlertMatches] = useState<Job[]>([]);
  const [extendingJob, setExtendingJob] = useState<string | null>(null);

  // ── Destructure onboarding progress ──────────────────────────────────────
  const { checklistItems, progress } = useOnboarding(publicKey);

  // ── Derived values ────────────────────────────────────────────────────────
  const { success } = toast;
  const router = useRouter();

  // ── Missing local helpers ─────────────────────────────────────────────────
  function loadWithdrawHistory(): Array<{ id: string; amount: string; asset: string; fiatCurrency: string }> {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("marketpay_withdraw_history") : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const [xlm, usdc] = await Promise.all([
        getXLMBalance(publicKey),
        getUSDCBalance(publicKey),
      ]);
      setBalance(xlm);
      setUsdcBalance(usdc);
    } catch {
      // ignore
    }
  }, [publicKey]);

  const handleExtendJob = useCallback((jobId: string) => {
    setExtendingJob(jobId);
    const job = myJobs.find((j) => j.id === jobId) ?? null;
    setExtendModalJob(job);
  }, [myJobs]);

  const handleRepost = useCallback((job: Job) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(REPOST_JOB_PREFILL_STORAGE_KEY, JSON.stringify(job));
    }
    router.push("/post-job");
  }, [router]);

  const handleResetContractMock = useCallback(() => {
    if (typeof window !== "undefined") {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("mock_escrow_"))
        .forEach((k) => localStorage.removeItem(k));
    }
  }, []);


  const handleJobExtended = useCallback((updated: Job) => {
    setMyJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    setExtendModalJob(null);
  }, []);

  const bulkResult = useCallback(
    (ids: string[], ok: boolean): BulkActionResponse => ({
      success: ok,
      succeeded: ok ? ids.length : 0,
      failed: ok ? 0 : ids.length,
      processedCount: ids.length,
      failedCount: ok ? 0 : ids.length,
      results: ids.map((id) => ({ id, success: ok })),
    }),
    [],
  );

  // Issue #868: Wire up bulk actions with the unified batch API
  const handleBulkCancel = useCallback(async () => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedJobIds);
      const result = await batchJobOperation("close", ids);
      await refreshDashboard();
      setSelectedJobIds(new Set());
      return {
        results: [
          ...result.succeeded.map((s) => ({ id: s.id, success: true })),
          ...result.failed.map((f) => ({ id: f.id, success: false, error: f.error })),
        ],
        succeeded: result.succeeded.length,
        failed: result.failed.length,
      };
    } catch (error) {
      console.error("Bulk cancel failed:", error);
      return bulkResult(Array.from(selectedJobIds), false);
    } finally {
      setBulkLoading(false);
    }
  }, [selectedJobIds, bulkResult]);

  const handleBulkExtend = useCallback(async () => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedJobIds);
      const result = await bulkExtendJobs(ids, 30); // 30 days by default
      await refreshDashboard();
      setSelectedJobIds(new Set());
      return result;
    } catch (error) {
      console.error("Bulk extend failed:", error);
      return bulkResult(Array.from(selectedJobIds), false);
    } finally {
      setBulkLoading(false);
    }
  }, [selectedJobIds, bulkResult]);

  const handleBulkBoost = useCallback(async () => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedJobIds);
      // For boost, we'd need a transaction hash from the user
      // For now, return a placeholder that indicates payment is needed
      toast.info("Boost requires payment. Feature coming soon!");
      return bulkResult(ids, false);
    } catch (error) {
      console.error("Bulk boost failed:", error);
      return bulkResult(Array.from(selectedJobIds), false);
    } finally {
      setBulkLoading(false);
    }
  }, [selectedJobIds, bulkResult, toast]);

  const loadDashboardData = useCallback(async () => {
    if (!publicKey) return null;

    const [jobs, apps, invitations, poolEntries, bal, usdc] = await Promise.all([
      fetchMyJobs(publicKey),
      fetchMyApplications(publicKey),
      fetchMyInvitations().catch((): JobInvitation[] => []),
      fetchTalentPool().catch(() => []),
      getXLMBalance(publicKey),
      getUSDCBalance(publicKey),
    ]);

    const jobApplications = new Map<string, Application[]>();
    const applicationLists = await Promise.all(
      jobs.map((job) =>
        fetchApplications(job.id).catch(() => [])
      )
    );

    jobs.forEach((job, index) => {
      jobApplications.set(job.id, applicationLists[index]);
    });

    setMyJobs(jobs);
    setMyApplications(apps);
    setJobApplications(jobApplications);
    setMyInvitations(invitations);
    setTalentPool(poolEntries);
    setBalance(bal);
    setUsdcBalance(usdc);
    latestJobsRef.current = jobs;
    latestApplicationsRef.current = apps;
    latestJobApplicationsRef.current = jobApplications;

    return { jobs, apps, jobApplications, invitations };
  }, [publicKey]);

  // Reload all dashboard data (used after bulk actions).
  const refreshDashboard = useCallback(async () => {
    await loadDashboardData();
  }, [loadDashboardData]);

  const pushNotification = useCallback(
    (key: string, message: string, variant: "success" | "info" = "info") => {
      if (seenNotificationsRef.current.has(key)) return;

      seenNotificationsRef.current.add(key);
      setNotificationCount((count) => count + 1);
      if (variant === "success") {
        toast.success(message);
        return;
      }
      toast.info(message);
    },
    [toast]
  );

  const refreshNotifications = useCallback(async () => {
    if (!publicKey) return;
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      const previousApplications = latestApplicationsRef.current;
      const previousJobApplications = latestJobApplicationsRef.current;
      const nextData = await loadDashboardData();
      if (!nextData) return;

      const { jobs, apps, jobApplications } = nextData;

      for (const job of jobs) {
        const previousIds = new Set(
          (previousJobApplications.get(job.id) ?? []).map((application) => application.id)
        );

        for (const application of jobApplications.get(job.id) ?? []) {
          if (!previousIds.has(application.id)) {
            pushNotification(
              `job:${job.id}:application:${application.id}`,
              `New application received for: ${job.title}`,
              "success"
            );
          }
        }
      }

      const previousStatuses = new Map(
        previousApplications.map((application) => [application.id, application.status])
      );

      for (const application of apps) {
        const previousStatus = previousStatuses.get(application.id);
        if (previousStatus && previousStatus !== application.status) {
          pushNotification(
            `application:${application.id}:status:${application.status}`,
            `Application status updated: ${application.status}`,
            application.status === "accepted" ? "success" : "info"
          );
        }
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, [loadDashboardData, publicKey, pushNotification]);

  useEffect(() => {
    if (!publicKey) return;

    loadDashboardData()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [loadDashboardData, publicKey]);

  useEffect(() => {
    syncDashboardNavBadge(notificationCount);
    return () => syncDashboardNavBadge(0);
  }, [notificationCount]);

  useEffect(() => {
    if (!publicKey) {
      setNotificationCount(0);
      seenNotificationsRef.current.clear();
      syncDashboardNavBadge(0);
      return;
    }

    const stopStreaming = streamAccountTransactions(publicKey, () => {
      void refreshNotifications();
    });

    return () => {
      stopStreaming();
    };
  }, [publicKey, refreshNotifications]);

  useEffect(() => {
    setWithdrawHistory(loadWithdrawHistory());
  }, [showWithdraw]);

  useEffect(() => {
    if (!publicKey) return;
    fetchPriceAlertPreference(publicKey)
      .then((pref) => {
        if (!pref) return;
        setMinPrice(
          pref.min_xlm_price_usd ? String(pref.min_xlm_price_usd) : "",
        );
        setMaxPrice(
          pref.max_xlm_price_usd ? String(pref.max_xlm_price_usd) : "",
        );
        setEmailEnabled(Boolean(pref.email_notifications_enabled));
        setAlertEmail(pref.email || "");
      })
      .catch(() => {});
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) return;
    fetchProfile(publicKey)
      .then((profile) =>
        setCanViewSpending(
          profile.role === "client" || profile.role === "both",
        ),
      )
      .catch(() => setCanViewSpending(true));
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) return;
    setSavedSearchesLoading(true);
    fetchSavedSearches()
      .then(setSavedSearches)
      .catch(() => {})
      .finally(() => setSavedSearchesLoading(false));
  }, [publicKey]);

  useEffect(() => {
    if (tab === "spending" && !canViewSpending) setTab("posted");
  }, [tab, canViewSpending]);

  // ── Tab content handlers ─────────────────────────────────────────────────
  const handleDeclineInvitation = async (id: string) => {
    try {
      await declineInvitation(id);
      setMyInvitations((prev) => prev.filter((i) => i.id !== id));
      success("Invitation declined.");
    } catch {
      // ignore
    }
  };

  const handleSavePriceAlerts = async () => {
    if (!publicKey) return;
    await upsertPriceAlertPreference(publicKey, {
      minXlmPriceUsd: minPrice ? Number(minPrice) : null,
      maxXlmPriceUsd: maxPrice ? Number(maxPrice) : null,
      emailNotificationsEnabled: emailEnabled,
      email: alertEmail,
    });
    success("Price alert settings saved");
  };

  const handleToggleSavedSearch = async (id: string) => {
    try {
      const current = savedSearches.find((s) => s.id === id);
      if (!current) return;
      const updated = await updateSavedSearch(id, {
        notify_in_app: !current.notify_in_app,
      });
      setSavedSearches((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)),
      );
      success("Notification preference updated");
    } catch {
      // ignore
    }
  };

  const handleConfirmDeleteSearch = async () => {
    if (!confirmDeleteSearch) return;
    try {
      await deleteSavedSearch(confirmDeleteSearch);
      setSavedSearches((prev) => prev.filter((x) => x.id !== confirmDeleteSearch));
      setConfirmDeleteSearch(null);
      success("Saved search removed");
    } catch {
      // ignore
    }
  };

  return {
    toast,
    tab,
    setTab,
    canViewSpending,
    myJobs,
    myApplications,
    jobApplications,
    myInvitations,
    talentPool,
    setTalentPool,
    balance,
    usdcBalance,
    notificationCount,
    loading,
    selectedJobIds,
    setSelectedJobIds,
    bulkLoading,
    extendModalJob,
    setExtendModalJob,
    confirmDeleteSearch,
    setConfirmDeleteSearch,
    showWithdraw,
    setShowWithdraw,
    showBuyXLM,
    setShowBuyXLM,
    withdrawHistory,
    setWithdrawHistory,
    savedSearches,
    savedSearchesLoading,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    emailEnabled,
    setEmailEnabled,
    alertEmail,
    setAlertEmail,
    selectedJob,
    setSelectedJob,
    alertMatchesDismissed,
    setAlertMatchesDismissed,
    alertMatches,
    extendingJob,
    checklistItems,
    progress,
    success,
    router,
    loadWithdrawHistory,
    refreshBalances,
    handleExtendJob,
    handleRepost,
    handleResetContractMock,
    handleJobExtended,
    handleBulkCancel,
    handleBulkExtend,
    handleBulkBoost,
    handleDeclineInvitation,
    handleSavePriceAlerts,
    handleToggleSavedSearch,
    handleConfirmDeleteSearch
  };
}

export type DashboardState = ReturnType<typeof useDashboard>;
