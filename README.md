# Névoa — chat anônimo e efêmero

Conversa privada em grupo, para até 10 pessoas, cifrada ponta a ponta no navegador.
Sem conta, sem banco de dados, sem histórico em servidores. Encerrou, evaporou.

## Use agora (sem instalar nada)

Site: https://lebot007.github.io/nevoa-chat/

1. Abra o site acima.
2. Clique em "Criar conversa privada" — o link é copiado automaticamente.
3. Envie o link pelo WhatsApp ou Telegram (botões prontos na tela), ou copie.
4. Até 9 pessoas abrem o link (10 no total, contando você) e entram sozinhas na conversa.
5. Mantenha a aba aberta enquanto conversam. Quem cria a sala é o admin: só o admin encerra para todos. Se ele sai, o admin passa automaticamente para o próximo da conversa (quem entrou primeiro), e assim por diante. Qualquer um pode "Sair da conversa" a qualquer momento.

Não é preciso rodar servidor local, abrir terminal, configurar rede ou instalar qualquer coisa. As instruções de localhost abaixo são apenas para desenvolvedores que queiram editar o código.

Recebeu um convite? Abra o link direto, ou use "Tenho um convite" no site e cole o link completo — a entrada é automática.

## Como funciona

- Quem cria a sala vira o admin; a chave AES-256-GCM nasce no navegador e vai no fragmento (#) do link, que nunca é enviado a servidores.
- Cada sala é um canal em brokers MQTT públicos (EMQX, HiveMQ, Eclipse, TBMQ, Mosquitto) via WebSocket seguro. Todos publicam e recebem no mesmo canal — é um grupão, todos falam com todos. Os brokers só repassam bytes já cifrados e não armazenam nada.
- Os 5 brokers funcionam em paralelo; dois usam a porta 443 (a mesma do HTTPS), que passa por VPN e firewall corporativo. Se um cai ou é bloqueado na rede de alguém, os outros seguem.
- **Conexão direta (P2P) quando a rede deixa:** os navegadores combinam um WebRTC entre si pelo próprio canal cifrado. Cada mensagem vai pelo P2P e pelo relay; quem recebe fica com a primeira cópia. Na mesma cidade isso costuma ser dezenas de ms em vez de centenas. Em 4G/CGNAT ou VPN, onde o P2P não abre, tudo segue pelo relay.
- **Ponte entre brokers:** se alguém só alcança brokers que o remetente não usa (ex.: VPN só com a 443), um participante conectado aos dois lados repassa os mesmos bytes cifrados.
- **Reconexão automática:** conexão que trava sem fechar (troca de Wi-Fi para 4G, celular que dormiu) é detectada em ~15 s e refeita; ao voltar para a aba, o site confere tudo na hora.
- O remetente de cada quadro é autenticado junto com a cifra (AES-GCM com dados associados): sem a chave ninguém forja mensagens.
- Limite de 10 pessoas: quem chega espera ~3 s as apresentações; se já houver 10, recebe "Sala cheia". A ordem de chegada decide, igual para todos.
- **Admin transferível:** quem cria a sala gera uma chave de assinatura (ECDSA P-256); o link leva só o hash da chave pública. Só um "encerrar" assinado por essa chave apaga a conversa de todos, e o admin prova o posto assinando seus "olás". O admin entrega uma cópia da chave ao próximo da fila, cifrada só para ele (ECDH) — assim, se o admin sai (até fechando a aba de repente), o próximo assume na hora; e assim por diante. Se o admin original volta, retoma o posto. O admin também pode "Sair e passar o admin".
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

## Testes automáticos

```bash
node tests/e2e.mjs
```

Sobe brokers falsos, um emulador de rede e 11 navegadores (Chrome headless): 10 participantes em 3 "casas" — fibra com P2P, 4G/CGNAT (150 ms ± 100 ms, 100 KB/s) e VPN corporativa só com a porta 443 — mais um visitante para testar a sala cheia. Verifica entrada, P2P × relay e latência, mensagens simultâneas, arquivos, queda de broker, queda de internet, troca de rede com conexão travada, limite de 10, apagar/encerrar, F5 e saída do anfitrião. Roda sozinho no GitHub Actions a cada push.

Em `localhost` o site aceita `?relays=ws://...,ws://...` e `?nop2p=1` para os testes; no site publicado esses parâmetros são ignorados.

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

Os brokers públicos veem os IPs dos participantes e bytes cifrados — nunca a chave nem o conteúdo, e não guardam nada. Com a conexão direta (P2P) ligada, os participantes também podem ver o IP uns dos outros, como em qualquer chamada WebRTC; dá para desligá-la em "Aparência e privacidade" e passar tudo pelo relay. Fechar a aba sem encerrar mantém histórico cifrado por até 12 h no seu dispositivo; use Encerrar para destruição imediata. Projeto educativo, sem auditoria formal.

## Licença

MIT © 2026 Lebot007
