console.log("Testando import...");

try {
  const { extractTableInfo } = require("./server.js");
  console.log("Import bem-sucedido!");

  const testSQL = `
  CREATE TABLE teste (id int);
  DROP TABLE IF EXISTS v_test;
  CREATE VIEW v_test AS SELECT * FROM teste;
  `;

  const result = extractTableInfo(testSQL);
  console.log("Result:", result);
} catch (error) {
  console.error("Erro:", error.message);
  console.error("Stack:", error.stack);
}
