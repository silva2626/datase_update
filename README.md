# 🚀 Comparador de Schema MySQL

Uma ferramenta web para comparar schemas de bancos de dados MySQL e gerar scripts de migração automaticamente.

## 📋 Descrição

O **Comparador de Schema MySQL** é uma aplicação web que permite comparar dois dumps de estrutura de banco de dados MySQL (arquivo `.sql` contendo apenas a estrutura das tabelas) e gerar automaticamente um script SQL com as alterações necessárias para migrar de um estado para outro.

### 🎯 Funcionalidades

- **Comparação de Schemas**: Analisa diferenças entre dois dumps de estrutura MySQL
- **Geração de Scripts de Migração**: Cria automaticamente comandos SQL para:
  - Criar novas tabelas
  - Alterar tabelas existentes (adicionar/remover/modificar colunas)
  - Gerenciar índices e constraints
  - Criar/remover views
- **Interface Web Intuitiva**: Upload simples de arquivos com feedback visual
- **Suporte a Views**: Detecta e gerencia views do banco de dados
- **Validação Robusta**: Parser SQL robusto que lida com diferentes formatos de dump

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js com Express
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Bootstrap 5
- **Parser SQL**: node-sql-parser
- **Upload de Arquivos**: express-fileupload
- **Comparação de Schemas**: Lógica customizada para análise de diferenças

## 📦 Instalação

### Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn

**OU**

- Docker e Docker Compose (recomendado para evitar problemas de versão)

### Passos para instalação

#### 🐳 Opção 1: Usando Docker (Recomendado)

1. **Clone o repositório**

```bash
git clone https://github.com/seu-usuario/datase_update.git
cd datase_update
```

2. **Crie os arquivos de teste** (necessário para desenvolvimento/testes)

```bash
git clone https://github.com/seu-usuario/datase_update.git
cd datase_update
```

2. **Crie os arquivos de teste** (necessário para desenvolvimento/testes)

```bash
# Crie o arquivo de teste de produção
cat > test_producao.sql << 'EOF'
-- phpMyAdmin SQL Dump
-- version 5.2.1-1.el9
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Tempo de geração: 17/07/2025 às 19:11
-- Versão do servidor: 11.2.2-MariaDB
-- Versão do PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `test_db`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `produtos`
--

CREATE TABLE `produtos` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `preco` decimal(10,2) NOT NULL,
  `descricao` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Índices de tabela `produtos`
--
ALTER TABLE `produtos`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `produtos`
--
ALTER TABLE `produtos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
EOF

# Crie o arquivo de teste de homologação
cat > test_homologacao.sql << 'EOF'
-- phpMyAdmin SQL Dump
-- version 5.2.1-1.el9
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Tempo de geração: 17/07/2025 às 19:10
-- Versão do servidor: 11.2.2-MariaDB
-- Versão do PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `test_db`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `produtos`
--

