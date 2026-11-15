# Névoa — chat anônimo e efêmero

Conversa privada entre **duas pessoas**, direto de navegador para navegador.
Sem conta, sem banco de dados, sem histórico em servidores. **Encerrou, evaporou.**

**Site:** https://lebot007.github.io/nevoa-chat/

## Como funciona

1. O usuário 1 cria a sala. Um link único é gerado com a chave de criptografia
   embutida no fragmento (`#`) — fragmentos **nunca** são enviados a servidores.
2. O usuário 2 abre o link. Os navegadores se encontram via broker público de
   sinalização (PeerJS Cloud) e abrem um **DataChannel WebRTC P2P**.
3. Todo o tráfego é cifrado com **AES-256-GCM** (WebCrypto) antes de sair do
   navegador, além do DTLS nativo do WebRTC. Nenhuma mensagem passa pelo servidor.
4. Qualquer um dos dois pode **Encerrar e apagar tudo**: mensagens, arquivos,
   histórico local e chave são destruídos **nos dois dispositivos**.

## Recursos

- Mensagens em tempo real com recibos (enviado / entregue / lido)
- Indicador de "digitando…", latência ao vivo, sons sintetizados (com mudo)
- Imagens com preview + lightbox; arquivos de qualquer tipo até **8 MB**,
  transferidos em blocos cifrados com progresso, cancelamento e reenvio
- Arrastar e soltar, colar imagem da área de transferência, emojis
- Apelidos anônimos aleatórios (editáveis), avatares por gradiente
- Textos persistidos **cifrados** no `localStorage` por até 12 h (retomada após
  recarregar); arquivos vivem **somente em RAM** e expiram ao recarregar
- Reconexão automática com backoff; sala estritamente para 2 pessoas
- QR Code e compartilhamento nativo do link; layout responsivo (drawer mobile)

## Rodar localmente

Precisa de contexto seguro (localhost ou HTTPS) por causa do WebCrypto:

```bash
python -m http.server 8080
# ou: npx serve .
```

Abra `http://localhost:8080`, crie a sala e envie o link para a outra pessoa.

## Publicar no GitHub (1 comando)

Requer Node 18+. Cria o repositório, comita na `main` como **Lebot007** e ativa o
GitHub Pages:

```bash
GITHUB_TOKEN=ghp_sua_chave node deploy.mjs          # bash
```

```powershell
$env:GITHUB_TOKEN="ghp_sua_chave"; node deploy.mjs  # PowerShell
```

Use um token classic com escopo `repo`. **Revogue o token depois** em
https://github.com/settings/tokens.

Alternativa manual:

```bash
git init -b main && git add .
git -c user.name=Lebot007 -c user.email=Lebot007@users.noreply.github.com \
  commit -m "feat: Névoa — chat anônimo P2P efêmero"
git remote add origin https://github.com/Lebot007/nevoa-chat.git
git push -u origin main
```

## Limites e notas de privacidade

- O broker de sinalização vê os IPs dos participantes (como qualquer WebRTC);
  ele **não** vê mensagens nem a chave. Em redes restritivas, um relay TURN
  público pode retransmitir o tráfego — sempre cifrado ponta a ponta.
- Fechar a aba sem encerrar mantém o histórico cifrado por até 12 h apenas no
  seu dispositivo. Use **Encerrar e apagar tudo** para destruição imediata.
- Projeto educativo, sem auditoria formal de segurança. Não use para dados
  que exijam garantias formais de sigilo.

## Licença

MIT © 2026 Lebot007
