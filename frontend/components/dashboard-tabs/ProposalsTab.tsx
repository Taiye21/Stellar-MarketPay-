import type { ComponentProps } from "react";
import ProposalComparison from "@/components/ProposalComparison";

export default function ProposalsTab(props: ComponentProps<typeof ProposalComparison>) {
  return <ProposalComparison {...props} />;
}
