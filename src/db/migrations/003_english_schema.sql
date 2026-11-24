CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  regular_maintenance INTEGER NOT NULL DEFAULT 0 CHECK (regular_maintenance IN (0, 1)),
  maintenance_interval_days INTEGER CHECK (
    maintenance_interval_days IS NULL
    OR (maintenance_interval_days >= 1 AND maintenance_interval_days <= 3650)
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO categories (
  id, name, description, active, regular_maintenance, maintenance_interval_days, created_at, updated_at
)
SELECT
  id, nome, descricao, ativo, manutencao_regular, intervalo_manutencao_dias, created_at, updated_at
FROM categorias;

CREATE UNIQUE INDEX idx_categories_name ON categories(name);

CREATE TABLE sectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO sectors (id, name, description, active, created_at, updated_at)
SELECT id, nome, descricao, ativo, created_at, updated_at
FROM setores;

CREATE UNIQUE INDEX idx_sectors_name ON sectors(name);

CREATE TABLE equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_tag TEXT NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  location TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('in_use','in_stock','in_maintenance','written_off')),
  acquired_on TEXT,
  acquisition_value_cents INTEGER CHECK (acquisition_value_cents IS NULL OR acquisition_value_cents >= 0),
  supplier TEXT,
  invoice TEXT,
  warranty_until TEXT,
  notes TEXT,
  write_off_reason TEXT,
  written_off_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'written_off' AND written_off_on IS NOT NULL AND write_off_reason IS NOT NULL AND length(trim(write_off_reason)) >= 3)
    OR (status <> 'written_off' AND written_off_on IS NULL AND write_off_reason IS NULL)
  )
);

INSERT INTO equipment (
  id, asset_tag, name, description, category_id, sector_id, location,
  brand, model, serial_number, status, acquired_on, acquisition_value_cents,
  supplier, invoice, warranty_until, notes, write_off_reason, written_off_on,
  created_at, updated_at
)
SELECT
  id,
  tombamento,
  nome,
  descricao,
  categoria_id,
  setor_id,
  complemento_local,
  marca,
  modelo,
  numero_serie,
  CASE status
    WHEN 'em_uso' THEN 'in_use'
    WHEN 'em_estoque' THEN 'in_stock'
    WHEN 'em_manutencao' THEN 'in_maintenance'
    WHEN 'baixado' THEN 'written_off'
    ELSE status
  END,
  data_aquisicao,
  valor_aquisicao_centavos,
  fornecedor,
  nota_fiscal,
  garantia_ate,
  observacoes,
  motivo_baixa,
  data_baixa,
  created_at,
  updated_at
FROM equipamentos;

CREATE UNIQUE INDEX idx_equipment_asset_tag ON equipment(asset_tag);
CREATE UNIQUE INDEX idx_equipment_serial ON equipment(serial_number)
  WHERE serial_number IS NOT NULL AND length(trim(serial_number)) > 0;

CREATE TABLE transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  from_sector_id INTEGER REFERENCES sectors(id) ON DELETE RESTRICT,
  to_sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
  from_location TEXT,
  to_location TEXT,
  reason TEXT NOT NULL,
  transferred_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO transfers (
  id, equipment_id, from_sector_id, to_sector_id, from_location, to_location,
  reason, transferred_on, created_at
)
SELECT
  id, equipamento_id, setor_origem_id, setor_destino_id, complemento_origem,
  complemento_destino, motivo, data_movimentacao, created_at
FROM movimentacoes;

CREATE INDEX idx_transfers_equipment ON transfers(equipment_id, transferred_on DESC, id DESC);

CREATE TABLE maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('preventive','corrective')),
  state TEXT NOT NULL CHECK (state IN ('open','completed','cancelled')),
  opened_on TEXT NOT NULL,
  completed_on TEXT,
  problem TEXT NOT NULL,
  solution TEXT,
  cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
  service_provider TEXT,
  cancellation_reason TEXT,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('in_use','in_stock','in_maintenance','written_off')),
  equipment_status_after TEXT CHECK (equipment_status_after IS NULL OR equipment_status_after IN ('in_use','in_stock','written_off')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (state = 'open' AND completed_on IS NULL AND solution IS NULL AND cancellation_reason IS NULL AND equipment_status_after IS NULL)
    OR (state = 'completed' AND completed_on IS NOT NULL AND solution IS NOT NULL AND length(trim(solution)) >= 3 AND cancellation_reason IS NULL AND equipment_status_after IS NOT NULL)
    OR (state = 'cancelled' AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) >= 3 AND equipment_status_after IS NULL)
  )
);

INSERT INTO maintenance (
  id, equipment_id, type, state, opened_on, completed_on, problem, solution,
  cost_cents, service_provider, cancellation_reason, previous_status,
  equipment_status_after, created_at, updated_at
)
SELECT
  id,
  equipamento_id,
  CASE tipo
    WHEN 'preventiva' THEN 'preventive'
    WHEN 'corretiva' THEN 'corrective'
    ELSE tipo
  END,
  CASE situacao
    WHEN 'aberta' THEN 'open'
    WHEN 'concluida' THEN 'completed'
    WHEN 'cancelada' THEN 'cancelled'
    ELSE situacao
  END,
  data_abertura,
  data_conclusao,
  descricao_problema,
  solucao,
  custo_centavos,
  fornecedor_assistencia,
  motivo_cancelamento,
  CASE status_anterior
    WHEN 'em_uso' THEN 'in_use'
    WHEN 'em_estoque' THEN 'in_stock'
    WHEN 'em_manutencao' THEN 'in_maintenance'
    WHEN 'baixado' THEN 'written_off'
    ELSE status_anterior
  END,
  CASE status_equipamento_apos
    WHEN 'em_uso' THEN 'in_use'
    WHEN 'em_estoque' THEN 'in_stock'
    WHEN 'baixado' THEN 'written_off'
    ELSE status_equipamento_apos
  END,
  created_at,
  updated_at
FROM manutencoes;

CREATE UNIQUE INDEX idx_maintenance_one_open ON maintenance(equipment_id) WHERE state = 'open';
CREATE INDEX idx_maintenance_equipment ON maintenance(equipment_id, opened_on DESC, id DESC);

DROP TABLE movimentacoes;
DROP TABLE manutencoes;
DROP TABLE equipamentos;
DROP TABLE setores;
DROP TABLE categorias;

DELETE FROM sqlite_sequence
WHERE name IN ('categorias', 'setores', 'equipamentos', 'movimentacoes', 'manutencoes');
