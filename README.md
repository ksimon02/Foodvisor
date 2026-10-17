# Foodvisor

Diário de alimentação (calorias e macros) como **PWA**: instala no celular como um app, funciona offline e **não precisa do computador ligado**. Os dados ficam no próprio aparelho (localStorage).

## Como usar no celular (sem computador ligado)

1. Faça push na branch padrão (o workflow roda em `main` e em `claude/mobile-local-app-access-lq6l1q`).
2. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. O workflow `Publicar no GitHub Pages` publica em `https://<seu-usuario>.github.io/Foodvisor/`.
4. Abra esse endereço no celular **uma vez, com internet**:
   - **Android (Chrome):** menu ⋮ → *Instalar app*.
   - **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.

Depois disso o app abre direto da tela inicial, mesmo sem internet.

> Observação: o site publicado é público (qualquer pessoa com o link abre o app), mas seus registros ficam só no seu celular. Use *Metas e dados → Exportar backup* de vez em quando; limpar os dados do navegador apaga o diário.

## Testar no computador

```sh
python3 -m http.server 8000   # abra http://localhost:8000
```

Ao alterar arquivos, aumente `CACHE` em `sw.js` para forçar a atualização nos aparelhos.
