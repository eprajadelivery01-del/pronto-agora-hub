## Plano

1. **Confirmar que o app está usando o projeto externo correto**
   - O código já importa `@/lib/supabaseClient`, que aponta para o Supabase externo compartilhado (`nptkxlrhrlssdsevpgqe`).
   - Não vou trocar para Lovable Cloud nem mexer nos arquivos auto-gerados.

2. **Melhorar o fluxo de login no frontend**
   - Centralizar o login usando o `signIn` do `AuthContext`, evitando lógica duplicada em `LoginPage`.
   - Normalizar o e-mail com `trim().toLowerCase()` antes de autenticar, para evitar erro por espaço invisível ou caixa alta.
   - Mostrar uma mensagem mais útil quando vier `Invalid login credentials`, explicando que pode ser senha incorreta, e-mail não confirmado, usuário bloqueado/deletado ou credencial criada em outro projeto.

3. **Adicionar diagnóstico seguro no console**
   - Registrar apenas informações não sensíveis: código/status do erro, mensagem e e-mail normalizado mascarado/parcial, sem senha.
   - Isso ajuda a diferenciar erro real de credencial de erro posterior de permissão/roles.

4. **Não tratar como RLS no login**
   - RLS só entra depois que o login emite sessão/token.
   - Se a resposta é `Invalid login credentials`, a falha está antes das consultas em `user_roles`, `profiles` ou permissões do painel.

5. **Validação final**
   - Conferir se os imports e o fluxo compilam corretamente.
   - Manter o comportamento de redirecionamento por role depois do login bem-sucedido.