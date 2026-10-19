import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EarningsTab from "@/components/dashboard-tabs/EarningsTab";
import SpendingTab from "@/components/dashboard-tabs/SpendingTab";
import ReferralsTab from "@/components/dashboard-tabs/ReferralsTab";
import ProposalsTab from "@/components/dashboard-tabs/ProposalsTab";
import SendTab from "@/components/dashboard-tabs/SendTab";
import EditProfileTab from "@/components/dashboard-tabs/EditProfileTab";
import TemplatesPanel from "@/components/dashboard-tabs/TemplatesPanel";
import { fetchClientSpendingAnalytics, fetchProposalTemplates, createProposalTemplate } from "@/lib/api";

jest.mock("next/dynamic", () => () => (props: Record<string, unknown>) => <output data-testid="lazy-panel">{JSON.stringify(props)}</output>);
jest.mock("@/components/ProposalComparison", () => (props: Record<string, unknown>) => <output>{JSON.stringify(props)}</output>);
jest.mock("@/components/SendPaymentForm", () => ({ fromPublicKey }: { fromPublicKey: string }) => <output>{fromPublicKey}</output>);
jest.mock("@/components/EditProfileForm", () => ({ publicKey }: { publicKey: string }) => <output>{publicKey}</output>);
jest.mock("@/contexts/PriceContext", () => ({ usePriceContext: () => ({ xlmPriceUsd: 0.1 }) }));
jest.mock("@/components/Toast", () => ({ useToast: () => ({ success: jest.fn() }) }));
jest.mock("@/components/ConfirmDialog", () => () => null);
jest.mock("@/lib/api", () => ({ fetchClientSpendingAnalytics: jest.fn(), fetchProposalTemplates: jest.fn(), createProposalTemplate: jest.fn(), updateProposalTemplate: jest.fn(), deleteProposalTemplate: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test.each([EarningsTab, ReferralsTab])("lazy panel forwards its wallet", (Panel) => {
  render(<Panel publicKey="GUSER" />);
  expect(screen.getByTestId("lazy-panel")).toHaveTextContent('"publicKey":"GUSER"');
});

test.each([SendTab, EditProfileTab])("form tab forwards its wallet", (Panel) => {
  render(<Panel publicKey="GUSER" />);
  expect(screen.getByText("GUSER")).toBeInTheDocument();
});

test("proposals forwards jobs, applications and wallet", () => {
  render(<ProposalsTab myJobs={[]} jobApplications={new Map()} publicKey="GUSER" />);
  expect(screen.getByText(/GUSER/)).toHaveTextContent('"myJobs":[]');
});

test("spending owns loading and analytics, and uses the current price", async () => {
  (fetchClientSpendingAnalytics as jest.Mock).mockResolvedValue({ totalSpentXlm: 12 });
  render(<SpendingTab publicKey="GUSER" />);
  expect(screen.getByTestId("lazy-panel")).toHaveTextContent('"loading":true');
  await waitFor(() => expect(screen.getByTestId("lazy-panel")).toHaveTextContent('"loading":false'));
  expect(fetchClientSpendingAnalytics).toHaveBeenCalledWith("GUSER");
  expect(screen.getByTestId("lazy-panel")).toHaveTextContent('"totalSpentXlm":12');
  expect(screen.getByTestId("lazy-panel")).toHaveTextContent('"xlmPriceUsd":0.1');
});

test("spending ignores a response from a previous wallet", async () => {
  let resolveOld!: (value: unknown) => void;
  (fetchClientSpendingAnalytics as jest.Mock)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ totalSpentXlm: 20 });
  const view = render(<SpendingTab publicKey="GOLD" />);
  view.rerender(<SpendingTab publicKey="GNEW" />);
  await waitFor(() => expect(screen.getByTestId("lazy-panel")).toHaveTextContent('"totalSpentXlm":20'));
  resolveOld({ totalSpentXlm: 1 });
  await waitFor(() => expect(screen.getByTestId("lazy-panel")).toHaveTextContent('"totalSpentXlm":20'));
});

test("template drafts survive hiding the panel and save through the API", async () => {
  (fetchProposalTemplates as jest.Mock).mockResolvedValue([]);
  (createProposalTemplate as jest.Mock).mockResolvedValue({ id: "t1", name: "Draft", content: "My proposal" });
  const view = render(<div hidden={false}><TemplatesPanel publicKey="GUSER" /></div>);
  await waitFor(() => expect(fetchProposalTemplates).toHaveBeenCalled());
  fireEvent.change(screen.getByPlaceholderText("Template name"), { target: { value: "Draft" } });
  fireEvent.change(screen.getByPlaceholderText("Template proposal content"), { target: { value: "My proposal" } });
  view.rerender(<div hidden><TemplatesPanel publicKey="GUSER" /></div>);
  view.rerender(<div hidden={false}><TemplatesPanel publicKey="GUSER" /></div>);
  expect(screen.getByPlaceholderText("Template name")).toHaveValue("Draft");
  fireEvent.click(screen.getAllByRole("button", { name: "Create Template", exact: true })[0]);
  await waitFor(() => expect(createProposalTemplate).toHaveBeenCalledWith({ name: "Draft", content: "My proposal" }));
  await waitFor(() => expect(screen.getByPlaceholderText("Template name")).toHaveValue(""));
});
