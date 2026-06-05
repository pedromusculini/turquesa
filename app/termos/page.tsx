import LegalDocumentLayout, { LegalCrossLinks } from '@/components/LegalDocumentLayout';
import { TERMS_VERSION } from '@/lib/legal';
import { PRODUCT_NAME } from '@/lib/visual/brand';

export const metadata = {
  title: 'Termos de Uso | Turquesa Agenda',
};

export default function TermosPage() {
  return (
    <LegalDocumentLayout title="Termos de Uso" version={TERMS_VERSION}>
      <p>
        Ao utilizar o {PRODUCT_NAME} você concorda com estes termos. Se não concordar, não utilize o
        serviço.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Serviço</h2>
      <p>
        Software de agenda, clientes, financeiro, formulários e integrações Google/WhatsApp
        para salões e estúdios de beleza. O serviço é fornecido “como está”, com evolução contínua.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Conta, trial e preço</h2>
      <p>
        Acesso via Google OAuth. Um período de teste de 30 dias pode ser oferecido por conta
        Google, conforme regras exibidas no produto.
      </p>
      <h3 className="text-lg font-semibold text-gray-900 mt-6">2.1 Contrato de 12 meses sem reajuste</h3>
      <p>
        Ao contratar o plano pago, o valor mensal vigente no momento do seu cadastro fica{' '}
        <strong>garantido por 12 (doze) meses</strong> a partir da data de cadastro na plataforma,
        independentemente de alterações posteriores no preço de tabela exibido no site para novos
        clientes.
      </p>
      <ul className="list-disc pl-6 space-y-2 mt-3">
        <li>
          <strong>Novos cadastros</strong> passam a pagar o preço de tabela vigente na data do
          cadastro, também com garantia de 12 meses sem aumento.
        </li>
        <li>
          <strong>Assinantes atuais</strong> mantêm o valor contratado até o fim do período de
          garantia; após 12 meses, renovações podem ser cobradas pelo preço de tabela então
          vigente, com nova garantia de 12 meses a partir da renovação.
        </li>
        <li>
          Reduções de preço de tabela não alteram retroativamente contratos em vigor até o fim do
          período garantido.
        </li>
      </ul>
      <p className="mt-3">
        O preço exibido na landing e na página de planos refere-se ao valor de tabela para novos
        cadastros. Sua fatura no Asaas reflete o valor efetivo do seu contrato.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Responsabilidades do usuário</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Manter credenciais Google seguras e revogar acessos quando necessário.</li>
        <li>
          Cumprir a LGPD e obter bases legais/consentimentos para dados de clientes.
        </li>
        <li>Não usar o sistema para fins ilícitos ou armazenar conteúdo proibido no Drive.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Dados e propriedade</h2>
      <p>
        Os arquivos no Google Drive permanecem sob controle do usuário. O {PRODUCT_NAME} não
        reivindica propriedade sobre fichas ou documentos dos seus clientes.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Limitação de responsabilidade</h2>
      <p>
        Não nos responsabilizamos por indisponibilidade de terceiros (Google, Meta, etc.) ou
        perdas indiretas. O profissional ou salão é responsável pelos serviços prestados e pela
        guarda dos registros que mantém no Drive.
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
