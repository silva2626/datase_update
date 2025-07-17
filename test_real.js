// Simulando o teste com código real
const testSQL = `
-- Estrutura para view message_view
DROP TABLE IF EXISTS message_view;
CREATE ALGORITHM=UNDEFINED DEFINER=root@localhost SQL SECURITY DEFINER VIEW message_view AS SELECT DISTINCT m.to_system_user_id FROM message AS m;

-- Estrutura para view v_affiliates  
DROP TABLE IF EXISTS v_affiliates;
CREATE ALGORITHM=UNDEFINED DEFINER=root@% SQL SECURITY DEFINER VIEW v_affiliates AS SELECT u.id, u.name FROM system_users AS u WHERE u.is_affiliate = 'y';
`;

console.log("=== Teste com SQL real ===");
console.log("SQL:", testSQL);

// Simular o processamento
let cleanedContent = testSQL
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*$/gm, "")
  .replace(/\s+/g, " ");

console.log("\nSQL limpo:", cleanedContent);

const lines = cleanedContent.split(";");
console.log("\nLinhas divididas:", lines);

const statements = [];
for (let i = 0; i < lines.length; i++) {
  let line = lines[i].trim();
  if (!line) continue;

  console.log(`\nProcessando linha ${i}: "${line}"`);

  if (
    line.toUpperCase().includes("CREATE") &&
    line.toUpperCase().includes("VIEW")
  ) {
    console.log("  -> Detectou CREATE VIEW");
    statements.push(line);
  }

  if (
    line.toUpperCase().includes("DROP") &&
    line.toUpperCase().includes("VIEW")
  ) {
    console.log("  -> Detectou DROP VIEW");
    statements.push(line);
  }
}

console.log("\nStatements finais:", statements);
