const { extractTableInfo, generateDiffSQL } = require("./server.js");

// Teste simples para verificar se as views estão sendo detectadas
const testHomologacao = `
-- Estrutura para tabela teste
CREATE TABLE teste (
  id int(11) NOT NULL
);

-- Estrutura para view message_view
DROP TABLE IF EXISTS message_view;
CREATE ALGORITHM=UNDEFINED DEFINER=root@localhost SQL SECURITY DEFINER VIEW message_view AS SELECT DISTINCT m.to_system_user_id FROM message AS m;

-- Estrutura para view v_affiliates
DROP TABLE IF EXISTS v_affiliates;
CREATE ALGORITHM=UNDEFINED DEFINER=root@% SQL SECURITY DEFINER VIEW v_affiliates AS SELECT u.id, u.name FROM system_users AS u WHERE u.is_affiliate = 'y';
`;

const testProducao = `
-- Estrutura para tabela teste
CREATE TABLE teste (
  id int(11) NOT NULL
);

-- Estrutura para view message_view
DROP TABLE IF EXISTS message_view;
CREATE ALGORITHM=UNDEFINED DEFINER=root@localhost SQL SECURITY DEFINER VIEW message_view AS SELECT DISTINCT m.to_system_user_id FROM message AS m;
`;

console.log("=== TESTE DE PARSING DE VIEWS ===");

const { tables: prodTables, views: prodViews } = extractTableInfo(testProducao);
const { tables: homTables, views: homViews } =
  extractTableInfo(testHomologacao);

console.log("Views em produção:", Object.keys(prodViews));
console.log("Views em homologação:", Object.keys(homViews));

console.log("\n=== DETALHES DAS VIEWS ===");
console.log("Produção - message_view:", prodViews.message_view);
console.log("Homologação - message_view:", homViews.message_view);
console.log("Homologação - v_affiliates:", homViews.v_affiliates);

console.log("\n=== SCRIPT GERADO ===");
const diffSql = generateDiffSQL(testProducao, testHomologacao);
console.log(diffSql);

console.log("=== Diferenças ===");
for (const [columnName, columnInfo] of homTables.sale.columns) {
  if (!prodTables.sale.columns.has(columnName)) {
    console.log(`Nova coluna: ${columnName} - ${columnInfo.definition}`);
  }
}
