console.log("Iniciando teste...");

const testSQL =
  "CREATE TABLE teste (id int); DROP TABLE IF EXISTS v_test; CREATE VIEW v_test AS SELECT * FROM teste;";

console.log("SQL original:", testSQL);

const lines = testSQL.split(";");
console.log("Dividido por ;:", lines);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  console.log(`Linha ${i}: "${line}"`);
}

console.log("Fim do teste.");
