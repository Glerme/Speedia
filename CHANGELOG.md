# Changelog

Cada versão tem uma seção `## <versão> — <data>`. A release só é publicada se a versão da tag
tiver uma seção aqui; o texto dela vira as notas da release.

## 1.5.0 — 2026-10-21

- Nova opção "PiP ao trocar de aba" na seção Mini player do popup (desligada por padrão): ao
  mudar de aba, o vídeo que está tocando abre sozinho em Picture-in-Picture. Só no Chrome, usando o
  PiP automático do navegador.
- Botão "Liberar este site" abaixo da opção: abre as configurações do Chrome do site da aba ativa
  (Instagram/X) ou a página genérica de PiP automático, onde basta escolher Permitir. Extensões não
  podem alterar essa permissão. Usa a nova permissão `activeTab` (sem aviso na instalação); fica
  oculto no Firefox.
- `npm test` roda o autoteste da nova opção (`scripts/test-tab-pip.mjs`).
- README com o passo a passo para liberar o PiP automático no Chrome.

## 1.4.3 — 2026-10-15

- Em carrosséis do Instagram, a barra só aparece quando o vídeo é o slide atual, em vez de ficar
  sobre o vazio quando a mídia visível é uma imagem.

## 1.4.2 — 2026-10-14

- Código reorganizado em TypeScript dentro de `src/`, com build (esbuild) gerando a extensão em
  `dist/`. Sem mudanças de comportamento.
- Para rodar localmente: `npm ci`, `npm run build` e carregar a pasta `dist/`.

## 1.4.1 — 2026-10-14

- Nova edição para as lojas (Chrome Web Store e Firefox Add-ons), sem download de vídeos. A
  release do GitHub continua com a versão completa e passa a trazer também os zips de loja.
- README com prints e GIFs de como usar.

## 1.4.0 — 2026-10-14

- Nova seção Aparência no popup: tema Automático, Claro ou Escuro e cor principal à escolha,
  com 8 cores prontas e uma roda de cor.
- Barra sobre o vídeo com tema claro (vidro branco fosco) e escuro, e botões planos, sem o
  fundo escuro com degradê.
- Página de boas-vindas segue o tema e a cor escolhidos.

## 1.3.0 — 2026-10-14

- Popup redesenhado: tema claro/escuro automático, cards, toggle do Auto PiP e gravação de
  atalhos com aviso de conflito e opção de desfazer.
- Barra sobre o vídeo em liquid glass: vidro transparente, velocidade ativa em destaque e lente
  suave na borda (Chrome).
- Página de boas-vindas na instalação, com os recursos e os atalhos.
- Disponível em português e inglês.
- No X, a barra aparece no canto superior esquerdo em tela cheia.
- A barra não fica mais por cima de cabeçalhos e barras fixas do site ao rolar.
- Melhorias de acessibilidade: navegação por teclado, leitores de tela e respeito a
  "reduzir movimento" e "reduzir transparência".

## 1.2.1 — 2026-10-12

- Firefox: a extensão instalada pelo `.xpi` passa a se atualizar sozinha a cada nova release.
- Cada release agora traz as novidades da versão, tiradas deste changelog.

## 1.2.0 — 2026-10-12

- Atalhos de teclado: tela cheia (F), som (M), aumentar (Shift + .), diminuir (Shift + ,) e
  resetar a velocidade (Shift + 1).
- Popup de configurações ao clicar no ícone, para editar os atalhos e o Auto PiP.
- Corrige a barra pulando para um vídeo escondido atrás do visualizador de Reels.

## 1.1.1 — 2026-10-12

- Novo ícone da extensão.

## 1.1.0 — 2026-10-12

- Suporte ao Firefox, com `.xpi` assinado na release.

## 1.0.0 — 2026-10-12

- Primeira versão: controle de velocidade, mini player/PiP ao rolar e download de vídeos no
  Instagram e no X.
