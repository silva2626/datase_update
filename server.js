const express = require("express");
const fileUpload = require("express-fileupload");
const { Parser } = require("node-sql-parser");
const path = require("path");

const app = express();
const port = 3000;

// Configurar middleware de file upload
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Limite de 50MB por arquivo
  })
);

// Função para extrair informações de tabelas do SQL
function extractTableInfo(sqlContent) {
  const tables = {};
  const views = {};

  // Remover comentários mais cuidadosamente
  let cleanedContent = sqlContent
    .replace(/--.*$/gm, "") // Remove comentários de linha
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comentários de bloco
    .replace(/^\s*$/gm, "") // Remove linhas vazias
    .replace(/\s+/g, " "); // Normaliza espaços

  // Dividir por statements, mantendo CREATE TABLE, CREATE VIEW e outras declarações intactas
  const statements = [];
  let currentStatement = "";
  let inCreateTable = false;
  let inCreateView = false;
  let parenthesesLevel = 0;

  const lines = cleanedContent.split(";");

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Se não estamos no meio de uma declaração, verificar o tipo
    if (!inCreateTable && !inCreateView) {
      // Detectar início de CREATE TABLE
      if (line.toUpperCase().includes("CREATE TABLE")) {
        inCreateTable = true;
        currentStatement = line;
        parenthesesLevel =
          (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

        if (parenthesesLevel === 0) {
          statements.push(currentStatement);
          currentStatement = "";
          inCreateTable = false;
        }
      }
      // Detectar início de CREATE VIEW
      else if (
        line.toUpperCase().includes("CREATE") &&
        line.toUpperCase().includes("VIEW")
      ) {
        inCreateView = true;
        currentStatement = line;
        statements.push(currentStatement);
        currentStatement = "";
        inCreateView = false;
      }
      // Detectar DROP TABLE/VIEW
      else if (
        line.toUpperCase().includes("DROP TABLE") ||
        line.toUpperCase().includes("DROP VIEW")
      ) {
        statements.push(line);
      }
      // Detectar ALTER TABLE
      else if (line.toUpperCase().includes("ALTER TABLE")) {
        statements.push(line);
      }
    }
    // Continuar construindo CREATE TABLE
    else if (inCreateTable) {
      currentStatement += " " + line;
      parenthesesLevel +=
        (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

      if (parenthesesLevel === 0) {
        statements.push(currentStatement);
        currentStatement = "";
        inCreateTable = false;
      }
    }
  }

  statements.forEach((statement) => {
    try {
      // Detectar CREATE VIEW
      if (
        statement.toUpperCase().includes("CREATE") &&
        statement.toUpperCase().includes("VIEW")
      ) {
        const match = statement.match(
          /CREATE\s+(?:ALGORITHM=\w+\s+)?(?:DEFINER=\S+\s+)?(?:SQL\s+SECURITY\s+\w+\s+)?VIEW\s+(?:`)?(\w+)(?:`)?/i
        );
        if (match) {
          const viewName = match[1];
          views[viewName] = {
            name: viewName,
            definition: statement.trim(),
            type: "VIEW",
          };
        }
      }

      // Detectar DROP VIEW
      else if (
        statement.toUpperCase().includes("DROP") &&
        statement.toUpperCase().includes("VIEW")
      ) {
        const match = statement.match(
          /DROP\s+(?:TABLE\s+IF\s+EXISTS|VIEW\s+IF\s+EXISTS|VIEW)\s+(?:`)?(\w+)(?:`)?/i
        );
        if (match) {
          const viewName = match[1];
          if (!views[viewName]) {
            views[viewName] = {
              name: viewName,
              type: "VIEW",
            };
          }
          views[viewName].dropStatement = statement.trim();
        }
      }

      // Detectar CREATE TABLE
      else if (statement.toUpperCase().includes("CREATE TABLE")) {
        const match = statement.match(/CREATE TABLE\s+(?:`)?(\w+)(?:`)?/i);
        if (match) {
          const tableName = match[1];
          tables[tableName] = {
            name: tableName,
            columns: new Map(),
            indexes: new Map(),
            constraints: new Map(),
            originalSql: statement,
          };

          // Extrair definição das colunas de forma mais robusta
          const tableDefMatch = statement.match(
            /CREATE TABLE\s+(?:`)?(\w+)(?:`)?[^(]*\(([^;]+)\)[^;]*;?/is
          );
          if (tableDefMatch) {
            const tableDefinition = tableDefMatch[2];

            // Dividir por vírgulas, mas respeitando parênteses
            const columnLines = [];
            let currentLine = "";
            let parenLevel = 0;
            let inQuotes = false;
            let quoteChar = "";

            for (let i = 0; i < tableDefinition.length; i++) {
              const char = tableDefinition[i];

              if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
              } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = "";
              } else if (!inQuotes) {
                if (char === "(") parenLevel++;
                else if (char === ")") parenLevel--;
                else if (char === "," && parenLevel === 0) {
                  columnLines.push(currentLine.trim());
                  currentLine = "";
                  continue;
                }
              }

              currentLine += char;
            }

            if (currentLine.trim()) {
              columnLines.push(currentLine.trim());
            }

            columnLines.forEach((line) => {
              if (!line || line.length === 0) return;

              const trimmedLine = line.trim();

              // Detectar PRIMARY KEY (não como coluna)
              if (
                trimmedLine.toUpperCase().includes("PRIMARY KEY") &&
                !trimmedLine.match(/^\w+\s+\w+/)
              ) {
                const keyMatch = trimmedLine.match(
                  /PRIMARY KEY\s*\(([^)]+)\)/i
                );
                if (keyMatch) {
                  tables[tableName].constraints.set("PRIMARY", {
                    type: "PRIMARY KEY",
                    columns: keyMatch[1]
                      .split(",")
                      .map((col) => col.trim().replace(/[`'"]/g, "")),
                    definition: trimmedLine,
                  });
                }
              }
              // Detectar UNIQUE KEY
              else if (trimmedLine.toUpperCase().includes("UNIQUE KEY")) {
                const keyMatch = trimmedLine.match(
                  /UNIQUE KEY\s+(?:`)?(\w+)(?:`)?/i
                );
                if (keyMatch) {
                  tables[tableName].constraints.set(keyMatch[1], {
                    type: "UNIQUE KEY",
                    name: keyMatch[1],
                    definition: trimmedLine,
                  });
                }
              }
              // Detectar KEY/INDEX
              else if (
                trimmedLine.toUpperCase().includes("KEY") ||
                trimmedLine.toUpperCase().includes("INDEX")
              ) {
                const keyMatch = trimmedLine.match(
                  /(?:KEY|INDEX)\s+(?:`)?(\w+)(?:`)?/i
                );
                if (keyMatch) {
                  tables[tableName].indexes.set(keyMatch[1], {
                    name: keyMatch[1],
                    definition: trimmedLine,
                  });
                }
              }
              // Detectar FOREIGN KEY
              else if (trimmedLine.toUpperCase().includes("FOREIGN KEY")) {
                const keyMatch = trimmedLine.match(
                  /CONSTRAINT\s+(?:`)?(\w+)(?:`)?.*FOREIGN KEY/i
                );
                if (keyMatch) {
                  tables[tableName].constraints.set(keyMatch[1], {
                    type: "FOREIGN KEY",
                    name: keyMatch[1],
                    definition: trimmedLine,
                  });
                }
              }
              // Detectar colunas normais
              else if (trimmedLine.match(/^(?:`)?(\w+)(?:`)?\s+\w+/)) {
                const colMatch = trimmedLine.match(/^(?:`)?(\w+)(?:`)?/);
                if (colMatch) {
                  const columnName = colMatch[1];
                  const isPrimaryKey = trimmedLine
                    .toUpperCase()
                    .includes("PRIMARY KEY");

                  // Limpar a definição da coluna
                  const cleanDefinition = trimmedLine.replace(
                    /^(?:`)?(\w+)(?:`)?/,
                    `\`${columnName}\``
                  );

                  tables[tableName].columns.set(columnName, {
                    name: columnName,
                    definition: cleanDefinition,
                    isPrimaryKey: isPrimaryKey,
                  });
                }
              }
            });
          }
        }
      }

      // Detectar ALTER TABLE
      else if (statement.toUpperCase().includes("ALTER TABLE")) {
        const match = statement.match(/ALTER TABLE\s+(?:`)?(\w+)(?:`)?/i);
        if (match) {
          const tableName = match[1];
          if (!tables[tableName]) {
            tables[tableName] = {
              name: tableName,
              columns: new Map(),
              indexes: new Map(),
              constraints: new Map(),
              alters: [],
            };
          }
          if (!tables[tableName].alters) {
            tables[tableName].alters = [];
          }
          tables[tableName].alters.push(statement);
        }
      }
    } catch (error) {
      console.warn(
        `Erro ao processar statement: ${statement.substring(0, 100)}...`,
        error.message
      );
    }
  });

  return { tables, views };
}

// Função para comparar colunas e gerar ALTER TABLE
function generateColumnAlters(tableName, prodTable, homTable) {
  const alters = [];

  // Verificar colunas que existem em homologação mas não em produção (ADD COLUMN)
  for (const [columnName, columnInfo] of homTable.columns) {
    if (!prodTable.columns.has(columnName)) {
      // Extrair apenas a parte da definição após o nome da coluna
      let columnDef = columnInfo.definition;

      // Remover o nome da coluna do início da definição
      columnDef = columnDef.replace(/^(?:`)?(\w+)(?:`)?/, "").trim();

      alters.push(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef};`
      );
    }
  }

  // Verificar colunas que existem em produção mas não em homologação (DROP COLUMN)
  for (const [columnName, columnInfo] of prodTable.columns) {
    if (!homTable.columns.has(columnName)) {
      alters.push(
        `-- ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\`; -- CUIDADO: Pode causar perda de dados`
      );
    }
  }

  // Verificar colunas que existem em ambos mas podem ter mudado (MODIFY COLUMN)
  for (const [columnName, homColumnInfo] of homTable.columns) {
    if (prodTable.columns.has(columnName)) {
      const prodColumnInfo = prodTable.columns.get(columnName);
      if (prodColumnInfo.definition !== homColumnInfo.definition) {
        // Extrair apenas a parte da definição após o nome da coluna
        let columnDef = homColumnInfo.definition;
        columnDef = columnDef.replace(/^(?:`)?(\w+)(?:`)?/, "").trim();

        alters.push(
          `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${columnDef};`
        );
      }
    }
  }

  return alters;
}

// Função para gerar ALTER/DROP/CREATE statements para views
function generateViewAlters(prodViews, homViews) {
  const alters = [];

  // Views que existem em homologação mas não em produção (CREATE VIEW)
  for (const viewName in homViews) {
    if (!prodViews[viewName]) {
      const viewInfo = homViews[viewName];
      if (viewInfo.definition) {
        alters.push(`-- Criando view '${viewName}' que não existe em produção`);
        alters.push(`DROP VIEW IF EXISTS \`${viewName}\`;`);
        alters.push(`${viewInfo.definition};`);
        alters.push("");
      }
    }
  }

  // Views que existem em produção mas não em homologação (DROP VIEW)
  for (const viewName in prodViews) {
    if (!homViews[viewName]) {
      alters.push(
        `-- ATENÇÃO: View '${viewName}' existe em produção mas não em homologação`
      );
      alters.push(`-- Removendo view que não existe mais em homologação:`);
      alters.push(`DROP VIEW IF EXISTS \`${viewName}\`;`);
      alters.push("");
    }
  }

  // Views que existem em ambos mas podem ter mudado (DROP e CREATE)
  for (const viewName in homViews) {
    if (prodViews[viewName]) {
      const prodView = prodViews[viewName];
      const homView = homViews[viewName];

      // Comparar definições (remover espaços extras para comparação)
      const prodDef = prodView.definition
        ? prodView.definition.replace(/\s+/g, " ").trim()
        : "";
      const homDef = homView.definition
        ? homView.definition.replace(/\s+/g, " ").trim()
        : "";

      if (prodDef !== homDef && homView.definition) {
        alters.push(`-- Atualizando view '${viewName}' que foi modificada`);
        alters.push(`DROP VIEW IF EXISTS \`${viewName}\`;`);
        alters.push(`${homView.definition};`);
        alters.push("");
      }
    }
  }

  return alters;
}

// Função para comparar índices e gerar ALTER TABLE
function generateIndexAlters(tableName, prodTable, homTable) {
  const alters = [];

  // Verificar índices que existem em homologação mas não em produção (ADD INDEX)
  for (const [indexName, indexInfo] of homTable.indexes) {
    if (!prodTable.indexes.has(indexName)) {
      alters.push(`ALTER TABLE \`${tableName}\` ADD ${indexInfo.definition};`);
    }
  }

  // Verificar índices que existem em produção mas não em homologação (DROP INDEX)
  for (const [indexName, indexInfo] of prodTable.indexes) {
    if (!homTable.indexes.has(indexName)) {
      alters.push(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\`;`);
    }
  }

  // Verificar índices que podem ter mudado
  for (const [indexName, homIndexInfo] of homTable.indexes) {
    if (prodTable.indexes.has(indexName)) {
      const prodIndexInfo = prodTable.indexes.get(indexName);
      if (prodIndexInfo.definition !== homIndexInfo.definition) {
        alters.push(
          `ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\`;`
        );
        alters.push(
          `ALTER TABLE \`${tableName}\` ADD ${homIndexInfo.definition};`
        );
      }
    }
  }

  return alters;
}

// Função para comparar constraints e gerar ALTER TABLE
function generateConstraintAlters(tableName, prodTable, homTable) {
  const alters = [];

  // Verificar constraints que existem em homologação mas não em produção (ADD CONSTRAINT)
  for (const [constraintName, constraintInfo] of homTable.constraints) {
    if (!prodTable.constraints.has(constraintName)) {
      if (constraintInfo.type === "PRIMARY KEY") {
        alters.push(
          `ALTER TABLE \`${tableName}\` ADD PRIMARY KEY (${constraintInfo.columns
            .map((col) => `\`${col}\``)
            .join(", ")});`
        );
      } else if (constraintInfo.type === "FOREIGN KEY") {
        alters.push(
          `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\` ${constraintInfo.definition};`
        );
      } else if (constraintInfo.type === "UNIQUE KEY") {
        alters.push(
          `ALTER TABLE \`${tableName}\` ADD ${constraintInfo.definition};`
        );
      }
    }
  }

  // Verificar constraints que existem em produção mas não em homologação (DROP CONSTRAINT)
  for (const [constraintName, constraintInfo] of prodTable.constraints) {
    if (!homTable.constraints.has(constraintName)) {
      if (constraintInfo.type === "PRIMARY KEY") {
        alters.push(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY;`);
      } else if (constraintInfo.type === "FOREIGN KEY") {
        alters.push(
          `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\`;`
        );
      } else {
        alters.push(
          `ALTER TABLE \`${tableName}\` DROP INDEX \`${constraintName}\`;`
        );
      }
    }
  }

  // Verificar constraints que podem ter mudado
  for (const [constraintName, homConstraintInfo] of homTable.constraints) {
    if (prodTable.constraints.has(constraintName)) {
      const prodConstraintInfo = prodTable.constraints.get(constraintName);
      if (prodConstraintInfo.definition !== homConstraintInfo.definition) {
        // Remover a constraint antiga
        if (prodConstraintInfo.type === "PRIMARY KEY") {
          alters.push(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY;`);
        } else if (prodConstraintInfo.type === "FOREIGN KEY") {
          alters.push(
            `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\`;`
          );
        } else {
          alters.push(
            `ALTER TABLE \`${tableName}\` DROP INDEX \`${constraintName}\`;`
          );
        }

        // Adicionar a nova constraint
        if (homConstraintInfo.type === "PRIMARY KEY") {
          alters.push(
            `ALTER TABLE \`${tableName}\` ADD PRIMARY KEY (${homConstraintInfo.columns
              .map((col) => `\`${col}\``)
              .join(", ")});`
          );
        } else if (homConstraintInfo.type === "FOREIGN KEY") {
          alters.push(
            `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\` ${homConstraintInfo.definition};`
          );
        } else if (homConstraintInfo.type === "UNIQUE KEY") {
          alters.push(
            `ALTER TABLE \`${tableName}\` ADD ${homConstraintInfo.definition};`
          );
        }
      }
    }
  }

  return alters;
}
// Função para comparar schemas e gerar SQL de diferenças
function generateDiffSQL(prodSchema, homSchema) {
  const { tables: prodTables, views: prodViews } = extractTableInfo(prodSchema);
  const { tables: homTables, views: homViews } = extractTableInfo(homSchema);

  let diffSql = [];

  // Comentário inicial
  diffSql.push("-- Script de atualização gerado automaticamente");
  diffSql.push("-- ATENÇÃO: Revise este script antes de executar em produção");
  diffSql.push("-- Execute cada comando com cuidado e faça backup antes!");
  diffSql.push("-- Recomenda-se executar em ambiente de teste primeiro");
  diffSql.push("");

  // ETAPA 1: Criar tabelas que existem em homologação mas não em produção
  diffSql.push("-- ========================================");
  diffSql.push("-- ETAPA 1: CRIAÇÃO DE NOVAS TABELAS");
  diffSql.push("-- ========================================");
  diffSql.push("");

  let hasNewTables = false;
  for (const tableName in homTables) {
    if (!prodTables[tableName]) {
      hasNewTables = true;
      diffSql.push(
        `-- Criando tabela '${tableName}' que não existe em produção`
      );
      diffSql.push(homTables[tableName].originalSql + ";");
      diffSql.push("");
    }
  }

  if (!hasNewTables) {
    diffSql.push("-- Nenhuma nova tabela encontrada");
    diffSql.push("");
  }

  // ETAPA 2: Alertar sobre tabelas que existem em produção mas não em homologação
  diffSql.push("-- ========================================");
  diffSql.push("-- ETAPA 2: TABELAS QUE PODEM SER REMOVIDAS");
  diffSql.push("-- ========================================");
  diffSql.push("");

  let hasDroppedTables = false;
  for (const tableName in prodTables) {
    if (!homTables[tableName]) {
      hasDroppedTables = true;
      diffSql.push(
        `-- ATENÇÃO: Tabela '${tableName}' existe em produção mas não em homologação`
      );
      diffSql.push(`-- Descomente a linha abaixo apenas se tiver certeza:`);
      diffSql.push(`-- DROP TABLE IF EXISTS \`${tableName}\`;`);
      diffSql.push("");
    }
  }

  if (!hasDroppedTables) {
    diffSql.push("-- Nenhuma tabela para remoção encontrada");
    diffSql.push("");
  }

  // ETAPA 3: Modificar tabelas existentes
  diffSql.push("-- ========================================");
  diffSql.push("-- ETAPA 3: ALTERAÇÕES EM TABELAS EXISTENTES");
  diffSql.push("-- ========================================");
  diffSql.push("");

  let hasTableChanges = false;
  for (const tableName in homTables) {
    if (prodTables[tableName]) {
      const prodTable = prodTables[tableName];
      const homTable = homTables[tableName];

      // Gerar alterações para colunas
      const columnAlters = generateColumnAlters(tableName, prodTable, homTable);

      // Gerar alterações para índices
      const indexAlters = generateIndexAlters(tableName, prodTable, homTable);

      // Gerar alterações para constraints
      const constraintAlters = generateConstraintAlters(
        tableName,
        prodTable,
        homTable
      );

      // Processar ALTERs encontrados nos dumps
      const existingAlters = homTable.alters || [];

      // Se há alterações, adicionar ao script
      if (
        columnAlters.length > 0 ||
        indexAlters.length > 0 ||
        constraintAlters.length > 0 ||
        existingAlters.length > 0
      ) {
        hasTableChanges = true;
        diffSql.push(`-- Alterações na tabela '${tableName}'`);
        diffSql.push(
          `-- Produção: ${prodTable.columns.size} colunas, ${prodTable.indexes.size} índices, ${prodTable.constraints.size} constraints`
        );
        diffSql.push(
          `-- Homologação: ${homTable.columns.size} colunas, ${homTable.indexes.size} índices, ${homTable.constraints.size} constraints`
        );

        // Debug: Listar colunas para verificação
        if (columnAlters.length > 0) {
          diffSql.push(
            `-- Colunas em produção: ${Array.from(
              prodTable.columns.keys()
            ).join(", ")}`
          );
          diffSql.push(
            `-- Colunas em homologação: ${Array.from(
              homTable.columns.keys()
            ).join(", ")}`
          );
        }

        diffSql.push("");

        // Primeiro, remover constraints que conflitam
        constraintAlters.forEach((alter) => {
          if (alter.includes("DROP")) {
            diffSql.push(alter);
          }
        });

        // Depois, modificar/adicionar colunas
        columnAlters.forEach((alter) => {
          diffSql.push(alter);
        });

        // Depois, modificar índices
        indexAlters.forEach((alter) => {
          diffSql.push(alter);
        });

        // Por último, adicionar novas constraints
        constraintAlters.forEach((alter) => {
          if (alter.includes("ADD")) {
            diffSql.push(alter);
          }
        });

        // Adicionar ALTERs encontrados nos dumps
        existingAlters.forEach((alter) => {
          diffSql.push(`-- ALTER encontrado em homologação:`);
          diffSql.push(alter + ";");
        });

        diffSql.push("");
      }
    }
  }

  if (!hasTableChanges) {
    diffSql.push("-- Nenhuma alteração em tabelas existentes encontrada");
    diffSql.push("");
  }

  // ETAPA 4: Gerenciar Views
  diffSql.push("-- ========================================");
  diffSql.push("-- ETAPA 4: GERENCIAMENTO DE VIEWS");
  diffSql.push("-- ========================================");
  diffSql.push("");

  const viewAlters = generateViewAlters(prodViews, homViews);
  if (viewAlters.length > 0) {
    diffSql.push("-- Alterações nas views:");
    diffSql.push(`-- Produção: ${Object.keys(prodViews).length} views`);
    diffSql.push(`-- Homologação: ${Object.keys(homViews).length} views`);
    diffSql.push("");

    viewAlters.forEach((alter) => {
      diffSql.push(alter);
    });
  } else {
    diffSql.push("-- Nenhuma alteração em views encontrada");
    diffSql.push("");
  }

  // ETAPA 5: Resumo final
  diffSql.push("-- ========================================");
  diffSql.push("-- RESUMO DO SCRIPT");
  diffSql.push("-- ========================================");

  const newTablesCount = Object.keys(homTables).filter(
    (t) => !prodTables[t]
  ).length;
  const droppedTablesCount = Object.keys(prodTables).filter(
    (t) => !homTables[t]
  ).length;
  const modifiedTablesCount = Object.keys(homTables).filter((t) => {
    if (!prodTables[t]) return false;
    const prodTable = prodTables[t];
    const homTable = homTables[t];
    return (
      generateColumnAlters(t, prodTable, homTable).length > 0 ||
      generateIndexAlters(t, prodTable, homTable).length > 0 ||
      generateConstraintAlters(t, prodTable, homTable).length > 0 ||
      (homTable.alters && homTable.alters.length > 0)
    );
  }).length;

  const newViewsCount = Object.keys(homViews).filter(
    (v) => !prodViews[v]
  ).length;
  const droppedViewsCount = Object.keys(prodViews).filter(
    (v) => !homViews[v]
  ).length;
  const modifiedViewsCount = Object.keys(homViews).filter((v) => {
    if (!prodViews[v]) return false;
    const prodView = prodViews[v];
    const homView = homViews[v];
    const prodDef = prodView.definition
      ? prodView.definition.replace(/\s+/g, " ").trim()
      : "";
    const homDef = homView.definition
      ? homView.definition.replace(/\s+/g, " ").trim()
      : "";
    return prodDef !== homDef;
  }).length;

  diffSql.push(`-- Tabelas a serem criadas: ${newTablesCount}`);
  diffSql.push(`-- Tabelas a serem removidas: ${droppedTablesCount}`);
  diffSql.push(`-- Tabelas a serem modificadas: ${modifiedTablesCount}`);
  diffSql.push(`-- Views a serem criadas: ${newViewsCount}`);
  diffSql.push(`-- Views a serem removidas: ${droppedViewsCount}`);
  diffSql.push(`-- Views a serem modificadas: ${modifiedViewsCount}`);
  diffSql.push("");

  if (
    newTablesCount === 0 &&
    droppedTablesCount === 0 &&
    modifiedTablesCount === 0 &&
    newViewsCount === 0 &&
    droppedViewsCount === 0 &&
    modifiedViewsCount === 0
  ) {
    diffSql.push("-- ✅ Os schemas estão sincronizados!");
  } else {
    diffSql.push(
      "-- ⚠️  LEMBRE-SE: Teste este script em ambiente de desenvolvimento primeiro!"
    );
  }

  return diffSql.join("\n");
}

