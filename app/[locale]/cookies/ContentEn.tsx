import { Link } from "@/src/i18n/navigation";

/**
 * Cookie Policy — English rendering.
 * Faithful translation of ContentPt.tsx, which remains the governing version.
 */
export default function CookiesContentEn() {
  return (
    <>
      <div className="legal-highlight">
        <p>
          <strong>Language and governing version.</strong> This English text is provided for your
          convenience. The Portuguese version of this Policy is the governing one: if there is any conflict
          or ambiguity between the two, the Portuguese text prevails.
        </p>
      </div>

      <p>
        Hello, and welcome to the backingtrack.store Cookie Policy (&quot;Policy&quot;). The purpose of this
        Policy is to explain clearly and accessibly which cookies we use, what they are for and what choices
        you have about them.
      </p>
      <p>
        This Policy complements our <Link href="/termos">Terms of Use</Link> and our{" "}
        <Link href="/privacidade">Privacy Policy</Link>, and should be read together with them.
      </p>

      <h2>1. What are cookies and similar technologies?</h2>
      <p>
        Cookies are small text files downloaded to your device when you visit a site. They let the site
        recognise your browser between visits. You can find more general information about cookies at{" "}
        <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer">
          www.allaboutcookies.org
        </a>
        .
      </p>
      <p>
        The term &quot;cookie&quot; is used broadly in this Policy, to cover similar technologies as well,
        such as browser local storage (<code>localStorage</code>/<code>sessionStorage</code>) used to
        remember playback preferences.
      </p>
      <p>Cookies differ by duration and origin:</p>
      <ul>
        <li><strong>Session cookies</strong>: expire when you close the browser.</li>
        <li><strong>Persistent cookies</strong>: stay on the device for a set period, or until deleted.</li>
        <li><strong>First-party cookies</strong>: set by backingtrack.store itself.</li>
        <li><strong>Third-party cookies</strong>: set by a partner (for example, a payment processor or an analytics tool), where applicable.</li>
      </ul>
      <p>And by purpose:</p>
      <table>
        <thead><tr><th>Type</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>Strictly necessary</td><td>Essential for the site to work — for example, keeping you signed in and protecting the login form against fraud. Without them you cannot access your account or use restricted areas of the service.</td></tr>
          <tr><td>Functionality</td><td>Remember choices and preferences, such as volume, which channels (stems) are active or muted in the player, and the last band or setlist viewed, to make your experience more convenient.</td></tr>
          <tr><td>Performance/analytics</td><td>Help us understand how the site is used (most visited pages, errors, load times), in aggregate, so we can improve the product.</td></tr>
          <tr><td>Advertising/third party</td><td>Used by partners to measure or target ads.</td></tr>
        </tbody>
      </table>

      <h2>2. How backingtrack.store uses cookies today</h2>
      <p>
        backingtrack.store currently runs on Next.js with authentication via NextAuth (Auth.js), and uses the
        following cookies:
      </p>
      <table>
        <thead><tr><th>Cookie</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead>
        <tbody>
          <tr>
            <td><code>authjs.session-token</code> (or equivalent)</td>
            <td>Strictly necessary</td>
            <td>Keeps your session authenticated, so you don&apos;t have to sign in on every page.</td>
            <td>Session / for the lifetime of the login</td>
          </tr>
          <tr>
            <td><code>authjs.csrf-token</code></td>
            <td>Strictly necessary</td>
            <td>Protects forms (sign-in, sign-up) against cross-site request forgery (CSRF) attacks.</td>
            <td>Session</td>
          </tr>
          <tr>
            <td><code>NEXT_LOCALE</code></td>
            <td>Functionality</td>
            <td>Remembers the interface language you chose, so the site does not fall back to detecting it from your country on every visit.</td>
            <td>1 year</td>
          </tr>
          <tr>
            <td>Local player preferences (browser local storage)</td>
            <td>Functionality</td>
            <td>Remembers volume, active/muted stems and playback settings between visits.</td>
            <td>Persistent, until cleared by the user</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not currently use analytics or third-party advertising cookies. As backingtrack.store evolves —
        for example, when integrating a payment processor for Pro and Band subscriptions, or a usage
        analytics tool — this section and the partner table (Section 5) will be updated before those services
        go live, and consent will be requested where required by law.
      </p>

      <h2>3. Legal basis (LGPD)</h2>
      <p>
        Data processing through cookies on backingtrack.store follows the Lei Geral de Proteção de Dados (Law
        13.709/2018 — LGPD). Strictly necessary cookies are processed on the basis of performing the service
        contract and our legitimate interest in keeping the site secure and functional, without requiring
        prior consent (art. 7, V and IX of the LGPD). Functionality, analytics or advertising cookies — when
        implemented — will be processed on the basis of consent, collected through a cookie notice on the
        site, unless another legal basis applies and is stated in this Policy.
      </p>

      <h2>4. How to manage your cookie preferences</h2>
      <p>
        <strong>Browser settings</strong>: you can accept, refuse or delete cookies at any time through your
        browser settings (usually under &quot;Help&quot;, &quot;Tools&quot; or &quot;Privacy&quot;). Note that
        blocking strictly necessary cookies prevents sign-in and use of the restricted areas of
        backingtrack.store.
      </p>
      <p>
        <strong>Local storage</strong>: player preferences saved locally can be removed by clearing the
        site&apos;s browsing data in your browser settings.
      </p>
      <p>
        More information at{" "}
        <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer">
          www.allaboutcookies.org
        </a>
        .
      </p>

      <h2>5. Partners</h2>
      <p>
        At present backingtrack.store does not use third-party cookies. This section will be updated with the
        name of each partner (for example, a payment processor or analytics tool) as soon as any such
        integration goes live.
      </p>

      <h2>6. Updates to this Policy</h2>
      <p>
        We may change this Policy from time to time, particularly when adding new features or partners that
        use cookies. Material changes will be communicated by a notice on the site or by email, in advance
        where possible.
      </p>

      <h2>7. How to contact us</h2>
      <p>
        Questions about this Cookie Policy or about how we process your data can be sent through our{" "}
        <Link href="/contato">contact form</Link> or by email to{" "}
        <a href="mailto:contato@l2techs.com">contato@l2techs.com</a>.
      </p>
    </>
  );
}
