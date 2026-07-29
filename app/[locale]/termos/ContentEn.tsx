import { Link } from "@/src/i18n/navigation";

/**
 * Terms of Use — English rendering.
 *
 * Faithful translation of the Portuguese text (ContentPt.tsx), which remains
 * the governing version. Brazilian statutes are named in Portuguese with a
 * short gloss, because translating "Código de Defesa do Consumidor" into
 * "Consumer Protection Code" would suggest a different body of law applies.
 *
 * Any change to the Portuguese must be mirrored here — see Section 0.
 */
export default function TermsContentEn() {
  return (
    <>
      <div className="legal-summary">
        <p>
          <strong>In short:</strong> these Terms govern the use of backingtrack.store — a subscription
          service for music practice, with backing tracks, synced chord charts, per-instrument track
          separation (stems) and band collaboration tools. By creating an account or using the service,
          you agree to these conditions, to the{" "}
          <Link href="/privacidade">Privacy Policy</Link> and to the{" "}
          <Link href="/cookies">Cookie Policy</Link>.
        </p>
      </div>

      <div className="legal-highlight">
        <p>
          <strong>Language and governing version.</strong> This English text is provided for your
          convenience. The Portuguese version of these Terms is the governing one: if there is any
          conflict or ambiguity between the two, the Portuguese text prevails. The Service is operated
          from Brazil by L2techs and is governed by Brazilian law, as set out in Section 16.
        </p>
      </div>

      <p>
        These Terms of Use (&quot;Terms&quot;) form a contract between you and L2techs, the operator of
        backingtrack.store (&quot;backingtrack.store&quot;, &quot;we&quot;, &quot;the platform&quot; or
        &quot;the service&quot;), available at backingtrack.store and in any related applications
        (together, the &quot;Service&quot;).
      </p>
      <p>
        <strong>Please read carefully.</strong> By clicking &quot;I accept&quot;, creating an account or
        otherwise using the Service, you confirm that you have read, understood and agree to be bound by
        these Terms, the Privacy Policy and the Cookie Policy. If you do not agree, you should not create
        an account or use the Service.
      </p>
      <p>
        These Terms are governed by Brazilian law, in particular the Código de Defesa do Consumidor
        (Brazil&apos;s consumer protection statute). No clause here is intended to remove any right that
        Brazilian law grants you as a consumer — where a clause of these Terms conflicts with a mandatory
        rule of that statute, the statute prevails.
      </p>

      <h2>1. What backingtrack.store is</h2>
      <p>
        backingtrack.store is a digital platform for hobby and working musicians, built for practice,
        rehearsal, study and performance — it is not a passive music consumption service (like a playlist
        player). The Service combines:
      </p>
      <ul>
        <li>a catalog of backing tracks (instrumental beds) produced by the platform itself, with chord charts synced in real time;</li>
        <li>a professional player with speed, key (pitch shift) and section-loop controls;</li>
        <li>tools that let you upload your own audio recording and obtain, through artificial intelligence, the separation of that recording into per-instrument tracks (&quot;stems&quot;) — drums, bass, guitar and other elements, subject to technical availability; and</li>
        <li>collaboration features for bands and musical groups: shared setlists, comments, community-corrected chord charts and a Performance Mode for rehearsals and shows.</li>
      </ul>
      <p>
        We may add, change, limit or discontinue any Service feature at any time, including features still
        in an experimental (&quot;beta&quot;) stage, without this creating a right to compensation — subject
        to the consumer&apos;s right to cancel the subscription under Section 3.4.
      </p>

      <h2>2. Eligibility and account</h2>
      <h3>2.1 Who may use the Service</h3>
      <p>
        You must be at least 13 years old to use the Service. If you are between 13 and 18, use must be
        with the knowledge and consent of a parent or legal guardian, who also becomes responsible for the
        obligations under these Terms, including financial ones. By accepting these Terms you confirm that
        you have legal capacity to contract or that you have obtained such consent.
      </p>
      <h3>2.2 Registration</h3>
      <p>
        To use most Service features you need to create an account, providing true, complete and current
        information (name, email and, where applicable, payment details). Registration can be done directly
        or through social login (e.g. Google).
      </p>
      <p>
        You are responsible for keeping your password confidential and for all activity carried out under
        your account. Tell us immediately if you suspect unauthorised use of your account, through the
        channel in Section 18.
      </p>
      <h3>2.3 One account per person</h3>
      <p>
        Each account is personal and non-transferable. Band accounts work as a shared space between members
        invited by someone who already has an individual account — sharing the login and password of a
        single account among several people to get around plan limits is not permitted.
      </p>

      <h2>3. Plans, prices and payment</h2>
      <p>
        The Service is offered in a free plan and paid subscription plans. The features, usage limits and
        current prices of each plan are always described on the site&apos;s{" "}
        <Link href="/planos">pricing page</Link> (&quot;Pricing Page&quot;), which prevails over any figure
        quoted in this Section in the event of a discrepancy caused by a price change or a change of offer.
      </p>
      <h3>3.1 Plan overview (reference as of this date)</h3>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Free</th>
            <th>Pro</th>
            <th>Pro Band</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Backing track catalog</td><td>Open access</td><td>Open access</td><td>Open access</td></tr>
          <tr><td>Own upload + stem separation</td><td>3 separations/month, full export</td><td>20 separations/month</td><td>40 separations/month</td></tr>
          <tr><td>Per-instrument stems in the player (mute/solo)</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
          <tr><td>Export (download) of the separated stems</td><td>Yes, within the 3 separations/month</td><td>Yes</td><td>Yes</td></tr>
          <tr><td>Pitch shift and A-B loop</td><td>No</td><td>Yes</td><td>Yes</td></tr>
          <tr><td>Community comments</td><td>Read only</td><td>Read and write</td><td>Read and write</td></tr>
          <tr><td>Setlist and Performance Mode</td><td>No</td><td>Yes</td><td>Yes</td></tr>
          <tr><td>Band (create and invite members)</td><td>No</td><td>No</td><td>Yes, up to 6 members per band (leader + 5)</td></tr>
          <tr><td>Download of the platform&apos;s own catalog backing tracks</td><td>No</td><td>No</td><td>No</td></tr>
        </tbody>
      </table>
      <p>
        Current prices in your currency are shown on the Pricing Page. The monthly audio separation limits
        (3 / 20 / 40) are disclosed openly: you can check how many separations you have used this month and
        your plan&apos;s ceiling directly in your account. These numbers exist to curb abusive or automated
        use and may be adjusted with prior notice on the Pricing Page.
      </p>
      <h3>3.2 Billing and renewal</h3>
      <p>
        Paid plans are charged on a recurring basis (monthly or yearly, as you choose) through a third-party
        payment processor. By subscribing to a paid plan you authorise automatic charging of the plan amount
        and applicable taxes to the payment method on file, each cycle, until cancellation.
      </p>
      <p>
        The subscription renews automatically at the end of each cycle, at the price then in force, unless
        cancelled before the renewal date. Price changes for ongoing subscriptions will be communicated to
        you at least 30 days in advance, and you may cancel before the new price takes effect.
      </p>
      <h3>3.3 Trial period</h3>
      <p>
        The Pro plan may be trialled for 7 days at no cost by eligible new subscribers, with proportional
        use of the plan&apos;s monthly allowance, capped at 5 audio separations during the trial. At the end
        of the trial, if you do not cancel, billing for the contracted plan starts automatically. We may
        limit trial eligibility to one per person/account.
      </p>
      <h3>3.4 Cancellation and right of withdrawal</h3>
      <p>
        You may cancel your subscription at any time from your account or through the contact channel in
        Section 18. Cancellation stops future renewal; access to paid features remains until the end of the
        period already paid for, without a pro-rata refund of the current period, except in the cases below.
      </p>
      <ul>
        <li>
          <strong>Right of withdrawal (art. 49 of the Código de Defesa do Consumidor):</strong> because the
          Service is contracted away from business premises (over the internet), you have up to 7 calendar
          days from the first paid subscription to withdraw and request a full refund, provided there has
          been no substantial and disproportionate use of the paid feature in that period.
        </li>
        <li>
          <strong>Incorrect charge or proven Service failure:</strong> refund as appropriate, assessed
          through the support channel.
        </li>
      </ul>

      <h2>4. Content produced by the platform</h2>
      <p>
        Part of the backing tracks available in the catalog is produced directly by backingtrack.store (our
        own recording) and made available with the corresponding chord chart. For that content we grant you
        a personal, non-exclusive, non-transferable and revocable licence to listen and practise within the
        Service, for as long as your subscription or the applicable free access lasts.
      </p>
      <p>
        This licence does not include the right to download, extract, redistribute, sublicense, make
        publicly available outside the platform or commercially exploit that content. Using the backing
        track as a bed for your band&apos;s rehearsal or live performance is permitted; responsibility for
        any public performance licences for the show itself rests with you or with the venue/event, as it
        already does for any band performing live, with or without the Service — see also Section 6.
      </p>

      <h2>5. Content you upload — upload and stem separation</h2>
      <h3>5.1 What you may upload</h3>
      <p>
        The Service lets you upload (&quot;Submit&quot;) an audio file that you own or for which you have
        sufficient authorisation, so that artificial intelligence tools (&quot;AI Tools&quot;) can separate
        that audio into per-instrument tracks and, where applicable, support the detection of chords, key
        and tempo. We call the content you upload &quot;User Content&quot;; we call the result generated by
        the AI Tools from it the &quot;Output&quot; (stems, detected chord chart and associated metadata).
      </p>
      <h3>5.2 You are responsible for the rights in what you upload</h3>
      <p>
        You should only upload User Content if you own the rights in it or have authorisation from whoever
        does — both in the sound recording (the specific recording) and, where applicable, in the musical
        composition (melody, harmony, lyrics) contained in it. By Submitting User Content, you represent and
        warrant that:
      </p>
      <ul>
        <li>you hold the necessary rights or sufficient authorisation for the upload and for the processing described in these Terms;</li>
        <li>uploading and using the User Content under these Terms does not infringe copyright, image or voice rights, or any other third-party right;</li>
        <li>if the content is a rendition of a third party&apos;s work (a cover), you are solely responsible for meeting the applicable obligations and licences relating to the underlying musical work.</li>
      </ul>
      <p>
        We do not review each upload in advance to verify ownership of rights — that verification is your
        responsibility, under the representation above. This does not prevent us from acting under the
        takedown policy in Section 7 if we receive a notice from a rights holder.
      </p>
      <h3>5.3 How we use what you upload</h3>
      <p>
        You retain ownership of the User Content you upload and, within the limits of applicable law, of the
        Output generated specifically for you. You grant us a worldwide, non-exclusive, royalty-free licence,
        limited to what is necessary to host, process and store your User Content and generate the
        corresponding Output, solely to provide the Service to you and, where applicable, to form part of the
        shared catalog described in Section 6.
      </p>

      <div className="legal-highlight">
        <p>
          <strong>Your content is not used to train AI models.</strong> We do not use User Content or the
          Output generated from it to train or fine-tune artificial intelligence or machine learning models,
          without your express and specific authorisation. This applies both to our own models and to
          third-party models we may use to provide the Service.
        </p>
      </div>

      <h3>5.4 Limits on what you can do with the Output</h3>
      <p>
        The Output may contain inaccuracies — treat it as a study reference, not a definitive transcription.
        You may not redistribute, sublicense or package the Output as a sample, sound effect, loop or content
        library for third parties, nor use it to train third-party artificial intelligence models, nor to
        compete with the Service.
      </p>
      <h3>5.5 The AI Tools can get it wrong</h3>
      <p>
        The AI Tools used to separate audio and detect chords, key or tempo are evolving technology and may
        produce inaccurate, incomplete or unexpected results — for example, one instrument bleeding into
        another track, or an incorrectly detected chord. You use the Output at your own risk, and the
        community may suggest chord corrections, which go through validation before entering the shared
        catalog.
      </p>

      <h2>6. Catalog shared between subscribers</h2>
      <p>
        To keep processing costs viable and avoid the same song being separated over and over, the stems and
        chord chart generated from an upload on a paid plan (Pro or Pro Band) become part of a shared catalog,
        accessible to other paying subscribers of the Service — equivalent to the backing track catalog in
        Section 4. This is different from your personal recording (your &quot;take&quot;, your own performance
        recorded inside the Service), which stays private by default and is only shared if you explicitly
        choose to share it (e.g. within a band).
      </p>
      <p>
        This clause is a condition for using the upload and separation feature on paid plans. If you would
        rather your upload were not incorporated into the shared catalog, you should not use that feature —
        get in touch through the channel in Section 18 to check available alternatives.
      </p>

      <div className="legal-highlight">
        <p>
          <strong>Highlighted clause — please read carefully (art. 54, §4 of the Código de Defesa do
          Consumidor).</strong> By subscribing to a paid plan and uploading audio for separation, you agree
          that the resulting stems and chord chart may enter a shared catalog accessible to other paying
          subscribers — it is not storage exclusively your own. If the holder of the copyright in the
          composition or in the sound recording notifies backingtrack.store requesting the removal of that
          song (Section 7), it will be blocked for all users who rely on it, including you, without this
          alone creating a right to a refund of the subscription — without prejudice to the other consumer
          rights set out in these Terms and in the law.
        </p>
      </div>

      <h2>7. Notice-and-takedown</h2>
      <p>
        We respect third-party copyright. Any rights holder (composer, publisher or owner of the sound
        recording) may notify backingtrack.store requesting the removal of a song from the shared catalog,
        stating: (i) the specific song; (ii) proof of ownership of the right (for example, registration with
        the Biblioteca Nacional or ECAD, a publishing contract or representation by a publisher); and
        (iii) the requester&apos;s contact details.
      </p>
      <h3>7.1 How we respond</h3>
      <ul>
        <li>We assess the notice and, where it is formally complete, respond within 48 business hours.</li>
        <li>The disputed track is blocked — it becomes inaccessible to all users, with a neutral message stating it was made unavailable at the request of the copyright holder. We do not delete the original file immediately; it is retained for a set period so that a counter-notice remains possible.</li>
        <li>The user who uploaded the blocked content may submit a counter-notice contesting the removal, through the channel in Section 18. Where there is sufficient basis, the track may be reinstated.</li>
        <li>Accounts that repeatedly infringe third-party copyright may be suspended or terminated at our discretion.</li>
      </ul>
      <p>
        This policy is based on the internet platform liability regime of the Marco Civil da Internet
        (Brazil&apos;s internet framework act), as interpreted by the Supreme Federal Court (Tema 987, RE
        1.037.396): broadly, we are liable for third-party content when, having been notified out of court by
        the rights holder, we fail to act. Unfounded or bad-faith notices may create liability for whoever
        sends them.
      </p>

      <h2>8. Rules of use</h2>
      <p>When using the Service, you agree not to:</p>
      <ul>
        <li>use the Service for any unlawful purpose or one that infringes third-party rights, including copyright, image or voice rights;</li>
        <li>use the Service, the Output or any content obtained from it to train or develop other artificial intelligence systems, or to create a competing service;</li>
        <li>get around your plan&apos;s usage limits, including by sharing access credentials with unauthorised people or automating uploads (scripts, bots);</li>
        <li>attempt to access restricted areas, circumvent security mechanisms, or reverse-engineer the Service&apos;s software;</li>
        <li>post comments or content that is defamatory, discriminatory, offensive or that harasses other users;</li>
        <li>resell, sublicense or make access to the Service available to third parties outside the band model included in your plan.</li>
      </ul>
      <p>
        We may remove content, suspend or terminate accounts that breach this Section, at our discretion and
        with notice where feasible, without prejudice to other appropriate measures.
      </p>

      <h2>9. backingtrack.store&apos;s intellectual property</h2>
      <p>
        The Service — including brand, logo, layout, software, catalog database, texts and other elements
        created by us (excluding User Content and the Output generated from it) — is owned by L2techs or its
        licensors and protected by intellectual property law. These Terms do not transfer to you any right in
        those elements beyond the limited licence described here.
      </p>
      <p>
        If you send us suggestions, criticism or ideas about the Service (&quot;Feedback&quot;), you grant us
        the right to use that Feedback freely to improve the Service, with no obligation of compensation or
        attribution.
      </p>

      <h2>10. Privacy and cookies</h2>
      <p>
        How we process your personal data is described in our{" "}
        <Link href="/privacidade">Privacy Policy</Link>, drawn up in line with the Lei Geral de Proteção de
        Dados (Law 13.709/2018 — Brazil&apos;s data protection act), and the use of cookies and similar
        technologies is described in the <Link href="/cookies">Cookie Policy</Link>. Both are incorporated
        into these Terms by reference and should be read together with them.
      </p>

      <h2>11. Important notices about the Service</h2>
      <h3>11.1 Artificial intelligence technology</h3>
      <p>
        The Service uses artificial intelligence and machine learning to separate audio and support the
        detection of chords, key and tempo. This technology is evolving and may produce inaccurate,
        incomplete or unexpected results, as described in Section 5.5. You acknowledge this limitation and
        accept the risks of using the generated Output.
      </p>
      <h3>11.2 Service availability</h3>
      <p>
        We make reasonable efforts to keep the Service available, but we do not guarantee uninterrupted or
        error-free operation. The Service is provided &quot;as is&quot; and may undergo maintenance,
        instability or temporary unavailability, without this alone amounting to breach of contract —
        subject to the consumer&apos;s right to redress in the event of repeated or serious failure in the
        provision of the paid service, under Brazilian consumer law.
      </p>
      <h3>11.3 Backing up your content</h3>
      <p>
        We recommend keeping your own copy of any User Content you upload and of the Output generated,
        especially if it matters to you. We may delete User Content and Output associated with accounts that
        have been inactive for an extended period, with prior notice where feasible.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by Brazilian law, we are not liable for indirect or incidental
        damages or lost profits arising from the use of, or inability to use, the Service. Nothing in this
        Section excludes or limits liability in situations where Brazilian law, in particular the Código de
        Defesa do Consumidor, does not permit limitation — such as damage arising from a defect in the
        provision of the service that causes loss to the consumer, or from wilful misconduct or gross
        negligence.
      </p>
      <p>
        We are not responsible for content uploaded by other users, nor for third-party claims relating to
        User Content submitted by you or by others — primary responsibility for ownership of uploaded content
        lies with whoever uploads it, under Section 5.2.
      </p>

      <h2>13. Indemnity</h2>
      <p>
        You agree to indemnify us for reasonable losses, damages and expenses (including legal fees) arising
        from a third-party claim relating to: (i) your breach of these Terms; (ii) User Content you upload
        without holding the necessary rights; or (iii) use of the Service contrary to Section 8 (Rules of
        use). This does not remove your rights as a consumer and does not apply to damage caused by our own
        failure in providing the Service.
      </p>

      <h2>14. Changes to these Terms and to the Service</h2>
      <p>
        We may change these Terms from time to time, including to reflect new features, legal changes or plan
        adjustments. Material changes will be communicated at least 15 days in advance, by notice on the site
        or by email. Continued use of the Service after the effective date represents agreement with the new
        Terms; if you do not agree, you may cancel your account before that date.
      </p>
      <p>
        We may also modify, limit or discontinue Service features at any time, subject, where applicable, to
        the consumer&apos;s right to cancel the paid plan without penalty where a feature essential to what
        was contracted is discontinued.
      </p>

      <h2>15. Term, suspension and termination</h2>
      <p>
        These Terms apply from the creation of your account or first use of the Service until the account is
        closed, by you or by us.
      </p>
      <ul>
        <li><strong>By you:</strong> you may close your account at any time from your account settings or through the channel in Section 18.</li>
        <li><strong>By us:</strong> we may suspend or close your account in the event of a material breach of these Terms, non-payment not resolved after notice, or fraudulent use of the Service, with prior notice wherever possible.</li>
      </ul>
      <p>
        Once the account is closed, your right of access to the Service ends and we may delete your User
        Content and associated data, subject to the retention periods required by the Lei Geral de Proteção de
        Dados and by legal obligations (e.g. tax records). Sections that by their nature should survive
        termination — such as Intellectual Property, Indemnity, Limitation of Liability and Governing Law —
        continue to apply.
      </p>

      <h2>16. Governing law and dispute resolution</h2>
      <p>These Terms are governed by the laws of the Federative Republic of Brazil.</p>
      <p>
        If you have any question, complaint or problem with the Service, please talk to our support channel
        first (Section 18) — most issues can be resolved directly, faster than through formal routes.
      </p>
      <p>
        The courts of Belo Horizonte - MG, Brazil, where L2techs is based, are chosen to settle any disputes
        arising from these Terms, without prejudice to the consumer&apos;s right to choose the courts of
        their own domicile under art. 101, I of the Código de Defesa do Consumidor. We do not require
        arbitration as a precondition to a consumer bringing court proceedings; where there is mutual
        interest in other dispute resolution methods (mediation, arbitration), they may be agreed later,
        voluntarily, once the dispute has arisen.
      </p>

      <h2>17. General provisions</h2>
      <ul>
        <li><strong>Entire agreement:</strong> these Terms, together with the Privacy Policy and the Cookie Policy, form the entire agreement between you and backingtrack.store regarding use of the Service.</li>
        <li><strong>Assignment:</strong> you may not assign your rights and obligations under these Terms without our prior consent. We may assign these Terms, in whole or in part, to an affiliate or successor, with notice.</li>
        <li><strong>Waiver and severability:</strong> delay or omission in enforcing any provision does not amount to waiver of that right. If any clause is held invalid, the remainder stays in force.</li>
        <li><strong>Electronic communications:</strong> you agree to receive communications from us by email or through notices inside the Service, which count as written communication for the purposes of these Terms.</li>
        <li><strong>International use:</strong> the Service is operated from Brazil and designed primarily for the Brazilian market. We do not warrant that its content or operation is suitable for, or compliant with the local law of, other jurisdictions. If you use the Service from outside Brazil, you do so on your own initiative and are responsible for complying with applicable local law.</li>
      </ul>

      <h2>18. Contact us</h2>
      <p>
        Questions about these Terms, copyright requests (Section 7), exercise of data subject rights or any
        other matter about the Service can be sent through our{" "}
        <Link href="/contato">contact form</Link> or by email to{" "}
        <a href="mailto:contato@l2techs.com">contato@l2techs.com</a>.
      </p>
    </>
  );
}