// Rota principal para servir o HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Rota para lidar com a comparação
app.post("/compare", async (req, res) => {
  console.log("📁 Recebendo arquivos para comparação...");

  // 1. Validação dos arquivos
  if (!req.files || !req.files.producao || !req.files.homologacao) {
    return res
      .status(400)
      .json({ error: "Por favor, envie os dois arquivos SQL." });
  }

  try {
    // 2. Leitura do conteúdo dos arquivos
    console.log("📖 Lendo arquivos SQL...");
    const schemaProducao = req.files.producao.data.toString("utf8");
    const schemaHomologacao = req.files.homologacao.data.toString("utf8");

    console.log(`📊 Arquivo produção: ${schemaProducao.length} caracteres`);
    console.log(
      `📊 Arquivo homologação: ${schemaHomologacao.length} caracteres`
    );

    // 3. Extrair informações das tabelas
    console.log("🔍 Extraindo informações das tabelas...");
    const { tables: prodTables, views: prodViews } =
      extractTableInfo(schemaProducao);
    const { tables: homTables, views: homViews } =
      extractTableInfo(schemaHomologacao);

    console.log(
      `📋 Tabelas encontradas em produção: ${Object.keys(prodTables).length}`
    );
    console.log(
      `📋 Tabelas encontradas em homologação: ${Object.keys(homTables).length}`
    );
    console.log(
      `👁️ Views encontradas em produção: ${Object.keys(prodViews).length}`
    );
    console.log(
      `👁️ Views encontradas em homologação: ${Object.keys(homViews).length}`
    );

    // Log das views encontradas
    console.log("📋 Views em produção:", Object.keys(prodViews));
    console.log("📋 Views em homologação:", Object.keys(homViews));

    // Log específico para tabela 'sale'
    if (prodTables.sale) {
      console.log(
        `🔍 Tabela 'sale' produção: ${prodTables.sale.columns.size} colunas`
      );
      console.log(
        `🔍 Colunas: ${Array.from(prodTables.sale.columns.keys()).join(", ")}`
      );
    }

    if (homTables.sale) {
      console.log(
        `🔍 Tabela 'sale' homologação: ${homTables.sale.columns.size} colunas`
      );
      console.log(
        `🔍 Colunas: ${Array.from(homTables.sale.columns.keys()).join(", ")}`
      );
    }

    // 4. Gerar o script de diferenças
    console.log("⚡ Gerando script de diferenças...");
    const diffSql = generateDiffSQL(schemaProducao, schemaHomologacao);
    console.log("✅ Script gerado com sucesso!");

    // 5. Enviar o resultado de volta como JSON
    res.status(200).json({ diff_sql: diffSql });
  } catch (error) {
    // Captura erros de parsing ou outros problemas
    console.error("❌ Erro ao processar os schemas:", error);
    res.status(500).json({
      error: `Ocorreu um erro no servidor: ${error.message}. Verifique se os arquivos são dumps de schema válidos.`,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});

// Exportar funções para teste
module.exports = {
  extractTableInfo,
  generateDiffSQL,
};
