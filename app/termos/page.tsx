import LegalDocumentLayout, { LegalCrossLinks } from '@/components/LegalDocumentLayout';
import {
  COMPANY_LEGAL_NAME,
  COMPANY_PRODUCT_NAME,
  LEGAL_CONTACT,
  LEGAL_FORUM,
  PRIVACY_CONTACT,
  SUPPORT_EMAIL,
  TERMS_VERSION,
} from '@/lib/legal';
import { PRODUCT_NAME } from '@/lib/visual/brand';

export const metadata = {
  title: 'Termos de Uso | Turquesa Agenda',
};

export default function TermosPage() {
  return (
    <LegalDocumentLayout title="Termos de Uso" version={TERMS_VERSION}>
      <p>
        Estes Termos regulam o uso do {COMPANY_PRODUCT_NAME} (&quot;{PRODUCT_NAME}&quot;,
        &quot;Plataforma&quot;), software de gestão para salões e estúdios de beleza oferecido
        por {COMPANY_LEGAL_NAME}. Ao criar conta ou utilizar o serviço, você declara ter lido e
        aceito estes Termos e a{' '}
        <a href="/privacidade" className="text-[#047482] hover:underline">
          Política de Privacidade
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Serviço</h2>
      <p>
        Ferramenta de <strong>apoio administrativo</strong>: agenda, clientes, catálogo,
        financeiro, formulários, integrações Google e links WhatsApp (wa.me).{' '}
        <strong>Não substitui</strong> obrigações fiscais, trabalhistas ou regulatórias do seu
        negócio. Fornecido &quot;como está&quot;, com evolução contínua.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Conta, trial e preço</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Acesso via Google OAuth e verificação de e-mail;</li>
        <li>Trial de 30 dias pode ser oferecido por conta Google;</li>
        <li>
          Plano pago: valor mensal garantido por <strong>12 meses</strong> a partir do cadastro,
          conforme regras exibidas no produto e fatura Asaas.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Papéis na LGPD</h2>
      <p>
        Para dados de <strong>clientes</strong>, o Usuário (salão/profissional) é{' '}
        <strong>Controlador</strong> e o {PRODUCT_NAME} é <strong>Operador</strong>. O Usuário
        declara possuir base legal para tratar dados de clientes, informar quando necessário e
        cumprir a LGPD.
      </p>
      <p>
        Fichas e arquivos de clientes ficam no <strong>Google Drive do Usuário</strong>. Metadados
        operacionais seguem a Política de Privacidade.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Responsabilidades do usuário</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Manter credenciais Google seguras e revogar acessos indevidos;</li>
        <li>Backups periódicos (funcionalidade Backup LGPD é auxiliar);</li>
        <li>Não usar o sistema para fins ilícitos ou conteúdo proibido;</li>
        <li>Configurar PIN do financeiro em modo salão quando compartilhar dispositivos;</li>
        <li>
          Comunicação WhatsApp: envio manual pelo profissional; cumprimento das políticas da Meta
          é de responsabilidade do Usuário.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Integrações</h2>
      <p>
        Calendar, Drive, Contatos, Asaas e wa.me dependem de terceiros. Não garantimos
        disponibilidade contínua. O Usuário aceita os termos dos respectivos provedores.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Propriedade</h2>
      <p>
        A Plataforma, marca e código são do {COMPANY_LEGAL_NAME}. Licença limitada, revogável,
        intransferível. Dados e arquivos do Usuário e de seus clientes permanecem sob controle do
        Usuário no Google Drive.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida pela lei, não nos responsabilizamos por: indisponibilidade
        de terceiros; perda de dados no Drive ou dispositivos do Usuário; lucros cessantes ou
        danos indiretos; reclamações de clientes contra o Usuário; serviços de beleza prestados
        pelo salão.
      </p>
      <p>
        Quando a responsabilidade não puder ser excluída, fica limitada ao valor total pago nos{' '}
        <strong>12 meses</strong> anteriores ao evento.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Indenização</h2>
      <p>
        O Usuário indeniza o {COMPANY_LEGAL_NAME} por reclamações decorrentes de uso ilícito,
        violação destes Termos ou da LGPD por culpa do Usuário, ou conteúdo inserido pelo
        Usuário.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">9. Rescisão</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>O Usuário pode encerrar a qualquer momento; dados no Drive permanecem na Google;</li>
        <li>Inadimplência pode suspender acesso após aviso;</li>
        <li>Podemos suspender contas por violação, fraude ou risco à segurança.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">10. Privacidade</h2>
      <p>
        Tratamento de dados pessoais: Política de Privacidade. Dúvidas: {PRIVACY_CONTACT}. Suporte:{' '}
        {SUPPORT_EMAIL}.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">11. Alterações</h2>
      <p>
        Mudanças materiais serão publicadas com nova versão e podem exigir novo aceite eletrônico.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">12. Lei e foro</h2>
      <p>
        Leis da República Federativa do Brasil. Foro da {LEGAL_FORUM}.
      </p>

      <p className="mt-6 text-sm text-gray-500">Contato: {LEGAL_CONTACT}</p>

      <LegalCrossLinks />
    </LegalDocumentLayout>
  );
}
