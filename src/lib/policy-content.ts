// Transcribed from the five supplied PDFs. Original files remain unchanged.
// Contact numbers updated to the website numbers at the client's explicit direction.
export type PolicySlug =
  | "privacy-policy"
  | "terms-and-conditions"
  | "refund-policy"
  | "cookie-policy"
  | "chauffeur-service-policy";
export type PolicyDocument = {
  slug: PolicySlug;
  title: string;
  sourcePath: string;
  sourceFilename: string;
  sections: { heading: string; paragraphs: string[] }[];
};
export const POLICIES: Record<PolicySlug, PolicyDocument> = {
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    sourcePath: "/policies/skyrun-privacy-policy-source.pdf",
    sourceFilename: "SKYRUN LIMO LLC (2).pdf",
    sections: [
      {
        heading: "1. Introduction",
        paragraphs: [
          "Skyrun Limo LLC (“Skyrun Limo,” “Skyrun,” “we,” “our,” or “us”) respects your privacy and is committed to handling personal information responsibly.",
          "This Privacy Policy explains how we may collect, use, disclose, store, and protect information when you visit our website, submit a ride enquiry, request a quote, communicate with our team, or use our chauffeur transportation services.",
          "Skyrun Limo provides professional chauffeur transportation, including airport transfers, corporate transportation, hourly chauffeur service, point-to-point transportation, weddings, special events, and long-distance travel, subject to availability.",
          "This policy applies to our website, online forms, chatbot, customer communications, and related services operated by Skyrun Limo LLC.",
        ],
      },
      {
        heading: "2. Information We Collect",
        paragraphs: [
          "Depending on how you interact with us, we may collect the following categories of information.",
          "A. Contact information",
          "● Full name",
          "● Email address",
          "● Telephone number",
          "● Company or organization name, where applicable",
          "B. Transportation and booking information",
          "● Pickup and destination addresses",
          "● Requested travel date and pickup time",
          "● Return-trip details, where applicable",
          "● Number of passengers",
          "● Preferred vehicle category",
          "● Airport, airline, or flight information when relevant",
          "● Requested stops, luggage information, accessibility needs, and other service instructions you voluntarily provide",
          "● Special requests relevant to arranging transportation",
          "Please avoid providing sensitive personal information unless it is necessary for your request.",
          "C. Communications",
          "We may collect information contained in contact forms, ride enquiries, chatbot messages, emails, telephone communications, customer-service conversations, feedback, and complaints.",
          "D. Transaction information",
          "If payments are accepted through our services, we may receive transaction details such as payment amount, payment status, transaction reference, billing information, and refund status. Payment card details may be processed directly by a payment provider rather than stored by Skyrun.",
          "E. Technical and usage information",
          "Depending on our website configuration and security tools, we may collect information such as IP address, browser type, device information, pages visited, referral source, approximate location derived from technical data, timestamps, and security logs.",
          "Cookies, analytics tools, and similar technologies may collect some of this information. See our Cookie Policy for details.",
        ],
      },
      {
        heading: "3. How We Collect Information",
        paragraphs: [
          "We may collect information:",
          "● Directly from you when you submit a form or contact us.",
          "● When you request transportation or a quote.",
          "● Through our website chatbot, if available.",
          "● When you communicate with our staff by phone or email.",
          "● From payment processors or other service providers involved in a transaction.",
          "● Automatically through website technologies and security systems, where enabled.",
          "● From a person arranging transportation on your behalf, where appropriate and lawful.",
          "If someone books transportation for another passenger, the person making the arrangement should have authority to provide the information necessary to coordinate that service.",
        ],
      },
      {
        heading: "4. How We Use Information",
        paragraphs: [
          "We may use personal information to:",
          "1. Respond to questions and contact requests. 2. Review ride enquiries and determine whether we can provide the requested service. 3. Prepare, communicate, and manage quotations. 4. Review availability and coordinate chauffeur transportation. 5. Create, confirm, update, and administer bookings. 6. Communicate pickup instructions, changes, delays, and service updates. 7. Process payments, deposits, refunds, and related accounting, where applicable. 8. Investigate complaints, disputes, suspected fraud, spam, and misuse. 9. Maintain customer-service records and operational history. 10. Protect our website, customers, personnel, and business systems. 11. Improve website usability and service quality. 12. Meet applicable legal, regulatory, tax, accounting, and recordkeeping obligations. 13. Send promotional communications where permitted and subject to applicable consent and opt-out requirements.",
          "We will not use information for a materially different purpose without providing any notice or obtaining any consent required by applicable law.",
        ],
      },
      {
        heading: "5. Ride Requests and Booking Confirmation",
        paragraphs: [
          "Submitting a contact form, chatbot message, ride enquiry, or quote request does not by itself establish that a ride has been accepted or confirmed.",
          "We may review submissions before responding or sending certain communications. If we determine that a request is genuine and appropriate for follow-up, we may contact you to discuss availability, pricing, and next steps.",
          "Information is used to process the request and coordinate service. A booking is confirmed only through the confirmation process communicated by Skyrun.",
        ],
      },
      {
        heading: "6. When We Share Information",
        paragraphs: [
          "We may disclose personal information, as reasonably necessary and permitted by law, to:",
          "Service providers: Companies providing website hosting, database services, email delivery, customer communications, payment processing, security, analytics, or technical support.",
          "Transportation partners: Chauffeurs, operators, or other authorized transportation providers involved in fulfilling a requested or confirmed ride, where applicable.",
          "Professional advisers: Lawyers, accountants, insurers, auditors, and other professional advisers who need the information for legitimate business purposes.",
          "Legal and safety purposes: Government authorities, courts, regulators, law enforcement, or other parties when disclosure is legally required or reasonably necessary to protect rights, safety, property, or legal interests.",
          "Business transactions: Parties involved in a merger, acquisition, restructuring, financing, or sale of relevant business assets, subject to appropriate safeguards.",
          "We do not promise that information is never shared. Sharing depends on the circumstances and the services actually used.",
        ],
      },
      {
        heading: "7. Cookies and Similar Technologies",
        paragraphs: [
          "Our website may use essential cookies, security technologies, analytics tools, or other similar technologies.",
          "Essential technologies may support site functionality, security, and user preferences. Optional analytics or advertising technologies, if used, should be disclosed and controlled in accordance with applicable law. See the separate Cookie Policy for more information.",
        ],
      },
      {
        heading: "8. Data Security",
        paragraphs: [
          "We use reasonable administrative, technical, and organizational safeguards appropriate to the nature of the information we handle.",
          "Depending on our implementation, safeguards may include access controls, authentication, encryption in transit, restricted administrative access, backups, monitoring, and secure service-provider integrations.",
          "No website, network, or electronic storage system can be guaranteed to be completely secure. We cannot promise absolute security.",
          "Access to personal information should be limited to authorized personnel and service providers who need it for legitimate purposes.",
        ],
      },
      {
        heading: "9. Data Retention",
        paragraphs: [
          "We retain personal information for as long as reasonably necessary for the purposes described in this policy, including responding to enquiries, administering rides, resolving disputes, maintaining business records, and complying with legal obligations.",
          "Retention periods may vary according to the type of information, its purpose, applicable law, and the circumstances of a transaction.",
          "We will establish and document retention schedules appropriate to our actual business and legal requirements. This policy does not promise a fixed deletion period for every category of information.",
        ],
      },
      {
        heading: "10. Your Privacy Rights",
        paragraphs: [
          "Depending on your state of residence and applicable law, you may have rights to:",
          "● Request access to certain personal information.",
          "● Request information about how personal information is collected, used, or disclosed.",
          "● Request correction of inaccurate information.",
          "● Request deletion of certain personal information.",
          "● Obtain a portable copy of certain information.",
          "● Opt out of certain sales, sharing, targeted advertising, or profiling activities,",
          "● where applicable.",
          "● Withdraw consent where processing relies on consent.",
          "● Appeal certain decisions concerning a privacy request.",
          "● Avoid unlawful discrimination for exercising applicable privacy rights.",
          "These rights are not identical in every state and may be subject to exceptions.",
          "To submit a privacy request, contact us using the contact details below. We may need to verify your identity and authority before processing a request. Where legally permitted, an authorized agent may submit a request on your behalf.",
          "We will respond within the timeframe required by applicable law.",
        ],
      },
      {
        heading: "11. California Residents",
        paragraphs: [
          "If the California Consumer Privacy Act, as amended, applies to Skyrun and your information, California residents may have additional rights regarding access, correction, deletion, portability, and opting out of certain sales or sharing of personal information.",
          "Applicable businesses may also need to provide a notice at collection and additional disclosures concerning the categories and purposes of personal information processed.",
          "The availability of these rights depends on the law’s applicability, relevant thresholds, exemptions, and the circumstances of processing.",
        ],
      },
      {
        heading: "12. Children’s Privacy",
        paragraphs: [
          "Our website and chauffeur services are intended for individuals arranging transportation and are not designed as a service directed to children under 13.",
          "We do not knowingly seek to collect personal information directly from children under 13 through a child-directed service. If we learn that we have collected information in a manner that violates applicable law, we will take appropriate steps.",
          "Parents or guardians arranging transportation for minors should provide only information reasonably necessary to coordinate the requested service.",
        ],
      },
      {
        heading: "13. Third-Party Websites and Services",
        paragraphs: [
          "Our website may link to third-party websites or use external services. Those parties operate under their own privacy policies and practices.",
          "We are not responsible for the privacy or security practices of independent third parties. Please review their policies before providing information to them.",
        ],
      },
      {
        heading: "14. Email and Text Communications",
        paragraphs: [
          "We may send messages concerning enquiries, quotes, bookings, pickup arrangements, service changes, and customer support.",
          "Marketing communications, where sent, must comply with applicable law. You may opt out of promotional emails through the unsubscribe mechanism provided or by contacting us.",
          "Opting out of marketing communications does not necessarily stop necessary service- related communications.",
          "Text messages will be sent only in accordance with applicable consent and messaging requirements. The final policy must describe any SMS program actually operated by Skyrun.",
        ],
      },
      {
        heading: "15. Interstate and International Processing",
        paragraphs: [
          "Our website and service providers may process information in locations different from where you are located. Where information is transferred or processed across jurisdictions, we will handle it in accordance with applicable legal requirements.",
        ],
      },
      {
        heading: "16. Changes to This Policy",
        paragraphs: [
          "We may update this Privacy Policy to reflect changes to our business, website, technology, or legal obligations.",
          "The updated policy will be posted on our website with a revised “Last Updated” date. Where required by law, we will provide additional notice or obtain consent.",
        ],
      },
      {
        heading: "17. Contact Us",
        paragraphs: [
          "For privacy questions or requests, contact:",
          "Skyrun Limo LLC Email: skyrunlimo2428@gmail.com Phone: 224-619-2024 Phone: 779-240-6371",
          "Please do not send payment-card details or other highly sensitive information through ordinary email.",
        ],
      },
    ],
  },
  "terms-and-conditions": {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    sourcePath: "/policies/skyrun-terms-and-conditions-source.pdf",
    sourceFilename: "SKYRUN LIMO LLC (1).pdf",
    sections: [
      {
        heading: "1. Agreement to These Terms",
        paragraphs: [
          "These Terms & Conditions (“Terms”) govern your access to and use of the Skyrun Limo LLC website and the chauffeur transportation services offered by Skyrun Limo (“Skyrun,” “we,” “our,” or “us”).",
          "By using the website, submitting a ride enquiry, requesting a quote, or arranging transportation, you agree to the Terms applicable to that activity. Separate written quote or booking terms may apply to a particular trip.",
          "If you do not agree with these Terms, do not use the website or request services through it.",
        ],
      },
      {
        heading: "2. Our Services",
        paragraphs: [
          "Skyrun offers professional chauffeur transportation, subject to availability and applicable requirements. Services may include:",
          "● Airport transfers, including transportation to or from Chicago O’Hare International Airport.",
          "● Corporate transportation.",
          "● Wedding and special-event transportation.",
          "● Sports-event transportation.",
          "● Hourly chauffeur service.",
          "● Point-to-point transportation.",
          "● City-to-city and long-distance transportation.",
          "● State-to-state transportation, where available and legally permitted.",
          "Our current fleet may include the 2027 Ford Expedition, 2025 Mercedes-Benz E350, and 2026 Mercedes-Benz GLC 300. Vehicle availability, specifications, and model-year descriptions should be confirmed when a ride is quoted.",
          "Skyrun provides transportation with a chauffeur. These Terms do not offer self-drive or car-only rental services.",
        ],
      },
      {
        heading: "3. Service Areas and Availability",
        paragraphs: [
          "Skyrun intends to serve transportation requests across the United States, subject to availability, applicable licensing and operating authority, route feasibility, vehicle availability, and other legal and operational requirements.",
          "A statement that service is available nationwide does not guarantee that every requested route or trip can be accepted.",
          "We may decline a request if we cannot lawfully or reasonably provide it.",
        ],
      },
      {
        heading: "4. Ride Enquiries Are Not Confirmed Bookings",
        paragraphs: [
          "A website submission, contact message, chatbot conversation, telephone enquiry, or quote request is a request for consideration. It does not automatically create a confirmed booking.",
          "A booking becomes confirmed only when Skyrun communicates acceptance through its designated confirmation process.",
          "Before confirmation, customers should not assume that a vehicle or chauffeur has been reserved, that a quoted time is guaranteed, or that a specific price is final.",
        ],
      },
      {
        heading: "5. Quotes and Pricing",
        paragraphs: [
          "A quote may depend on the requested route, trip duration, vehicle category, date and time, passenger requirements, waiting time, stops, tolls, parking, airport arrangements, and other disclosed trip requirements.",
          "Unless expressly stated otherwise in writing, a quote is not a guarantee of availability until the booking is confirmed.",
          "The quote should specify, where applicable:",
          "● Service and vehicle category.",
          "● Pickup and destination details.",
          "● Date, time, and trip duration.",
          "● Included mileage, hours, stops, or waiting time.",
          "● Base fare and any applicable taxes or fees.",
          "● Additional charges that may apply.",
          "● Payment requirements.",
          "● Quote expiry date, if any.",
          "● Cancellation and refund terms.",
          "Any mandatory charges and material additional fees should be disclosed before the customer commits to the booking, as required by applicable law.",
        ],
      },
      {
        heading: "6. Booking Information",
        paragraphs: [
          "Customers are responsible for providing accurate information, including their name, contact details, pickup and destination addresses, travel date, requested pickup time, passenger count, and relevant service instructions.",
          "For airport transfers, customers should provide accurate airport, airline, flight, and arrival or departure information when requested.",
          "Incorrect or incomplete information may affect service coordination, availability, timing, or pricing. If important details change, customers should contact Skyrun as soon as possible.",
        ],
      },
      {
        heading: "7. Payment Terms",
        paragraphs: [
          "The payment method, deposit, payment deadline, and balance due will be stated in the applicable quote or booking confirmation.",
          "Skyrun will not treat an unconfirmed enquiry as a completed paid booking solely because the enquiry was submitted.",
          "Customers must pay charges that were properly disclosed and agreed to, subject to applicable law and any valid dispute or refund rights.",
          "If payment processing is handled by a third-party provider, the provider’s applicable terms may also apply.",
        ],
      },
      {
        heading: "8. Changes to a Booking",
        paragraphs: [
          "Requests to change a pickup time, route, destination, vehicle category, trip duration, passenger count, stops, or other material detail are subject to approval and availability. A change may affect the price. Skyrun should communicate any material price change and obtain the customer’s agreement before proceeding, except where applicable law permits otherwise.",
          "A requested change is not accepted until Skyrun confirms it.",
        ],
      },
      {
        heading: "9. Customer Responsibilities",
        paragraphs: [
          "Customers agree to:",
          "● Provide accurate booking information.",
          "● Be reasonably ready at the agreed pickup location and time.",
          "● Treat chauffeurs and other passengers respectfully.",
          "● Follow reasonable safety instructions.",
          "● Avoid illegal activity or conduct that creates a safety risk.",
          "● Comply with applicable laws during transportation.",
          "● Inform Skyrun about relevant accessibility needs, passenger requirements, or other arrangements in advance where possible.",
          "● Pay applicable agreed charges.",
          "Skyrun may decline or discontinue service when reasonably necessary for safety, legal compliance, or protection of passengers, chauffeurs, or property, subject to applicable law and the specific circumstances.",
        ],
      },
      {
        heading: "10. Passenger Count, Luggage, and Special Requests",
        paragraphs: [
          "Customers must request a vehicle appropriate for the intended passenger count and luggage requirements.",
          "Passenger and luggage capacity varies by vehicle. A vehicle preference is not a guarantee of a particular model until confirmed.",
          "Child seats, accessibility accommodations, additional stops, and other special requests must be communicated in advance. Availability and any additional charges should be confirmed before the ride.",
        ],
      },
      {
        heading: "11. Chauffeur and Vehicle Assignment",
        paragraphs: [
          "Skyrun will arrange appropriate chauffeur transportation for a confirmed booking.",
          "A requested vehicle model or category is subject to availability. If the originally discussed vehicle becomes unavailable, Skyrun should communicate a proposed alternative and any material difference in price or service.",
          "A substitution should not be treated as accepted where customer approval is required by the booking terms or applicable law.",
        ],
      },
      {
        heading: "12. Pickup, Delays, and Waiting Time",
        paragraphs: [
          "Pickup arrangements and any included waiting period should be specified in the quote or confirmation.",
          "Customers should contact Skyrun promptly if they anticipate a delay. Additional waiting charges, where applicable, must be disclosed in the agreed booking terms.",
          "Airport pickup arrangements may depend on flight information, airport restrictions, traffic, parking rules, and the selected pickup procedure.",
          "Skyrun does not guarantee that every trip will arrive at its destination at an exact time, because traffic, weather, road closures, airport conditions, and other factors may be beyond its control.",
          "We will make reasonable efforts to coordinate service and communicate material disruptions.",
        ],
      },
      {
        heading: "13. Cancellations and Refunds",
        paragraphs: [
          "Cancellations, missed pickups, and refunds are governed by the applicable Cancellation Policy, Refund Policy, and any specific terms disclosed and agreed to for the booking.",
          "Customers should review those policies before confirming a booking.",
          "No cancellation fee or non-refundable charge should be imposed unless it is supported by the applicable agreed terms and permitted by law.",
        ],
      },
      {
        heading: "14. Safety and Prohibited Conduct",
        paragraphs: [
          "Customers must not request or engage in conduct that violates applicable law or creates an unreasonable safety risk.",
          "Subject to applicable law, Skyrun may refuse service or take appropriate action if a passenger engages in violence, harassment, serious misconduct, dangerous behavior, or other conduct that makes the trip unsafe. Any charges or refunds associated with such circumstances will be handled under the applicable booking terms and law.",
        ],
      },
      {
        heading: "15. Website Content and Availability",
        paragraphs: [
          "We aim to keep website information accurate, but descriptions, photographs, vehicle images, availability indicators, and other content may not always reflect the exact vehicle or conditions available for a specific booking.",
          "Website content is provided for general informational purposes. A confirmed booking and its written terms govern the specific trip, subject to applicable law.",
        ],
      },
      {
        heading: "16. Third-Party Services",
        paragraphs: [
          "The website may use external hosting, payment, communications, analytics, or other service providers. External websites and services may be governed by their own terms and privacy policies.",
          "Nothing in these Terms eliminates rights or obligations that apply under relevant third- party agreements or applicable law.",
        ],
      },
      {
        heading: "17. Limitation of Liability",
        paragraphs: [
          "To the extent permitted by applicable law, Skyrun will not be liable for indirect, incidental, special, exemplary, or consequential losses arising from website use or a service disruption where such exclusion is lawful.",
          "Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited, including applicable statutory rights and any liability for which an exclusion is prohibited by law.",
        ],
      },
      {
        heading: "18. Indemnification",
        paragraphs: [
          "To the extent permitted by applicable law, a customer may be responsible for losses directly caused by the customer’s unlawful conduct, material breach of agreed booking terms, or damage to property for which the customer is legally responsible. This section does not require a customer to indemnify Skyrun for Skyrun’s own negligence, unlawful conduct, or other liability where such indemnification would be prohibited by law.",
        ],
      },
      {
        heading: "19. Privacy",
        paragraphs: [
          "Our handling of personal information is described in the Skyrun Limo Privacy Policy. By using the website or requesting service, you acknowledge that personal information may be processed as described there, subject to applicable law.",
        ],
      },
      {
        heading: "20. Disputes and Governing Law",
        paragraphs: [
          "Please contact Skyrun with questions or concerns about your booking. Applicable consumer rights and mandatory legal protections remain in effect.",
          "Nothing in this section prevents a customer from exercising a right that cannot legally be waived.",
        ],
      },
      {
        heading: "21. Changes to These Terms",
        paragraphs: [
          "We may update these Terms from time to time. Updated Terms will be posted with a revised “Last Updated” date.",
          "Changes will apply as permitted by law. Material changes to an existing confirmed booking should not be treated as automatically accepted merely because the website terms were later updated.",
        ],
      },
      {
        heading: "22. Contact Information",
        paragraphs: [
          "Skyrun Limo LLC Email: skyrunlimo2428@gmail.com Phone: 224-619-2024 Phone: 779-240-6371",
        ],
      },
    ],
  },
  "refund-policy": {
    slug: "refund-policy",
    title: "Refund Policy",
    sourcePath: "/policies/skyrun-refund-policy-source.pdf",
    sourceFilename: "SKYRUN LIMO LLC.pdf",
    sections: [
      {
        heading: "1. Introduction",
        paragraphs: [
          "This Refund Policy explains how Skyrun Limo LLC (“Skyrun,” “we,” “our,” or “us”) handles requests for refunds related to chauffeur transportation services.",
          "It applies to eligible payments made for quotes, deposits, confirmed bookings, and other transportation charges, subject to the applicable booking terms and law.",
          "This policy must be read together with the Skyrun Limo Cancellation Policy and the Terms & Conditions.",
        ],
      },
      {
        heading: "2. General Refund Principles",
        paragraphs: [
          "Refund eligibility depends on the payment made, the status of the booking, the applicable cancellation terms, whether the service was provided, and the circumstances of the request.",
          "We will assess refund requests fairly and in accordance with applicable law and the agreed booking terms.",
          "A request for a refund does not guarantee that the full amount will be refundable. Equally, this policy does not eliminate any refund or other rights that applicable law gives a customer.",
        ],
      },
      {
        heading: "3. Ride Enquiries and Unconfirmed Requests",
        paragraphs: [
          "Submitting a ride enquiry or quote request does not itself create a confirmed booking.",
          "If a customer paid an amount before a booking was confirmed, the payment will be reviewed according to the disclosed payment terms and the circumstances of the transaction.",
          "If a booking is not accepted and the customer is entitled to a refund, Skyrun will arrange the applicable refund.",
        ],
      },
      {
        heading: "4. Customer-Initiated Cancellations",
        paragraphs: [
          "Refunds for customer-initiated cancellations are determined by the applicable Cancellation Policy and the terms disclosed and agreed to before booking.",
          "Depending on the approved booking terms, an eligible refund may be:",
          "● A full refund.",
          "● A refund less a disclosed and lawful cancellation fee.",
          "● A partial refund where a permitted charge or portion of the service is non- refundable.",
          "● No refund where a disclosed, agreed, and lawful term applies.",
          "These are possible outcomes, not a declaration that any particular charge is currently imposed by Skyrun.",
        ],
      },
      {
        heading: "5. Cancellations by Skyrun",
        paragraphs: [
          "If Skyrun cancels a confirmed booking and cannot provide the agreed service, we will explain the available options.",
          "Depending on the circumstances, the booking terms, and applicable law, customers may be eligible for:",
          "● A refund of amounts paid for the cancelled service.",
          "● An alternative arrangement accepted by the customer.",
          "● Rescheduling, where available and agreed.",
          "An alternative arrangement should not be treated as accepted automatically. Refund eligibility and amount will be determined in accordance with the applicable agreement and law.",
        ],
      },
      {
        heading: "6. Service Not Provided or Materially Different",
        paragraphs: [
          "If the agreed transportation is not provided, or a material problem occurs with the service, contact Skyrun promptly.",
          "Please provide the booking reference, travel date, a description of the issue, and any supporting documentation.",
          "Skyrun will review the circumstances, including the agreed booking details, the service actually provided, communications between the parties, and applicable law.",
          "Where a refund or other remedy is due, Skyrun will communicate the outcome and any necessary next steps.",
        ],
      },
      {
        heading: "7. Duplicate or Incorrect Charges",
        paragraphs: [
          "If you believe you were charged twice or charged an incorrect amount, contact us with:",
          "● Your name and booking reference.",
          "● The date and amount of the charge.",
          "● The payment method used, described without sending full card details.",
          "● Any transaction reference shown by your payment provider.",
          "We will investigate and, if a duplicate or incorrect charge is confirmed, arrange the appropriate correction or refund.",
        ],
      },
      {
        heading: "8. Deposits and Prepayments",
        paragraphs: [
          "Whether a deposit or prepayment is refundable depends on the terms communicated and agreed to when the booking was made, subject to applicable law.",
          "Before accepting a deposit, Skyrun should clearly disclose:",
          "● The amount or percentage due.",
          "● What the payment secures.",
          "● The balance and payment deadline.",
          "● Whether the deposit is refundable.",
          "● The cancellation terms.",
          "● Any circumstances in which a refund or deduction may apply.",
          "A payment should not be described as non-refundable unless that condition was properly disclosed, agreed to, and is lawful.",
        ],
      },
      {
        heading: "9. No-Shows and Late Cancellations",
        paragraphs: [
          "Where a customer fails to appear or cancels too late, the applicable booking terms may permit a disclosed fee. Any resulting refund will be calculated under the Cancellation Policy and the terms applicable to the booking.",
          "Skyrun should not impose an undisclosed fee or automatically treat every missed pickup as a no-show without applying the agreed conditions and relevant circumstances.",
        ],
      },
      {
        heading: "10. Additional Charges and Partial Refunds",
        paragraphs: [
          "If a booking includes additional stops, extra time, waiting charges, route changes, or other separately agreed services, refund calculations may take those items into account where lawful.",
          "Any partial refund should be explained clearly, including the amount refunded and the basis for any deduction.",
          "Taxes, payment-processing charges, and other fees will be handled according to applicable law, the relevant provider’s terms, and the customer’s agreement.",
        ],
      },
      {
        heading: "11. How to Request a Refund",
        paragraphs: [
          "To request a refund, contact:",
          "Email: skyrunlimo2428@gmail.com Phone: 224-619-2024 Phone: 779-240-6371",
          "Please include:",
          "1. Your full name. 2. Booking or transaction reference. 3. Date of the scheduled ride. 4. Amount paid. 5. Reason for the request. 6. Relevant supporting information.",
          "Do not send full payment-card numbers, security codes, account passwords, or other sensitive payment credentials by email.",
        ],
      },
      {
        heading: "12. Refund Review and Processing",
        paragraphs: [
          "Skyrun will review the request and may ask for additional information reasonably needed to verify the transaction or circumstances.",
          "If a refund is approved, it will generally be submitted through the original payment method where feasible and appropriate, unless another method is agreed to or required by law.",
          "The time required for the funds to appear may depend on the payment processor, bank, card issuer, or other financial institution.",
        ],
      },
      {
        heading: "13. Payment Disputes and Chargebacks",
        paragraphs: [
          "If you believe a payment is incorrect, we encourage you to contact Skyrun so we can investigate.",
          "You may also have rights to dispute a charge with your bank, card issuer, or payment provider. Nothing in this policy prevents you from exercising any rights available under applicable law or payment-network rules.",
          "Skyrun will respond to payment disputes through the applicable process.",
        ],
      },
      {
        heading: "14. Third-Party Payment Providers",
        paragraphs: [
          "Where a third-party payment provider processes a transaction, its terms may govern certain aspects of payment processing and settlement.",
          "Skyrun remains responsible for handling refund requests in accordance with its own applicable obligations and the agreed booking terms. A payment provider’s processing time does not eliminate a customer’s legal rights.",
        ],
      },
      {
        heading: "15. Changes to This Policy",
        paragraphs: [
          "We may update this policy to reflect changes in our payment processes, booking arrangements, or legal obligations.",
          "The revised version will be posted with an updated date. Changes will apply as permitted by law and will not automatically rewrite the agreed refund terms of an existing booking.",
        ],
      },
      {
        heading: "16. Contact Information",
        paragraphs: [
          "Skyrun Limo LLC Email: skyrunlimo2428@gmail.com Phone: 224-619-2024 Phone: 779-240-6371",
        ],
      },
    ],
  },
  "cookie-policy": {
    slug: "cookie-policy",
    title: "Cookie Policy",
    sourcePath: "/policies/skyrun-cookie-policy-source.pdf",
    sourceFilename: "Skyrun_Limo_Cookie_Policy.pdf",
    sections: [
      {
        heading: "1. Introduction",
        paragraphs: [
          "This Cookie Policy explains how Skyrun Limo LLC (“Skyrun,” “we,” “our,” or “us”) may use cookies and similar technologies on our website. Cookies are small data files stored on a device; similar technologies may include local storage, pixels, tags, scripts, and tools used for preferences, website usage, or security.",
          "The technologies used may change. This policy must reflect the tools actually installed and the purposes for which they operate.",
        ],
      },
      {
        heading: "2. What Are Cookies?",
        paragraphs: [
          "Cookies can help a website remember information between visits or maintain information during a session. Session cookies generally expire when the session ends; persistent cookies remain for a defined period or until deleted. First-party cookies are set by the website being visited, while third-party cookies are set by another service operating on or through the website.",
          "Similar technologies may operate without traditional cookies.",
        ],
      },
      {
        heading: "3. Categories of Technologies",
        paragraphs: [
          "Strictly necessary technologies may support essential website functions, security, navigation, form submission, or other requested services. Where applicable law permits, these may operate without optional cookie consent; not every technology labeled “essential” automatically qualifies for an exemption.",
          "Functional technologies may remember preferences or improve the experience. Where required by law, they will be used only after appropriate consent or another valid legal basis has been established.",
          "If enabled, analytics and performance technologies may help Skyrun understand page visits, traffic sources, navigation patterns, and performance. Providers, data collected, retention settings, and consent requirements depend on the tools deployed.",
          "If Skyrun uses advertising pixels, retargeting tools, or similar technologies, they may measure advertising performance or support targeted advertising. These must be disclosed and controlled in accordance with applicable law.",
        ],
      },
      {
        heading: "4. Why We Use These Technologies",
        paragraphs: [
          "Depending on tools enabled, cookies and similar technologies may maintain functionality, protect forms and systems, remember preferences, diagnose issues, measure performance, understand visitor interactions, measure campaigns, or support advertising and personalization where lawfully enabled.",
        ],
      },
      {
        heading: "5. Cookie Consent and Preferences",
        paragraphs: [
          "Where applicable law requires consent for non-essential cookies or similar technologies, Skyrun will provide an appropriate consent mechanism before those technologies operate. You can also manage cookies through your browser settings; blocking some cookies may affect website features.",
        ],
      },
      {
        heading: "6. Browser Controls",
        paragraphs: [
          "Most common browsers allow users to view, block, or delete cookies through settings. Blocking cookies may affect website functionality or preferences. Browser controls may not control every tracking technology, and deleting cookies may not remove information already collected by a provider.",
        ],
      },
      {
        heading: "7. Third-Party Services",
        paragraphs: [
          "The website may rely on third-party services for hosting, security, analytics, maps, communications, or other features. Those services may use cookies or similar technologies depending on integration and configuration.",
          "Skyrun does not control all independent third-party practices; visitors should review applicable third-party policies.",
        ],
      },
      {
        heading: "8. California and Other State Privacy Rights",
        paragraphs: [
          "Depending on Skyrun's legal obligations and actual data practices, residents of certain states may have rights concerning personal information collected through cookies and similar technologies.",
          "For example, California law may provide rights concerning certain sales or sharing of personal information, including some online tracking for cross-context behavioral advertising. Where applicable, Skyrun will provide required disclosures and opt-out mechanisms and handle legally recognized browser-based opt-out signals as required by law.",
          "Exact rights and requirements depend on the relevant law, whether it applies to Skyrun, and the technologies used.",
        ],
      },
      {
        heading: "9. Do Not Track and Opt-Out Signals",
        paragraphs: [
          "Some browsers provide privacy settings or signals intended to communicate tracking preferences. Their effect depends on applicable law, the signal, and the website configuration. Where a legally recognized opt-out preference signal must be honored, Skyrun will implement necessary technical and organizational measures.",
        ],
      },
      {
        heading: "10. Updates to This Policy",
        paragraphs: [
          "Skyrun may update this policy when the website, technologies, service providers, or legal obligations change. The revised policy will be posted with an updated date. Where required, changes to cookie practices will be accompanied by appropriate notice or consent.",
        ],
      },
      {
        heading: "11. Contact Information",
        paragraphs: [
          "For questions about cookies or website privacy, contact Skyrun Limo LLC. Email: skyrunlimo2428@gmail.com | Phone: 224-619-2024 | Phone: 779-240-6371",
        ],
      },
    ],
  },
  "chauffeur-service-policy": {
    slug: "chauffeur-service-policy",
    title: "Chauffeur Service & Booking Policy",
    sourcePath: "/policies/skyrun-chauffeur-service-policy-source.pdf",
    sourceFilename: "Skyrun_Limo_Chauffeur_Service_Policy.pdf",
    sections: [
      {
        heading: "1. Purpose and Scope",
        paragraphs: [
          "This policy explains how customers request, arrange, and use chauffeur transportation services provided by Skyrun Limo LLC (“Skyrun,” “we,” “our,” or “us”). It supplements the Terms & Conditions, Cancellation Policy, and Refund Policy.",
          "Skyrun provides transportation with a professional chauffeur. It does not offer self-drive or car-only rental services under this policy.",
        ],
      },
      {
        heading: "2. Available Services",
        paragraphs: [
          "Subject to availability and applicable requirements, Skyrun may provide airport transfers, O’Hare Airport transportation, corporate travel, wedding transportation, sports-event transportation, special-event transportation, hourly chauffeur service, point-to-point transportation, city-to-city transportation, state-to-state transportation, and long-distance transportation. Not every service or route is available for every date, time, or vehicle.",
        ],
      },
      {
        heading: "3. Fleet and Vehicle Categories",
        paragraphs: [
          "Current fleet information provided for Skyrun includes the 2027 Ford Expedition (Luxury SUV), 2025 Mercedes-Benz E350 (Luxury Sedan), and 2026 Mercedes-Benz GLC 300 (Luxury SUV).",
          "Actual vehicle availability must be confirmed for each booking. Listing a vehicle does not guarantee availability for a particular journey. Substitutions are handled according to confirmed booking terms and applicable law.",
        ],
      },
      {
        heading: "4. How to Request a Ride",
        paragraphs: [
          "Customers may submit a ride enquiry through the website, telephone, email, or another officially supported channel. Information requested may include name and contact details, service type, pickup and destination, travel date and time, passenger count, preferred vehicle category, return-trip details, flight information, stops, luggage, accessibility requirements, and other instructions.",
          "Customers should provide accurate and complete information. Skyrun may ask follow-up questions before preparing a quote.",
        ],
      },
      {
        heading: "5. Review and Confirmation",
        paragraphs: [
          "Skyrun may review the request, availability, route, vehicle requirements, and other relevant factors, and may provide a quote or request more information.",
          "Submitting a request is not a booking confirmation. A ride is confirmed only when Skyrun communicates acceptance through its designated booking-confirmation process. Customers should retain the confirmation and review service details, price, payment requirements, and cancellation conditions.",
        ],
      },
      {
        heading: "6. Quotes and Service Changes",
        paragraphs: [
          "A quote should identify the service and price, plus material conditions such as duration, waiting time, additional stops, tolls, parking, taxes, and other charges where relevant. Expiry dates or availability conditions should be disclosed. Changes to a confirmed ride require Skyrun's approval and may affect price or availability. Material changes should be communicated and accepted as required before taking effect.",
        ],
      },
      {
        heading: "7. Pickup and Drop-Off Details",
        paragraphs: [
          "Customers are responsible for accurate pickup and destination details, including addresses, entrances, terminals, meeting points, and other coordination information. Notify Skyrun promptly of changes to location, contact number, destination, or timing.",
          "Arrangements remain subject to traffic restrictions, airport rules, property access, road closures, safety requirements, and lawful stopping or parking arrangements.",
        ],
      },
      {
        heading: "8. Airport Transportation",
        paragraphs: [
          "Customers should provide accurate flight information when requested, including airline, flight number, airport, arrival or departure details, and timing. The quote or confirmation should clarify the pickup arrangement, such as curbside, a designated meeting point, or another agreed location.",
          "Flight delays, cancellations, diversions, early arrivals, baggage delays, and missed connections may affect pickup arrangements. Flight monitoring, included waiting time, additional waiting charges, and handling of flight changes must be stated in the applicable booking terms.",
        ],
      },
      {
        heading: "9. Waiting Time and Customer Delays",
        paragraphs: [
          "The agreed pickup time and any included waiting period should be specified in the booking confirmation. Customers should be ready at the agreed location and reachable by the contact number provided. Additional waiting charges or a no-show outcome may apply only as disclosed in the booking terms and permitted by law.",
        ],
      },
      {
        heading: "10. Passenger and Luggage Requirements",
        paragraphs: [
          "Customers must provide a reasonable estimate of passenger count and luggage. Capacity depends on the vehicle and configuration. Notify Skyrun in advance about oversized luggage, mobility equipment, child-seat requirements, or other special arrangements.",
          "If actual needs exceed the confirmed arrangement, the booking may need to be revised. Proposed price or service changes should be communicated before proceeding where required.",
        ],
      },
      {
        heading: "11. Child Seats and Accessibility",
        paragraphs: [
          "Advise Skyrun of child-seat requirements, mobility assistance, accessibility needs, or other accommodations when requesting a quote. Availability and compatibility should be confirmed before the ride. Skyrun will handle requests in accordance with applicable law and confirmed arrangements.",
        ],
      },
      {
        heading: "12. Hourly Service and Additional Stops",
        paragraphs: [
          "Hourly service may be subject to a minimum duration, agreed service area, mileage or time limits, and additional charges. The quote should specify included hours, start and end arrangements, permitted stops or route, overtime rate if applicable, and material limitations.",
          "Additional stops, route changes, and extended service are subject to availability and may change the price. Request approval before making material changes.",
        ],
      },
      {
        heading: "13. Corporate and Event Transportation",
        paragraphs: [
          "Corporate, wedding, sports-event, and other special-event services may require advance planning. The booking confirmation should identify the contracting customer, authorized contact, itinerary, payment responsibility, and special conditions.",
          "If a third party arranges transportation, that party should ensure passengers receive relevant pickup and conduct instructions. Special-event cancellation and deposit terms must be disclosed before confirmation.",
        ],
      },
      {
        heading: "14. Chauffeur Conduct and Passenger Safety",
        paragraphs: [
          "Skyrun expects professional and respectful conduct. Passengers must follow reasonable safety instructions and must not engage in unlawful or dangerous conduct.",
          "A chauffeur may take reasonable safety measures, including stopping at a safe location or declining to continue where continuing would create an unreasonable safety or legal risk, subject to applicable law and circumstances. Charges or refunds are determined under the booking terms and applicable law.",
        ],
      },
      {
        heading: "15. Delays, Weather, and Unexpected Events",
        paragraphs: [
          "Traffic, severe weather, road closures, airport conditions, emergencies, and other events may affect travel time or service availability. Skyrun will make reasonable efforts to coordinate transportation and communicate material disruptions.",
          "Customers should allow appropriate travel time for flights, meetings, ceremonies, and scheduled events. Unless expressly agreed and legally supportable, Skyrun does not guarantee an exact arrival time or an outcome dependent on factors outside its reasonable control.",
        ],
      },
      {
        heading: "16. Cancellations and Refunds",
        paragraphs: [
          "Cancellations, late cancellations, no-shows, and refund eligibility are governed by the applicable Cancellation Policy, Refund Policy, and booking-specific terms. Review these policies before confirming a ride.",
        ],
      },
      {
        heading: "17. Personal Belongings",
        paragraphs: [
          "Customers are responsible for checking that they have collected their belongings. If an item is left behind, contact Skyrun promptly with a description, travel date, and booking reference.",
          "Skyrun will make reasonable efforts to coordinate return where practicable. Any return arrangement or delivery charge must be communicated. Liability for lost or damaged property is subject to applicable law and circumstances.",
        ],
      },
      {
        heading: "18. Complaints and Service Issues",
        paragraphs: [
          "Contact Skyrun as soon as reasonably possible about a service issue. Provide the booking reference, travel date, description, and supporting information where available. Skyrun will review the matter and communicate next steps. A complaint does not automatically establish refund entitlement, but will be considered under the booking terms and law.",
        ],
      },
      {
        heading: "19. Contact Information",
        paragraphs: [
          "Skyrun Limo LLC | Email: skyrunlimo2428@gmail.com | Phone: 224-619-2024 | Phone: 779-240-6371",
        ],
      },
    ],
  },
};
