import { PaymentType } from "../types";

export const paymentData: PaymentType = {
  summary: {
    originalPrice: 6592,
    savings: -299,
    storePickup: 99,
    tax: 799,
    total: 7191,
  },
  savedCards: [
    {
      id: "1",
      cardType: "Visa",
      cardNumber: "4532 9876 5432 1234",
      cardName: "John Doe",
      expiry: "11/24",
      cvc: "832",
      last4: "1234",
    },
    {
      id: "2",
      cardType: "Mastercard",
      cardNumber: "6011 1234 5678 9012",
      cardName: "John Doe",
      expiry: "05/26",
      cvc: "237",
      last4: "9012",
    },
    {
      id: "3",
      cardName: "John Doe",
      accountNumber: "789654123",
      routingNumber: "021000021",
      last4: "4123",
    },
  ],
};
