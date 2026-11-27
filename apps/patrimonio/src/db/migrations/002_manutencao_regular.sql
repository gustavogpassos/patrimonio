ALTER TABLE categorias ADD COLUMN manutencao_regular INTEGER NOT NULL DEFAULT 0
  CHECK (manutencao_regular IN (0, 1));
ALTER TABLE categorias ADD COLUMN intervalo_manutencao_dias INTEGER
  CHECK (
    intervalo_manutencao_dias IS NULL
    OR (intervalo_manutencao_dias >= 1 AND intervalo_manutencao_dias <= 3650)
  );
