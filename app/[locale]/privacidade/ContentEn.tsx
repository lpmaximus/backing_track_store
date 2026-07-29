import { Link } from "@/src/i18n/navigation";

/**
 * Privacy Policy — English rendering.
 *
 * Faithful translation of ContentPt.tsx, which remains the governing version.
 * The policy is built on Brazil's LGPD; the statute is named in Portuguese so
 * it is clear which law applies. Any change to the Portuguese must be mirrored.
 */
export default function PrivacyContentEn() {
  return (
    <>
      <div className="legal-highlight">
        <p>
          <strong>Language and governing version.</strong> This English text is provided for your
          convenience. The Portuguese version of this Policy is the governing one: if there is any conflict
          or ambiguity between the two, the Portuguese text prevails. Data processing is governed by
          Brazil&apos;s Lei Geral de Proteção de Dados (LGPD).
        </p>
      </div>

      <p>
        Thank you for choosing backingtrack.store. We are a platform for hobby and working musicians to
        practise and perform with backing tracks, instrument separation (stems), synced chord charts and
        band collaboration tools. To provide that service, we need to process some of your personal data.
        Your privacy matters to us, and this Privacy Policy (&quot;Policy&quot;) explains transparently what
        data we collect, why we collect it, who we share it with, how long we keep it and what rights you
        have over it.
      </p>
      <p>
        This Policy follows the principles and obligations of the Lei Geral de Proteção de Dados (Law
        13.709/2018 — LGPD), the Brazilian statute governing the processing of personal data.
      </p>

      <h2>1. About this Policy</h2>
      <p>
        This Policy applies to all services offered at backingtrack.store and associated services
        (&quot;Service&quot;). The conditions for using the Service are set out in our{" "}
        <Link href="/termos">Terms of Use</Link>, a document complementary to this Policy.
      </p>
      <p>
        If we launch new features or services that significantly change how we process your personal data,
        we will update this Policy and let you know before or at the time of the change. The purpose of this
        Policy is: to explain what personal data we collect, why we collect it and who we share it with; to
        explain how we use the data you entrust to us to provide a good experience on the Service; and to
        explain your rights and choices regarding the personal data we process, and how we protect it.
      </p>
      <p>
        If you do not agree with this Policy, please do not use the Service. Questions can be sent to the
        contact channel in Section 14.
      </p>

      <h2>2. Your rights as a data subject (LGPD, art. 18)</h2>
      <p>As a data subject, you have the following rights under art. 18 of the LGPD:</p>
      <ul>
        <li><strong>Confirmation and access</strong> — to confirm whether we process your personal data and to access it;</li>
        <li><strong>Correction</strong> — to request correction of incomplete, inaccurate or out-of-date data;</li>
        <li><strong>Anonymisation, blocking or deletion</strong> — of unnecessary or excessive data, or data processed unlawfully;</li>
        <li><strong>Portability</strong> — to request portability of your data to another service provider, on express request;</li>
        <li><strong>Deletion</strong> — to request deletion of personal data processed on the basis of your consent, subject to the retention grounds provided by law (Section 8);</li>
        <li><strong>Information about sharing</strong> — to obtain information about which public or private entities we share your data with;</li>
        <li>Information about the possibility of withholding consent and the consequences of doing so;</li>
        <li><strong>Withdrawal of consent</strong> — to withdraw your consent at any time, without affecting the lawfulness of processing carried out before withdrawal;</li>
        <li><strong>Review of automated decisions</strong> — to request review of decisions taken solely on the basis of automated processing that affect your interests.</li>
      </ul>
      <p>
        To exercise any of these rights, use the channel in Section 13. If, after contacting us, you believe
        your request was not handled properly, you also have the right to petition the Autoridade Nacional de
        Proteção de Dados (ANPD), Brazil&apos;s data protection authority.
      </p>

      <h2>3. Personal data we collect</h2>
      <h3>3.1 Registration data</h3>
      <p>
        When you create an account we collect: name, email, password (stored encrypted, never in plain text)
        or, if you choose to sign in with your Google account, the basic profile data provided by Google
        (name, email, photo) with your explicit authorisation at sign-in.
      </p>
      <h3>3.2 Usage data</h3>
      <p>
        We collect data about how you use the Service, including: songs searched and played, stems
        enabled/disabled during practice, A-B loop use, speed and transposition applied, setlists created,
        comments posted on chord charts, playback history, and interactions with the community and with
        support.
      </p>
      <h3>3.3 Content you upload (audio uploads and recordings)</h3>
      <p>
        If you use personal upload features, we collect and process the audio file you upload for instrument
        separation (stems), through our processing pipeline (running on on-demand GPU infrastructure).
      </p>
      <p>
        If you use the own-recording feature (&quot;takes&quot;/overdub), we collect the audio recorded by
        your microphone through the browser. Those recordings are linked to your account and have visibility
        you control: private (default), shared with your band, or public if you choose.
      </p>
      <h3>3.4 Band and collaboration data</h3>
      <p>
        If you take part in a band inside the Service, we process data about your role in the band
        (leader/member), shared setlists, chord corrections submitted for community validation, and invites
        sent and received.
      </p>
      <h3>3.5 Payment data</h3>
      <p>
        If you subscribe to a paid plan, billing data (name, tax ID where required, payment method details)
        is collected and processed directly by our payment partner (currently Asaas). We do not store full
        credit card numbers on our own systems. We keep only the history of subscription and transaction
        status (date, amount, plan).
      </p>
      <h3>3.6 Technical data and cookies</h3>
      <p>
        We automatically collect: IP address, browser type and version, operating system, device identifiers,
        cookie data and similar technologies, and Service performance/error information. We use this
        information to make the Service work, keep your session authenticated, prevent fraud and, on the free
        plan, display advertising (Section 10). See more detail in our{" "}
        <Link href="/cookies">Cookie Policy</Link>.
      </p>

      <h2>4. What we use your data for, and the legal basis</h2>
      <table>
        <thead>
          <tr><th>Purpose</th><th>Legal basis (LGPD, art. 7)</th><th>Data involved</th></tr>
        </thead>
        <tbody>
          <tr><td>Create and maintain your account, authenticate sign-in</td><td>Performance of a contract</td><td>Registration data</td></tr>
          <tr><td>Process stem separation and provide the player, synced chord charts and other Service functions</td><td>Performance of a contract</td><td>Registration data, usage data, uploaded content</td></tr>
          <tr><td>Enable band features (shared setlist, roles, community chord corrections)</td><td>Performance of a contract / consent</td><td>Band and collaboration data</td></tr>
          <tr><td>Process subscription payment</td><td>Performance of a contract / legal obligation</td><td>Payment data</td></tr>
          <tr><td>Prevent fraud and abuse (e.g. misuse of separation limits per account)</td><td>Legitimate interest</td><td>Usage data, technical data</td></tr>
          <tr><td>Respond to copyright holder notices and apply content blocking (Section 6)</td><td>Compliance with a legal obligation / legitimate interest</td><td>Registration data, usage data</td></tr>
          <tr><td>Send communications about your account, billing and Service changes</td><td>Performance of a contract / legal obligation</td><td>Registration data</td></tr>
          <tr><td>Display advertising on the free plan</td><td>Legitimate interest / consent (cookies)</td><td>Technical data</td></tr>
          <tr><td>Improve the Service and develop new features</td><td>Legitimate interest</td><td>Usage data, technical data</td></tr>
          <tr><td>Comply with legal and tax obligations and respond to competent authorities</td><td>Compliance with a legal obligation</td><td>As required</td></tr>
        </tbody>
      </table>

      <h2>5. Sharing personal data</h2>
      <p>We do not sell your personal data. We share personal data only in the following situations:</p>
      <p><strong>With other users, inside the Service:</strong></p>
      <ul>
        <li>If you take part in a band, your name/role and what you share with the band (setlists, chord corrections) are visible to the other members.</li>
        <li>If you choose to make a recording/take public, it becomes visible to other users.</li>
        <li>The catalog of processed songs (stems + chord chart) is shared between users on paid plans, as detailed in Section 6 — this does not involve sharing your personal data, only the processed musical content.</li>
      </ul>
      <p><strong>With service providers acting on our behalf</strong> (each processing data only to perform its specific function):</p>
      <table>
        <thead><tr><th>Category</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>Hosting and database infrastructure (Vercel, Neon)</td><td>Host the Service and store data in a structured way</td></tr>
          <tr><td>Audio storage (Cloudflare R2)</td><td>Store audio files (backing tracks, uploads, recordings)</td></tr>
          <tr><td>Stem separation processing (on-demand GPU infrastructure)</td><td>Run instrument separation on the uploaded audio</td></tr>
          <tr><td>Authentication (Google OAuth)</td><td>Allow sign-in with a Google account, when you choose that option</td></tr>
          <tr><td>Payment processing (currently Asaas)</td><td>Process charges and manage subscriptions</td></tr>
          <tr><td>Advertising (Google AdSense, on the free plan)</td><td>Display non-intrusive ads outside the player</td></tr>
        </tbody>
      </table>
      <p><strong>With authorities and third parties, where required:</strong></p>
      <ul>
        <li>Public authorities, under a court order or valid legal request.</li>
        <li>Copyright holders, in the context of the notice-and-takedown policy (Section 6).</li>
        <li>A potential buyer of the business, in the event of a merger, acquisition or asset sale — in that case you will be notified before your data is transferred.</li>
      </ul>

      <h2>6. Shared catalog and copyright notice-and-takedown policy</h2>
      <p>
        Unlike a wholly owned music catalog, backingtrack.store works largely from audio uploaded by users
        themselves for instrument separation. The processed result (stems and chord chart) of a given song
        may become available to other users on paid plans, as a way of avoiding duplicate reprocessing and
        allowing community-validated chord charts.
      </p>
      <p>
        If the holder of the copyright in a composition or sound recording notifies backingtrack.store
        requesting removal of a song from the catalog, we may make that song unavailable to all users who
        rely on it, even if you were not the one who originally uploaded it. In that case the file is not
        deleted — it is blocked, with a message stating it is unavailable at the request of the copyright
        holder — and it may become accessible again if the notice is successfully contested through the
        counter-notice channel.
      </p>
      <p>
        By using the Service, and especially by subscribing to a paid plan with access to the shared catalog,
        you expressly agree to this condition, including the possibility of temporary or permanent
        unavailability of specific songs for that reason, without this amounting to a failure of the
        contracted service.
      </p>
      <p>
        If you are a copyright holder and wish to request removal of content, or you are a user and wish to
        contest a removal, get in touch through the channel in Section 13, with proof of ownership of the
        right (registration, publishing contract, or representation by a publisher/label).
      </p>

      <h2>7. International data transfers</h2>
      <p>
        Some of the service providers listed in Section 5 (hosting, database, storage, separation processing)
        may store or process data on servers located outside Brazil. In those cases we seek to ensure the
        transfer is to countries or bodies providing an adequate level of personal data protection, or is
        made under mechanisms provided for in the LGPD (art. 33), such as specific contractual clauses with
        suppliers.
      </p>

      <h2>8. Data retention and deletion</h2>
      <p>
        We keep your personal data while your account is active and for as long as necessary to fulfil the
        purposes described in this Policy, including applicable legal, tax and accounting obligations.
      </p>
      <p>
        If you request deletion of your account, your registration data and personal content will be removed
        or anonymised within a reasonable period, subject to the grounds in art. 16 of the LGPD (compliance
        with a legal obligation, exclusive use by the controller where anonymised, transfer to a third party
        with your consent, or exclusive use for legitimate purposes such as fraud prevention). Audio files
        blocked following a copyright notice (Section 6) are kept for a set period, long enough to allow a
        counter-notice, before permanent deletion.
      </p>
      <p>To request deletion of your account and your data, get in touch through the channel in Section 13.</p>

      <h2>9. Information security</h2>
      <p>
        We adopt technical and organisational measures to protect your personal data, including: encrypted
        connections (HTTPS/TLS), password storage with cryptographic hashing, access to the admin panel
        restricted to authorised staff, and audio file storage on access-controlled infrastructure.
      </p>
      <p>
        No system is entirely free of risk. We recommend using a strong, unique password for your account and
        not sharing it with anyone.
      </p>

      <h2>10. Cookies and advertising</h2>
      <p>
        We use cookies and similar technologies to keep your session authenticated, remember your preferences
        and, on the free plan, display advertising (Google AdSense) outside the player — never overlaid on
        the content or during practice/performance mode.
      </p>
      <p>
        You can manage non-essential cookies directly in your browser settings. Cookies strictly necessary
        for the Service to work (such as authentication cookies) cannot be disabled without compromising use
        of the platform. See the full list in our <Link href="/cookies">Cookie Policy</Link>.
      </p>

      <h2>11. Children and adolescents</h2>
      <p>
        The Service is not directed at children (people under 12, as defined by the LGPD). We do not
        knowingly collect personal data from children. Processing of adolescents&apos; data (12 to 18) follows
        the best interests of the data subject, as required by the LGPD.
      </p>
      <p>
        If you are the legal guardian of a child and find that they have provided us with personal data
        without your authorisation, get in touch through the channel in Section 13 so we can delete that
        data.
      </p>

      <h2>12. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. When we make material changes, we will notify you by a
        notice in the Service and/or by email, before or at the time the change takes effect. We recommend
        reviewing this Policy periodically.
      </p>

      <h2>13. How to contact us</h2>
      <p>
        If you have questions about this Policy, want to exercise the rights described in Section 2, or want
        to report a copyright matter (Section 6), get in touch through our{" "}
        <Link href="/contato">contact form</Link> or by email at{" "}
        <a href="mailto:contato@l2techs.com">contato@l2techs.com</a>.
      </p>
    </>
  );
}
