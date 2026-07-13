import LegalDocumentLayout, { LegalCrossLinks } from '@/components/LegalDocumentLayout';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_PRODUCT_NAME,
  LEGAL_CONTACT,
  PRIVACY_CONTACT,
  PRIVACY_POLICY_VERSION,
  SUPPORT_EMAIL,
} from '@/lib/legal';
import { PRODUCT_NAME } from '@/lib/visual/brand';

export const metadata = {
  title: { absolute: 'Turquesa Agenda' },
};

export default function PrivacidadePage() {
  return (
    <LegalDocumentLayout title="Política de Privacidade" version={PRIVACY_POLICY_VERSION}>
      <p>
        O {COMPANY_PRODUCT_NAME} (&quot;{COMPANY_LEGAL_NAME}&quot;, &quot;nós&quot;) oferece
        software de gestão para salões e estúdios de beleza. Esta política descreve como tratamos
        dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº
        13.709/2018) e orientações da Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Papéis na LGPD</h2>
      <p>
        <strong>Controlador dos dados de clientes:</strong> o profissional ou salão contratante,
        que define finalidades e meios do tratamento relativo aos seus clientes.
      </p>
      <p>
        <strong>Operador:</strong> o {PRODUCT_NAME}, que processa dados em nome do Controlador para
        prestar o serviço contratado (agenda, formulários, comunicação, etc.).
      </p>
      <p>
        <strong>Controlador dos dados da conta do profissional:</strong> o {COMPANY_LEGAL_NAME},
        quanto a cadastro, cobrança, suporte e operação do SaaS.
      </p>
      <p>
        Clientes finais devem exercer direitos junto ao salão ou profissional. Auxiliamos o
        Controlador quando aplicável ({PRIVACY_CONTACT}).
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">2. O que não fazemos</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Não armazenamos fichas completas de clientes em nossa nuvem de forma permanente.</li>
        <li>
          Arquivos de clientes ficam no <strong>Google Drive da sua conta</strong> (escopo{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">drive.file</code> — apenas arquivos
          criados ou abertos pelo app).
        </li>
        <li>Não vendemos nem compartilhamos dados para marketing de terceiros.</li>
        <li>
          Não utilizamos API oficial do WhatsApp/Meta para envio automático de mensagens; a
          comunicação é via <strong>links wa.me</strong> abertos pelo profissional no próprio
          aparelho.
        </li>
        <li>Não utilizamos cookies de publicidade ou remarketing no site do produto.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Dados que tratamos</h2>
      <h3 className="text-lg font-semibold text-gray-900 mt-4">3.1 Conta do profissional</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>E-mail Google, identificador Google (sub), nome;</li>
        <li>Profissão, CNPJ (opcional), WhatsApp, endereço comercial;</li>
        <li>Dados de onboarding, plano, assinatura e pagamento (via Asaas);</li>
        <li>Registro de consentimento (versão dos termos, data/hora).</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">
        3.2 Dados operacionais (Supabase)
      </h3>
      <p className="mb-2">
        Para operar o serviço, mantemos <strong>metadados mínimos</strong> em nossa base — não o
        prontuário/ficha completa do cliente:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Agenda:</strong> nome do cliente, telefone, serviço, status, horários, vínculo
          com profissional;
        </li>
        <li>
          <strong>Agendamento online:</strong> índice telefone → cliente para identificação no
          link público;
        </li>
        <li>Links de formulário, tokens públicos, configurações de mensagens;</li>
        <li>
          <strong>Financeiro:</strong> transações (descrição, valor, data, profissional, itens de
          catálogo quando informados);
        </li>
        <li>Códigos de verificação de e-mail e registros de rate limit;</li>
        <li>Perfil de onboarding e dados de assinatura.</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">3.3 Formulários públicos</h3>
      <p>
        Dados enviados pelo cliente ficam temporariamente em nossa infraestrutura até
        sincronização para o Google Drive do profissional, quando são{' '}
        <strong>removidos da nossa base</strong> operacional.
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">3.4 Google (Drive, Calendar, Contatos)</h3>
      <p>
        Com autorização explícita, acessamos recursos Google conforme escopos concedidos. Fichas e
        documentos de clientes permanecem no Drive do Usuário.
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">3.5 Cache no seu dispositivo</h3>
      <p>
        Para desempenho, alguns dados operacionais podem ficar em{' '}
        <code className="text-sm bg-gray-100 px-1 rounded">localStorage</code> do navegador (ex.:
        cache de agenda ou financeiro). Não são usados para publicidade. Proteja o dispositivo e
        encerre a sessão em computadores compartilhados.
      </p>

      <h2 id="google" className="text-xl font-semibold text-gray-900 mt-8 scroll-mt-24">
        4. Uso de dados do Google
      </h2>
      <p>
        Utilizamos APIs do Google somente quando você autoriza explicitamente. O uso obedece à{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="text-[#047482] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Política de Dados do Usuário dos Serviços de API do Google
        </a>{' '}
        (Uso Limitado): sem venda, sem publicidade, apenas para funcionalidades solicitadas.
      </p>
      <ul className="list-disc pl-6 space-y-2 mt-3">
        <li>
          <strong>Login:</strong> autenticar conta e exibir nome/foto no painel;
        </li>
        <li>
          <strong>Calendar:</strong> criar e sincronizar sessões agendadas;
        </li>
        <li>
          <strong>Drive (drive.file):</strong> armazenar fichas de clientes em arquivos do app;
        </li>
        <li>
          <strong>Contatos (readonly):</strong> importar contatos que você escolher para
          cadastro.
        </li>
      </ul>
      <p className="mt-3">
        Tokens de acesso ficam em cookies httpOnly no servidor e não são expostos ao JavaScript
        da página.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Bases legais</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Execução de contrato</strong> — prestação do SaaS, conta e cobrança;
        </li>
        <li>
          <strong>Legítimo interesse</strong> — segurança, prevenção a fraudes, logs técnicos;
        </li>
        <li>
          <strong>Consentimento</strong> — quando exigido (formulário do cliente, aceite de
          termos);
        </li>
        <li>
          <strong>Obrigação legal</strong> — ordens judiciais ou regulatórias.
        </li>
      </ul>
      <p className="mt-2">
        Dados sensíveis de saúde ou imagem inseridos em anamnese são responsabilidade do
        Controlador (salão), que deve possuir base legal adequada.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Suboperadores</h2>
      <p>Prestadores que auxiliam na operação:</p>
      <ul className="list-disc pl-6 space-y-2 mt-2">
        <li>
          <strong>Google</strong> — OAuth, Drive, Calendar, Contatos;
        </li>
        <li>
          <strong>Supabase</strong> — banco de dados operacional;
        </li>
        <li>
          <strong>Vercel</strong> — hospedagem;
        </li>
        <li>
          <strong>Resend</strong> — e-mails transacionais (OTP);
        </li>
        <li>
          <strong>Asaas</strong> — cobrança e assinaturas.
        </li>
      </ul>
      <p className="mt-2">
        Transferências internacionais podem ocorrer com mecanismos previstos em lei. Não
        compartilhamos dados de clientes com Meta/WhatsApp Business API.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Retenção e segurança</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Conta ativa: enquanto durar a relação contratual e obrigações legais;</li>
        <li>Formulários: até sincronização ao Drive;</li>
        <li>OTP e rate limits: prazo curto;</li>
        <li>Registros de consentimento: enquanto exigido para comprovação;</li>
        <li>Após encerramento: exclusão ou anonimização quando não houver obrigação de guarda.</li>
      </ul>
      <p className="mt-3">
        Medidas técnicas: autenticação Google, verificação de e-mail, isolamento por conta nas
        APIs, Row Level Security no Supabase, service role apenas no servidor, PIN opcional no
        financeiro (modo salão).
      </p>
      <p className="mt-2">
        Nenhum sistema é 100% seguro. Em incidente relevante, notificaremos o Controlador e,
        quando aplicável, a ANPD e titulares conforme a lei.
      </p>

      <h2 id="cookies" className="text-xl font-semibold text-gray-900 mt-8 scroll-mt-24">
        8. Cookies e tecnologias similares
      </h2>
      <p>
        Utilizamos cookies essenciais e armazenamento local para operar o serviço. Detalhes
        técnicos: documentação interna de cookies (versão alinhada a esta política).
      </p>
      <h3 className="text-lg font-semibold text-gray-900 mt-6">8.1 Cookies essenciais</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Sessão (NextAuth):</strong> login seguro;
        </li>
        <li>
          <strong>Integração Google:</strong> tokens httpOnly para Calendar, Drive e Contatos
          autorizados.
        </li>
      </ul>
      <h3 className="text-lg font-semibold text-gray-900 mt-6">8.2 Armazenamento local</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>Preferência do aviso de cookies;</li>
        <li>Cache operacional de agenda e financeiro (sem publicidade).</li>
      </ul>
      <h3 className="text-lg font-semibold text-gray-900 mt-6">8.3 Cookies de marketing (com consentimento)</h3>
      <p>
        Com seu aceite no banner de cookies, utilizamos o <strong>Meta Pixel</strong> (Meta
        Platforms) para medir visitas e conversões de campanhas publicitárias (ex.: anúncios no
        Facebook e Instagram). Base legal: consentimento (art. 7º, I, LGPD). Você pode revogar
        limpando cookies do site ou contatando {PRIVACY_CONTACT}.
      </p>
      <h3 className="text-lg font-semibold text-gray-900 mt-6">8.4 O que não utilizamos</h3>
      <p>
        Google Analytics, Hotjar ou outras ferramentas de analytics além do Meta Pixel descrito
        acima. Mudanças futuras exigirão consentimento prévio e atualização desta política.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">
        9. Direitos do titular (art. 18 LGPD)
      </h2>
      <p>Você pode solicitar a {PRIVACY_CONTACT}:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Confirmação e acesso;</li>
        <li>Correção;</li>
        <li>Anonimização, bloqueio ou eliminação;</li>
        <li>Portabilidade, quando aplicável;</li>
        <li>Informação sobre compartilhamento;</li>
        <li>Revogação do consentimento;</li>
        <li>Oposição a tratamento por legítimo interesse, quando cabível.</li>
      </ul>
      <p className="mt-2">
        Prazo de resposta: em geral até <strong>15 dias</strong>, prorrogável conforme a lei.
        Profissionais podem exportar dados em <strong>Backup LGPD</strong> no painel. Clientes
        finais: contatar o salão controlador.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">10. Canal de privacidade</h2>
      <p>
        Privacidade: <strong>{PRIVACY_CONTACT}</strong> · Suporte: {SUPPORT_EMAIL} · Geral:{' '}
        {LEGAL_CONTACT}
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">11. Menores</h2>
      <p>
        O serviço destina-se a profissionais e salões. Dados de menores inseridos como clientes
        são responsabilidade do Controlador, que deve observar a LGPD e o ECA.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">12. Alterações</h2>
      <p>
        Publicaremos nova versão nesta página. Mudanças materiais podem exigir novo aceite no
        login. Versão vigente no topo do documento.
      </p>

      <LegalCrossLinks />
    </LegalDocumentLayout>
  );
}
