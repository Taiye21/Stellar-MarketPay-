import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Job, JobInvitation } from "@/utils/types";
import PostedJobsTab from "@/components/dashboard-tabs/PostedJobsTab";
import AppliedJobsTab from "@/components/dashboard-tabs/AppliedJobsTab";
import InvitationsTab from "@/components/dashboard-tabs/InvitationsTab";
import AnalyticsTab from "@/components/dashboard-tabs/AnalyticsTab";
import TemplatesTab from "@/components/dashboard-tabs/TemplatesTab";
import PriceAlertsTab from "@/components/dashboard-tabs/PriceAlertsTab";
import WithdrawalsTab from "@/components/dashboard-tabs/WithdrawalsTab";
import SavedSearchesTab from "@/components/dashboard-tabs/SavedSearchesTab";
import TalentPoolTab from "@/components/dashboard-tabs/TalentPoolTab";
import { removeFromTalentPool } from "@/lib/api";

jest.mock("@/lib/api", () => ({ removeFromTalentPool: jest.fn(), inviteFromTalentPool: jest.fn() }));
jest.mock("@/components/JobStatusTimeline", () => () => null);
jest.mock("@/components/ExtendJobModal", () => () => null);
jest.mock("@/components/ConfirmDialog", () => () => null);
jest.mock("next/dynamic", () => () => () => <div>Job analytics chart</div>);

const noop = () => {};
const mockPush = jest.fn();
jest.mock("next/router", () => ({ useRouter: () => ({ push: mockPush, query: {} }) }));

beforeEach(() => jest.clearAllMocks());

test("posted jobs empty state opens the posting flow", () => {
  render(<PostedJobsTab myJobs={[]} onExtendJob={noop} onRepost={noop} extendModalJob={null} onJobExtended={noop} onCloseExtendModal={noop} />);
  fireEvent.click(screen.getByRole("button", { name: "Post Your First Job" }));
  expect(mockPush).toHaveBeenCalledWith("/post-job");
});

test("applications empty state opens jobs", () => {
  render(<AppliedJobsTab myApplications={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Browse Jobs" }));
  expect(mockPush).toHaveBeenCalledWith("/jobs");
});

test("invitations decline forwards the invitation id", () => {
  const decline = jest.fn();
  const invitation = { id: "inv-1", jobId: "job-1", jobTitle: "Build a site", clientName: "Client", clientAddress: "GCLIENT", jobBudget: "5", jobCurrency: "XLM", createdAt: new Date().toISOString() } as JobInvitation;
  render(<InvitationsTab myInvitations={[invitation]} onDecline={decline} />);
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  expect(decline).toHaveBeenCalledWith("inv-1");
});

test("analytics selection forwards the selected job", () => {
  const select = jest.fn();
  const job = { id: "job-1", title: "Build a site" } as Job;
  render(<AnalyticsTab myJobs={[job]} selectedJob={null} extendingJob={null} onSelectJob={select} onExtend={noop} />);
  fireEvent.click(screen.getByRole("button", { name: job.title }));
  expect(select).toHaveBeenCalledWith(job);
});

test("template edits and save reach their handlers", () => {
  const change = jest.fn();
  const save = jest.fn();
  render(<TemplatesTab templates={[]} templateName="" templateContent="" editingTemplateId={null} onTemplateNameChange={change} onTemplateContentChange={noop} onSave={save} onEdit={noop} confirmDeleteTemplate={null} onRequestDelete={noop} onCancelDelete={noop} onConfirmDelete={noop} />);
  fireEvent.change(screen.getByPlaceholderText("Template name"), { target: { value: "Proposal" } });
  expect(change).toHaveBeenCalledWith("Proposal");
  fireEvent.click(screen.getAllByRole("button", { name: "Create Template", exact: true })[0]);
  expect(save).toHaveBeenCalled();
});

test("price alert inputs and save reach their handlers", () => {
  const change = jest.fn();
  const save = jest.fn();
  render(<PriceAlertsTab minPrice="1" maxPrice="2" emailEnabled={false} alertEmail="" onMinPriceChange={change} onMaxPriceChange={noop} onEmailEnabledChange={noop} onAlertEmailChange={noop} onSave={save} />);
  fireEvent.change(screen.getByPlaceholderText("Alert if XLM drops below (USD)"), { target: { value: "0.5" } });
  expect(change).toHaveBeenCalledWith("0.5");
  fireEvent.click(screen.getByRole("button", { name: "Save Alerts" }));
  expect(save).toHaveBeenCalled();
});

test("withdrawal empty state starts withdrawal", () => {
  const withdraw = jest.fn();
  render(<WithdrawalsTab withdrawHistory={[]} onWithdraw={withdraw} />);
  fireEvent.click(screen.getByRole("button", { name: "Withdraw now" }));
  expect(withdraw).toHaveBeenCalled();
});

test("saved searches request removal of the selected id", () => {
  const remove = jest.fn();
  render(<SavedSearchesTab savedSearches={[{ id: "search-1", query_params: {}, notify_in_app: true, notify_email: false, created_at: new Date().toISOString() }]} savedSearchesLoading={false} onBrowse={noop} onToggleInApp={noop} confirmDeleteSearch={null} onRequestRemove={remove} onCancelRemove={noop} onConfirmRemove={noop} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove", exact: true }));
  expect(remove).toHaveBeenCalledWith("search-1");
});

test("talent pool only removes a row after the API succeeds", async () => {
  const removed = jest.fn();
  (removeFromTalentPool as jest.Mock).mockResolvedValue(undefined);
  const entry = { id: "talent-1", freelancer_address: "GFREELANCER", display_name: "Freelancer", skills: [], created_at: new Date().toISOString() } as React.ComponentProps<typeof TalentPoolTab>["entries"][number];
  render(<TalentPoolTab entries={[entry]} openJobs={[]} onRemoved={removed} onInvited={noop} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(removed).toHaveBeenCalledWith("talent-1"));
  expect(removeFromTalentPool).toHaveBeenCalledWith("talent-1");
});
