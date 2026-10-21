<p align="center">
  <img src="icons/icon128.png" alt="Ícone do Speedia" width="96">
</p>

<h1 align="center">Speedia</h1>

<p align="center">
  Controle de velocidade, mini player e download de vídeos no Instagram, X (Twitter), TikTok, Facebook e Reddit.
</p>

<p align="center">
  <a href="https://github.com/Glerme/Speedia/releases/latest"><img src="https://img.shields.io/github/v/release/Glerme/Speedia?label=release" alt="Última release"></a>
  <img src="https://img.shields.io/badge/Chrome-121%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome 121+">
  <img src="https://img.shields.io/badge/Firefox-128%2B-FF7139?logo=firefoxbrowser&logoColor=white" alt="Firefox 128+">
</p>

<p align="center"><a href="README.md">English</a> · Português</p>

<p align="center">
  <img src="docs/media/speed.gif" alt="Mudando a velocidade de reprodução com a barra do Speedia sobre um vídeo" width="640">
</p>

## Recursos

- Velocidade de 0.5x a 3x, em uma barra de vidro sobre o vídeo.
- Botões de som e Picture-in-Picture na mesma barra.
- Auto PiP: um mini player aparece ao rolar a página além de um vídeo que está tocando com som.
- PiP ao trocar de aba (opcional, só no Chrome): o vídeo que está tocando abre em Picture-in-Picture quando você muda de aba. O Chrome também exige liberar o site uma vez, pelo botão "Liberar este site" do popup.
- Download de vídeos.
- Sempre ativo, com a mesma barra em todos os sites.
- Atalhos de teclado configuráveis.
- Tema claro, escuro ou automático, com cor principal personalizável.
- A barra continua visível em tela cheia no X.
- Página de boas-vindas na instalação.
- Português (BR) e inglês.

Funciona no Instagram, X/Twitter, TikTok, Facebook e Reddit. Requer Chrome 121+ ou Firefox 128+.

## Instalação

### Chrome

1. Baixe `speedia-vX.zip` na [última release](https://github.com/Glerme/Speedia/releases/latest) e extraia.
2. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta `speedia` extraída.
4. Recarregue as abas do Instagram, X, TikTok, Facebook e Reddit que já estiverem abertas.

### Firefox

Abra o `.xpi` assinado da [última release](https://github.com/Glerme/Speedia/releases/latest) no Firefox e confirme a instalação. Ele se atualiza sozinho a cada nova release.

### Edições

- **Completa** (releases do GitHub): inclui o download de vídeos.
- **Lojas** (Chrome Web Store / AMO): a mesma extensão sem download de vídeos e sem a permissão `downloads`.

Gere qualquer uma com `scripts/build.sh <full|store> <outdir>` (ex.: `scripts/build.sh store dist` → `dist/speedia-store` e `dist/speedia-store-firefox`).

## Uso

Abra um vídeo no Instagram, X, TikTok, Facebook ou Reddit. A barra do Speedia aparece sobre ele, com as velocidades (0.5x a 3x) e os botões de som, PiP, Auto PiP e download.

<p align="center">
  <img src="docs/media/overlay.png" alt="Barra do Speedia sobre um vídeo, com as velocidades e os botões de som, PiP, Auto PiP e download" width="480">
</p>

- **Mini player:** com o Auto PiP ligado, ao rolar além de um vídeo que toca com som, ele continua tocando em um mini player.

  <p align="center">
    <img src="docs/media/mini-player.gif" alt="Vídeo continuando a tocar em um mini player depois de rolar a página" width="480">
  </p>

- **PiP ao trocar de aba** (só no Chrome): ao mudar de aba, o vídeo que está tocando com som abre em Picture-in-Picture. O Chrome bloqueia isso até você liberar o site, e só você pode fazer isso (extensões não têm acesso a essa permissão). Faça uma vez em cada site (Instagram, X, TikTok, Facebook e Reddit):
  1. Abra o Instagram, X, TikTok, Facebook ou Reddit e clique no ícone do Speedia para abrir o popup.
  2. Na seção Mini player, ligue **PiP ao trocar de aba**.
  3. Clique em **Liberar este site**. Abre a página de configurações do Chrome daquele site.
  4. Procure a opção **Picture-in-picture automático** e mude para **Permitir**.

     <img src="docs/media/auto-pip-permission.png" alt="Opção Picture-in-picture automático marcada como Permitir nas configurações do site no Chrome" width="480">

  5. Volte para a aba do site e recarregue a página. Toque um vídeo com som e troque de aba.

  Se preferir fazer pelo menu: `chrome://settings/content/autoPictureInPicture` > Permitido entrar no modo picture-in-picture automaticamente > Adicionar > `https://www.instagram.com` (ou `https://x.com`, `https://www.tiktok.com`, `https://www.facebook.com`, `https://www.reddit.com`).

- **Download:** o botão de download salva o vídeo como arquivo `.mp4`.
- **Tela cheia:** a barra continua visível em tela cheia no X. Aperte `F` para alternar a tela cheia.

## Atalhos de teclado

| Ação | Padrão |
| --- | --- |
| Tela cheia | `F` |
| Ligar/desligar o som | `M` |
| Aumentar a velocidade | `Shift` + `.` |
| Diminuir a velocidade | `Shift` + `,` |
| Resetar a velocidade | `Shift` + `1` |

Você pode alterar ou desativar qualquer atalho no popup (clique no ícone do Speedia na barra do navegador). O popup avisa sobre conflitos e permite desfazer.

## Aparência

No popup, escolha o tema (Automático, Claro ou Escuro) e a cor principal, entre 8 cores prontas ou uma roda de cor. A barra sobre o vídeo e a página de boas-vindas seguem a sua escolha.

<p align="center">
  <img src="docs/media/appearance.gif" alt="Mudando o tema e a cor principal no popup do Speedia" width="320">
</p>

<p align="center">
  <img src="docs/media/popup-dark.png" alt="Popup do Speedia com o tema escuro" width="280">
  <img src="docs/media/popup-light.png" alt="Popup do Speedia com o tema claro" width="280">
</p>

## Página de boas-vindas

Uma página pequena abre após a instalação, com os recursos e os atalhos.

<p align="center">
  <img src="docs/media/welcome.png" alt="Página de boas-vindas do Speedia" width="360">
</p>

## Privacidade

O Speedia não coleta dados e não tem servidores. Tudo roda no seu navegador, apenas nos 5 sites suportados (Instagram, X, TikTok, Facebook e Reddit). O download vem direto do CDN do site, sem passar por servidor do Speedia. Ele pede três permissões: `activeTab` (lê o endereço da aba atual só para o botão "Liberar este site"), `downloads` (para salvar vídeos) e `storage` (para guardar suas configurações). No Firefox, o manifest declara `data_collection_permissions: none`.

## Desenvolvimento

- **Rodar localmente:** rode `npm ci` e `npm run build` (ou `npm run watch`) e carregue a pasta `dist/` como extensão sem compactação (`chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação; no Firefox, `about:debugging#/runtime/this-firefox` → Carregar extensão temporária).
- **Mídias:** as imagens e GIFs de `docs/media/` são regenerados com os scripts em `scripts/media`.
- **Release:** enviar uma tag `v*` dispara o [`release.yml`](.github/workflows/release.yml), que publica o zip do Chrome e o `.xpi` assinado do Firefox, além do `updates.json` para atualização automática. A release só sai se o `CHANGELOG.md` tiver a seção `## <versão>` correspondente, e a `version` do `static/manifest.json` precisa bater com a tag (ex.: tag `v1.4.0` ↔ versão `1.4.0`).
