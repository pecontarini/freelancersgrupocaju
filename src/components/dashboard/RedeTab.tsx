import { NetworkSummary } from "@/components/NetworkSummary";
import { FreelancerEntry } from "@/types/freelancer";

interface RedeTabProps {
  entries: FreelancerEntry[];
}

export function RedeTab({ entries }: RedeTabProps) {
  return (
    <div className="fade-in">
      <NetworkSummary entries={entries} />
    </div>
  );
}
