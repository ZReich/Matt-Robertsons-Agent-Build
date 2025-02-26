import type { SalesTrendType } from "../types";

export const salesTrendData: SalesTrendType = {
  period: "Last year",
  summary: {
    totalLead: 190,
    totalProposal: 135,
    totalNegotiation: 110,
    totalClosed: 85,
  },
  monthly: [
    { month: "January", lead: 20, proposal: 18, negotiation: 14, closed: 10 },
    { month: "February", lead: 19, proposal: 17, negotiation: 13, closed: 10 },
    { month: "March", lead: 18, proposal: 16, negotiation: 12, closed: 9 },
    { month: "April", lead: 17, proposal: 15, negotiation: 12, closed: 9 },
    { month: "May", lead: 16, proposal: 14, negotiation: 11, closed: 8 },
    { month: "June", lead: 15, proposal: 13, negotiation: 11, closed: 8 },
    { month: "July", lead: 14, proposal: 12, negotiation: 10, closed: 7 },
    { month: "August", lead: 14, proposal: 12, negotiation: 10, closed: 7 },
    { month: "September", lead: 16, proposal: 14, negotiation: 12, closed: 9 },
    { month: "October", lead: 18, proposal: 16, negotiation: 14, closed: 10 },
    { month: "November", lead: 20, proposal: 18, negotiation: 16, closed: 12 },
    { month: "December", lead: 23, proposal: 20, negotiation: 18, closed: 14 },
  ],
};
