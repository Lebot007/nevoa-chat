# Névoa — chat anônimo e efêmero

Conversa privada em grupo, para até 10 pessoas, cifrada ponta a ponta no navegador.
Sem conta, sem banco de dados, sem histórico em servidores. Encerrou, evaporou.

## Use agora (sem instalar nada)

Site: https://lebot007.github.io/nevoa-chat/

1. Abra o site acima.
2. Clique em "Criar conversa privada" — o link é copiado automaticamente.
3. Envie o link pelo WhatsApp ou Telegram (botões prontos na tela), ou copie.
4. Até 9 pessoas abrem o link (10 no total, contando você) e entram sozinhas na conversa.
5. Mantenha a aba aberta enquanto conversam. Só o anfitrião encerra para todos ("Encerrar e apagar para todos"); os outros podem "Sair da conversa" a qualquer momento.

Não é preciso rodar servidor local, abrir terminal, configurar rede ou instalar qualquer coisa. As instruções de localhost abaixo são apenas para desenvolvedores que queiram editar o código.

Recebeu um convite? Abra o link direto, ou use "Tenho um convite" no site e cole o link completo — a entrada é automática.

## Como funciona

- O anfitrião cria a sala; a chave AES-256-GCM nasce no navegador e vai no fragmento (#) do link, que nunca é enviado a servidores.
- Cada sala é um canal em brokers MQTT públicos (EMQX, HiveMQ, Eclipse, Mosquitto) via WebSocket seguro. Todos publicam e recebem no mesmo canal — é um grupão, todos falam com todos. Os brokers só repassam bytes já cifrados e não armazenam nada.
- Os 4 brokers funcionam em paralelo: se um cai ou é bloqueado na rede de alguém, os outros seguem. Funciona em casas diferentes, 4G/5G e VPN (não depende de P2P).
- O remetente de cada quadro é autenticado junto com a cifra (AES-GCM com dados associados): sem a chave ninguém forja mensagens.
- Limite de 10 pessoas: quem chega espera ~3 s as apresentações; se já houver 10, recebe "Sala cheia". A ordem de chegada decide, igual para todos.
- Se o anfitrião fechar a aba, os outros continuam conversando. Só ele pode encerrar para todos: o link carrega apenas o hash de um segredo que fica no navegador dele.
- Qualquer participante pode apagar qualquer mensagem para todos; editar, só o autor.

## Recursos

- Chat em grupo (até 10) com lista de participantes, entradas/saídas, recibos (✓✓ azul quando todos leram), "Fulano está digitando…", latência e sons com mudo
- Imagens com preview e lightbox; arquivos até 8 MB com progresso, cancelamento e reenvio
- Cópia automática do convite, botões de WhatsApp/Telegram e compartilhamento nativo
- Entrada por convite colado (auto-join ao colar um link válido)
- Faixa de conexão em linguagem simples com "Tentar agora" e reconexão automática
- Apelidos anônimos editáveis; textos cifrados no localStorage por até 12 h; arquivos só em RAM
- 8 temas (Névoa, Meia-noite, Oceano, Floresta, Crepúsculo, Claro, Papel, Contraste) e cor de destaque personalizável
- Layout responsivo, QR Code e sala limitada a 10 pessoas

## Rodar localmente (apenas desenvolvedores)

```bash
python -m http.server 8080
# ou: npx serve .
```

Abra http://localhost:8080 para editar e testar o código. Usuários finais usam só o site publicado.

## Publicar / atualizar

O deploy.mjs cria o repositório e publica no GitHub Pages:

```bash
GITHUB_TOKEN=ghp_sua_chave node deploy.mjs
```

Use token classic com escopo repo e revogue depois em https://github.com/settings/tokens.

## Privacidade

Os brokers públicos veem os IPs dos participantes e bytes cifrados — nunca a chave nem o conteúdo, e não guardam nada. Fechar a aba sem encerrar mantém histórico cifrado por até 12 h no seu dispositivo; use Encerrar para destruição imediata. Projeto educativo, sem auditoria formal.

## Licença

MIT © 2026 Lebot007
