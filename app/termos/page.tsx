import LegalDocumentLayout, { LegalCrossLinks } from '@/components/LegalDocumentLayout';
import { TERMS_VERSION } from '@/lib/legal';

export const metadata = {
  title: 'Termos de Uso | MedSupAPP',
};

export default function TermosPage() {
  return (
    <LegalDocumentLayout title="Termos de Uso" version={TERMS_VERSION}>
      <p>
        Ao utilizar o MedSupAPP você concorda com estes termos. Se não concordar, não utilize o
        serviço.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Serviço</h2>
      <p>
        Software de agenda, clientes, financeiro, formulários e integrações Google/WhatsApp
        para consultórios e clínicas. O serviço é fornecido “como está”, com evolução contínua.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Conta e trial</h2>
      <p>
        Acesso via Google OAuth. Um período de teste pode ser oferecido por conta Google,
        conforme regras exibidas no produto. Planos pagos serão cobrados conforme página de
        planos vigente.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Responsabilidades do usuário</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Manter credenciais Google seguras e revogar acessos quando necessário.</li>
        <li>
          Cumprir LGPD, regulamentação profissional (incl. CFM) e obter bases legais/consentimentos
          para dados de pacientes.
        </li>
        <li>Não usar o sistema para fins ilícitos ou armazenar conteúdo proibido no Drive.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Dados e propriedade</h2>
      <p>
        Os dados clínicos e arquivos no Google Drive permanecem sob controle do usuário. O
        MedSupAPP não reivindica propriedade sobre prontuários ou documentos médicos do
        profissional.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Limitação de responsabilidade</h2>
      <p>
        Não nos responsabilizamos por indisponibilidade de terceiros (Google, Meta, etc.),
        perdas indiretas ou decisões clínicas tomadas com base em informações do sistema. O
        profissional é responsável pela prática médica e guarda de prontuário.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Rescisão</h2>
      <p>
        Você pode deixar de usar o serviço a qualquer momento. Podemos suspender contas em caso
        de violação destes termos ou risco à segurança.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Lei aplicável</h2>
      <p>Leis da República Federativa do Brasil, foro da comarca do domicílio do usuário contratante quando aplicável.</p>

      <LegalCrossLinks />
    </LegalDocumentLayout>
  );
}
