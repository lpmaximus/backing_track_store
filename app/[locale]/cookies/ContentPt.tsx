/** Política de Cookies — versão em português (a que prevalece; ver ContentEn.tsx). */
export default function CookiesContentPt() {
  return (
    <>
      <p>
        Olá, e bem-vindo à Política de Cookies do backingtrack.store (&quot;Política&quot;). O objetivo desta
        Política é explicar, de forma clara e acessível, quais cookies usamos, para que servem e quais
        escolhas você tem sobre eles.
      </p>
      <p>
        Esta Política complementa nossos <a href="/termos">Termos de Uso</a> e nossa{" "}
        <a href="/privacidade">Política de Privacidade</a>, e deve ser lida em conjunto com eles.
      </p>

      <h2>1. O que são cookies e tecnologias semelhantes?</h2>
      <p>
        Cookies são pequenos arquivos de texto baixados no seu dispositivo quando você visita um site.
        Eles permitem que o site reconheça o seu navegador entre uma visita e outra. Você encontra mais
        informações gerais sobre cookies em{" "}
        <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer">
          www.allaboutcookies.org
        </a>
        .
      </p>
      <p>
        O termo &quot;cookie&quot; é usado nesta Política de forma ampla, para abranger também tecnologias
        semelhantes, como armazenamento local do navegador (<code>localStorage</code>/<code>sessionStorage</code>)
        usado para lembrar preferências de reprodução.
      </p>
      <p>Os cookies se diferenciam por duração e origem:</p>
      <ul>
        <li><strong>Cookies de sessão</strong>: expiram quando você fecha o navegador.</li>
        <li><strong>Cookies persistentes</strong>: permanecem no dispositivo por um período definido, ou até serem excluídos.</li>
        <li><strong>Cookies próprios</strong>: definidos pelo próprio backingtrack.store.</li>
        <li><strong>Cookies de terceiros</strong>: definidos por um parceiro (por exemplo, um processador de pagamento ou uma ferramenta de análise), quando aplicável.</li>
      </ul>
      <p>E por finalidade:</p>
      <table>
        <thead><tr><th>Tipo</th><th>Finalidade</th></tr></thead>
        <tbody>
          <tr><td>Estritamente necessários</td><td>Essenciais para o funcionamento do site — por exemplo, manter você autenticado e proteger o formulário de login contra fraude. Sem eles, não é possível acessar sua conta ou usar as áreas restritas do serviço.</td></tr>
          <tr><td>De funcionalidade</td><td>Lembram escolhas e preferências, como o volume, os canais (stems) ativos ou mutados no player, e a última banda ou setlist visualizada, para tornar sua experiência mais conveniente.</td></tr>
          <tr><td>De desempenho/análise</td><td>Ajudam a entender como o site é usado (páginas mais acessadas, erros, tempo de carregamento), de forma agregada, para melhorarmos o produto.</td></tr>
          <tr><td>De publicidade/terceiros</td><td>Usados por parceiros para medir ou direcionar anúncios.</td></tr>
        </tbody>
      </table>

      <h2>2. Como o backingtrack.store usa cookies hoje</h2>
      <p>
        Atualmente o backingtrack.store é operado com Next.js e autenticação via NextAuth (Auth.js), e
        usa os seguintes cookies:
      </p>
      <table>
        <thead><tr><th>Cookie</th><th>Tipo</th><th>Finalidade</th><th>Duração</th></tr></thead>
        <tbody>
          <tr>
            <td><code>authjs.session-token</code> (ou equivalente)</td>
            <td>Estritamente necessário</td>
            <td>Mantém sua sessão autenticada, para que você não precise fazer login a cada página.</td>
            <td>Sessão / conforme validade do login</td>
          </tr>
          <tr>
            <td><code>authjs.csrf-token</code></td>
            <td>Estritamente necessário</td>
            <td>Protege formulários (login, cadastro) contra ataques de falsificação de solicitação entre sites (CSRF).</td>
            <td>Sessão</td>
          </tr>
          <tr>
            <td><code>NEXT_LOCALE</code></td>
            <td>Funcionalidade</td>
            <td>Guarda o idioma de interface que você escolheu, para o site não voltar a detectá-lo pelo país a cada visita.</td>
            <td>1 ano</td>
          </tr>
          <tr>
            <td>Preferências locais de player (armazenamento local do navegador)</td>
            <td>Funcionalidade</td>
            <td>Lembra volume, stems ativos/mutados e configurações de reprodução entre visitas.</td>
            <td>Persistente, até ser limpo pelo usuário</td>
          </tr>
        </tbody>
      </table>
      <p>
        Não utilizamos, no momento, cookies de análise (analytics) ou de publicidade de terceiros.
        Conforme o backingtrack.store evoluir — por exemplo, ao integrar um processador de pagamento
        para assinaturas dos planos Pro e Banda, ou uma ferramenta de análise de uso — esta seção e a
        tabela de parceiros (Seção 5) serão atualizadas antes da entrada em operação desses serviços, e
        o consentimento será solicitado quando exigido por lei.
      </p>

      <h2>3. Base legal (LGPD)</h2>
      <p>
        O tratamento de dados por meio de cookies no backingtrack.store segue a Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018 — LGPD). Cookies estritamente necessários são tratados com base na
        execução do contrato de uso do serviço e em nosso legítimo interesse em manter o site seguro e
        funcional, dispensando consentimento prévio (art. 7º, V e IX da LGPD). Cookies de
        funcionalidade, análise ou publicidade — quando implementados — serão tratados mediante
        consentimento, coletado através de um aviso de cookies no site, salvo quando outra base legal
        for aplicável e informada nesta Política.
      </p>

      <h2>4. Como gerenciar suas preferências de cookies</h2>
      <p>
        <strong>Configurações do navegador</strong>: você pode aceitar, recusar ou excluir cookies a
        qualquer momento pelas configurações do seu navegador (geralmente em &quot;Ajuda&quot;, &quot;Ferramentas&quot; ou
        &quot;Privacidade&quot;). Note que bloquear cookies estritamente necessários impede o login e o uso das
        áreas restritas do backingtrack.store.
      </p>
      <p>
        <strong>Armazenamento local</strong>: preferências de player salvas localmente podem ser
        apagadas limpando os dados de navegação do site nas configurações do seu navegador.
      </p>
      <p>
        Mais informações em{" "}
        <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer">
          www.allaboutcookies.org
        </a>
        .
      </p>

      <h2>5. Parceiros</h2>
      <p>
        No momento, o backingtrack.store não utiliza cookies de terceiros. Esta seção será atualizada
        com o nome de cada parceiro (por exemplo, processador de pagamento ou ferramenta de análise)
        assim que qualquer integração desse tipo entrar em operação.
      </p>

      <h2>6. Atualizações desta Política</h2>
      <p>
        Podemos alterar esta Política periodicamente, especialmente ao adicionar novas funcionalidades
        ou parceiros que utilizem cookies. Mudanças relevantes serão comunicadas por aviso no site ou
        por e-mail, com antecedência quando possível.
      </p>

      <h2>7. Como falar conosco</h2>
      <p>
        Dúvidas sobre esta Política de Cookies ou sobre o tratamento dos seus dados podem ser enviadas
        pelo nosso <a href="/contato">formulário de contato</a> ou pelo e-mail{" "}
        <a href="mailto:contato@l2techs.com">contato@l2techs.com</a>.
      </p>
    </>
  );
}
