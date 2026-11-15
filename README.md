# Névoa — chat anônimo e efêmero

Conversa privada entre duas pessoas, direto de navegador para navegador.
Sem conta, sem banco de dados, sem histórico em servidores. Encerrou, evaporou.

## Use agora (sem instalar nada)

Site: https://lebot007.github.io/nevoa-chat/

1. Abra o site acima.
2. Clique em "Criar conversa privada" — o link é copiado automaticamente.
3. Envie o link pelo WhatsApp ou Telegram (botões prontos na tela), ou copie.
4. A outra pessoa abre o link e a conversa conecta sozinha.
5. Mantenha a aba aberta enquanto conversam. "Encerrar e apagar tudo" remove mensagens, arquivos e chave dos dois lados.

Não é preciso rodar servidor local, abrir terminal, configurar rede ou instalar qualquer coisa. As instruções de localhost abaixo são apenas para desenvolvedores que queiram editar o código.

Recebeu um convite? Abra o link direto, ou use "Tenho um convite" no site e cole o link completo — a entrada é automática.

## Como funciona

- O usuário 1 cria a sala; a chave AES-256-GCM nasce no navegador e vai no fragmento (#) do link, que nunca é enviado a servidores.
- O usuário 2 abre o link; os navegadores se encontram pelo broker público (PeerJS Cloud) e abrem um canal WebRTC P2P.
- Mensagens e arquivos são cifrados ponta a ponta antes de sair do navegador. Nenhum servidor guarda conteúdo.
- Encerrar apaga mensagens, arquivos da RAM, histórico local cifrado e a chave, nos dois dispositivos.

## Recursos

- Chat em tempo real com recibos, "digitando…", latência e sons com mudo
- Imagens com preview e lightbox; arquivos até 8 MB com progresso, cancelamento e reenvio
- Cópia automática do convite, botões de WhatsApp/Telegram e compartilhamento nativo
- Entrada por convite colado (auto-join ao colar um link válido)
- Faixa de conexão em linguagem simples com "Tentar agora" e reconexão automática
- Apelidos anônimos editáveis; textos cifrados no localStorage por até 12 h; arquivos só em RAM
- Layout responsivo, QR Code e sala limitada a duas pessoas

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

O broker de sinalização vê os IPs dos participantes, mas não vê mensagens nem a chave. A descoberta de rota usa STUN público; em redes com NAT simétrico pode ser necessário configurar um relay TURN próprio no código (o tráfego segue cifrado ponta a ponta). Fechar a aba sem encerrar mantém histórico cifrado por até 12 h no seu dispositivo; use Encerrar para destruição imediata. Projeto educativo, sem auditoria formal.

## Licença

MIT © 2026 Lebot007
