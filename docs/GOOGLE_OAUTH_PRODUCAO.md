# Google OAuth — produção (Turquesa Agenda)

## Escopos (login único)

No **primeiro login** (`auth.ts` → `googleLoginScopeParam()` em `lib/googleOAuthScopes.ts`), o app pede **todos** os escopos do titular em um consentimento:

| Escopo | Uso no app |
|--------|------------|
| `openid`, `email`, `profile` | Identidade e sessão |
| `drive.file` | `clientes.json`, faturamento e backups no Drive do salão |
| `calendar.events` | Criar/atualizar sessões na agenda Google |
| `calendar.readonly` | Ler disponibilidade e evitar conflitos na sync |
| `contacts.readonly` | Importação manual de contatos (People API `connections.list`) |

**Não usar** no Console: `contacts.other.readonly`, `directory.readonly`.

## OAuth Consent Screen (Cloud Console)

Projeto: `turquesa-498516`. Em **APIs & Services → OAuth consent screen → Scopes**, manter apenas os escopos da tabela acima (API scopes).

APIs a habilitar: Google Drive API, Google Calendar API, People API.

## Fluxo do usuário

1. Login → tela Google com **todos** os escopos (expandir “1 serviço” no vídeo de verificação).
2. Tokens salvos em `owner_google_integracao` com `drive`, `calendar`, `contacts`.
3. **Reconectar Google** no Dashboard: só para contas antigas ou revogação; novos logins não precisam.

Autorização incremental (`/api/auth/google-authorize`) permanece para reconexão e contas legadas.

## Vídeo para verificação Google

1. Aba anônima → login em https://www.turquesaagenda.com.br
2. Na tela de consentimento, clicar em **“1 serviço”** e mostrar Calendar, Drive, Contatos
3. Aceitar → dashboard → Clientes (Drive) e Agenda (Calendar)
4. (Opcional) Dashboard → Importar contatos Google

## Resposta ao e-mail do Google (modelo)

- Escopos declarados = escopos do login (`googleLoginScopeParam`)
- Removidos `contacts.other.readonly` e `directory.readonly`
- Link do vídeo com consent expandido
- Privacidade: https://www.turquesaagenda.com.br/privacidade
