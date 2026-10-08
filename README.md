# Numora Cine Hub

Quero construir o NUMORA CINE, uma plataforma de streaming responsiva para celular e desktop.

USE COMO REFERÊNCIA VISUAL O VÍDEO/EXEMPLO QUE ENVIEI, principalmente a estrutura de navegação, organização do catálogo, cards, categorias, banners, anúncios e experiência mobile.

NÃO copie logos, identidade visual, código ou marca do aplicativo de referência. Crie uma identidade própria para o NUMORA CINE.

DESIGN:

- Tema escuro cinematográfico.
- Interface moderna e premium.
- Fundo predominantemente preto/cinza muito escuro.
- Destaques em uma cor de identidade própria do Numora Cine.
- Cards de filmes com pôster vertical.
- Bordas levemente arredondadas.
- Avaliação numérica no card.
- Títulos abaixo dos cards.
- Rolagem horizontal nas categorias.
- Banner grande de destaque.
- Layout otimizado primeiro para celular.
- Desktop também deve ser totalmente responsivo.

TOPO:

Criar:

- Logo NUMORA CINE
- Barra de pesquisa com ícone de lupa
- Botão de histórico
- Botão de downloads
- Perfil do usuário

NAVEGAÇÃO PRINCIPAL:

Criar categorias:

Início
Séries
Filmes
Animes
Novelas
Dramas
Infantil
Documentários

A navegação deve permitir adicionar novas categorias futuramente.

HOME:

Criar um banner cinematográfico grande com:

- imagem de fundo
- título
- descrição
- gênero
- ano
- classificação
- botão "Assistir"
- botão "Minha Lista"

Abaixo do banner:

"Streaming"

Criar cards de serviços/plataformas apenas como categorias/filtros de conteúdo, sem sugerir que temos os catálogos licenciados dessas empresas.

Depois criar:

"Recomendados para você"

"Em alta"

"Filmes populares"

"Séries populares"

"Lançamentos"

"Melhores avaliados"

Cada seção deve possuir cards horizontais.

CARD DO FILME:

Cada card deve mostrar:

- pôster
- título
- nota
- ano quando disponível
- tipo de conteúdo

Ao clicar no card, abrir a página de detalhes.

PÁGINA DE DETALHES:

Mostrar:

- backdrop
- pôster
- título
- descrição
- gênero
- ano
- duração
- classificação
- nota
- elenco
- diretor
- botão "Assistir"
- botão "Minha Lista"
- botão "Baixar" somente se houver conteúdo autorizado para download

Criar também:

"Você também pode gostar"

PLAYER:

Criar player de vídeo responsivo.

Recursos:

- Play/Pause
- volume
- barra de progresso
- tela cheia
- legendas
- qualidade
- velocidade

Preparar o player para receber URLs de vídeo autorizadas.

NUNCA inventar links de filmes.

Se não houver uma fonte autorizada, mostrar:

"Este conteúdo ainda não possui vídeo disponível."

ANÚNCIOS:

Criar espaços preparados para anúncios:

1. Banner na Home
2. Banner entre seções
3. Anúncio antes da reprodução
4. Anúncio durante a reprodução quando permitido pela rede de anúncios

Criar componentes separados para publicidade para que futuramente possamos conectar uma rede como Google AdMob/Ad Manager ou outra solução compatível.

Não criar anúncios falsos como se fossem receita real.

CATÁLOGO:

Integrar uma API de filmes para obter metadados autorizados:

- título
- pôster
- backdrop
- descrição
- gêneros
- ano
- avaliação
- elenco
- diretor
- trailers quando disponíveis

Usar variáveis de ambiente para chaves da API.

Não expor chaves secretas no frontend.

IMPORTANTE:

A API de catálogo fornece METADADOS.

Ela NÃO deve ser usada para obter filmes pirateados.

A reprodução deve utilizar somente fontes de vídeo para as quais a plataforma tenha autorização.

BANCO DE DADOS:

Usar Supabase.

Criar tabelas para:

profiles
movies
series
episodes
genres
favorites
watch_history
watch_progress
downloads
admin_users

Criar relacionamentos corretamente.

LOGIN:

Criar:

- cadastro
- login
- logout
- recuperação de senha
- perfil

PAINEL ADMINISTRATIVO:

Criar /admin protegido.

O administrador deve conseguir:

- adicionar filme
- adicionar série
- adicionar temporada
- adicionar episódio
- adicionar capa
- adicionar banner
- adicionar descrição
- definir gênero
- definir ano
- definir nota
- definir classificação
- adicionar URL de vídeo autorizada
- adicionar legenda
- publicar/despublicar
- editar
- excluir
- colocar conteúdo em destaque

UPLOAD:

Criar interface de upload de:

- pôster
- banner
- vídeo
- legenda

Os arquivos devem ser armazenados de forma adequada e segura.

Criar barra de progresso durante uploads.

MOBILE:

No celular, criar navegação inferior fixa:

Início
Explorar
Tendências
Indicações
Meu

A navegação deve funcionar de verdade.

DESKTOP:

Criar navegação superior/lateral adaptada para telas maiores.

PESQUISA:

A pesquisa deve procurar por:

- título
- gênero
- ano
- atores
- diretor

Criar resultados instantâneos quando possível.

HISTÓRICO:

Salvar automaticamente:

- conteúdo assistido
- posição do vídeo
- data

Criar:

"Continuar assistindo"

MINHA LISTA:

Usuário pode adicionar/remover conteúdos.

TENDÊNCIAS:

Criar uma página mostrando conteúdos mais visualizados.

INDICAÇÕES:

Criar recomendações baseadas no histórico e favoritos.

PERFORMANCE:

- lazy loading
- imagens otimizadas
- carregamento progressivo
- skeleton loading
- cache quando apropriado
- paginação/infinite scroll
- tratamento de erros

SEGURANÇA:

- Supabase Auth
- Row Level Security
- rotas administrativas protegidas
- validação dos dados
- variáveis de ambiente
- nenhuma chave secreta no frontend

OBJETIVO FINAL:

Quero que o resultado pareça um aplicativo de streaming profissional e moderno, com a experiência mobile semelhante à referência que enviei, mas com identidade própria do NUMORA CINE.

Não quero apenas uma página demonstrativa.

Quero uma aplicação funcional, com navegação funcionando, banco de dados preparado, autenticação, catálogo conectado à API, favoritos, histórico, pesquisa, player preparado para vídeos autorizados, anúncios preparados e painel administrativo.

Construa primeiro a versão funcional e depois podemos adicionar recursos avançados.

This project was built for **NUMORA CINE**.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
