"use client";

import * as React from "react";
import Link from "next/link";

import type { FaqType } from "../types";

export const faqsData: FaqType[] = [
  {
    question: "What is a Regular License?",
    answer: (
      <p>
        A{" "}
        <a
          href="https://themeforest.net/licenses/terms/regular"
          className="font-semibold underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Regular License
        </a>{" "}
        grants permission to use the product in a single project where users do
        not pay for access. This can be for personal or client use. If you need
        to use the product for multiple projects or clients, a separate license
        must be purchased for each instance. This also applies when using the
        product on different domains with distinct setups.
      </p>
    ),
  },
  {
    question: "What is an Extended License?",
    answer: (
      <p>
        The{" "}
        <a
          href="https://themeforest.net/licenses/terms/extended"
          className="font-semibold underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Extended License
        </a>{" "}
        allows the product to be used in a single project where users are
        charged for access or services, such as in a subscription-based or paid
        platform. This applies whether the product is for your own use or for a
        client. If the product will be used for multiple projects or clients,
        additional licenses are required.
      </p>
    ),
  },
  {
    question: "Which license do I need for a SaaS product?",
    answer: (
      <p>
        If your SaaS product requires users to pay for access, an{" "}
        <a
          href="https://themeforest.net/licenses/terms/extended"
          className="font-semibold underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Extended License
        </a>{" "}
        is necessary for each project. If access is free, a{" "}
        <a
          href="https://themeforest.net/licenses/terms/regular"
          className="font-semibold underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Regular License
        </a>{" "}
        is sufficient. More details can be found on the Envato platform.
      </p>
    ),
  },
  {
    question:
      "Can a single Regular or Extended License cover multiple projects?",
    answer: (
      <p>
        No, each license applies to a single project. If the product is used in
        multiple applications, a separate license must be obtained for each one.
      </p>
    ),
  },
  {
    question: "Do all licenses include updates and support?",
    answer: (
      <p>
        Yes, each purchase includes product updates and 6 months of support.
      </p>
    ),
  },
];
