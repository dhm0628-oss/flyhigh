import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const sections = [
  {
    title: "1. Description of Service",
    paragraphs: [
      "These Terms of Service apply to all users of the online media, content distribution, streaming, and community services provided through Flyhigh.tv and related domains, subdomains, websites, applications, and TV platforms (collectively, the Services).",
      "These Terms govern your use of Flyhigh.tv, including its features, streaming services, audio, visual and written materials, PDFs, links, user interfaces, content, and software provided by Flyhigh.tv (the Company)."
    ]
  },
  {
    title: "2. Acceptance and Changes to Terms",
    paragraphs: [
      "The Company may modify, add, or remove any part of these Terms of Service at its sole discretion, without notice or liability to you.",
      "Any changes are effective immediately after posting. By continuing to use the Services after changes are posted, you accept those changes and agree to review these Terms periodically."
    ]
  },
  {
    title: "3. Access and Use of Service",
    paragraphs: [
      "Users accessing the Services must be at least thirteen (13) years old. Users registering for the Services and uploading user generated content must be at least eighteen (18) years old.",
      "The Company makes no representation that the Services may be lawfully accessed in any specific location. You are solely responsible for complying with the laws and regulations of your jurisdiction."
    ]
  },
  {
    title: "4. Your Conduct",
    paragraphs: [
      "The Services may be used only for lawful purposes relating to streaming and related materials. The Company prohibits use of the Services for any purpose other than the purposes designated by the Company.",
      "You may not violate or attempt to violate the security of the Services, including accessing data not intended for you, logging into accounts you are not authorized to access, probing vulnerabilities, breaching security or authentication measures, interfering with service, submitting malicious code, overloading systems, forging packet headers, scraping or harvesting data, or using automated systems to manipulate the service.",
      "Violations of system or network security may result in civil or criminal liability. The Company may investigate suspected violations and may cooperate with law enforcement authorities.",
      "You are solely responsible for your conduct in any community forum. Harassment, degrading comments, spam, self-promotion, and irrelevant third-party links are not allowed. Public contributions may be moderated, suspended, or removed."
    ]
  },
  {
    title: "5. User Information",
    paragraphs: [
      "You are solely responsible for the information you submit or upload to the Services and represent that you have the right and authority to register for the Services and post user generated content.",
      "The Company may determine in its sole discretion whether information you submit is appropriate and complies with these Terms, Company policies, and applicable law.",
      "If you register, you may be asked to provide information including a valid email address. You represent that this information is current, accurate, and kept up to date.",
      "Your privacy rights are described in our Privacy Policy."
    ],
    links: [
      { href: "/privacy", label: "Privacy Policy" }
    ],
    tail: [
      "The Company may offer Company or third-party services and products to you based on your preferences unless you opt out where such opt-out is available."
    ]
  },
  {
    title: "6. Username / Password / Security",
    paragraphs: [
      "You are responsible for maintaining the confidentiality of your account information, including your username and password, and for all use of your credentials, whether or not authorized by you.",
      "If another person uses your device, you should log out so that person does not gain access to your account or content.",
      "You agree to immediately notify the Company of any unauthorized use of your username or password."
    ]
  },
  {
    title: "7. Use of Services",
    paragraphs: [
      "The Services are offered for video streaming and related materials. Each user is solely responsible for deciding whether the Services are suitable for that user's purposes.",
      "The Company grants you a limited, non-exclusive license to access and use the Services for your personal, non-commercial use, including viewing content on the Company's website and applications.",
      "If you access any component of the Services for which a fee applies, you agree to pay all associated charges on a timely basis and maintain valid payment information when applicable."
    ]
  },
  {
    title: "8. Access to Services - Subscriptions and Purchases",
    paragraphs: [
      "The Services may allow access to digital content on a pay-per-view, subscription, rental, or purchase basis. The applicable access model will be shown on the relevant product detail page.",
      "Subject to payment of applicable fees, the Company grants you a non-exclusive, non-transferable, personal, non-sublicensable, limited right to view the video stream based on the purchase, subscription, rental, or pay-per-view option you selected.",
      "The Company makes no guarantees regarding resolution or streaming quality. Quality and speed depend on variables including connection speed, location, device, player, and bandwidth."
    ]
  },
  {
    title: "9. Payments and Billing",
    paragraphs: [
      "Digital content and payment plans, including pay-per-view, subscription, membership, and rental options, may change from time to time at the Company's sole discretion. The Company does not guarantee the availability of any specific payment plan.",
      "By purchasing a payment plan, you authorize the Company to charge your selected payment method. You may update your billing information through your account settings where available.",
      "Receipts are sent to the registered email address after a successful charge. Your subscription continues unless you cancel it or we terminate it. You must cancel before the next billing date under the terms of your plan to avoid further billing."
    ]
  },
  {
    title: "10. User Comments and Suggestions",
    paragraphs: [
      "Although the Company values feedback, please do not submit creative ideas, inventions, or suggestions unless specifically requested.",
      "If you nevertheless submit creative ideas, inventions, or suggestions, those submissions become the property of the Company and may be used without compensation to you or any third party.",
      "No part of any submission will be subject to any obligation of confidence, and the Company will not be liable for any use or disclosure of such submissions."
    ]
  },
  {
    title: "11. Intellectual Property",
    paragraphs: [
      "Flyhigh.tv and any related trademarks, trade names, and variations are and remain the exclusive property of the Company. Unauthorized use is prohibited.",
      "The Services, including programs, compiled binaries, interface layout, interface text, documentation, resources, and graphics, are the sole and exclusive property of the Company and are protected by copyright, trademark, and other intellectual property laws of the United States and other countries.",
      "You agree that Flyhigh.tv owns and retains all rights in the Services, and that content made available through the Services is owned or controlled by the applicable content provider and protected by intellectual property law.",
      "You may not sell, modify, reproduce, display, publicly perform, distribute, or otherwise use the Services or Services content except as expressly allowed by the Company."
    ]
  },
  {
    title: "12. Social Networking",
    paragraphs: [
      "Users may have the option to share links or content from the Services through social networking services. Any such use is your sole responsibility, including compliance with the applicable terms of those third-party services."
    ]
  },
  {
    title: "13. Use of Software",
    paragraphs: [
      "If the Services require or include downloadable software, including applications, the Company grants you a personal, limited, non-exclusive, and non-transferable license to use the software only for purposes related to video streaming and related activities through Flyhigh.tv.",
      "You may not modify, alter, create derivative works from, decompile, reverse engineer, disassemble, include in other software, translate, copy, reproduce, transmit, rent, lease, resell, sublicense, assign, distribute, or otherwise transfer the software or this license.",
      "This license does not allow use of the software on any device you do not own or control, and you may not distribute or make the software available over a network where it could be used by multiple devices at the same time.",
      "You agree that the software, including its design and structure, contains proprietary and confidential information, trade secrets, and intellectual property of the Company.",
      "Use of the software may require the Company to obtain your phone number or other information in order to provide access. The Company may also collect technical data and related information in order to provide updates, support, and related services, provided the information does not personally identify you.",
      "The Company may revise, automatically update, or otherwise modify the software at any time, with reasonable posted or emailed notice. Continued use of the software constitutes acceptance of those changes.",
      "This license remains in effect until terminated by you or the Company. Your rights terminate automatically if you fail to comply with this license. Upon termination, you must stop using and delete all versions of the software.",
      "The warranty disclaimers and limitation of liability provisions in these Terms also apply to the software."
    ]
  },
  {
    title: "14. Copyright Infringement Notification",
    paragraphs: [
      "If you believe copyrighted work is accessible through the Services in a way that constitutes infringement, please provide the Company's designated copyright agent with your signature, a description of the copyrighted work, a description of the allegedly infringing activity, the URL or specific location where the material appears, your contact information, and a statement under penalty of perjury that the information is accurate and authorized.",
      "If you believe a copyright notice was wrongly filed against you, you may send a counter-notice including your name, address, telephone number, the source address of the removed content, a statement under penalty of perjury that you have a good faith belief the content was removed in error, and a statement consenting to the appropriate court's jurisdiction and acceptance of service of process.",
      "The United States Copyright Act prohibits submission of a false or materially misleading notice or counter-notice.",
      "The Company has designated David Mayo as the agent to receive notices of claims of copyright infringement."
    ],
    links: [
      { href: "mailto:david@flyhigh.tv", label: "david@flyhigh.tv" }
    ]
  },
  {
    title: "15. Warranty Disclaimers",
    paragraphs: [
      "THE SERVICES ARE PROVIDED AS IS AND AS AVAILABLE, WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND. THE COMPANY DISCLAIMS ALL WARRANTIES AND CONDITIONS, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, QUIET ENJOYMENT, ACCURACY, AND NON-INFRINGEMENT.",
      "THE COMPANY DOES NOT WARRANT THAT THE SERVICES WILL MEET USER REQUIREMENTS, OPERATE WITHOUT INTERRUPTION OR ERROR, OR BE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.",
      "THE COMPANY MAKES NO WARRANTIES ABOUT THE ACCURACY, RELIABILITY, COMPLETENESS, OR TIMELINESS OF THE SERVICES, USER GENERATED CONTENT, OR OTHER CONTENT ACCESSED THROUGH THE SERVICES.",
      "TRANSMISSION OF DATA OVER THE INTERNET OR OTHER PUBLIC NETWORKS IS NOT SECURE AND MAY BE LOST, INTERCEPTED, OR ALTERED. THE COMPANY DOES NOT ASSUME LIABILITY FOR DAMAGE OR COSTS ARISING FROM SUCH TRANSMISSIONS.",
      "THE COMPANY TAKES NO RESPONSIBILITY FOR INFORMATION YOU UPLOAD TO THE SERVICES AND IS NOT LIABLE FOR DELETION, CORRECTION, DAMAGE, LOSS, OR FAILURE TO STORE SUCH INFORMATION. USERS ARE EXPECTED TO MAINTAIN THEIR OWN BACKUPS.",
      "TO THE FULLEST EXTENT PERMITTED BY LAW, THE COMPANY'S MAXIMUM LIABILITY SHALL NOT EXCEED THE AMOUNT, IF ANY, PAID FOR THE SERVICES."
    ]
  },
  {
    title: "16. Limitation of Liability",
    paragraphs: [
      "TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, NEITHER THE COMPANY NOR ITS AFFILIATES, SUBSIDIARIES, DIRECTORS, OFFICERS, EMPLOYEES, PARTNERS, REPRESENTATIVES, CONTRACTORS, OR AGENTS SHALL BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, EXEMPLARY, OR OTHER DAMAGES RELATING TO OR RESULTING FROM YOUR USE OR INABILITY TO USE THE SERVICES.",
      "THIS LIMITATION APPLIES REGARDLESS OF WHETHER THE CLAIM IS BASED ON WARRANTY, CONTRACT, NEGLIGENCE, TORT, OR ANY OTHER LEGAL THEORY, EVEN IF THE COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES."
    ]
  },
  {
    title: "17. Indemnification",
    paragraphs: [
      "You agree to defend, indemnify, and hold harmless the Company and its subsidiaries, affiliates, officers, directors, employees, agents, representatives, and partners from and against any loss, liability, claim, action, or demand, including reasonable legal and accounting fees, arising out of your use of the Services, your user generated content or communications, or your breach of these Terms.",
      "The Company will provide prompt notice of any such claim and may assist you, at your expense, in defending it. The Company reserves the right to assume the exclusive defense and control of any matter subject to indemnification."
    ]
  },
  {
    title: "18. Communications",
    paragraphs: [
      "By using the Services, you consent to receive electronic communications from the Company, including emails relating to your account, password, access, marketing, transactions, and other information related to the Services and your account."
    ]
  },
  {
    title: "19. Additional Terms and Conditions",
    paragraphs: [
      "Nothing in this Agreement is intended to create, and nothing will be construed as creating, a joint venture, partnership, employer-employee, or principal-agent relationship between users and the Company.",
      "These Terms of Service are governed by the laws of the State of North Carolina, without regard to conflict of laws rules and excluding the United Nations Convention on Contracts for the International Sale of Goods. You consent to the exclusive jurisdiction of the courts located in the State of North Carolina for any action arising out of or related to these Terms.",
      "If any court with competent jurisdiction holds any provision of these Terms invalid or unenforceable, that provision shall be enforced to the maximum extent permitted by law and the remaining provisions shall remain in full force and effect.",
      "The failure or delay of either party to enforce any right or claim does not constitute a waiver unless the waiver is expressly made in writing and signed by an authorized representative.",
      "You may not assign these Terms of Service or any rights or obligations under them.",
      "Except as expressly stated in these Terms, this Agreement creates rights and obligations only between the Company and each user and does not create rights for any other party."
    ]
  }
];

export default function TermsPage() {
  return (
    <main className="page page--marketing">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="brand">Legal</div>
          <h1>Terms of Service</h1>
          <p className="watch-copy">
            These Terms govern the use of FlyHigh TV. Section 19 still contains a state placeholder and should be updated with your registered state before launch.
          </p>
        </div>
      </section>

      <section className="content">
        <article className="legal-card">
          <div className="legal-prose legal-prose--terms">
            {sections.map((section) => (
              <section key={section.title} className="legal-section">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.links?.length ? (
                  <p>
                    {section.links.map((link, index) => (
                      <span key={link.href}>
                        {index > 0 ? " | " : ""}
                        <a href={link.href}>{link.label}</a>
                      </span>
                    ))}
                  </p>
                ) : null}
                {section.tail?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
