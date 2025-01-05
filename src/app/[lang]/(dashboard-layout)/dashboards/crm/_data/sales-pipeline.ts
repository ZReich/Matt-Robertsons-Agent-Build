import type { SalesPipelineType } from "../types";

export const salesPipelineData: SalesPipelineType = {
  period: "2024",
  summary: {
    totalLead: 127,
    totalProposal: 83,
    totalNegotiation: 61,
    totalClosed: 36,
  },
  monthly: [
    { month: "January", lead: 15, proposal: 12, negotiation: 8, closed: 5 },
    { month: "February", lead: 14, proposal: 11, negotiation: 7, closed: 5 },
    { month: "March", lead: 13, proposal: 10, negotiation: 6, closed: 4 },
    { month: "April", lead: 12, proposal: 9, negotiation: 6, closed: 4 },
    { month: "May", lead: 12, proposal: 8, negotiation: 5, closed: 3 },
    { month: "June", lead: 11, proposal: 7, negotiation: 5, closed: 3 },
    { month: "July", lead: 10, proposal: 6, negotiation: 5, closed: 3 },
    { month: "August", lead: 10, proposal: 6, negotiation: 5, closed: 2 },
    { month: "September", lead: 9, proposal: 5, negotiation: 4, closed: 2 },
    { month: "October", lead: 8, proposal: 4, negotiation: 4, closed: 2 },
    { month: "November", lead: 7, proposal: 3, negotiation: 3, closed: 2 },
    { month: "December", lead: 6, proposal: 2, negotiation: 3, closed: 1 },
  ],
};