CREATE TABLE `produtos` (
  `id` int(11) NOT NULL,
  `nome` varchar(150) NOT NULL,
  `preco` decimal(10,2) NOT NULL,
  `descricao` text DEFAULT NULL,
  `categoria_id` int(11) DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `categorias`
--

CREATE TABLE `categorias` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para view `v_produtos_categoria`
--

CREATE VIEW `v_produtos_categoria` AS
SELECT
    p.id,
    p.nome as produto_nome,
    p.preco,
    c.nome as categoria_nome
FROM produtos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.ativo = 1;

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Índices de tabela `produtos`
--
ALTER TABLE `produtos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_categoria` (`categoria_id`);

--
-- Índices de tabela `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `produtos`
--
ALTER TABLE `produtos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `categorias`
--
ALTER TABLE `categorias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabela `produtos`
--
ALTER TABLE `produtos`
  ADD CONSTRAINT `fk_produtos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`);

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
EOF
```

3. **Execute com Docker Compose**

```bash
docker-compose up -d
```

4. **Acesse a aplicação**
   Abra seu navegador e acesse: `http://localhost:3000`

Para parar a aplicação:

```bash
docker-compose down
```

#### 💻 Opção 2: Instalação Local (Node.js)

1. **Clone o repositório**

```bash
git clone https://github.com/seu-usuario/datase_update.git
cd datase_update
```

2. **Instale as dependências**

```bash
npm install
```

3. **Crie os arquivos de teste** (use os mesmos comandos da Opção 1)

4. **Execute a aplicação**

```bash
npm start
# ou
node server.js
```

5. **Acesse a aplicação**
   Abra seu navegador e acesse: `http://localhost:3000`

## 🚀 Como usar

1. **Prepare os arquivos**: Gere dumps de estrutura (apenas estrutura, sem dados) dos seus bancos:

   ```bash
   # Dump de produção (estado atual)
   mysqldump -u usuario -p --no-data nome_db > producao.sql

   # Dump de homologação (estado desejado)
   mysqldump -u usuario -p --no-data nome_db_homolog > homologacao.sql
   ```

2. **Faça upload dos arquivos**:

   - Selecione o arquivo de produção (estado atual)
   - Selecione o arquivo de homologação (estado desejado)
   - Clique em "Gerar Script de Alteração"

3. **Revise e execute o script**: O script gerado deve ser **cuidadosamente revisado** antes da execução em produção.

## 📁 Estrutura do Projeto

```
datase_update/
├── server.js              # Servidor principal Express
├── index.html             # Interface web
├── package.json           # Dependências do projeto
├── Dockerfile             # Configuração do Docker
├── docker-compose.yml     # Configuração do Docker Compose
├── .dockerignore          # Arquivos ignorados pelo Docker
├── test_homologacao.sql   # Arquivo de teste (homologação)
├── test_producao.sql      # Arquivo de teste (produção)
├── debug_split.js         # Script de debug
├── debug_test.js          # Script de debug
├── test_parsing.js        # Teste de parsing
├── test_real.js           # Teste com dados reais
└── README.md             # Este arquivo
```

## 🔧 Configuração

### Docker

O projeto inclui configuração Docker para facilitar a execução:

- **Dockerfile**: Baseado na imagem oficial do Node.js 18 Alpine
- **docker-compose.yml**: Configuração completa com volume mounting e hot reload
- **Porta**: 3000 (mapeada para o host)

### Dependências

```json
{
  "dependencies": {
    "dbdiff": "^0.5.3",
    "express": "^5.1.0",
    "express-fileupload": "^1.5.2",
    "node-sql-parser": "^5.3.10",
    "sql-parser": "^0.5.0"
  }
}
```

### Configurações do Servidor

- **Porta**: 3000 (configurável no código)
- **Limite de arquivo**: 50MB por arquivo
- **Formatos suportados**: `.sql`

## 🧪 Testes

### Com Docker

```bash
# Acessar o container
docker-compose exec comparador-schema bash

# Executar testes dentro do container
node test_parsing.js
node test_real.js
node debug_split.js
```

### Instalação Local

```bash
# Teste de parsing
node test_parsing.js

# Teste com dados reais
node test_real.js

# Debug de divisão de statements
node debug_split.js
```

## ⚠️ Importante - Segurança

- **Sempre revise** o script gerado antes de executá-lo em produção
- **Faça backup** do banco de dados antes de aplicar as alterações
- **Teste em ambiente de desenvolvimento** primeiro
- Os arquivos de dump **não devem conter dados sensíveis**

## 🔍 Funcionalidades Detectadas

O sistema detecta e processa:

### Tabelas

- ✅ Criação de novas tabelas
- ✅ Alteração de colunas existentes
- ✅ Adição de novas colunas
- ✅ Remoção de colunas
- ✅ Modificação de tipos de dados

### Índices

- ✅ Criação de novos índices
- ✅ Remoção de índices
- ✅ Modificação de índices existentes
- ✅ Chaves primárias
- ✅ Chaves únicas

### Views

- ✅ Criação de views
- ✅ Modificação de views
- ✅ Remoção de views

### Constraints

- ✅ Chaves estrangeiras
- ✅ Constraints CHECK
- ✅ Constraints UNIQUE

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de parsing**: Verifique se o arquivo SQL está bem formatado
2. **Arquivo muito grande**: Limite atual é 50MB
3. **Caracteres especiais**: Certifique-se de que o arquivo está em UTF-8
4. **Porta já em uso**: Se a porta 3000 estiver ocupada, altere no docker-compose.yml ou pare outros serviços
5. **Problemas de permissão (Docker)**: Certifique-se de que o Docker está rodando e o usuário tem permissões

### Comandos úteis Docker

```bash
# Ver logs da aplicação
docker-compose logs -f

# Rebuild da imagem
docker-compose build --no-cache

# Parar e remover containers
docker-compose down

# Acessar o container
docker-compose exec comparador-schema bash
```

### Logs

Os logs do servidor aparecem no console. Para debug detalhado, verifique os arquivos de teste.

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença ISC. Veja o arquivo `LICENSE` para mais detalhes.

## 👥 Desenvolvido por

- **Allison Silva** - Desenvolvimento e manutenção

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório do GitHub.

---

**⚠️ Aviso**: Esta ferramenta gera scripts SQL que modificam a estrutura do banco de dados. Sempre teste em ambiente de desenvolvimento e faça backup antes de aplicar em produção.
