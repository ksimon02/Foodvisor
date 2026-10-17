# Foodvisor

Diário alimentar personalizado, inspirado no app Foodvisor (sem ligação com a empresa). É um **PWA**: instala no celular como um app, funciona offline e **não precisa do computador ligado**. Os dados ficam no próprio aparelho (localStorage).

## O que o app faz

- **Questionário inicial** no estilo do Foodvisor: objetivo, motivação, sexo, gestação, idade, altura, peso, peso desejado, ritmo (com a data prevista mudando ao vivo), nível de atividade, tipo de alimentação, alergias, refeições por dia e desafios.
- **Programa personalizado**: meta de calorias (Mifflin-St Jeor + nível de atividade + ritmo), proteínas, carboidratos e gorduras de acordo com o objetivo e a dieta, meta de água e calorias recomendadas por refeição.
- **Diário**: anel de calorias, barras de macros, refeições, busca em ~100 alimentos brasileiros com porções, quantidade em porções, alimentos manuais, água por copos, dica do dia e sequência de dias.
- **Personalização pelas respostas**: avisos de alergênicos, sugestões que respeitam a dieta (vegetariana, vegana, pescetariana, low carb), dicas para os seus desafios e motivações e ideias de refeições ordenadas pelo objetivo.
- **Progresso**: registro de peso com gráfico, % do caminho até a meta, previsão de data e calorias dos últimos 7 dias.
- **Perfil**: respostas, refazer o questionário, ajuste manual das metas e backup.

## Como usar no celular (sem computador ligado)

1. O app está publicado em **https://ksimon02.github.io/Foodvisor/** (GitHub Pages, branch `gh-pages`).
   A cada push na branch padrão, o workflow `Publicar no GitHub Pages` atualiza a `gh-pages` automaticamente.
2. Abra esse endereço no celular **uma vez, com internet**:
   - **Android (Chrome):** menu ⋮ → *Instalar app*.
   - **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.

Depois disso o app abre direto da tela inicial, mesmo sem internet.

> Observação: o site publicado é público (qualquer pessoa com o link abre o app), mas seus registros ficam só no seu celular. Use *Perfil → Exportar backup* de vez em quando; limpar os dados do navegador apaga o diário.

## Testar no computador

```sh
python3 -m http.server 8000   # abra http://localhost:8000
```

Ao alterar arquivos, aumente `CACHE` em `sw.js` para forçar a atualização nos aparelhos.

Arquivos: `index.html` (estrutura), `style.css` (visual), `app.js` (questionário, cálculos e telas), `foods.js` (alimentos e ideias de refeições), `sw.js` (offline).
